// 申請・承認・却下・取り下げ(JOIN-FN-02〜08・12)。
import { clock } from "@/lib/clock";
import { db, newId, tx } from "@/lib/groups-store";
import type { DemoUser, Id, Page } from "@/lib/groups-types";
import { AppError, conflict, forbidden, invalidInput, unavailableState } from "@/lib/errors";
import { isMember, isOrganizer } from "@/lib/authz";
import { LIMITS } from "@/lib/limits";
import { paginate } from "@/lib/query";
import type { Group } from "@/features/groups/types";
import { canAcceptRequests } from "@/features/groups/lifecycle/policy";
import { notAcceptingReason } from "@/features/groups/lifecycle/rules";
import { onMembershipChanged } from "@/features/groups/lifecycle/evaluate";
import { addMember, countActiveMembers } from "@/features/groups/core/service";
import { notify } from "@/features/notify/service";
import { checkRate } from "@/features/safety/guards/rate-limit";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { assertNotBlocked, isBlocked } from "@/features/safety/blocks/block-service";
import { visibleProfile } from "@/features/safety/visibility/profile";
import { REJECT_REASONS, REJECT_REASON_IDS } from "./constants";
import { JOIN_ERRORS, consentText } from "./messages";
import { assertCanRequest, checkWith } from "./preconditions";
import { countPendingRequests } from "./stats";
import type {
  ApproveResult, JoinReason, JoinRequest, JoinRequestStatus, JoinRequestView, MyRequestState,
  OrganizerRequestList, OrganizerRequestView, RejectReasonId, RequestJoinInput,
} from "./types";

const reasonErr = (code: "not_found", reason: keyof typeof JOIN_ERRORS) =>
  new AppError(code, JOIN_ERRORS[reason], { reason });

function getGroup(groupId: Id): Readonly<Group> {
  const g = db().groups.get(groupId);
  if (!g) throw reasonErr("not_found", "group_not_found");
  return g;
}

/** 申請を取り、URL のグループのものか確認する(他グループの申請は 404)。 */
function getRequest(groupId: Id, requestId: Id): Readonly<JoinRequest> {
  const r = db().joinRequests.get(requestId);
  if (!r || r.groupId !== groupId) throw reasonErr("not_found", "request_not_found");
  return r;
}

export function toJoinRequestView(req: JoinRequest): JoinRequestView {
  return {
    id: req.id,
    groupId: req.groupId,
    status: req.status,
    note: req.note,
    createdAt: req.createdAt,
    decidedAt: req.decidedAt,
    rejectReasonLabel: req.reasonId ? REJECT_REASONS[req.reasonId] : null,
  };
}

export function requestJoin(user: DemoUser, groupId: Id, input: RequestJoinInput): JoinRequest {
  return tx((d) => {
    const group = getGroup(groupId);
    const note = input.note ?? "";
    assertCanRequest(user, group, {
      inviteCode: input.inviteCode,
      consentedMinMembers: input.consentedMinMembers,
      between: () => {
        checkRate("join_request", user.id);
        // 5 内容の検査
        if (note.split("\n").length > LIMITS.JOIN_NOTE.maxLines) {
          throw invalidInput({ note: JOIN_ERRORS.note_lines });
        }
        if (input.consentMinMembers !== true) {
          throw invalidInput({ consentMinMembers: JOIN_ERRORS.consent_required });
        }
        if (note) assertTextAllowed(note, "join_note", "note", { ackReview: input.ackReview });
        if (input.reentryOfGroupId !== undefined) {
          const from = input.reentryOfGroupId;
          const ok = group.lifecycle.replanOfGroupId === from &&
            d.joinRequests.count((r) => r.groupId === from && r.applicantId === user.id) > 0;
          if (!ok) throw invalidInput({ reentryOfGroupId: JOIN_ERRORS.reentry_mismatch });
        }
      },
    });
    const now = clock.nowIso();
    const req = d.joinRequests.insert({
      id: newId("jr"),
      groupId,
      applicantId: user.id,
      note,
      status: "pending",
      consentMinMembers: true,
      consentAt: now,
      consentedMinMembers: input.consentedMinMembers,
      viaInviteCode: group.visibility !== "public",
      reentryOfGroupId: input.reentryOfGroupId ?? null,
      reasonId: null,
      createdAt: now,
      decidedAt: null,
      decidedBy: null,
    });
    notify({
      kind: "join_requested",
      groupId,
      eventKey: `jr:${req.id}`,
      params: { groupTitle: group.name, pendingCount: countPendingRequests(groupId) },
      recipients: [{ type: "organizer" }],
    });
    return req;
  });
}

function approveResult(req: Readonly<JoinRequest>, group: Readonly<Group>, added: boolean): ApproveResult {
  const g = db().groups.get(group.id) ?? group;
  return {
    request: toJoinRequestView(req),
    memberAdded: added,
    currentMembers: countActiveMembers(group.id),
    groupStatus: g.lifecycle.status,
  };
}

