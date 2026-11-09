// 遷移表と共通処理(設計 04 §5.3・5.5)。署名スタブ(P-2-10 で実装)。
import type { Id } from "@/lib/groups-types";
import type { DueEvent, GroupStatus, LifecycleEvent, TransitionResult } from "./types";

export interface Transition { id: string; from: GroupStatus; event: LifecycleEvent; to: GroupStatus }
export const TRANSITIONS: readonly Transition[] = [];

export function applyDue(groupId: Id, due: DueEvent, now: Date, expectedRevision: number): TransitionResult {
  void groupId; void due; void now; void expectedRevision;
  throw new Error("not implemented");
}
