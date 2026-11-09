// 13 クエリの検証(INS-FN-02)。署名スタブ。
import type { BusinessScope, InsightQuery } from "./types";

export function parseInsightQuery(sp: URLSearchParams, scope: BusinessScope): InsightQuery {
  void sp; void scope; throw new Error("not implemented");
}