export function approve(user: DemoUser, groupId: Id, requestId: Id): ApproveResult {
  return tx((d) => {
    const group = getGroup(groupId);
    const req = getRequest(groupId, requestId);
    if (!isOrganizer(user, group)) throw forbidden(JOIN_ERRORS.not_organizer, { reason: "not_organizer" });
    if (req.status === "approved") return approveResult(req, group, false); // 冪等
    if (req.status !== "pending") throw conflict(JOIN_ERRORS.request_not_pending, { reason: "request_not_pending" });
    if (!canAcceptRequests(group)) {
      throw unavailableState(JOIN_ERRORS.closed, {
        reason: notAcceptingReason(group) ?? undefined,
        detail: { state: group.lifecycle.status },
      });
    }
    assertNotBlocked(user.id, req.applicantId);
    if (isMember(req.applicantId, group)) throw conflict(JOIN_ERRORS.already_member, { reason: "already_member" });
    if (countActiveMembers(groupId) >= group.capacity) throw conflict(JOIN_ERRORS.group_full, { reason: "group_full" });

    addMember(groupId, req.applicantId);
    const updated = d.joinRequests.update(requestId, { status: "approved", decidedAt: clock.nowIso(), decidedBy: user.id });
    onMembershipChanged(groupId);
    notify({
      kind: "join_approved",
      groupId,
      eventKey: `ja:${requestId}`,
      params: { groupTitle: group.name },
      recipients: [{ type: "users", userIds: [req.applicantId] }],
    });
    return approveResult(updated, group, true);
  });
}

export function reject(user: DemoUser, groupId: Id, requestId: Id, reasonId?: RejectReasonId): JoinRequest {
  return tx((d) => {
    const group = getGroup(groupId);
    const req = getRequest(groupId, requestId);
    if (!isOrganizer(user, group)) throw forbidden(JOIN_ERRORS.not_organizer, { reason: "not_organizer" });
    const reason = reasonId ?? "not_specified";
    if (!REJECT_REASON_IDS.includes(reason)) throw invalidInput({ reasonId: JOIN_ERRORS.reason_invalid });
    if (req.status === "rejected") return req; // 冪等
    if (req.status !== "pending") throw conflict(JOIN_ERRORS.request_not_pending, { reason: "request_not_pending" });
    const updated = d.joinRequests.update(requestId, {
      status: "rejected", reasonId: reason, decidedAt: clock.nowIso(), decidedBy: user.id,
    });
    notify({
      kind: "join_rejected",
      groupId,
      eventKey: `jx:${requestId}`,
      params: { groupTitle: group.name },
      recipients: [{ type: "users", userIds: [req.applicantId] }],
    });
    return updated;
  });
}

export function withdrawRequest(user: DemoUser, groupId: Id, requestId: Id): JoinRequest {
  return tx((d) => {
    getGroup(groupId);
    const req = getRequest(groupId, requestId);
    if (req.applicantId !== user.id) throw forbidden(JOIN_ERRORS.not_applicant, { reason: "not_applicant" });
    if (req.status === "withdrawn") return req; // 冪等
    if (req.status !== "pending") throw conflict(JOIN_ERRORS.request_not_pending, { reason: "request_not_pending" });
    return d.joinRequests.update(requestId, { status: "withdrawn", decidedAt: clock.nowIso(), decidedBy: user.id });
  });
}

function cannotApproveReason(group: Readonly<Group>, req: Readonly<JoinRequest>): JoinReason | null {
  if (req.status !== "pending") return "request_not_pending";
  if (!canAcceptRequests(group)) return notAcceptingReason(group);
  if (isMember(req.applicantId, group)) return "already_member";
  if (countActiveMembers(group.id) >= group.capacity) return "group_full";
  return null;
}

export function listRequests(
  user: DemoUser, groupId: Id, opts?: { status?: JoinRequestStatus[]; limit?: number; offset?: number },
): OrganizerRequestList {
  const group = getGroup(groupId);
  if (!isOrganizer(user, group)) throw forbidden(JOIN_ERRORS.not_organizer, { reason: "not_organizer" });
  const statuses = opts?.status?.length ? opts.status : ["pending" as const];
  const rows = db().joinRequests
    .filter((r) => r.groupId === groupId && statuses.includes(r.status) && !isBlocked(user.id, r.applicantId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  const page = paginate(rows, {
    limit: opts?.limit ?? LIMITS.PAGE.defaultLimit,
    offset: opts?.offset ?? 0,
  });
  const items: OrganizerRequestView[] = page.items.map((r) => {
    const why = cannotApproveReason(group, r);
    return {
      request: {
        ...toJoinRequestView(r),
        consentedMinMembers: r.consentedMinMembers,
        consentAt: r.consentAt,
        viaInviteCode: r.viaInviteCode,
      },
      applicant: visibleProfile(user, r.applicantId, { kind: "request", groupId }),
      canApprove: why === null,
      cannotApproveReason: why,
    };
  });
  return {
    ...page,
    items,
    capacity: {
      current: countActiveMembers(groupId),
      max: group.capacity,
      min: group.lifecycle.minMembers,
      status: group.lifecycle.status,
    },
    pendingCount: countPendingRequests(groupId),
  };
}

export function getMyRequest(user: DemoUser, groupId: Id): MyRequestState {
  const group = db().groups.get(groupId);
  const mine = group
    ? db().joinRequests
        .filter((r) => r.groupId === groupId && r.applicantId === user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))[0]
    : undefined;
  if (!group || !mine) throw reasonErr("not_found", "request_not_found");
  return {
    request: toJoinRequestView(mine),
    canApply: checkWith(user, group, { skipVisibility: true }),
    consentText: consentText(group.lifecycle.minMembers),
    consentedMinMembers: group.lifecycle.minMembers,
  };
}

export function listMyRequests(user: DemoUser, page: { limit: number; offset: number }): Page<JoinRequestView> {
  const rows = db().joinRequests
    .filter((r) => r.applicantId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  const p = paginate(rows, page);
  return { ...p, items: p.items.map(toJoinRequestView) };
}
