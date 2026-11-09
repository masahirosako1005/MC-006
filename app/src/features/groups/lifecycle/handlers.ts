// 04 のハンドラ(LCY-API-01〜06)。薄く: 検証 → 呼び出し → 応答。LCY-API-07(status-log)は見送り。
import { created, route } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";
import { changeConditions, organizerCancel } from "./conditions";
import { getReplanDraft, replan } from "./replan";
import { getLifecycleView } from "./view";
import { withdraw } from "./withdraw";

const CANCEL_REASONS = ["schedule_conflict", "safety_concern", "weather_or_closure", "other"] as const;

export const getLifecycleHandler = route<GroupParams>(async (c) => {
  return getLifecycleView(c.user, await c.id("groupId", "g"));
});

export const withdrawHandler = route<GroupParams>(async (c) => {
  return withdraw(c.user, await c.id("groupId", "g"));
});

export const cancelHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  const b = await c.body(v.object({ reason: v.enum(CANCEL_REASONS) }));
  return organizerCancel(c.user, id, b.reason);
});

export const changeConditionsHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  const b = await c.body(v.object({
    minMembers: v.int({ optional: true }),
    deadlineDate: v.date({ optional: true }),
  }));
  return changeConditions(c.user, id, {
    ...(b.minMembers !== undefined ? { minMembers: b.minMembers } : {}),
    ...(b.deadlineDate ? { deadlineDate: b.deadlineDate } : {}),
  });
});

export const getReplanDraftHandler = route<GroupParams>(async (c) => {
  return getReplanDraft(c.user, await c.id("groupId", "g"));
});

export const replanHandler = route<GroupParams>(async (c) => {
  const id = await c.id("groupId", "g");
  const b = await c.body(v.object({
    name: v.string({ optional: true }),
    destination: v.string({ optional: true }),
    minMembers: v.int({ optional: true }),
    startDate: v.date(),
    endDate: v.date(),
    deadlineDate: v.date(),
    ackReview: v.boolean({ optional: true }),
  }));
  const r = replan(c.user, id, {
    name: b.name || undefined,
    destination: b.destination || undefined,
    minMembers: b.minMembers,
    startDate: b.startDate,
    endDate: b.endDate,
    deadlineDate: b.deadlineDate,
    ackReview: b.ackReview,
  });
  return created(r, `/api/groups/${r.groupId}`);
});

// 見送り(統一仕様書 16.2)。
export const getStatusLogHandler = stubRoute<GroupParams>();
