// 05 の本文・クエリのスキーマ(PLN-FILE-03)。
import type { DateStr } from "@/lib/groups-types";
import { v, type Schema } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";

export function isWithinSchedule(d: DateStr, trip: { startDate: DateStr; endDate: DateStr }): boolean {
  return trip.startDate <= d && d <= trip.endDate;
}
export function countLines(s: string): number {
  return s === "" ? 0 : s.split("\n").length;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const VERSION = { min: 0, max: 2147483647 } as const;

/** PATCH 用: キーが無ければ省略(undefined)。null・値は元のスキーマに任せる。 */
function maybe<T>(s: Schema<T>): Schema<T | undefined> {
  return { parse: (input, path, issues) => (input === undefined ? undefined : (s.parse(input, path, issues) as T)) };
}

const ackReview = v.boolean({ optional: true });
const time = v.nullable(v.string({ pattern: TIME, optional: true }));
const spotId = v.nullable(v.int({ min: 1, optional: true }));
const noteOpts = { max: LIMITS.PLAN_ITEM_NOTE.max, maxLines: LIMITS.PLAN_ITEM_NOTE.maxLines, multiline: true, optional: true } as const;
const title = v.string({ min: LIMITS.PLAN_ITEM_TITLE.min, max: LIMITS.PLAN_ITEM_TITLE.max });

export const MeetingBody = v.object({
  baseVersion: v.int(VERSION),
  text: v.string({ max: LIMITS.MEETING.max, multiline: true, optional: true, default: "" }),
  spotId,
  date: v.nullable(v.date({ optional: true })),
  time,
  ackReview,
});
export const MemoBody = v.object({
  baseVersion: v.int(VERSION),
  text: v.string({ max: LIMITS.SCHEDULE_MEMO.max, multiline: true, optional: true, default: "" }),
  ackReview,
});
export const CreateItemBody = v.object({
  date: v.date(),
  time,
  title,
  spotId,
  note: v.string({ ...noteOpts, default: "" }),
  ackReview,
});
export const UpdateItemBody = v.object({
  baseVersion: v.int(VERSION),
  date: maybe(v.date()),
  time: maybe(time),
  title: maybe(title),
  spotId: maybe(spotId),
  note: maybe(v.string(noteOpts)),
  ackReview,
});
export const OrderBody = v.object({
  date: v.date(),
  orderedIds: v.array(v.id("pi"), { max: LIMITS.PLAN_ITEMS.maxPerDate, unique: true }),
  baseRevision: v.int(VERSION),
});
export const DeleteQuery = v.object({ baseVersion: v.int({ ...VERSION, coerce: true }) });
