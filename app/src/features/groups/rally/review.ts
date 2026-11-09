// 08: 振り返り(メモ・アンケート・ダミー写真)。RLY-FN-04〜08。
import { clock } from "@/lib/clock";
import { conflict, forbidden, invalidInput } from "@/lib/errors";
import { db, newId, tx } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { LIMITS } from "@/lib/limits";
import { assertInGroup } from "@/features/safety/guards/access";
import { isBlocked } from "@/features/safety/blocks/block-service";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { assertRallyOp, loadRallyContext } from "./access";
import { listMyRewards } from "./rewards";
import { groupProgress } from "./stamps";
import type { MemberRefDto, PhotoPost, PhotoPostDto, ReviewDto, ReviewMemoDto, SurveyAnswerDto, SurveyInput } from "./types";

const DEFAULT_HUE = 200;

function authorRef(userId: Id, viewerId: Id): MemberRefDto {
  const name = db().profiles.find((p) => p.userId === userId)?.displayName ?? db().users.get(userId)?.displayName ?? "メンバー";
  return { displayName: name, isMe: userId === viewerId };
}

function toSurveyDto(s: Readonly<SurveyInput & { answeredAt: string }>): SurveyAnswerDto {
  return {
    satisfaction: s.satisfaction, planClarity: s.planClarity, wantAgain: s.wantAgain,
    localInteraction: s.localInteraction, localExploration: s.localExploration, answeredAt: s.answeredAt,
  };
}

function spotHue(user: DemoUser, groupId: Id, spotId: number | null): number | undefined {
  if (spotId === null) return DEFAULT_HUE;
  return groupProgress(user, groupId).spots.find((s) => s.spotId === spotId)?.hue;
}

function toPhotoDto(p: Readonly<PhotoPost>, user: DemoUser, hues: Map<number, number>): PhotoPostDto {
  return {
    id: p.id, author: authorRef(p.userId, user.id), spotId: p.spotId,
    hue: p.spotId === null ? DEFAULT_HUE : (hues.get(p.spotId) ?? DEFAULT_HUE),
    caption: p.caption, createdAt: p.createdAt, mine: p.userId === user.id,
  };
}

export function getReview(user: DemoUser, groupId: Id): ReviewDto {
  const ctx = loadRallyContext(user, groupId);
  assertRallyOp(ctx, "review");
  const { group, access } = ctx;
  const progress = groupProgress(user, groupId);
  const hues = new Map(progress.spots.map((s) => [s.spotId, s.hue]));
  const visible = <T extends { userId: Id }>(x: T) => x.userId === user.id || !isBlocked(user.id, x.userId);

  const memos: ReviewMemoDto[] = db().rallyMemos
    .filter((m) => m.groupId === groupId && visible(m))
    .map((m) => ({ id: m.id, author: authorRef(m.userId, user.id), body: m.body, updatedAt: m.updatedAt, mine: m.userId === user.id }))
    .sort((a, b) => Number(b.mine) - Number(a.mine) || a.updatedAt.localeCompare(b.updatedAt));
  const mine = db().rallySurveys.find((s) => s.groupId === groupId && s.userId === user.id);
  const photos = db().rallyPhotos
    .filter((p) => p.groupId === groupId && visible(p))
    .map((p) => toPhotoDto(p, user, hues))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return {
    groupId,
    groupName: group.name,
    period: { start: group.trip.startDate, end: group.trip.endDate },
    status: group.lifecycle.status,
    access,
    progress: {
      totalSpots: progress.totalSpots, acquiredCount: progress.acquiredCount, achievementRate: progress.achievementRate,
      spots: progress.spots, rewards: progress.rewards,
    },
    myRewards: listMyRewards(user.id, groupId),
    memos,
    mySurvey: mine ? toSurveyDto(mine) : null,
    surveyAnswered: db().rallySurveys.count((s) => s.groupId === groupId),
    memberCount: db().members.count((m) => m.groupId === groupId && m.status === "active"),
    photos,
  };
}

export function saveMemo(user: DemoUser, groupId: Id, input: { body: string; ackReview?: boolean }): ReviewMemoDto {
  return tx((d) => {
    const ctx = loadRallyContext(user, groupId);
    assertRallyOp(ctx, "review");
    const len = [...input.body].length;
    if (len < LIMITS.RALLY_MEMO.min || len > LIMITS.RALLY_MEMO.max) {
      throw invalidInput({ body: `${LIMITS.RALLY_MEMO.min}〜${LIMITS.RALLY_MEMO.max} 文字で入力してください。` });
    }
    assertTextAllowed(input.body, "rally_memo", "body", { ackReview: input.ackReview });
    const at = clock.nowIso();
    const cur = d.rallyMemos.find((m) => m.groupId === groupId && m.userId === user.id);
    const row = cur
      ? d.rallyMemos.update(cur.id, { body: input.body, updatedAt: at })
      : d.rallyMemos.insert({ id: newId("rm"), groupId, userId: user.id, body: input.body, updatedAt: at });
    return { id: row.id, author: authorRef(user.id, user.id), body: row.body, updatedAt: row.updatedAt, mine: true };
  });
}

export function saveSurvey(user: DemoUser, groupId: Id, input: SurveyInput): SurveyAnswerDto {
  return tx((d) => {
    const ctx = loadRallyContext(user, groupId);
    assertRallyOp(ctx, "review");
    const at = clock.nowIso();
    const fields = {
      satisfaction: input.satisfaction, planClarity: input.planClarity, wantAgain: input.wantAgain,
      localInteraction: input.localInteraction, localExploration: input.localExploration, answeredAt: at,
    };
    const cur = d.rallySurveys.find((s) => s.groupId === groupId && s.userId === user.id);
    const row = cur
      ? d.rallySurveys.update(cur.id, fields)
      : d.rallySurveys.insert({ id: newId("rs"), groupId, userId: user.id, ...fields });
    return toSurveyDto(row);
  });
}

export function addPhotoPost(
  user: DemoUser,
  groupId: Id,
  input: { spotId?: number | null; caption: string; ackReview?: boolean },
): PhotoPostDto {
  return tx((d) => {
    const ctx = loadRallyContext(user, groupId);
    assertRallyOp(ctx, "review");
    const spotId = input.spotId ?? null;
    const hue = spotHue(user, groupId, spotId);
    if (hue === undefined) throw invalidInput({ spotId: "存在しないスポットです。" });
    if (input.caption !== "") assertTextAllowed(input.caption, "rally_photo_caption", "caption", { ackReview: input.ackReview });
    if (d.rallyPhotos.count((p) => p.groupId === groupId && p.userId === user.id) >= LIMITS.PHOTOS.maxPerUser
      || d.rallyPhotos.count((p) => p.groupId === groupId) >= LIMITS.PHOTOS.maxItems) {
      throw conflict("投稿できる写真の上限に達しました。", { reason: "limit_exceeded" });
    }
    const row = d.rallyPhotos.insert({
      id: newId("ph"), groupId, userId: user.id, spotId, caption: input.caption, createdAt: clock.nowIso(),
    });
    return { id: row.id, author: authorRef(user.id, user.id), spotId, hue, caption: row.caption, createdAt: row.createdAt, mine: true };
  });
}

export function removePhotoPost(user: DemoUser, groupId: Id, photoId: Id): void {
  tx((d) => {
    const ctx = loadRallyContext(user, groupId);
    assertRallyOp(ctx, "review");
    const photo = assertInGroup(d.rallyPhotos.get(photoId), groupId);
    if (photo.userId !== user.id) throw forbidden();
    d.rallyPhotos.remove(photoId);
  });
}
