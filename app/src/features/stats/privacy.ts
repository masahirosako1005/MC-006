// 12 少数の扱い(MUN-FN-06〜09)。
import type { AgeBand } from "@/features/safety/types";
import type { CoarseAgeBand, CountCell, RateCell } from "./types";

export function toCountCell(n: number, k: number): CountCell {
  return n > 0 && n < k ? { few: true } : { few: false, value: n };
}

export function toRateCell(num: number, den: number, k: number): RateCell {
  if (den === 0) return { kind: "none" };
  if (den < k) return { kind: "few" };
  if (num > 0 && num < k) return { kind: "below", percent: Math.round((k / den) * 100) };
  return { kind: "value", percent: Math.round((num / den) * 100) };
}

export function suppressBreakdown(counts: number[], k: number): boolean[] {
  const out = counts.map((c) => c > 0 && c < k);
  if (out.filter(Boolean).length === 1) {
    let idx = -1;
    counts.forEach((c, i) => {
      if (!out[i] && c > 0 && (idx < 0 || c < counts[idx])) idx = i;
    });
    if (idx >= 0) out[idx] = true;
  }
  return out;
}

const COARSE: Record<AgeBand, CoarseAgeBand> = {
  "18-19": "under30",
  "20s": "under30",
  "30s": "30to49",
  "40s": "30to49",
  "50s": "50plus",
  "60s": "50plus",
  "70s+": "50plus",
};

export function coarseAgeBand(ageBand: AgeBand | undefined): CoarseAgeBand | null {
  return ageBand ? COARSE[ageBand] : null;
}
