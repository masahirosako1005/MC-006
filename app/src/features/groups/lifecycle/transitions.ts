// 遷移表と共通処理(設計 04 §5.3・5.5)。
import type { Id } from "@/lib/groups-types";
import { db, tx, newId } from "@/lib/groups-store";
import { emit } from "@/lib/events";
import { clock } from "@/lib/clock";
import { conflict } from "@/lib/errors";
import { requireGroup } from "@/lib/authz";
import { applyLifecyclePatch } from "@/features/groups/core/repository";
import { addDays } from "./dates";
import { LIFECYCLE_POLICY } from "./policy";
import { noticeForTransition, noticeForDue } from "./notices";
import type {
  DueEvent, GroupLifecycle, GroupStatus, GroupStatusLog, LifecycleEvent, TransitionResult,
} from "./types";

export interface Transition { id: string; from: GroupStatus; event: LifecycleEvent; to: GroupStatus }

export const TRANSITIONS: readonly Transition[] = [
  { id: "T2", from: "recruiting", event: "count_reached", to: "min_reached" },
  { id: "T3", from: "min_reached", event: "count_lost", to: "recruiting" },
  { id: "T4", from: "recruiting", event: "deadline_missed", to: "cancelled" },
  { id: "T5", from: "min_reached", event: "deadline_met", to: "withdrawal_period" },
  { id: "T6", from: "withdrawal_period", event: "withdrawal_ended", to: "confirmed" },
  { id: "T7", from: "withdrawal_period", event: "withdrawal_lost_min", to: "cancelled" },
  { id: "T8", from: "confirmed", event: "floor_lost", to: "cancelled" },
  { id: "T9", from: "confirmed", event: "trip_started", to: "in_progress" },
  { id: "T10", from: "in_progress", event: "trip_ended", to: "completed" },
  { id: "T11a", from: "recruiting", event: "organizer_cancelled", to: "cancelled" },
  { id: "T11b", from: "min_reached", event: "organizer_cancelled", to: "cancelled" },
  { id: "T11c", from: "withdrawal_period", event: "organizer_cancelled", to: "cancelled" },
  { id: "T12a", from: "recruiting", event: "organizer_left", to: "cancelled" },
  { id: "T12b", from: "min_reached", event: "organizer_left", to: "cancelled" },
  { id: "T12c", from: "withdrawal_period", event: "organizer_left", to: "cancelled" },
  { id: "T13", from: "cancelled", event: "replanned", to: "replanned" },
];

const mismatch = () => conflict("グループの状態が更新されています。", { reason: "version_mismatch" });

/** 状態を変える処理の共通部分((a)〜(e))。withdraw・organizerCancel・replan からも使える。 */
export function commitTransition(args: {
  groupId: Id; from: GroupStatus; to: GroupStatus; event: LifecycleEvent;
  effectiveAt: string; expectedRevision: number; patch: Partial<GroupLifecycle>;
  cancelReason: GroupLifecycle["cancelReason"]; actor?: "system" | Id;
}): TransitionResult {
  const { groupId, from, to, event, effectiveAt, expectedRevision, patch, cancelReason } = args;
  return tx(() => {
    const cur = requireGroup(groupId);
    if (cur.lifecycle.revision !== expectedRevision) throw mismatch();
    const next = applyLifecyclePatch(groupId, expectedRevision, { ...patch, status: to });
    const seq = db().groupStatusLogs.filter((l) => l.groupId === groupId).reduce((m, l) => Math.max(m, l.seq), 0) + 1;
    const log: GroupStatusLog = {
      id: newId("sl"), groupId, seq, from, to, event, effectiveAt, evaluatedAt: clock.nowIso(),
      actor: args.actor ?? "system", meta: null,
    };
    db().groupStatusLogs.insert(log);
    noticeForTransition(groupId, from, to, cancelReason);
    emit({ type: "status_changed", groupId, from, to, cancelReason, revision: next.revision, at: clock.nowIso() });
    return { groupId, from, to, event, effectiveAt };
  });
}

function patchFor(due: DueEvent, lc: GroupLifecycle): Partial<GroupLifecycle> {
  const at = due.effectiveAt;
  switch (due.event) {
    case "deadline_met":
      return {
        withdrawalStartedAt: lc.deadlineAt,
        withdrawalEndsAt: addDays(lc.deadlineAt, LIFECYCLE_POLICY.withdrawalDays),
        deadlineSoonNoticeSent: true,
      };
    case "deadline_missed":
      return { cancelledAt: at, cancelReason: due.cancelReason ?? "min_not_reached", deadlineSoonNoticeSent: true };
    case "withdrawal_ended": return { confirmedAt: at, withdrawalEndingNoticeSent: true };
    case "withdrawal_lost_min":
      return { cancelledAt: at, cancelReason: due.cancelReason ?? "below_min_in_withdrawal", withdrawalEndingNoticeSent: true };
    case "floor_lost": return { cancelledAt: at, cancelReason: due.cancelReason ?? "below_floor" };
    case "trip_started": return { startedAt: at };
    case "trip_ended": return { completedAt: at };
    default: return {};
  }
}

export function applyDue(groupId: Id, due: DueEvent, now: Date, expectedRevision: number): TransitionResult {
  void now;
  return tx(() => {
    const g = requireGroup(groupId);
    if (due.to === null) {
      // 通知のみ(状態は変えない)。送信済みフラグを同じ tx で立てる。
      if (g.lifecycle.revision !== expectedRevision) throw mismatch();
      const flag = due.event === "deadline_near" ? "deadlineSoonNoticeSent" : "withdrawalEndingNoticeSent";
      applyLifecyclePatch(groupId, expectedRevision, { [flag]: true });
      noticeForDue(groupId, due.event);
      return { groupId, from: null, to: null, event: due.event, effectiveAt: due.effectiveAt };
    }
    const patch = patchFor(due, g.lifecycle);
    const cancelReason = due.to === "cancelled" ? (patch.cancelReason ?? due.cancelReason) : null;
    return commitTransition({
      groupId, from: g.lifecycle.status, to: due.to, event: due.event as LifecycleEvent,
      effectiveAt: due.effectiveAt, expectedRevision, patch, cancelReason: cancelReason ?? null,
    });
  });
}
