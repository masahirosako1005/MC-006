"use client";
import type { MemberSummary } from "@/features/safety/types";

// 09 の formatMemberSummary と同じ文言(09 はサーバー専用のストアを import するため、クライアントでは複製)。
const LABEL: Record<string, string> = { "20s-": "20代以下", "30-40s": "30〜40代", "50-60s": "50〜60代", "70s+": "70代以上" };

export function MemberSummaryLabel({ summary }: { summary: MemberSummary }) {
  const text = summary.buckets === null
    ? `参加者 ${summary.count} 人(人数が少ないため年代は表示しません)`
    : `参加者 ${summary.count} 人(${summary.buckets.map((b) => LABEL[b] ?? b).join("、")})`;
  return <>{text}</>;
}
