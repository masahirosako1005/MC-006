// 条件変更・幹事の中止(設計 04 LCY-FN-14・15)。署名スタブ(P-2-11 で実装)。
import type { DateStr, DemoUser, Id } from "@/lib/groups-types";
import type { LifecycleView, OrganizerCancelReason } from "./types";

export function organizerCancel(user: DemoUser, groupId: Id, reason: OrganizerCancelReason): LifecycleView {
  void user; void groupId; void reason;
  throw new Error("not implemented");
}
export function changeConditions(
  user: DemoUser, groupId: Id, patch: { minMembers?: number; deadlineDate?: DateStr },
): LifecycleView {
  void user; void groupId; void patch;
  throw new Error("not implemented");
}
