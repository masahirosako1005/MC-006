// 遷移・操作 → 10 の notify 入力の組み立て(設計 04 §5.7)。
import type { Id } from "@/lib/groups-types";
import { requireGroup, activeMembers } from "@/lib/authz";
import { notify } from "@/features/notify/service";
import type { CancelReasonCode, GroupStatus } from "./types";

export function noticeForTransition(groupId: Id, from: GroupStatus, to: GroupStatus, cancelReason: CancelReasonCode | null): void {
  const g = requireGroup(groupId);
  const groupTitle = g.name;
  const count = activeMembers(groupId).length;
  const minParticipants = g.lifecycle.minMembers;
  if (to === "min_reached" && from === "recruiting") {
    notify({ kind: "min_reached", groupId, eventKey: "reached", params: { groupTitle, minParticipants, count },
      recipients: [{ type: "groupMembers" }] });
  } else if (to === "withdrawal_period") {
    notify({ kind: "withdraw_period_started", groupId, eventKey: "wp-start",
      params: { groupTitle, count, withdrawUntil: g.lifecycle.withdrawalEndsAt ?? g.lifecycle.deadlineAt },
      recipients: [{ type: "groupMembers" }] });
  } else if (to === "confirmed") {
    notify({ kind: "confirmed", groupId, eventKey: "confirmed", params: { groupTitle, count },
      recipients: [{ type: "groupMembers" }] });
  } else if (to === "cancelled") {
    notify({ kind: "cancelled", groupId, eventKey: "cancelled",
      params: { groupTitle, reason: cancelReason ?? g.lifecycle.cancelReason ?? "min_not_reached", minParticipants },
      recipients: [{ type: "groupMembers" }, { type: "pendingApplicants" }] });
  }
  // T3・T9・T10 は通知しない。
}

/** 状態を変えない通知(withdraw_period_ending)。deadline_near は見送り。 */
export function noticeForDue(groupId: Id, event: string): void {
  if (event !== "withdraw_period_ending") return;
  const g = requireGroup(groupId);
  notify({ kind: "withdraw_period_ending", groupId, eventKey: "wp-end",
    params: { groupTitle: g.name, count: activeMembers(groupId).length },
    recipients: [{ type: "groupMembers" }] });
}
