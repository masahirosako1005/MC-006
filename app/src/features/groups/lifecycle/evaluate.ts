// 遅延評価(設計 04 §5.1・5.3)。署名スタブ(P-2-10 で実装)。
import type { Id } from "@/lib/groups-types";
import type { EvaluationResult } from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function evaluate(groupId: Id, now?: Date): EvaluationResult { void groupId; void now; return ni(); }
export function evaluateAll(now?: Date): EvaluationResult[] { void now; return ni(); }
export function onMembershipChanged(groupId: Id, now?: Date): EvaluationResult { void groupId; void now; return ni(); }
export function recordCreated(groupId: Id): void { void groupId; ni(); }
export function onOrganizerLeft(groupId: Id): EvaluationResult { void groupId; return ni(); }
