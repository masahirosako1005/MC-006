// 09: メンバー概要。
import { AppError } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import type { Id } from "@/lib/groups-types";
import { SAFETY_POLICY } from "../policy";
import type { AgeBand, AgeBucket, MemberSummary } from "../types";

const BUCKET_OF: Record<AgeBand, AgeBucket> = {
  "18-19": "20s-", "20s": "20s-", "30s": "30-40s", "40s": "30-40s", "50s": "50-60s", "60s": "50-60s", "70s+": "70s+",
};
const ORDER: AgeBucket[] = ["20s-", "30-40s", "50-60s", "70s+"];
const LABEL: Record<AgeBucket, string> = { "20s-": "20代以下", "30-40s": "30〜40代", "50-60s": "50〜60代", "70s+": "70代以上" };

export function memberSummary(members: ReadonlyArray<{ ageBand: AgeBand }>): MemberSummary {
  const count = members.length;
  if (count < SAFETY_POLICY.summaryMinCount) return { count, buckets: null, hiddenReason: "few_members" };
  const set = new Set(members.map((m) => BUCKET_OF[m.ageBand]));
  return { count, buckets: ORDER.filter((b) => set.has(b)), hiddenReason: null };
}

export function formatMemberSummary(s: MemberSummary): string {
  if (s.buckets === null) return `参加者 ${s.count} 人(人数が少ないため年代は表示しません)`;
  return `参加者 ${s.count} 人(${s.buckets.map((b) => LABEL[b]).join("、")})`;
}

export function ageBandsOf(userIds: readonly Id[]): { ageBand: AgeBand }[] {
  return userIds.map((id) => {
    const p = db().profiles.get(id);
    if (!p) throw new AppError("internal", "profile not found");
    return { ageBand: p.ageBand };
  });
}
