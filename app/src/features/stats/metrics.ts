// 12 指標の計算(MUN-FN-04・11〜14)。署名スタブ。
import type { GroupStatus, CancelReasonCode } from "@/features/groups/lifecycle/types";
import type {
  CancelReasonGroup, FunnelAggregate, GroupFact, GroupPhase, HistoryFunnelEvent, StatsMeta, StatsQuery, StatsResponse,
} from "./types";

export function computeStats(input: {
  groups: GroupFact[]; funnel: FunnelAggregate; query: StatsQuery; meta: Omit<StatsMeta, "query">; k?: number;
}): StatsResponse { void input; throw new Error("not implemented"); }
export function monthsBetween(from: string, to: string): string[] { void from; void to; throw new Error("not implemented"); }
export function groupPhase(status: GroupStatus): GroupPhase { void status; throw new Error("not implemented"); }
export function cancelReasonGroup(code: CancelReasonCode): CancelReasonGroup { void code; throw new Error("not implemented"); }
export function addFunnelEvents(base: FunnelAggregate, events: readonly HistoryFunnelEvent[]): FunnelAggregate {
  void base; void events; throw new Error("not implemented");
}
