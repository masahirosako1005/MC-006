// 流入計測(11 ENT-FN-05・06)。署名スタブ。
import type { FunnelAggregate, FunnelEventInput, FunnelQuery } from "./types";

export function recordFunnelEvent(input: FunnelEventInput): void {
  void input;
  throw new Error("not implemented");
}

export function aggregateFunnel(q: FunnelQuery): FunnelAggregate {
  void q;
  throw new Error("not implemented");
}
