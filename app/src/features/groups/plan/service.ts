// 05 サービス層(PLN-FILE-05)。すべて同期。書き込みは tx の中で行う。
import type { DemoUser, Id } from "@/lib/groups-types";
import { db, newId, tx, type Db } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import { conflict, forbidden, invalidInput, notFound, unavailableState } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import type { Group } from "@/features/groups/core/types";
import { canEdit, canReadHistory } from "@/features/groups/lifecycle/policy";
import { assertGroupAccess } from "@/features/safety/guards/access";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { PLAN_MESSAGES } from "./messages";
import { isWithinSchedule } from "./validation";
import { buildPlanView, itemView, meetingView, memoView, spotExists } from "./view";
import type {
  CreatePlanItemInput, GroupPlan, MeetingNoteView, PlanItem, PlanItemId, PlanItemView, PlanView,
  ReorderInput, ScheduleMemoView, UpdateMeetingInput, UpdateMemoInput, UpdatePlanItemInput,
} from "./types";

type U = Readonly<DemoUser>;
type Trip = { startDate: string; endDate: string };

const mismatch = (current: unknown) =>
  conflict(PLAN_MESSAGES.conflict, { reason: "version_mismatch", detail: { current: current as Record<string, unknown> } });

export function emptyPlan(groupId: Id): GroupPlan {
  const meta = { version: 0, updatedBy: null, updatedAt: null };
  return {
    id: groupId,
    groupId,
    meeting: { text: "", spotId: null, date: null, time: null, ...meta },
    scheduleMemo: { text: "", ...meta },
    items: [],
    itemsRevision: 0,
  };
}

export function ensurePlan(d: Db, groupId: Id): Readonly<GroupPlan> {
  return d.plans.get(groupId) ?? d.plans.insert(emptyPlan(groupId));
}

export function sortItems(items: readonly PlanItem[]): PlanItem[] {
  return [...items].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq));
}

export function assertCanRead(user: U, groupId: Id): Group {
  const g = assertGroupAccess(user.id, groupId, "member");
  if (!canReadHistory(g)) throw forbidden();
  return g;
}

export function assertCanEdit(user: U, groupId: Id): Group {
  const g = assertCanRead(user, groupId);
  if (!canEdit(g)) {
    throw unavailableState(PLAN_MESSAGES.readOnly(g.lifecycle.status), { detail: { state: g.lifecycle.status } });
  }
  return g;
}

export function assertPlanTextsAllowed(
  input: { title?: string; note?: string; text?: string },
  kind: "item" | "meeting" | "memo",
  ackReview?: boolean,
): void {
  const opts = { ackReview };
  if (kind === "item") {
    if (input.title !== undefined) assertTextAllowed(input.title, "plan_item_title", "title", opts);
    if (input.note) assertTextAllowed(input.note, "plan_note", "note", opts);
  } else if (input.text) {
    assertTextAllowed(input.text, "plan_note", "text", opts);
  }
}

function checkSpot(spotId: number | null | undefined): void {
  if (spotId !== null && spotId !== undefined && !spotExists(spotId)) {
    throw invalidInput({ spotId: PLAN_MESSAGES.spotNotFound });
  }
}
function checkDate(date: string | null | undefined, trip: Trip, field = "date"): void {
  if (date !== null && date !== undefined && !isWithinSchedule(date, trip)) {
    throw invalidInput({ [field]: PLAN_MESSAGES.dateOutOfRange(trip.startDate, trip.endDate) });
  }
}

const stamp = (user: U) => ({ updatedBy: user.id, updatedAt: clock.nowIso() });

/** その日の seq を 1..n に詰める(元の順序を保つ)。 */
function compact(items: PlanItem[], date: string): PlanItem[] {
  const order = items.filter((i) => i.date === date).sort((a, b) => a.seq - b.seq);
  const seqOf = new Map(order.map((i, n) => [i.id, n + 1]));
  return items.map((i) => (seqOf.has(i.id) ? { ...i, seq: seqOf.get(i.id)! } : i));
}
const nextSeq = (items: readonly PlanItem[], date: string): number =>
  items.filter((i) => i.date === date).reduce((m, i) => Math.max(m, i.seq), 0) + 1;

