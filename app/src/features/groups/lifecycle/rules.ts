// 純粋関数(設計 04 §5.1・5.2)。署名スタブ(P-2-9 で実装)。
import type { DateStr, Id } from "@/lib/groups-types";
import type {
  DueEvent, GroupLifecycle, GroupLike, LifecycleInput, NotAcceptingReason,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function notAcceptingReason(g: GroupLike, now?: Date): NotAcceptingReason | null { void g; void now; return ni(); }
export function deriveBaseStatus(minMembers: number, count: number): "recruiting" | "min_reached" {
  void minMembers; void count; return ni();
}
export function nextDue(g: GroupLike, count: number, now: Date): DueEvent | null { void g; void count; void now; return ni(); }
export function validateLifecycleInput(
  input: LifecycleInput, ctx: { capacity: number; startDate: DateStr; now: Date },
): LifecycleInput { void input; void ctx; return ni(); }
export function buildInitialLifecycle(input: LifecycleInput, now: Date, opts?: { replanOfGroupId?: Id }): GroupLifecycle {
  void input; void now; void opts; return ni();
}
