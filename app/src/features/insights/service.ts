// 13 サービス(INS-FN-10・11)。署名スタブ。
import type { DemoUser } from "@/lib/groups-types";
import type { InsightForecastResponse, InsightQuery, InsightSuggestionsResponse } from "./types";

export function getInsightForecast(user: DemoUser, query: InsightQuery): InsightForecastResponse {
  void user; void query; throw new Error("not implemented");
}
export function getInsightSuggestions(user: DemoUser, query: InsightQuery): InsightSuggestionsResponse {
  void user; void query; throw new Error("not implemented");
}
