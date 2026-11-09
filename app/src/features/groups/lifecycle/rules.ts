// 純粋関数(設計 04 §5.1・5.2)。
import { LIMITS } from "@/lib/limits";
import { clock } from "@/lib/clock";
import { invalidInput } from "@/lib/errors";
import { addDays as addDateDays, isDateStr, startOfNextJstDay, toJstIso } from "@/lib/datetime";
import type { DateStr, Id } from "@/lib/groups-types";
import { addDays, jstDate } from "./dates";
import { LIFECYCLE_POLICY, closedReason } from "./policy";
import type {
  DueEvent, GroupLifecycle, GroupLike, LifecycleInput, NotAcceptingReason,
} from "./types";

export function notAcceptingReason(g: GroupLike, now: Date = clock.now()): NotAcceptingReason | null {
  return closedReason(g, now);
}

export function deriveBaseStatus(minMembers: number, count: number): "recruiting" | "min_reached" {
  return count >= minMembers ? "min_reached" : "recruiting";
}

export function validateLifecycleInput(
  input: LifecycleInput, ctx: { capacity: number; startDate: DateStr; now: Date },
): LifecycleInput {
  const fields: Record<string, string> = {};
  const { capacity } = ctx;
  const floor = LIMITS.MIN_MEMBERS.min;
  let minMembers = input.minMembers;
  if (minMembers === undefined || minMembers === null) {
    minMembers = LIFECYCLE_POLICY.defaultMinMembers(capacity);
  } else if (!Number.isInteger(minMembers) || minMembers < floor || minMembers > capacity) {
    fields.minMembers = `最少人数は ${floor} 人以上、定員(${capacity} 人)以下の整数で指定してください。`;
  }
  const today = jstDate(ctx.now);
  const d = input.deadlineDate;
  if (typeof d !== "string" || !isDateStr(d)) {
    fields.deadlineDate = "締切日を YYYY-MM-DD の実在する日付で指定してください。";
  } else if (d < today) {
    fields.deadlineDate = "締切日は今日以降にしてください。";
  } else if (d > addDateDays(today, 365)) {
    fields.deadlineDate = "締切日は 1 年以内にしてください。";
  } else {
    const endsAt = addDays(startOfNextJstDay(d), LIFECYCLE_POLICY.withdrawalDays);
    if (Date.parse(endsAt) > Date.parse(`${ctx.startDate}T00:00:00+09:00`)) {
      fields.deadlineDate = `辞退期間(${LIFECYCLE_POLICY.withdrawalDays} 日)が旅行開始前に終わるよう、締切日を早めてください。`;
    }
  }
  if (Object.keys(fields).length > 0) throw invalidInput(fields);
  return { minMembers, deadlineDate: d };
}

export function buildInitialLifecycle(input: LifecycleInput, now: Date, opts?: { replanOfGroupId?: Id }): GroupLifecycle {
  void now;
  return {
    status: "recruiting",
    minMembers: input.minMembers ?? LIFECYCLE_POLICY.minMembersFloor,
    deadlineDate: input.deadlineDate,
    deadlineAt: startOfNextJstDay(input.deadlineDate),
    deadlineExtendedCount: 0,
    withdrawalStartedAt: null,
    withdrawalEndsAt: null,
    confirmedAt: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    cancelReason: null,
    organizerCancelReason: null,
    replanOfGroupId: opts?.replanOfGroupId ?? null,
    replannedToGroupId: null,
    replannedAt: null,
    deadlineSoonNoticeSent: false,
    withdrawalEndingNoticeSent: false,
    revision: 1,
  };
}

/** 保存状態から見て最も早い未処理イベントを 1 件返す。通知のみのイベント(deadline_near 等)は見送り。 */
export function nextDue(g: GroupLike, count: number, now: Date): DueEvent | null {
  const lc = g.lifecycle;
  const nowMs = now.getTime();
  switch (lc.status) {
    case "recruiting":
    case "min_reached": {
      const base = deriveBaseStatus(lc.minMembers, count);
      if (base !== lc.status) {
        const effectiveAt = toJstIso(now);
        return base === "min_reached"
          ? { event: "count_reached", to: "min_reached", effectiveAt, cancelReason: null }
          : { event: "count_lost", to: "recruiting", effectiveAt, cancelReason: null };
      }
      if (nowMs >= Date.parse(lc.deadlineAt)) {
        return count >= lc.minMembers
          ? { event: "deadline_met", to: "withdrawal_period", effectiveAt: lc.deadlineAt, cancelReason: null }
          : { event: "deadline_missed", to: "cancelled", effectiveAt: lc.deadlineAt, cancelReason: "min_not_reached" };
      }
      return null;
    }
    case "withdrawal_period": {
      const endsAt = lc.withdrawalEndsAt ?? addDays(lc.deadlineAt, LIFECYCLE_POLICY.withdrawalDays);
      if (nowMs < Date.parse(endsAt)) return null;
      return count >= lc.minMembers
        ? { event: "withdrawal_ended", to: "confirmed", effectiveAt: endsAt, cancelReason: null }
        : { event: "withdrawal_lost_min", to: "cancelled", effectiveAt: endsAt, cancelReason: "below_min_in_withdrawal" };
    }
    case "confirmed": {
      const at = lc.startedAt ?? `${g.trip.startDate}T00:00:00+09:00`;
      return nowMs >= Date.parse(at)
        ? { event: "trip_started", to: "in_progress", effectiveAt: at, cancelReason: null } : null;
    }
    case "in_progress": {
      const at = lc.completedAt ?? `${addDateDays(g.trip.endDate, 1)}T00:00:00+09:00`;
      return nowMs >= Date.parse(at)
        ? { event: "trip_ended", to: "completed", effectiveAt: at, cancelReason: null } : null;
    }
    default:
      return null;
  }
}
