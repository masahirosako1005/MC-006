"use client";
// 09: 禁止表現の拒否メッセージ。スタブ(P-3-11 で本体に置き換える)。
import type { TextCheckResult } from "../types";

export interface TextRejectNoticeProps {
  result: TextCheckResult | null;
  serverError?: string;
  onAckReview?(): void;
}

export function TextRejectNotice(props: TextRejectNoticeProps) {
  void props;
  return null;
}
