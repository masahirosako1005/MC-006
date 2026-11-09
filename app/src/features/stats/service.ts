// 12 集計サービス(MUN-FN-05)。
import { clock } from "@/lib/clock";
import type { DemoUser } from "@/lib/groups-types";
import { resolveScope } from "./access";
import { MIN_CELL_COUNT } from "./config";
import { collectFacts } from "./facts";
import { computeStats } from "./metrics";
import type { StatsQuery, StatsResponse } from "./types";

export function getStats(user: DemoUser, query: StatsQuery, opts?: { includeHistory?: boolean }): StatsResponse {
  const scope = resolveScope(user);
  const { groups, funnel } = collectFacts(scope, query, clock.now(), opts);
  return computeStats({
    groups,
    funnel,
    query,
    k: MIN_CELL_COUNT,
    meta: {
      municipalityName: scope.municipality.displayName,
      campaign: scope.municipality.campaign,
      regions: scope.regions,
      minCellCount: MIN_CELL_COUNT,
      includesDemoHistory: opts?.includeHistory !== false,
      generatedAt: clock.nowIso(),
    },
  });
}
