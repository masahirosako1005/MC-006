// 状態ごとの可否(契約 4.4)とポリシー定数。
import { LIMITS } from "@/lib/limits";
import { clock } from "@/lib/clock";
import type { GroupLike, GroupStatus, NotAcceptingReason } from "./types";

export const LIFECYCLE_POLICY = {
  minMembersFloor: LIMITS.MIN_MEMBERS.min,
  defaultMinMembers: (capacity: number) => Math.min(3, capacity),
  withdrawalDays: 2,
  belowMinInWithdrawal: "cancel" as "cancel" | "reopen_once",
  withdrawAfterConfirmed: "allow_keep" as "allow_keep" | "deny" | "allow_reevaluate",
  confirmedFloorMembers: 2,
  onFullBeforeDeadline: "wait_deadline" as "wait_deadline" | "close_now" | "organizer_choice",
  organizerCancelStates: ["recruiting", "min_reached", "withdrawal_period"] as GroupStatus[],
  organizerLeft: "cancel_before_confirm" as "cancel_before_confirm" | "freeze_until_handover",
  allowLowerMinOnly: true,
  maxDeadlineExtensions: 1,
  deadlineSoonHours: 24,
  withdrawalEndingHours: 24,
  replanInvitePolicy: "members_and_pending" as "members_only" | "members_and_pending",
  maxEvaluateSteps: 16,
} as const;

const has = (g: GroupLike, ss: readonly GroupStatus[]): boolean => ss.includes(g.lifecycle.status);

export function canAcceptRequests(g: GroupLike, now: Date = clock.now()): boolean {
  return has(g, ["recruiting", "min_reached"]) && now.getTime() < Date.parse(g.lifecycle.deadlineAt);
}
export function canEdit(g: GroupLike): boolean {
  return has(g, ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress"]);
}
export function canChat(g: GroupLike): boolean { return canEdit(g); }
export function canReadHistory(g: GroupLike): boolean { void g; return true; }
export function canEditExpenses(g: GroupLike): boolean { return has(g, ["confirmed", "in_progress", "completed"]); }
export function canCollectStamps(g: GroupLike): boolean { return has(g, ["in_progress"]); }
export function canReview(g: GroupLike): boolean { return has(g, ["in_progress", "completed"]); }
export function canWithdraw(g: GroupLike): boolean {
  return has(g, ["recruiting", "min_reached", "withdrawal_period", "confirmed"]);
}
export function canOrganizerCancel(g: GroupLike): boolean { return has(g, LIFECYCLE_POLICY.organizerCancelStates); }
export function canChangeConditions(g: GroupLike): boolean { return has(g, ["recruiting", "min_reached"]); }
export function canReplan(g: GroupLike): boolean {
  return has(g, ["cancelled"]) && g.lifecycle.replannedToGroupId === null;
}

/** 受付不可の理由。受付可なら null(rules.ts の notAcceptingReason が使う)。 */
export function closedReason(g: GroupLike, now: Date = clock.now()): NotAcceptingReason | null {
  if (canAcceptRequests(g, now)) return null;
  switch (g.lifecycle.status) {
    case "recruiting": case "min_reached": return "closed_deadline";
    case "withdrawal_period": return "closed_withdrawal_period";
    case "confirmed": case "in_progress": case "completed": return "closed_confirmed";
    default: return "closed_cancelled";
  }
}
