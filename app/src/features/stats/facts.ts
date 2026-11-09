// 12 活動中データのアダプタ(MUN-FN-03)。署名スタブ。
import type { FunnelAggregate, GroupFact, MunicipalScope, StatsQuery } from "./types";

export function collectFacts(
  scope: MunicipalScope, query: StatsQuery, now: Date, opts?: { includeHistory?: boolean },
): { groups: GroupFact[]; funnel: FunnelAggregate } {
  void scope; void query; void now; void opts; throw new Error("not implemented");
}
