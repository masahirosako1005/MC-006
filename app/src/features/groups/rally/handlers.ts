// 08: Route Handler(RLY-API-01〜07)。処理順はアクセス → 状態 → 本文。
import { route, created, noContent } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";
import { assertRallyOp, loadRallyContext } from "./access";
import { addPhotoPost, getReview, removePhotoPost, saveMemo, saveSurvey } from "./review";
import { acquireForGroup, groupProgress } from "./stamps";
import type { SurveyInput } from "./types";

const scale = () => v.int({ min: 1, max: 5 });
const stampBody = v.object({ keyword: v.string({ min: 1, max: 64 }) });
const memoBody = v.object({
  body: v.string({ multiline: true, min: LIMITS.RALLY_MEMO.min, max: LIMITS.RALLY_MEMO.max }),
  ackReview: v.boolean({ optional: true }),
});
const surveyBody = v.object({
  satisfaction: scale(), planClarity: scale(), wantAgain: v.enum(["yes", "maybe", "no"] as const),
  localInteraction: scale(), localExploration: scale(),
});
const photoBody = v.object({
  spotId: v.nullable(v.int({ min: 1, optional: true })),
  caption: v.string({ optional: true, max: LIMITS.PHOTO_CAPTION.max }),
  ackReview: v.boolean({ optional: true }),
});

export const getRallyHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return groupProgress(c.user, groupId);
});

export const postStampHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  assertRallyOp(loadRallyContext(c.user, groupId), "stamp");
  const b = await c.body(stampBody);
  return created(acquireForGroup(c.user, groupId, b.keyword));
});

export const getReviewHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return getReview(c.user, groupId);
});

export const putMemoHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  assertRallyOp(loadRallyContext(c.user, groupId), "review");
  const b = await c.body(memoBody);
  return saveMemo(c.user, groupId, { body: b.body, ackReview: b.ackReview });
});

export const putSurveyHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  assertRallyOp(loadRallyContext(c.user, groupId), "review");
  const b = await c.body(surveyBody);
  return saveSurvey(c.user, groupId, b as SurveyInput);
});

export const postPhotoHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  assertRallyOp(loadRallyContext(c.user, groupId), "review");
  const b = await c.body(photoBody);
  return created(addPhotoPost(c.user, groupId, { spotId: b.spotId, caption: b.caption ?? "", ackReview: b.ackReview }));
});

export const deletePhotoHandler = route<{ groupId: string; photoId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const photoId = await c.id("photoId", "ph");
  assertRallyOp(loadRallyContext(c.user, groupId), "review");
  removePhotoPost(c.user, groupId, photoId);
  return noContent();
});
