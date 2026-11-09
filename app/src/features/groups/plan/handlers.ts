// 05 の Route Handler(PLN-FILE-06)。
import { created, ok, route } from "@/lib/api-route";
import { v, INVALID } from "@/lib/validation";
import type { Schema } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";
import type { GroupParams } from "@/features/stub";
import {
  createItem, deleteItem, getPlan, listItems, reorderItems, updateItem, updateMeeting, updateScheduleMemo,
} from "./service";
import type {
  CreatePlanItemInput, ReorderInput, UpdateMeetingInput, UpdateMemoInput, UpdatePlanItemInput,
} from "./types";

type ItemParams = { groupId: string; itemId: string };

// 未指定は undefined(PATCH の「変更なし」)。null は「消去」。
const opt = <T,>(s: Schema<T>): Schema<T | undefined> => ({
  parse(input, path, issues) {
    return input === undefined ? undefined : (s.parse(input, path, issues) as T | typeof INVALID);
  },
});
const optNullable = <T,>(s: Schema<T>) => opt(v.nullable(s));

const VERSION = v.int({ min: 0, max: 2147483647 });
const ACK = v.boolean({ optional: true });
const TIME = v.string({ pattern: /^([01]\d|2[0-3]):[0-5]\d$/ });
const TITLE = v.string({ min: LIMITS.PLAN_ITEM_TITLE.min, max: LIMITS.PLAN_ITEM_TITLE.max });
const NOTE = v.string({ max: LIMITS.PLAN_ITEM_NOTE.max, maxLines: LIMITS.PLAN_ITEM_NOTE.maxLines, multiline: true, optional: true });

const MeetingBody = v.object({
  baseVersion: VERSION,
  text: v.string({ max: LIMITS.MEETING.max, multiline: true, optional: true, default: "" }),
  spotId: optNullable(v.int({ min: 1 })),
  date: optNullable(v.date()),
  time: optNullable(TIME),
  ackReview: ACK,
});
const MemoBody = v.object({
  baseVersion: VERSION,
  text: v.string({ max: LIMITS.SCHEDULE_MEMO.max, multiline: true, optional: true, default: "" }),
  ackReview: ACK,
});
const CreateBody = v.object({
  date: v.date(),
  time: optNullable(TIME),
  title: TITLE,
  spotId: optNullable(v.int({ min: 1 })),
  note: NOTE,
  ackReview: ACK,
});
const PatchBody = v.object({
  baseVersion: VERSION,
  date: opt(v.date()),
  time: optNullable(TIME),
  title: opt(TITLE),
  spotId: optNullable(v.int({ min: 1 })),
  note: opt(NOTE),
  ackReview: ACK,
});
const OrderBody = v.object({
  date: v.date(),
  orderedIds: v.array(v.id("pi"), { max: LIMITS.PLAN_ITEMS.maxPerDate, unique: true }),
  baseRevision: VERSION,
});
const DeleteQuery = v.object({ baseVersion: v.int({ min: 0, max: 2147483647, coerce: true }) });

export const getPlanHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return ok(getPlan(c.user, groupId));
});

export const getItemsHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return ok(listItems(c.user, groupId));
});

export const putMeetingHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(MeetingBody);
  return ok(updateMeeting(c.user, groupId, input as UpdateMeetingInput));
});

export const putMemoHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(MemoBody);
  return ok(updateScheduleMemo(c.user, groupId, input as UpdateMemoInput));
});

export const postItemHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(CreateBody);
  const item = createItem(c.user, groupId, input as CreatePlanItemInput);
  return created(item, `/api/groups/${groupId}/plan/items/${item.id}`);
});

export const patchItemHandler = route<ItemParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const itemId = await c.id("itemId", "pi");
  const input = await c.body(PatchBody);
  return ok(updateItem(c.user, groupId, itemId, input as UpdatePlanItemInput));
});

export const deleteItemHandler = route<ItemParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const itemId = await c.id("itemId", "pi");
  const q = c.query(DeleteQuery);
  return ok(deleteItem(c.user, groupId, itemId, q.baseVersion));
});

export const putOrderHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(OrderBody);
  return ok(reorderItems(c.user, groupId, input as ReorderInput));
});
