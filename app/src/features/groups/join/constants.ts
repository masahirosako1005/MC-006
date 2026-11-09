// 03 の定数(設計 03 §5.1)。ひとことの文字数・行数は LIMITS.JOIN_NOTE を使う。
import type { RejectReasonId } from "./types";

export const MAX_REQUESTS_PER_GROUP = 3;

export const REJECT_REASONS: Record<RejectReasonId, string> = {
  plan_mismatch: "プランの内容・進め方が合わないため",
  schedule_mismatch: "日程・集合の都合が合わないため",
  not_specified: "理由は伝えない",
};

export const REJECT_REASON_IDS = Object.keys(REJECT_REASONS) as RejectReasonId[];
/** 同意の扱い。"required" のみ実装(他案は見送り)。 */
export const CONSENT_POLICY: "required" | "optional_excluded" | "optional_lower_priority" = "required";