function checkCounts(items: readonly PlanItem[], date: string, excludeId?: PlanItemId): void {
  const rest = items.filter((i) => i.id !== excludeId);
  if (rest.length >= LIMITS.PLAN_ITEMS.maxItems) {
    throw invalidInput({ items: PLAN_MESSAGES.itemsTotalMax(LIMITS.PLAN_ITEMS.maxItems) });
  }
  if (rest.filter((i) => i.date === date).length >= LIMITS.PLAN_ITEMS.maxPerDate) {
    throw invalidInput({ items: PLAN_MESSAGES.itemsPerDateMax(LIMITS.PLAN_ITEMS.maxPerDate) });
  }
}

function newItemId(): PlanItemId {
  for (;;) {
    const id = newId("pi");
    if (!db().plans.list().some((p) => p.items.some((i) => i.id === id))) return id;
  }
}

export function getPlan(user: U, groupId: Id): PlanView {
  const g = assertCanRead(user, groupId);
  return buildPlanView(user, g, db().plans.get(groupId) ?? emptyPlan(groupId));
}

export function listItems(user: U, groupId: Id): { items: PlanItemView[]; itemsRevision: number } {
  const g = assertCanRead(user, groupId);
  const plan = db().plans.get(groupId) ?? emptyPlan(groupId);
  return { items: sortItems(plan.items).map((i) => itemView(groupId, g.trip, i)), itemsRevision: plan.itemsRevision };
}

export function updateMeeting(user: U, groupId: Id, input: UpdateMeetingInput): MeetingNoteView {
  return tx((d) => {
    const g = assertCanEdit(user, groupId);
    const text = input.text ?? "";
    const spotId = input.spotId ?? null;
    const date = input.date ?? null;
    const time = input.time ?? null;
    assertPlanTextsAllowed({ text }, "meeting", input.ackReview);
    checkSpot(spotId);
    checkDate(date, g.trip, "date");
    if ((date !== null || time !== null) && text === "" && spotId === null) {
      throw invalidInput({ text: PLAN_MESSAGES.meetingNeedsPlace });
    }
    const plan = ensurePlan(d, groupId);
    if (plan.meeting.version !== input.baseVersion) throw mismatch(meetingView(groupId, g.trip, plan.meeting));
    const meeting = { text, spotId, date, time, version: plan.meeting.version + 1, ...stamp(user) };
    d.plans.update(groupId, { meeting });
    return meetingView(groupId, g.trip, meeting);
  });
}

export function updateScheduleMemo(user: U, groupId: Id, input: UpdateMemoInput): ScheduleMemoView {
  return tx((d) => {
    assertCanEdit(user, groupId);
    const text = input.text ?? "";
    assertPlanTextsAllowed({ text }, "memo", input.ackReview);
    const plan = ensurePlan(d, groupId);
    if (plan.scheduleMemo.version !== input.baseVersion) throw mismatch(memoView(groupId, plan.scheduleMemo));
    const scheduleMemo = { text, version: plan.scheduleMemo.version + 1, ...stamp(user) };
    d.plans.update(groupId, { scheduleMemo });
    return memoView(groupId, scheduleMemo);
  });
}

export function createItem(user: U, groupId: Id, input: CreatePlanItemInput): PlanItemView {
  return tx((d) => {
    const g = assertCanEdit(user, groupId);
    assertPlanTextsAllowed({ title: input.title, note: input.note }, "item", input.ackReview);
    checkSpot(input.spotId);
    checkDate(input.date, g.trip);
    const plan = ensurePlan(d, groupId);
    checkCounts(plan.items, input.date);
    const now = clock.nowIso();
    const item: PlanItem = {
      id: newItemId(),
      groupId,
      date: input.date,
      time: input.time ?? null,
      title: input.title,
      spotId: input.spotId ?? null,
      note: input.note ?? "",
      seq: nextSeq(plan.items, input.date),
      version: 1,
      createdBy: user.id,
      createdAt: now,
      updatedBy: user.id,
      updatedAt: now,
    };
    d.plans.update(groupId, { items: [...plan.items, item], itemsRevision: plan.itemsRevision + 1 });
    return itemView(groupId, g.trip, item);
  });
}

