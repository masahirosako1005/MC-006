// 10: テンプレート文言(kind × 理由)。個人名・チャット本文・連絡先は載せない。
import type { CancelReasonCode } from "@/features/groups/lifecycle/types";
import type { NotificationKind } from "./types";

export interface Template { title: string; body: string }

export const TEMPLATES: Partial<Record<NotificationKind, Template>> = {
  min_reached: { title: "最少人数に達しました", body: "「{groupTitle}」が最少人数({minParticipants}人)に達しました。現在{count}人です。まだ実行確定ではありません。" },
  withdraw_period_started: { title: "辞退期間が始まりました", body: "「{groupTitle}」の辞退期間が始まりました。{withdrawUntil}までペナルティなしで辞退できます。現在{count}人です。" },
  withdraw_period_ending: { title: "まもなく実行確定します", body: "「{groupTitle}」の辞退期間が終わります。まもなく実行が確定します。現在{count}人です。" },
  confirmed: { title: "実行が確定しました", body: "「{groupTitle}」の実行が確定しました。参加は{count}人です。参加者の概要: {summaryText}" },
  cancelled: { title: "中止になりました", body: "{reasonBody}{guide}" },
  replan_invited: { title: "再企画のご案内", body: "「{groupTitle}」を見直して、新しい募集が始まりました。参加するには、もう一度お申し込みください。" },
  withdrawal_received: { title: "辞退を受け付けました", body: "「{groupTitle}」で辞退がありました。現在{count}人(最少{minParticipants}人)です。" },
  conditions_changed: { title: "募集の条件が変わりました", body: "「{groupTitle}」の条件が変わりました。{changes}" },
  join_requested: { title: "参加申請が届いています", body: "「{groupTitle}」に参加申請があります。未対応は{pendingCount}件です。" },
  join_approved: { title: "参加が承認されました", body: "「{groupTitle}」への参加が承認されました。メンバーとして利用できます。" },
  join_rejected: { title: "申請の結果", body: "「{groupTitle}」への参加申請は、今回は見送りとなりました。ほかのグループもご覧ください。" },
  join_expired: { title: "参加申請の受付が終了しました", body: "「{groupTitle}」は募集の締切を迎えたため、申請中の参加申請は受け付けられなくなりました。ほかのグループもご覧ください。" },
  chat_new: { title: "チャットに新着があります", body: "「{groupTitle}」に新しいメッセージが{count}件あります。" },
  deadline_near: { title: "締切が近づいています", body: "「{groupTitle}」の締切は{deadline}です。現在{count}人(最少{minParticipants}人)です。" },
};

export const CANCEL_BODIES: Record<CancelReasonCode, string> = {
  min_not_reached: "「{groupTitle}」は、締切までに最少人数({minParticipants}人)に達しなかったため、中止になりました。",
  below_min_in_withdrawal: "「{groupTitle}」は、辞退期間中の辞退で最少人数({minParticipants}人)を下回ったため、中止になりました。",
  below_floor: "「{groupTitle}」は、実行確定後の辞退で参加者が2人未満になったため、中止になりました。",
  organizer_cancelled: "「{groupTitle}」は、幹事の操作により中止になりました。",
  organizer_left: "「{groupTitle}」は、幹事が不在になったため、中止になりました。",
};

export const CANCEL_GUIDE = "幹事は日程などを見直して再企画できます。再企画されると、参加者に案内が届きます。";
/** 末尾の案内を付けない理由。 */
export const CANCEL_NO_GUIDE: readonly CancelReasonCode[] = ["organizer_left"];

export const FALLBACK_SUMMARY = "人数のみ(年代の内訳は表示しません)";
