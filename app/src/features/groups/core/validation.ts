// 01 の項目の検証(純粋関数。クライアントと共有)。DB を引く検査(地方の実在)は service.ts で行う。
import { LIMITS } from "@/lib/limits";
import { invalidInput } from "@/lib/errors";
import { v, parse } from "@/lib/validation";
import type { Schema } from "@/lib/validation";
import { addDays, daysBetween } from "@/lib/datetime";
import type { CreateGroupInput, Trip, UpdateGroupPatch } from "@/features/groups/types";
import { INVITE_CODE_LENGTH, MAX_START_AHEAD_DAYS, MAX_TRIP_DAYS } from "./constants";
import { GROUP_MESSAGES as M } from "./messages";

/** 未指定のままにする(v.object が項目を省く)ためのラッパー。 */
function opt<T>(schema: Schema<T>): Schema<T | undefined> {
  return {
    parse(input, path, issues) {
      if (input === undefined) return undefined;
      return schema.parse(input, path, issues);
    },
  };
}

const TripSchema = v.object({
  destination: v.string(LIMITS.DESTINATION),
  startDate: v.date(),
  endDate: v.date(),
  dateNote: v.string({ optional: true, max: LIMITS.DATE_NOTE.max }),
});
const TagsSchema = v.array(v.string({ min: LIMITS.TAG.min, max: LIMITS.TAG.max }), { max: LIMITS.TAG.maxItems });

/** POST /api/groups の本文(CreateGroupRequest)。lifecycle の 2 項目は型だけ受ける(検証は 04)。 */
const createShape = {
  name: v.string(LIMITS.GROUP_NAME),
  campaign: v.string({ min: 1, max: 40, pattern: /^[a-z0-9-]{1,40}$/ }),
  region: v.slugId("r"),
  trip: TripSchema,
  capacity: v.int(LIMITS.CAPACITY),
  visibility: v.enum(["public", "private"] as const),
  tags: v.array(v.string({ min: LIMITS.TAG.min, max: LIMITS.TAG.max }), { max: LIMITS.TAG.maxItems, optional: true }),
  description: v.string({ optional: true, multiline: true, max: LIMITS.DESCRIPTION.max }),
};
const CreateInputSchema = v.object(createShape);

export const CreateGroupBody = v.object({
  ...createShape,
  minMembers: v.int({ optional: true }),
  deadlineDate: v.date(),
  ackReview: v.boolean({ optional: true }),
});

/** PATCH /api/groups/[groupId] の本文(UpdateGroupRequest)。変更する項目だけ。 */
export const UpdateGroupBody = v.object({
  name: opt(v.string(LIMITS.GROUP_NAME)),
  region: opt(v.slugId("r")),
  trip: opt(TripSchema),
  capacity: opt(v.int(LIMITS.CAPACITY)),
  visibility: opt(v.enum(["public", "private"] as const)),
  tags: opt(TagsSchema),
  description: opt(v.string({ optional: true, multiline: true, max: LIMITS.DESCRIPTION.max })),
  ackReview: v.boolean({ optional: true }),
});

function checkTrip(trip: Trip, fields: Record<string, string>, today?: string): void {
  if (trip.startDate > trip.endDate) fields["trip.endDate"] = M.tripOrder;
  else if (daysBetween(trip.startDate, trip.endDate) + 1 > MAX_TRIP_DAYS) fields["trip.endDate"] = M.tripLength;
  if (today && trip.startDate > addDays(today, MAX_START_AHEAD_DAYS)) fields["trip.startDate"] = M.tripAhead;
}

function checkTags(tags: string[], fields: Record<string, string>): void {
  const seen = new Set(tags.map((t) => t.toLowerCase()));
  if (seen.size !== tags.length) fields.tags = M.tagsDuplicate;
}

/** 日程の暦日検査。today は開始日の上限検査に使う(省略時は検査しない)。 */
export function validateTrip(trip: Trip, today?: string): void {
  const fields: Record<string, string> = {};
  checkTrip(trip, fields, today);
  if (Object.keys(fields).length) throw invalidInput(fields);
}

/** 01 の項目の検証。失敗は AppError(invalid_input, fields)。 */
export function validateCreateGroupInput(raw: unknown, today?: string): CreateGroupInput {
  const b = parse(CreateInputSchema, raw);
  const fields: Record<string, string> = {};
  checkTrip(b.trip, fields, today);
  const tags = b.tags ?? [];
  checkTags(tags, fields);
  if (Object.keys(fields).length) throw invalidInput(fields);
  return {
    name: b.name,
    campaign: b.campaign,
    region: b.region,
    trip: b.trip,
    capacity: b.capacity,
    visibility: b.visibility,
    tags,
    description: b.description ?? "",
  };
}

export function validateUpdateGroupPatch(raw: unknown, today?: string): UpdateGroupPatch {
  const b = parse(UpdateGroupBody, raw);
  const fields: Record<string, string> = {};
  if (b.trip) checkTrip(b.trip, fields, today);
  if (b.tags) checkTags(b.tags, fields);
  if (Object.keys(fields).length) throw invalidInput(fields);
  const patch: UpdateGroupPatch = {};
  if (b.name !== undefined) patch.name = b.name;
  if (b.region !== undefined) patch.region = b.region;
  if (b.trip !== undefined) patch.trip = b.trip;
  if (b.capacity !== undefined) patch.capacity = b.capacity;
  if (b.visibility !== undefined) patch.visibility = b.visibility;
  if (b.tags !== undefined) patch.tags = b.tags;
  if (b.description !== undefined) patch.description = b.description;
  return patch;
}

/** 大文字化、ハイフン・空白の除去。形式不正は null。クライアントと共有。 */
export function normalizeInviteCode(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const s = raw.normalize("NFKC").replace(/[\s\-‐-―ー]/g, "").toUpperCase();
  return new RegExp(`^[2-9A-HJ-NP-Z]{${INVITE_CODE_LENGTH}}$`).test(s) ? s : null;
}
