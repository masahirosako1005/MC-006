// 再企画(設計 04 LCY-FN-16・17、契約 5.4)。
import { clock } from "@/lib/clock";
import { conflict, forbidden, invalidInput, unavailableState } from "@/lib/errors";
import { emit } from "@/lib/events";
import { db, newId } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { activeMembers } from "@/lib/authz";
import { applyLifecyclePatch, createGroupInternal } from "@/features/groups/core/service";
import { notify } from "@/features/notify/service";
import { assertGroupAccess } from "@/features/safety/guards/access";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { requireVerified } from "@/features/safety/verification/verification-service";
import type { Group } from "@/features/groups/types";
import { LIFECYCLE_POLICY } from "./policy";
import { buildInitialLifecycle, validateLifecycleInput } from "./rules";
import { recordCreated } from "./evaluate";
import type { ReplanDraft, ReplanInput, ReplanResult } from "./types";

/** 検証(アクセス・幹事・状態)。通れば元グループを返す。 */
function loadCancelled(user: DemoUser, groupId: Id): Readonly<Group> {
  const g = assertGroupAccess(user.id, groupId, "view");
  if (g.organizerId !== user.id) throw forbidden("幹事のみができる操作です。", { reason: "not_organizer" });
  if (g.lifecycle.status === "replanned") {
    throw conflict("このグループはすでに再企画されています。", {
      reason: "already_replanned",
      detail: { replannedToGroupId: g.lifecycle.replannedToGroupId },
    });
  }
  if (g.lifecycle.status !== "cancelled") {
    throw unavailableState("中止したグループのみ再企画できます。", { reason: "not_cancelled" });
  }
  return g;
}

/** 案内の宛先: 中止時の参加者(辞退者・幹事を除く)+ 中止で失効した申請者。 */
function recipientsOf(g: Readonly<Group>): Id[] {
  const ids = new Set<Id>();
  for (const m of activeMembers(g.id)) if (m.userId !== g.organizerId) ids.add(m.userId);
  if (LIFECYCLE_POLICY.replanInvitePolicy === "members_and_pending") {
    for (const r of db().joinRequests.filter((x) => x.groupId === g.id && x.status === "expired")) {
      if (r.applicantId !== g.organizerId) ids.add(r.applicantId);
    }
  }
  return [...ids];
}

export function getReplanDraft(user: DemoUser, groupId: Id): ReplanDraft {
  const g = loadCancelled(user, groupId);
  return {
    fromGroupId: g.id,
    carried: {
      name: g.name, campaign: g.campaign, region: g.region, destination: g.trip.destination,
      capacity: g.capacity, visibility: g.visibility, tags: [...g.tags], minMembers: g.lifecycle.minMembers,
    },
    required: ["startDate", "endDate", "deadlineDate"],
    originalTrip: { startDate: g.trip.startDate, endDate: g.trip.endDate, deadlineDate: g.lifecycle.deadlineDate },
    recipientCount: recipientsOf(g).length,
  };
}

export function replan(user: DemoUser, groupId: Id, input: ReplanInput): ReplanResult {
  const g = loadCancelled(user, groupId);
  requireVerified(user.id, "create_group");
  const name = input.name ?? g.name;
  const destination = input.destination ?? g.trip.destination;
  const ackReview = input.ackReview;
  assertTextAllowed(name, "group_name", "name", { ackReview });
  assertTextAllowed(destination, "group_destination", "destination", { ackReview });
  if (input.endDate < input.startDate) {
    throw invalidInput({ endDate: "終了日は開始日以降にしてください。" });
  }
  const now = clock.now();
  const life = validateLifecycleInput(
    { minMembers: input.minMembers ?? g.lifecycle.minMembers, deadlineDate: input.deadlineDate },
    { capacity: g.capacity, startDate: input.startDate, now },
  );
  const lifecycle = buildInitialLifecycle(life, now, { replanOfGroupId: g.id });
  const created = createGroupInternal({
    name, campaign: g.campaign, region: g.region,
    trip: { destination, startDate: input.startDate, endDate: input.endDate, dateNote: "" },
    capacity: g.capacity, visibility: g.visibility, tags: [...g.tags], description: g.description,
    organizerId: user.id, lifecycle,
  });
  recordCreated(created.id);

  const at = clock.nowIso();
  const updated = applyLifecyclePatch(g.id, g.lifecycle.revision, {
    status: "replanned", replannedToGroupId: created.id, replannedAt: at,
  });
  const logs = db().groupStatusLogs.filter((l) => l.groupId === g.id);
  db().groupStatusLogs.insert({
    id: newId("sl"), groupId: g.id, seq: logs.reduce((m, l) => Math.max(m, l.seq), 0) + 1,
    from: "cancelled", to: "replanned", event: "replanned", effectiveAt: at, evaluatedAt: at,
    actor: user.id, meta: { newGroupId: created.id },
  });
  emit({
    type: "status_changed", groupId: g.id, from: "cancelled", to: "replanned",
    cancelReason: g.lifecycle.cancelReason, revision: updated.revision, at,
  });

  const userIds = recipientsOf(g);
  if (userIds.length > 0) {
    notify({
      kind: "replan_invited", groupId: created.id, eventKey: `replan-${g.id}`,
      params: { groupTitle: name, newGroupId: created.id },
      recipients: [{ type: "users", userIds }],
    });
  }
  return { groupId: created.id, invited: userIds.length };
}
