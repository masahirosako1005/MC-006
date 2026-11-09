// 辞退・退会(設計 04 LCY-FN-13、契約 4.5 の 6 手順)。
import { clock } from "@/lib/clock";
import { conflict, forbidden, notFound, unavailableState } from "@/lib/errors";
import { emit } from "@/lib/events";
import { newId, tx } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { countActiveMembers, markMemberLeft } from "@/features/groups/core/service";
import { notify } from "@/features/notify/service";
import { onMembershipChanged } from "./evaluate";
import { canWithdraw } from "./policy";
import type { WithdrawPhase, WithdrawResult } from "./types";

export function withdraw(user: DemoUser, groupId: Id, now: Date = clock.now()): WithdrawResult {
  return tx((d) => {
    const g = d.groups.get(groupId);
    if (!g) throw notFound("グループ");
    const row = d.members.list().find((m) => m.groupId === groupId && m.userId === user.id);
    if (!row) throw forbidden("グループのメンバーのみができる操作です。", { reason: "not_member" });
    if (row.status === "left") throw conflict("すでに辞退しています。", { reason: "already_withdrawn" });
    if (row.role === "organizer") {
      throw forbidden("幹事は辞退できません。中止を使ってください。", { reason: "organizer_cannot_withdraw" });
    }
    if (!canWithdraw(g)) throw unavailableState("この状態では辞退・退会できません。", { reason: "cannot_withdraw" });

    // (1) 確認済み → (2) markMemberLeft → (3) Withdrawal → (4) notify → (5) emit → (6) 人数による遷移
    const phase = g.lifecycle.status as WithdrawPhase;
    const at = clock.nowIso();
    markMemberLeft(groupId, user.id, at);
    const countAfter = countActiveMembers(groupId);
    const wd = d.withdrawals.insert({
      id: newId("wd"), groupId, userId: user.id, withdrawnAt: at, phase, countAfter, causedTransition: null,
    });
    notify({
      kind: "withdrawal_received", groupId, eventKey: `wd:${wd.id}`,
      params: { groupTitle: g.name, count: countAfter, minParticipants: g.lifecycle.minMembers },
      recipients: [{ type: "organizer" }],
    });
    emit({ type: "member_left", groupId, userId: user.id, phase, withdrawalId: wd.id, at });

    const ev = onMembershipChanged(groupId, now);
    const first = ev.applied[0];
    if (first && first.event !== "deadline_near" && first.event !== "withdraw_period_ending") {
      d.withdrawals.update(wd.id, { causedTransition: first.event });
    }
    const after = d.groups.get(groupId)!;
    return {
      status: after.lifecycle.status, phase, cancelled: after.lifecycle.status === "cancelled",
      currentCount: countAfter,
    };
  });
}
