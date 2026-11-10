"use client";
// INS-UI-03 取得フック(2 本)。
import { useGroupsApi } from "@/lib/groups-api";
import type { ApiError } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { InsightForecastResponse, InsightSuggestionsResponse } from "../types";

type R<T> = { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };
const q = (region: Id | null | undefined) => (region ? `?region=${encodeURIComponent(region)}` : "");

export function useInsightForecast(region: Id | null | undefined): R<InsightForecastResponse> {
  return useGroupsApi<InsightForecastResponse>(`/api/insights${q(region)}`);
}
export function useInsightSuggestions(region: Id | null | undefined): R<InsightSuggestionsResponse> {
  return useGroupsApi<InsightSuggestionsResponse>(`/api/insights/suggestions${q(region)}`);
}