export function updateItem(user: U, groupId: Id, itemId: PlanItemId, input: UpdatePlanItemInput): PlanItemView {
  return tx((d) => {
    const g = assertCanEdit(user, groupId);
    const plan = ensurePlan(d, groupId);
    const cur = plan.items.find((i) => i.id === itemId);
    if (!cur) throw notFound("項目");
    const { baseVersion, ackReview, ...fields } = input;
    if (Object.values(fields).every((x) => x === undefined)) throw invalidInput({ _: PLAN_MESSAGES.nothingToChange });
    assertPlanTextsAllowed({ title: fields.title, note: fields.note }, "item", ackReview);
    checkSpot(fields.spotId);
    checkDate(fields.date, g.trip);
    const dateChanged = fields.date !== undefined && fields.date !== cur.date;
    if (dateChanged) checkCounts(plan.items, fields.date!, itemId);
    if (cur.version !== baseVersion) throw mismatch(itemView(groupId, g.trip, cur));

    const next: PlanItem = { ...cur, version: cur.version + 1, ...stamp(user) };
    if (fields.time !== undefined) next.time = fields.time;
    if (fields.title !== undefined) next.title = fields.title;
    if (fields.spotId !== undefined) next.spotId = fields.spotId;
    if (fields.note !== undefined) next.note = fields.note;
    let items = plan.items.map((i) => (i.id === itemId ? next : i));
    let itemsRevision = plan.itemsRevision;
    if (dateChanged) {
      next.date = fields.date!;
      next.seq = nextSeq(plan.items.filter((i) => i.id !== itemId), next.date);
      items = compact(items, cur.date);
      itemsRevision += 1;
    }
    d.plans.update(groupId, { items, itemsRevision });
    return itemView(groupId, g.trip, items.find((i) => i.id === itemId)!);
  });
}

export function deleteItem(user: U, groupId: Id, itemId: PlanItemId, baseVersion: number): { itemsRevision: number } {
  return tx((d) => {
    const g = assertCanEdit(user, groupId);
    const plan = ensurePlan(d, groupId);
    const cur = plan.items.find((i) => i.id === itemId);
    if (!cur) throw notFound("項目");
    if (cur.version !== baseVersion) throw mismatch(itemView(groupId, g.trip, cur));
    const items = compact(plan.items.filter((i) => i.id !== itemId), cur.date);
    const itemsRevision = plan.itemsRevision + 1;
    d.plans.update(groupId, { items, itemsRevision });
    return { itemsRevision };
  });
}

export function reorderItems(
  user: U,
  groupId: Id,
  input: ReorderInput,
): { items: PlanItemView[]; itemsRevision: number } {
  return tx((d) => {
    const g = assertCanEdit(user, groupId);
    const plan = ensurePlan(d, groupId);
    // 古い一覧での並び替えは、ID の過不足より先に競合として返す。
    if (plan.itemsRevision !== input.baseRevision) {
      throw mismatch({ items: sortItems(plan.items).map((i) => itemView(groupId, g.trip, i)), itemsRevision: plan.itemsRevision });
    }
    const ofDate = plan.items.filter((i) => i.date === input.date);
    const ids = new Set(ofDate.map((i) => i.id));
    const same = input.orderedIds.length === ids.size && input.orderedIds.every((id) => ids.has(id));
    if (!same) throw invalidInput({ orderedIds: PLAN_MESSAGES.orderMismatch });
    const seqOf = new Map(input.orderedIds.map((id, n) => [id, n + 1]));
    const items = plan.items.map((i) => (seqOf.has(i.id) ? { ...i, seq: seqOf.get(i.id)! } : i));
    const itemsRevision = plan.itemsRevision + 1;
    d.plans.update(groupId, { items, itemsRevision });
    return { items: sortItems(items).map((i) => itemView(groupId, g.trip, i)), itemsRevision };
  });
}
