"use client";
// MUN-UI-03 取得フック。
import { useGroupsApi, type ApiError } from "@/lib/groups-api";
import type { StatsQuery, StatsResponse } from "../types";

export function useStats(query: StatsQuery | null): {
  data: StatsResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void>;
} {
  let path = "/api/stats";
  if (query) {
    const p = new URLSearchParams({ from: query.from, to: query.to, official: query.official });
    if (query.region) p.set("region", query.region);
    path = `/api/stats?${p}`;
  }
  return useGroupsApi<StatsResponse>(path);
}
