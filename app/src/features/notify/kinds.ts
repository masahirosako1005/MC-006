// 10: kind のメタ情報(既定のリンク先、必須/任意)。
import { NOTIFICATION_KINDS, OPTIONAL_KINDS, type NotificationKind, type NotificationView } from "./types";

export interface KindMeta {
  defaultView: NotificationView;
  optional: boolean;
}

const VIEW: Record<NotificationKind, NotificationView> = {
  min_reached: "detail", withdraw_period_started: "detail", withdraw_period_ending: "detail", confirmed: "detail",
  cancelled: "detail", replan_invited: "detail", withdrawal_received: "detail", conditions_changed: "detail",
  join_requested: "requests", join_approved: "detail", join_rejected: "list", join_expired: "list",
  chat_new: "chat", deadline_near: "detail",
};

export const KIND_META: Partial<Record<NotificationKind, KindMeta>> = Object.fromEntries(
  NOTIFICATION_KINDS.map((k) => [k, {
    defaultView: VIEW[k],
    optional: (OPTIONAL_KINDS as readonly string[]).includes(k),
  }]),
);
