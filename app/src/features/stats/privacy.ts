// 12 少数の扱い(MUN-FN-06〜09)。署名スタブ。
import type { AgeBand } from "@/features/safety/types";
import type { CoarseAgeBand, CountCell, RateCell } from "./types";

export function toCountCell(n: number, k: number): CountCell { void n; void k; throw new Error("not implemented"); }
export function toRateCell(num: number, den: number, k: number): RateCell { void num; void den; void k; throw new Error("not implemented"); }
export function suppressBreakdown(counts: number[], k: number): boolean[] { void counts; void k; throw new Error("not implemented"); }
export function coarseAgeBand(ageBand: AgeBand | undefined): CoarseAgeBand | null { void ageBand; throw new Error("not implemented"); }
