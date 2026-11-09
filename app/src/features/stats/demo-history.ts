// 12 合成履歴(MUN-FN-10)。署名スタブ。
import type { Municipality } from "@/features/official/types";
import type { GroupFact, HistoryFunnelEvent } from "./types";

export function buildDemoHistory(
  municipalities: readonly Municipality[],
): { groups: GroupFact[]; funnelEvents: HistoryFunnelEvent[] } {
  void municipalities; throw new Error("not implemented");
}
