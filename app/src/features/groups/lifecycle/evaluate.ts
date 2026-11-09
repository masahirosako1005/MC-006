// 遅延評価(設計 04 §5.1・5.3)。
import type { Id } from "@/lib/groups-types";
import { db, tx, newId } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import { requireGroup, activeMembers } from "@/lib/authz";
import { LIFECYCLE_POLICY } from "./policy";
import { nextDue } from "./rules";
import { applyDue } from "./transitions";
import type { EvaluationResult, GroupLike, TransitionResult } from "./types";

const evaluating = new Set<Id>();

export function evaluate(groupId: Id, now: Date = clock.now()): EvaluationResult {
  if (evaluating.has(groupId)) return { groupId, applied: [] };
  evaluating.add(groupId);
  try {
    const applied: TransitionResult[] = [];
    for (let i = 0; i < LIFECYCLE_POLICY.maxEvaluateSteps; i++) {
      const g = requireGroup(groupId);
      const due = nextDue(g as GroupLike, activeMembers(groupId).length, now);
      if (!due) return { groupId, applied };
      applied.push(applyDue(groupId, due, now, g.lifecycle.revision));
    }
    console.error(`[lifecycle] maxEvaluateSteps exceeded: ${groupId}`);
    return { groupId, applied };
  } finally {
    evaluating.delete(groupId);
  }
}

const TERMINAL = new Set(["completed", "cancelled", "replanned"]);

export function evaluateAll(now: Date = clock.now()): EvaluationResult[] {
  return db().groups.list()
    .filter((g) => !TERMINAL.has(g.lifecycle.status))
    .map((g) => evaluate(g.id, now));
}

export function onMembershipChanged(groupId: Id, now: Date = clock.now()): EvaluationResult {
  return evaluate(groupId, now);
}

export function recordCreated(groupId: Id): void {
  const g = requireGroup(groupId);
  const now = clock.nowIso();
  tx(() => {
    db().groupStatusLogs.insert({
      id: newId("sl"), groupId, seq: 1, from: null, to: g.lifecycle.status, event: "created",
      effectiveAt: g.createdAt ?? now, evaluatedAt: now, actor: g.organizerId, meta: null,
    });
  });
  evaluate(groupId); // 幹事 1 人で最少人数に到達する場合に備える
}

/** 見送り(統一仕様書 16.2)。デモでは未使用。 */
export function onOrganizerLeft(groupId: Id): EvaluationResult {
  return { groupId, applied: [] };
}
