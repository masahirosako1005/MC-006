// 13 提案ルール(INS-FN-08)。署名スタブ。
import type { Id } from "@/lib/groups-types";
import type { INSIGHT_THRESHOLDS } from "./config";
import type { InsightAggregates, InsightForecastResponse, SuggestionCard, TourismBusiness } from "./types";

export function evaluateRules(input: {
  forecast: Pick<InsightForecastResponse, "weeks" | "areaTable">;
  perArea: Pick<InsightForecastResponse, "weeks">[];
  agg: InsightAggregates;
  business: TourismBusiness;
  regions: { id: Id; name: string }[];
  thresholds?: typeof INSIGHT_THRESHOLDS;
}): SuggestionCard[] { void input; throw new Error("not implemented"); }
