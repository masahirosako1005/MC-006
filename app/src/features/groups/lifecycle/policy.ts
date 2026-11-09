// 状態ごとの可否(契約 4.4)とポリシー定数。署名スタブ(P-2-9 で実装)。
import { LIMITS } from "@/lib/limits";
import type { GroupLike, GroupStatus } from "./types";

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

const ni = (): never => { throw new Error("not implemented"); };

export function canAcceptRequests(g: GroupLike, now?: Date): boolean { void g; void now; return ni(); }
export function canEdit(g: GroupLike): boolean { void g; return ni(); }
export function canChat(g: GroupLike): boolean { void g; return ni(); }
export function canReadHistory(g: GroupLike): boolean { void g; return ni(); }
export function canEditExpenses(g: GroupLike): boolean { void g; return ni(); }
export function canCollectStamps(g: GroupLike): boolean { void g; return ni(); }
export function canReview(g: GroupLike): boolean { void g; return ni(); }
export function canWithdraw(g: GroupLike): boolean { void g; return ni(); }
export function canOrganizerCancel(g: GroupLike): boolean { void g; return ni(); }
export function canChangeConditions(g: GroupLike): boolean { void g; return ni(); }
export function canReplan(g: GroupLike): boolean { void g; return ni(); }
