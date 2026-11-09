// 08: 状態ごとの可否と共通前処理。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { GroupRecord } from "@/features/safety/types";
import type { GroupLike } from "@/features/groups/lifecycle/types";
import { canCollectStamps, canReview } from "@/features/groups/lifecycle/policy";
import { assertGroupAccess } from "@/features/safety/guards/access";
import { unavailableState } from "@/lib/errors";
import type { RallyAccess, RallyUnavailableReason } from "./types";
import { UNAVAILABLE_MESSAGES } from "./messages";

export type RallyContext = { group: GroupRecord; access: RallyAccess };

function stampReason(status: string): RallyUnavailableReason | null {
  switch (status) {
    case "recruiting": case "min_reached": case "withdrawal_period": return "recruiting";
    case "confirmed": return "not_started";
    case "completed": return "finished";
    case "cancelled": return "cancelled";
    case "replanned": return "replanned";
    default: return null;
  }
}

function reviewReason(status: string): RallyUnavailableReason | null {
  switch (status) {
    case "recruiting": case "min_reached": case "withdrawal_period": case "confirmed": return "not_started";
    case "cancelled": return "cancelled";
    case "replanned": return "replanned";
    default: return null;
  }
}

export function rallyAccess(g: Pick<GroupRecord, "lifecycle">): RallyAccess {
  const like = g as unknown as GroupLike;
  const stamp = canCollectStamps(like);
  const review = canReview(like);
  const status = g.lifecycle.status;
  return {
    canView: true,
    canCollectStamps: stamp,
    canReviewRead: review,
    canReviewWrite: review,
    stampReason: stamp ? null : stampReason(status),
    reviewReason: review ? null : reviewReason(status),
  };
}

export function loadRallyContext(user: DemoUser, groupId: Id): RallyContext {
  const group = assertGroupAccess(user.id, groupId, "member");
  return { group, access: rallyAccess(group) };
}

export function assertRallyOp(ctx: RallyContext, op: "stamp" | "review"): void {
  const ok = op === "stamp" ? ctx.access.canCollectStamps : ctx.access.canReviewWrite;
  if (ok) return;
  const reason = (op === "stamp" ? ctx.access.stampReason : ctx.access.reviewReason) ?? "not_started";
  throw unavailableState(UNAVAILABLE_MESSAGES[reason], { reason, detail: { state: ctx.group.lifecycle.status } });
}
