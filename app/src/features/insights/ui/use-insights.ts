"use client";
// INS-UI-03 取得フック(2 本)。スタブ。
import type { ApiError } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { InsightForecastResponse, InsightSuggestionsResponse } from "../types";

export function useInsightForecast(region: Id | null | undefined): {
  data: InsightForecastResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void>;
} {
  void region;
  return { data: null, error: null, loading: false, reload: async () => {} };
}
export function useInsightSuggestions(region: Id | null | undefined): {
  data: InsightSuggestionsResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void>;
} {
  void region;
  return { data: null, error: null, loading: false, reload: async () => {} };
}
