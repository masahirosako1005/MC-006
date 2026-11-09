// 状態の表示(設計 04 LCY-FN-10・12)。
import { clock } from "@/lib/clock";
import { daysBetween, jstDate } from "@/lib/datetime";
import { isMember } from "@/lib/authz";
import type { DemoUser, Id } from "@/lib/groups-types";
import { countActiveMembers } from "@/features/groups/core/service";
import { assertGroupAccess } from "@/features/safety/guards/access";
import { CANCEL_REASON_LABEL, statusLabel } from "./messages";
import * as P from "./policy";
import type { CapabilityKey, GroupCapabilities, GroupLike, LifecycleView } from "./types";

export function getCapabilities(g: GroupLike, user: DemoUser, now?: Date): GroupCapabilities {
  const organizer = g.organizerId === user.id;
  const member = organizer || isMember(user.id, g.id);
  const label = statusLabel(g.lifecycle.status);
  const deniedReason: Partial<Record<CapabilityKey, string>> = {};
  const decide = (key: CapabilityKey, role: boolean, state: () => boolean): boolean => {
    if (!role) {
      if (key !== "canAcceptRequests") deniedReason[key] = "この操作を行える立場ではありません。";
      return false;
    }
    if (!state()) {
      deniedReason[key] = `現在の状態(${label})ではできません。`;
      return false;
    }
    return true;
  };
  return {
    canAcceptRequests: decide("canAcceptRequests", true, () => P.canAcceptRequests(g, now)),
    canEdit: decide("canEdit", organizer, () => P.canEdit(g)),
    canEditExpenses: decide("canEditExpenses", member, () => P.canEditExpenses(g)),
    canChat: decide("canChat", member, () => P.canChat(g)),
    canReadHistory: decide("canReadHistory", member, () => P.canReadHistory(g)),
    canCollectStamps: decide("canCollectStamps", member, () => P.canCollectStamps(g)),
    canReview: decide("canReview", member, () => P.canReview(g)),
    canWithdraw: decide("canWithdraw", member && !organizer, () => P.canWithdraw(g)),
    canOrganizerCancel: decide("canOrganizerCancel", organizer, () => P.canOrganizerCancel(g)),
    canChangeConditions: decide("canChangeConditions", organizer, () => P.canChangeConditions(g)),
    canReplan: decide("canReplan", organizer, () => P.canReplan(g)),
    deniedReason,
  };
}

export function getLifecycleView(user: DemoUser, groupId: Id): LifecycleView {
  const g = assertGroupAccess(user.id, groupId, "view");
  const l = g.lifecycle;
  const now = clock.now();
  const count = countActiveMembers(g.id);
  const related = g.organizerId === user.id || isMember(user.id, g.id);
  const open = l.status === "recruiting" || l.status === "min_reached";
  return {
    groupId: g.id,
    status: l.status,
    statusLabel: statusLabel(l.status),
    minMembers: l.minMembers,
    capacity: g.capacity,
    currentCount: count,
    isFull: count >= g.capacity,
    shortage: Math.max(0, l.minMembers - count),
    deadlineDate: l.deadlineDate,
    deadlineAt: l.deadlineAt,
    withdrawalEndsAt: l.withdrawalEndsAt,
    daysToDeadline: open ? Math.max(0, daysBetween(jstDate(now), l.deadlineDate)) : null,
    cancelReason: l.cancelReason,
    cancelReasonLabel: l.cancelReason ? CANCEL_REASON_LABEL[l.cancelReason] : null,
    organizerCancelReason: l.organizerCancelReason,
    replanOfGroupId: l.replanOfGroupId,
    replannedToGroupId: related ? l.replannedToGroupId : null,
    capabilities: getCapabilities(g, user, now),
    now: clock.nowIso(),
  };
}
