// 04 の文言(契約 10.1・10.2)。
import type { CancelReasonCode, GroupStatus, OrganizerCancelReason } from "./types";

export const STATUS_LABEL: Record<GroupStatus, string> = {
  recruiting: "募集中",
  min_reached: "最少人数到達",
  withdrawal_period: "辞退期間",
  confirmed: "実行確定",
  in_progress: "実施中",
  completed: "完了",
  cancelled: "中止",
  replanned: "再企画済み",
};

export const CANCEL_REASON_LABEL: Record<CancelReasonCode, string> = {
  min_not_reached: "締切までに最少人数に達しなかった",
  below_min_in_withdrawal: "辞退期間中の辞退で最少人数を下回った",
  below_floor: "実行確定後の辞退で 2 人未満になった",
  organizer_cancelled: "幹事が中止した",
  organizer_left: "幹事が不在になった",
};

export const ORGANIZER_CANCEL_REASON_LABEL: Record<OrganizerCancelReason, string> = {
  schedule_conflict: "日程の都合",
  safety_concern: "安全上の懸念",
  weather_or_closure: "天候・休業など",
  other: "その他",
};

export function statusLabel(status: GroupStatus): string { return STATUS_LABEL[status]; }
