// 09: 頻度制限(固定ウィンドウ)。スタブ(P-2-1)。
import type { Id } from "@/lib/groups-types";
import type { RATE_LIMITS } from "../policy";

export function checkRate(name: keyof typeof RATE_LIMITS, userId: Id, scope?: Id): void {
  void name; void userId; void scope;
  throw new Error("not implemented");
}

export function resetRateBuckets(): void {
  throw new Error("not implemented");
}
