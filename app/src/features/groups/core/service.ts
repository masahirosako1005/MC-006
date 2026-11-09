// 01 のサービス関数(契約 7.1)。他モジュールはここから import する。
import type { DemoUser, Id, IsoDateTime } from "@/lib/groups-types";
import { db, newId, tx } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import { emit } from "@/lib/events";
import { conflict, invalidInput, notFound, unavailableState } from "@/lib/errors";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type {
  CreateGroupInput, EditableField, Group, GroupDetailView, GroupMember, InviteCodeView, MemberRole,
  MemberView, UpdateGroupPatch,
} from "@/features/groups/types";
import { assertGroupAccess } from "@/features/safety/guards/access";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { visibleProfile } from "@/features/safety/visibility/profile";
import { ORGANIZER_GROUP_LIMIT } from "./constants";
import { GROUP_MESSAGES as M } from "./messages";
import { activeMembers, isOrganizer } from "./permissions";
import { editableFields } from "./policy";
import { countActiveMembers } from "./repository";
import { generateInviteCode, hasActiveInviteCode, toInviteCodeView } from "./inviteCode";
import { validateCreateGroupInput, validateUpdateGroupPatch } from "./validation";

export { getGroupById, listAllGroups, countActiveMembers, applyLifecyclePatch } from "./repository";
export { normalizeInviteCode, findGroupByInviteCode, assertInviteCode } from "./inviteCode";
export { isMember, isOrganizer, activeMembers } from "./permissions";
export { editableFields } from "./policy";

const TERMINAL = new Set(["completed", "cancelled", "replanned"]);

function assertRegion(regionId: Id, campaign: string): void {
  const r = db().regions.get(regionId);
  if (!r || r.campaign !== campaign) throw invalidInput({ region: M.invalidRegion });
}

function insertGroup(
  input: CreateGroupInput & { official?: boolean; organizerId: Id; lifecycle: GroupLifecycle },
): Group {
  const checked = validateCreateGroupInput(input, clock.today());
  assertRegion(checked.region, checked.campaign);
  return tx(() => {
    const now = clock.nowIso();
    const group: Group = {
      id: newId("g"),
      ...checked,
      official: input.official === true,
      organizerId: input.organizerId,
      inviteCode: checked.visibility === "private" ? generateInviteCode() : null,
      lifecycle: input.lifecycle,
      createdAt: now,
      updatedAt: now,
    };
    db().groups.insert(group);
    db().members.insert({
      id: newId("m"), groupId: group.id, userId: input.organizerId, role: "organizer",
      status: "active", joinedAt: now, leftAt: null,
    });
    emit({ type: "group_created", groupId: group.id, organizerId: input.organizerId, at: now });
    return group;
  });
}

export function createGroup(user: DemoUser, input: CreateGroupInput, lifecycle: GroupLifecycle): Group {
  const running = db().groups.count((g) => g.organizerId === user.id && !TERMINAL.has(g.lifecycle.status));
  if (running >= ORGANIZER_GROUP_LIMIT) {
    throw conflict(M.organizerGroupLimit, { reason: "organizer_group_limit" });
  }
  return insertGroup({ ...input, organizerId: user.id, lifecycle });
}

export function createGroupInternal(
  input: CreateGroupInput & { official?: boolean; organizerId: Id; lifecycle: GroupLifecycle },
): Group {
  return insertGroup(input);
}

export function getGroup(user: DemoUser, id: Id): GroupDetailView {
  const g = assertGroupAccess(user.id, id, "member");
  const role: MemberRole = isOrganizer(user.id, id) ? "organizer" : "member";
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { inviteCode: _omit, ...rest } = g;
  return {
    kind: "member",
    group: rest,
    role,
    activeCount: countActiveMembers(id),
    canEdit: role === "organizer" && editableFields(g.lifecycle.status).size > 0,
    hasActiveInviteCode: hasActiveInviteCode(g),
  };
}

