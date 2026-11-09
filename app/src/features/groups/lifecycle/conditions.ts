// 条件変更・幹事の中止(設計 04 LCY-FN-14・15)。
import { clock } from "@/lib/clock";
import { addDays, startOfNextJstDay } from "@/lib/datetime";
import { conflict, forbidden, invalidInput, notFound, unavailableState } from "@/lib/errors";
import { tx } from "@/lib/groups-store";
import type { DateStr, DemoUser, Id } from "@/lib/groups-types";
import { applyLifecyclePatch } from "@/features/groups/core/service";
import { notify } from "@/features/notify/service";
import { onMembershipChanged } from "./evaluate";
import { LIFECYCLE_POLICY, canChangeConditions, canOrganizerCancel } from "./policy";
import { applyDue } from "./transitions";
import type { GroupLifecycle, LifecycleView, OrganizerCancelReason } from "./types";
import { getLifecycleView } from "./view";

const REASONS: readonly OrganizerCancelReason[] = ["schedule_conflict", "safety_concern", "weather_or_closure", "other"];

export function organizerCancel(user: DemoUser, groupId: Id, reason: OrganizerCancelReason): LifecycleView {
  tx((d) => {
    const g = d.groups.get(groupId);
    if (!g) throw notFound("グループ");
    if (g.organizerId !== user.id) throw forbidden("幹事のみができる操作です。", { reason: "not_organizer" });
    if (!REASONS.includes(reason)) throw invalidInput({ reason: "中止の理由を選んでください。" });
    if (!canOrganizerCancel(g)) throw unavailableState("この状態では中止できません。", { reason: "cannot_cancel" });
    applyDue(groupId, {
      event: "organizer_cancelled", to: "cancelled", effectiveAt: clock.nowIso(), cancelReason: "organizer_cancelled",
    }, clock.now(), g.lifecycle.revision);
    // 幹事が選んだ理由は通知に含めず、状態の記録として保存する(通知・イベントの後)。
    const after = d.groups.get(groupId)!;
    applyLifecyclePatch(groupId, after.lifecycle.revision, { organizerCancelReason: reason });
  });
  return getLifecycleView(user, groupId);
}

export function changeConditions(
  user: DemoUser, groupId: Id, patch: { minMembers?: number; deadlineDate?: DateStr },
): LifecycleView {
  tx((d) => {
    const g = d.groups.get(groupId);
    if (!g) throw notFound("グループ");
    if (g.organizerId !== user.id) throw forbidden("幹事のみができる操作です。", { reason: "not_organizer" });
    if (!canChangeConditions(g)) {
      throw unavailableState("この状態では条件を変更できません。", { reason: "cannot_change_conditions" });
    }
    const lc = g.lifecycle;
    const next: Partial<GroupLifecycle> = {};
    let minChange: { from: number; to: number } | undefined;
    let dlChange: { from: DateStr; to: DateStr } | undefined;

    if (patch.minMembers !== undefined && patch.minMembers !== lc.minMembers) {
      const m = patch.minMembers;
      if (!Number.isInteger(m) || m < LIFECYCLE_POLICY.minMembersFloor || m > g.capacity) {
        throw invalidInput({ minMembers: "最少人数は 2 人以上、定員以下の整数にしてください。" });
      }
      if (LIFECYCLE_POLICY.allowLowerMinOnly && m > lc.minMembers) {
        throw invalidInput({ minMembers: "最少人数は下げる方向にだけ変更できます。" });
      }
      next.minMembers = m;
      minChange = { from: lc.minMembers, to: m };
    }
    if (patch.deadlineDate !== undefined && patch.deadlineDate !== lc.deadlineDate) {
      const dl = patch.deadlineDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dl) || dl < lc.deadlineDate || dl < clock.today()) {
        throw invalidInput({ deadlineDate: "締切は今の締切より後の日付にしてください。" });
      }
      if (addDays(dl, LIFECYCLE_POLICY.withdrawalDays) > g.trip.startDate) {
        throw invalidInput({ deadlineDate: "締切は辞退期間を含めて旅行開始日までに収めてください。" });
      }
      if (lc.deadlineExtendedCount >= LIFECYCLE_POLICY.maxDeadlineExtensions) {
        throw conflict("締切の延長は 1 回までです。", { reason: "deadline_extension_limit" });
      }
      next.deadlineDate = dl;
      next.deadlineAt = startOfNextJstDay(dl);
      next.deadlineExtendedCount = lc.deadlineExtendedCount + 1;
      next.deadlineSoonNoticeSent = false;
      next.withdrawalEndingNoticeSent = false;
      dlChange = { from: lc.deadlineDate, to: dl };
    }
    if (!minChange && !dlChange) throw invalidInput({ minMembers: "変更する項目を指定してください。" });

    const updated = applyLifecyclePatch(groupId, lc.revision, next);
    notify({
      kind: "conditions_changed", groupId, eventKey: `cond:${updated.revision}`,
      params: {
        groupTitle: g.name,
        ...(minChange ? { minParticipants: minChange } : {}),
        ...(dlChange ? { deadline: dlChange } : {}),
      },
      recipients: [{ type: "groupMembers", excludeOrganizer: true }, { type: "pendingApplicants" }],
    });
    onMembershipChanged(groupId, clock.now());
  });
  return getLifecycleView(user, groupId);
}
