// 12 クエリの検証(MUN-FN-02)。署名スタブ。
import type { MunicipalScope, StatsQuery } from "./types";

export function parseStatsQuery(sp: URLSearchParams, scope: MunicipalScope, now: Date): StatsQuery {
  void sp; void scope; void now; throw new Error("not implemented");
}
