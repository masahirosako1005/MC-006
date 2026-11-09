// 04 グループライフサイクルの型(設計 04 §4.1)。
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { Group } from "@/features/groups/types";

export type GroupStatus =
  | "recruiting" | "min_reached" | "withdrawal_period" | "confirmed"
  | "in_progress" | "completed" | "cancelled" | "replanned";

export type CancelReasonCode =
  | "min_not_reached" | "below_min_in_withdrawal" | "below_floor" | "organizer_cancelled" | "organizer_left";

export type OrganizerCancelReason = "schedule_conflict" | "safety_concern" | "weather_or_closure" | "other";

export type NotAcceptingReason =
  | "closed_deadline" | "closed_withdrawal_period" | "closed_confirmed" | "closed_cancelled";

export interface GroupLifecycle {
  status: GroupStatus;
  minMembers: number;
  deadlineDate: DateStr;
  deadlineAt: IsoDateTime;
  deadlineExtendedCount: number;
  withdrawalStartedAt: IsoDateTime | null;
  withdrawalEndsAt: IsoDateTime | null;
  confirmedAt: IsoDateTime | null;
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  cancelReason: CancelReasonCode | null;
  organizerCancelReason: OrganizerCancelReason | null;
  replanOfGroupId: Id | null;
  replannedToGroupId: Id | null;
  replannedAt: IsoDateTime | null;
  deadlineSoonNoticeSent: boolean;
  withdrawalEndingNoticeSent: boolean;
  revision: number;
}

export type LifecycleEvent =
  | "created" | "count_reached" | "count_lost" | "deadline_met" | "deadline_missed"
  | "withdrawal_ended" | "withdrawal_lost_min" | "floor_lost" | "trip_started" | "trip_ended"
  | "organizer_cancelled" | "organizer_left" | "replanned";

export type NoticeEvent = "deadline_near" | "withdraw_period_ending";

/** コレクション groupStatusLogs(`sl-NNN`)。 */
export interface GroupStatusLog {
  id: Id;
  groupId: Id;
  seq: number;
  from: GroupStatus | null;
  to: GroupStatus;
  event: LifecycleEvent;
  effectiveAt: IsoDateTime;
  evaluatedAt: IsoDateTime;
  actor: "system" | Id;
  meta: Record<string, string | number | boolean> | null;
}

export type WithdrawPhase = "recruiting" | "min_reached" | "withdrawal_period" | "confirmed";

/** コレクション withdrawals(`wd-NNN`)。 */
export interface Withdrawal {
  id: Id;
  groupId: Id;
  userId: Id;
  withdrawnAt: IsoDateTime;
  phase: WithdrawPhase;
  countAfter: number;
  causedTransition: LifecycleEvent | null;
}

export type CapabilityKey =
  | "canAcceptRequests" | "canEdit" | "canEditExpenses" | "canChat" | "canReadHistory"
  | "canCollectStamps" | "canReview" | "canWithdraw" | "canOrganizerCancel"
  | "canChangeConditions" | "canReplan";

export type GroupCapabilities = Record<CapabilityKey, boolean> & {
  deniedReason: Partial<Record<CapabilityKey, string>>;
};

export interface LifecycleView {
  groupId: Id;
  status: GroupStatus;
  statusLabel: string;
  minMembers: number;
  capacity: number;
  currentCount: number;
  isFull: boolean;
  shortage: number;
  deadlineDate: DateStr;
  deadlineAt: IsoDateTime;
  withdrawalEndsAt: IsoDateTime | null;
  daysToDeadline: number | null;
  cancelReason: CancelReasonCode | null;
  cancelReasonLabel: string | null;
  organizerCancelReason: OrganizerCancelReason | null;
  replanOfGroupId: Id | null;
  replannedToGroupId: Id | null;
  capabilities: GroupCapabilities;
  now: IsoDateTime;
}

export interface TransitionResult {
  groupId: Id; from: GroupStatus | null; to: GroupStatus | null;
  event: LifecycleEvent | NoticeEvent; effectiveAt: IsoDateTime;
}
export interface EvaluationResult { groupId: Id; applied: TransitionResult[]; }

export type GroupLike = Pick<Group, "id" | "organizerId" | "capacity" | "trip"> & { lifecycle: GroupLifecycle };
export interface LifecycleInput { minMembers?: number; deadlineDate: DateStr; }
export interface WithdrawResult { status: GroupStatus; phase: WithdrawPhase; cancelled: boolean; currentCount: number; }
export interface ReplanDraft {
  fromGroupId: Id;
  carried: {
    name: string; campaign: string; region: Id; destination: string; capacity: number;
    visibility: "public" | "private"; tags: string[]; minMembers: number;
  };
  required: ("startDate" | "endDate" | "deadlineDate")[];
  originalTrip: { startDate: DateStr; endDate: DateStr; deadlineDate: DateStr };
  recipientCount: number;
}
export interface ReplanInput {
  name?: string; destination?: string; minMembers?: number;
  startDate: DateStr; endDate: DateStr; deadlineDate: DateStr;
  ackReview?: boolean;
}
export interface ReplanResult { groupId: Id; invited: number; }

export interface DueEvent {
  event: LifecycleEvent | NoticeEvent;
  to: GroupStatus | null;
  effectiveAt: IsoDateTime;
  cancelReason: CancelReasonCode | null;
}
