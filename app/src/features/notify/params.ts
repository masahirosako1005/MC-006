// 10: params の検証スキーマ(00 の v)。未知キーは捨てる。
import { v, INVALID, type Schema } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";
import type { CancelReasonCode } from "@/features/groups/lifecycle/types";
import { NOTIFICATION_KINDS, type NotificationKind } from "./types";

const title = () => v.string({ min: LIMITS.GROUP_NAME.min, max: LIMITS.GROUP_NAME.max });
const count = () => v.int({ min: 0, max: 999 });
const minP = (optional = false) => v.int({ min: LIMITS.MIN_MEMBERS.min, max: LIMITS.MIN_MEMBERS.max, optional });
const REASONS: readonly CancelReasonCode[] = [
  "min_not_reached", "below_min_in_withdrawal", "below_floor", "organizer_cancelled", "organizer_left",
];

/** 構造検証のあと、追加の必須条件を確認する。 */
function refine(base: Schema, check: (value: Record<string, unknown>) => Record<string, string> | null): Schema {
  return {
    parse(input, path, issues) {
      const r = base.parse(input, path, issues);
      if (r === INVALID) return INVALID;
      const bad = check(r as Record<string, unknown>);
      if (!bad) return r;
      for (const [k, msg] of Object.entries(bad)) issues[path ? `${path}.${k}` : k] ??= msg;
      return INVALID;
    },
  };
}

export function paramsSchema(kind: NotificationKind): Schema {
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(kind)) throw new Error(`unknown kind: ${String(kind)}`);
  const t = title();
  switch (kind) {
    case "min_reached": return v.object({ groupTitle: t, minParticipants: minP(), count: count() });
    case "withdraw_period_started": return v.object({ groupTitle: t, count: count(), withdrawUntil: v.datetime() });
    case "withdraw_period_ending": return v.object({ groupTitle: t, count: count() });
    case "confirmed": return v.object({ groupTitle: t, count: count() }); // summaryText は notify が設定する
    case "cancelled":
      return refine(
        v.object({ groupTitle: t, reason: v.enum(REASONS), minParticipants: minP(true) }),
        (p) =>
          (p.reason === "min_not_reached" || p.reason === "below_min_in_withdrawal") && p.minParticipants === undefined
            ? { minParticipants: "必須です。" }
            : null,
      );
    case "replan_invited": return v.object({ groupTitle: t, newGroupId: v.id("g") });
    case "withdrawal_received": return v.object({ groupTitle: t, count: count(), minParticipants: minP() });
    case "conditions_changed":
      return refine(
        v.object({
          groupTitle: t,
          minParticipants: v.object({ from: minP(), to: minP() }, { optional: true }),
          deadline: v.object({ from: v.date(), to: v.date() }, { optional: true }),
        }),
        (p) => (p.minParticipants === undefined && p.deadline === undefined ? { minParticipants: "変更内容が必要です。" } : null),
      );
    case "join_requested": return v.object({ groupTitle: t, pendingCount: count() });
    case "join_approved":
    case "join_rejected":
    case "join_expired": return v.object({ groupTitle: t });
    case "chat_new": return v.object({ groupTitle: t, count: count() });
    case "deadline_near":
      return v.object({ groupTitle: t, deadlineDate: v.date(), deadlineAt: v.datetime(), count: count(), minParticipants: minP() });
  }
}
