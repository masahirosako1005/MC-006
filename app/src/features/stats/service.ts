// 12 集計サービス(MUN-FN-05)。署名スタブ。
import type { DemoUser } from "@/lib/groups-types";
import type { StatsQuery, StatsResponse } from "./types";

export function getStats(user: DemoUser, query: StatsQuery, opts?: { includeHistory?: boolean }): StatsResponse {
  void user; void query; void opts; throw new Error("not implemented");
}
