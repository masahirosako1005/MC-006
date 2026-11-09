// 13 見込みの計算(INS-FN-06・07)。署名スタブ。
import type { DateStr, Id } from "@/lib/groups-types";
import type { InsightAggregates, InsightForecastResponse, PastAgeProfile, PlannedFact } from "./types";

export function computeForecast(input: {
  agg: InsightAggregates; planned: PlannedFact[]; regions: { id: Id; name: string }[];
  weeks: { weekStart: DateStr; weekEnd: DateStr }[]; k?: number;
}): Pick<InsightForecastResponse, "weeks" | "areaTable"> { void input; throw new Error("not implemented"); }

export function buildPastProfile(agg: InsightAggregates): PastAgeProfile[] { void agg; throw new Error("not implemented"); }
