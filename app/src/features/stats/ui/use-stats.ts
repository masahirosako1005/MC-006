"use client";
// MUN-UI-03 取得フック。スタブ。
import type { ApiError } from "@/lib/groups-api";
import type { StatsQuery, StatsResponse } from "../types";

export function useStats(query: StatsQuery | null): {
  data: StatsResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void>;
} {
  void query;
  return { data: null, error: null, loading: false, reload: async () => {} };
}