const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function updateGroup(
  user: DemoUser, id: Id, patch: UpdateGroupPatch, opts?: { ackReview?: boolean },
): Group {
  const g = assertGroupAccess(user.id, id, "organizer");
  const p = validateUpdateGroupPatch(patch, clock.today());
  const changed = (Object.keys(p) as EditableField[]).filter((k) => !sameJson(p[k], g[k]));
  if (changed.length === 0) return g as Group;

  const allowed = editableFields(g.lifecycle.status);
  if (changed.some((k) => !allowed.has(k))) {
    throw unavailableState(M.fieldNotEditable, { detail: { state: g.lifecycle.status } });
  }
  if (p.region !== undefined) assertRegion(p.region, g.campaign);

  const ack = { ackReview: opts?.ackReview };
  if (changed.includes("name")) assertTextAllowed(p.name!, "group_name", "name", ack);
  if (changed.includes("description")) assertTextAllowed(p.description!, "group_description", "description", ack);
  if (changed.includes("tags")) p.tags!.forEach((t, i) => assertTextAllowed(t, "group_tag", `tags.${i}`, ack));
  if (changed.includes("trip")) {
    assertTextAllowed(p.trip!.destination, "group_destination", "trip.destination", ack);
    assertTextAllowed(p.trip!.dateNote, "group_date_note", "trip.dateNote", ack);
  }

  const next = { ...g, ...p } as Group;
  // INV-3(人数)・INV-4(日程と締切)
  const active = countActiveMembers(id);
  const min = g.lifecycle.minMembers;
  if (next.capacity < active || next.capacity < min || (next.capacity === 2 && min !== 2)) {
    throw conflict(`現在 ${active} 人、最少 ${min} 人のため、上限は ${Math.max(active, min)} 人以上にしてください`, {
      reason: "capacity_below_members",
    });
  }
  if (g.lifecycle.deadlineDate >= next.trip.startDate) {
    throw invalidInput({ "trip.startDate": M.deadlineBeforeStart });
  }

  return tx(() => {
    let inviteCode = g.inviteCode;
    if (next.visibility === "public") inviteCode = null;
    else if (!hasActiveInviteCode(g)) inviteCode = generateInviteCode();
    return db().groups.update(id, { ...p, inviteCode, updatedAt: clock.nowIso() }) as Group;
  });
}

export function listMembers(user: DemoUser, id: Id): MemberView[] {
  assertGroupAccess(user.id, id, "member");
  return activeMembers(id).map((m) => {
    const p = visibleProfile({ id: user.id }, m.userId, { kind: "member", groupId: id });
    return {
      userId: m.userId,
      displayName: p.displayName,
      ageBand: p.ageBand ?? null,
      role: m.role,
      joinedAt: m.joinedAt,
      isSelf: m.userId === user.id,
    };
  });
}

export function addMember(groupId: Id, userId: Id, role: MemberRole = "member"): Readonly<GroupMember> {
  return tx(() => {
    const g = db().groups.get(groupId);
    if (!g) throw notFound("グループ");
    if (db().members.find((m) => m.groupId === groupId && m.userId === userId && m.status === "active")) {
      throw conflict(M.alreadyMember, { reason: "already_member" });
    }
    if (countActiveMembers(groupId) >= g.capacity) throw conflict(M.groupFull, { reason: "group_full" });
    const now = clock.nowIso();
    const row = db().members.insert({
      id: newId("m"), groupId, userId, role, status: "active", joinedAt: now, leftAt: null,
    });
    emit({ type: "member_joined", groupId, userId, at: now });
    return row;
  });
}

export function markMemberLeft(groupId: Id, userId: Id, at: IsoDateTime): Readonly<GroupMember> {
  const row = db().members.find((m) => m.groupId === groupId && m.userId === userId && m.status === "active");
  if (!row) throw notFound("メンバー");
  return db().members.update(row.id, { status: "left", leftAt: at });
}

function organizerGroup(user: DemoUser, id: Id): Readonly<Group> {
  return assertGroupAccess(user.id, id, "organizer");
}

function assertInviteOperable(g: Readonly<Group>): void {
  if (TERMINAL.has(g.lifecycle.status)) {
    throw unavailableState(M.inviteTerminal, { detail: { state: g.lifecycle.status } });
  }
  if (g.visibility === "public") throw conflict(M.groupIsPublic, { reason: "group_is_public" });
}

export function issueInviteCode(user: DemoUser, id: Id): InviteCodeView {
  const g = organizerGroup(user, id);
  assertInviteOperable(g);
  if (hasActiveInviteCode(g)) return toInviteCodeView(g.inviteCode!);
  const code = generateInviteCode();
  db().groups.update(id, { inviteCode: code, updatedAt: clock.nowIso() });
  return toInviteCodeView(code);
}

export function reissueInviteCode(user: DemoUser, id: Id): InviteCodeView {
  const g = organizerGroup(user, id);
  assertInviteOperable(g);
  const code = generateInviteCode();
  db().groups.update(id, { inviteCode: code, updatedAt: clock.nowIso() });
  return toInviteCodeView(code);
}

export function getInviteCode(user: DemoUser, id: Id): InviteCodeView | null {
  const g = organizerGroup(user, id);
  return g.inviteCode ? toInviteCodeView(g.inviteCode) : null;
}
