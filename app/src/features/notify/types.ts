// 10 通知: 型(設計 5.1、6.1)。
import type { CursorPage, DateStr, Id, IsoDateTime } from "@/lib/groups-types";
import type { CancelReasonCode } from "@/features/groups/lifecycle/types";

export const NOTIFICATION_KINDS = [
  "min_reached", "withdraw_period_started", "withdraw_period_ending", "confirmed",
  "cancelled", "replan_invited", "withdrawal_received", "conditions_changed",
  "join_requested", "join_approved", "join_rejected", "join_expired",
  "chat_new", "deadline_near",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** 必須 12 種類。任意(余力)は chat_new と deadline_near。 */
export const OPTIONAL_KINDS = ["chat_new", "deadline_near"] as const satisfies readonly NotificationKind[];

interface Base { groupTitle: string }

export interface ParamsByKind {
  min_reached: Base & { minParticipants: number; count: number };
  withdraw_period_started: Base & { count: number; withdrawUntil: IsoDateTime };
  withdraw_period_ending: Base & { count: number };
  confirmed: Base & { count: number; summaryText?: string };
  cancelled: Base & { reason: CancelReasonCode; minParticipants?: number };
  replan_invited: Base & { newGroupId: Id };
  withdrawal_received: Base & { count: number; minParticipants: number };
  conditions_changed: Base & {
    minParticipants?: { from: number; to: number };
    deadline?: { from: DateStr; to: DateStr };
  };
  join_requested: Base & { pendingCount: number };
  join_approved: Base;
  join_rejected: Base;
  join_expired: Base;
  chat_new: Base & { count: number };
  deadline_near: Base & { deadlineDate: DateStr; deadlineAt: IsoDateTime; count: number; minParticipants: number };
}
export type ParamsOf<K extends NotificationKind> = ParamsByKind[K];

/** db().notifications の要素。 */
export interface GroupNotification<K extends NotificationKind = NotificationKind> {
  id: Id;
  userId: Id;
  kind: K;
  groupId: Id;
  params: ParamsOf<K>;
  dedupeKey: string;
  createdAt: IsoDateTime;
  readAt: IsoDateTime | null;
}

export type NotificationView = "detail" | "requests" | "chat" | "members" | "list";

export interface NotificationDto {
  id: Id;
  kind: NotificationKind;
  groupId: Id;
  title: string;
  body: string;
  link: { groupId: Id; view: NotificationView };
  createdAt: IsoDateTime;
  read: boolean;
}

export type NotificationPage = CursorPage<NotificationDto> & { unreadCount: number };

/** 宛先の指定。いずれも NotifyInput.groupId のグループを対象に解決する。 */
export type RecipientSpec =
  | { type: "users"; userIds: Id[] }
  | { type: "groupMembers"; excludeOrganizer?: boolean; excludeUserIds?: Id[] }
  | { type: "organizer" }
  | { type: "pendingApplicants" };

export interface NotifyInput<K extends NotificationKind = NotificationKind> {
  kind: K;
  groupId: Id;
  eventKey: string;
  params: ParamsOf<K>;
  recipients: RecipientSpec[];
}

export interface NotifyResult {
  created: GroupNotification[];
  skippedDuplicate: Id[];
  recipientCount: number;
}
