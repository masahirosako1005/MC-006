// 合成層(所有 01。どのモジュールからも import されない)。契約 5.1・5.5。
import { created, ok, route } from "@/lib/api-route";
import type { Schema } from "@/lib/validation";
import { clock } from "@/lib/clock";
import { notFound, invalidInput } from "@/lib/errors";
import { db, tx } from "@/lib/groups-store";
import { isMember } from "@/lib/authz";
import type { GroupParams } from "@/features/stub";
import { createGroup, getGroup } from "@/features/groups/core/service";
import { validateCreateGroupInput } from "@/features/groups/core/validation";
import { buildInitialLifecycle, recordCreated, validateLifecycleInput } from "@/features/groups/lifecycle";
import { getPublicGroup } from "@/features/groups/discovery/service";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { checkRate } from "@/features/safety/guards/rate-limit";
import { requireVerified } from "@/features/safety/verification/verification-service";
import { isGroupVisibleTo } from "@/features/safety/visibility/group";

// 本文の生の値を受け取る。型・未知キーの処理は 01 の validateCreateGroupInput が行う。
const RawBody: Schema<Record<string, unknown>> = {
  parse(input, path, issues) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      issues[path || "body"] = "本文の形式が正しくありません。";
      return undefined as never;
    }
    return input as Record<string, unknown>;
  },
};

export const createGroupHandler = route(async (c) => {
  const user = c.user;
  requireVerified(user.id, "create_group");
  checkRate("group_create", user.id);

  const raw = await c.body(RawBody);
  const ackReview = raw.ackReview === true;
  const input = validateCreateGroupInput(raw);

  const opts = { ackReview };
  assertTextAllowed(input.name, "group_name", "name", opts);
  assertTextAllowed(input.trip.destination, "group_destination", "trip.destination", opts);
  if (input.trip.dateNote) assertTextAllowed(input.trip.dateNote, "group_date_note", "trip.dateNote", opts);
  if (input.description) assertTextAllowed(input.description, "group_description", "description", opts);
  input.tags.forEach((t, i) => assertTextAllowed(t, "group_tag", `tags.${i}`, opts));

  if (typeof raw.deadlineDate !== "string") throw invalidInput({ deadlineDate: "締切日を入力してください。" });
  const now = clock.now();
  const lcIn = {
    ...(typeof raw.minMembers === "number" ? { minMembers: raw.minMembers } : {}),
    deadlineDate: raw.deadlineDate,
  };
  const groupId = tx(() => {
    const lifecycleInput = validateLifecycleInput(lcIn, {
      capacity: input.capacity,
      startDate: input.trip.startDate,
      now,
    });
    const lifecycle = buildInitialLifecycle(lifecycleInput, now);
    const g = createGroup(user, input, lifecycle);
    recordCreated(g.id);
    return g.id;
  });
  return created(getGroup(user, groupId), `/api/groups/${groupId}`);
});

export const getGroupDetailHandler = route<GroupParams>(async (c) => {
  const user = c.user;
  const groupId = await c.id("groupId", "g");
  const group = db().groups.get(groupId);
  if (!group) throw notFound("グループ");
  if (isMember(user, group)) return ok(getGroup(user, groupId));
  if (isGroupVisibleTo(user.id, group)) return ok(getPublicGroup(user, groupId));
  throw notFound("グループ");
});
