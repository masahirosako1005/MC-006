// 08: スタンプの取得と進捗。
import { clock } from "@/lib/clock";
import { conflict, invalidInput } from "@/lib/errors";
import { db, newId, tx } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { listRewards, listSpots, findSpotByKeyword, CAMPAIGN_SLUG } from "./catalog";
import { assertRallyOp, loadRallyContext } from "./access";
import { ALREADY_ACQUIRED_MESSAGE, INVALID_CODE_MESSAGE, FORMER_MEMBER_LABEL } from "./messages";
import { grantRewardsOnReach, listMyRewards } from "./rewards";
import type {
  AcquireResultDto, GroupStamp, MemberContributionDto, RallyProgressDto, RallyRewardDto, RallySpotDto,
} from "./types";

const rate = (count: number, total: number) => (total === 0 ? 0 : Math.round((count * 100) / total));

export function deriveRewards(stamps: readonly GroupStamp[]): RallyRewardDto[] {
  const sorted = [...stamps].sort((a, b) => a.at.localeCompare(b.at));
  return listRewards().map((r) => {
    const reached = sorted.length >= r.requiredStamps;
    return {
      rewardId: r.id, name: r.name, prize: r.prize, requiredStamps: r.requiredStamps,
      reached, reachedAt: reached ? sorted[r.requiredStamps - 1].at : null,
    };
  });
}

const nameOf = (userId: Id) => db().users.get(userId)?.displayName ?? FORMER_MEMBER_LABEL;

export function acquireForGroup(user: DemoUser, groupId: Id, keyword: string): AcquireResultDto {
  return tx((d) => {
    const ctx = loadRallyContext(user, groupId);
    assertRallyOp(ctx, "stamp");
    const spot = findSpotByKeyword(keyword);
    if (!spot) throw invalidInput({ keyword: INVALID_CODE_MESSAGE }, INVALID_CODE_MESSAGE, { reason: "invalid_code" });
    const existing = d.groupStamps.find((s) => s.groupId === groupId && s.spotId === spot.id);
    if (existing) {
      throw conflict(ALREADY_ACQUIRED_MESSAGE, {
        reason: "already_acquired",
        detail: { acquired: { acquiredBy: { displayName: nameOf(existing.acquiredBy), isMe: existing.acquiredBy === user.id }, at: existing.at } },
      });
    }
    const before = deriveRewards(d.groupStamps.filter((s) => s.groupId === groupId));
    const at = clock.nowIso();
    d.groupStamps.insert({ id: newId("gs"), groupId, spotId: spot.id, acquiredBy: user.id, method: "keyword", at });
    const stamps = d.groupStamps.filter((s) => s.groupId === groupId);
    const after = deriveRewards(stamps);
    const newlyReached = after.filter((r, i) => r.reached && !before[i].reached);
    const grants = grantRewardsOnReach(d, groupId, newlyReached, at);
    const mine = new Set(grants.filter((g) => g.userId === user.id).map((g) => g.rewardId));
    const myNewRewards = listMyRewards(user.id, groupId).filter((m) => mine.has(m.rewardId));
    const total = listSpots().length;
    return {
      spot: { spotId: spot.id, name: spot.name, stampName: spot.stampName },
      acquiredCount: stamps.length,
      achievementRate: rate(stamps.length, total),
      newlyReached,
      myNewRewards,
    };
  });
}

export function groupProgress(user: DemoUser, groupId: Id): RallyProgressDto {
  const { group, access } = loadRallyContext(user, groupId);
  const stamps = db().groupStamps.filter((s) => s.groupId === groupId);
  const sameCampaign = group.campaign === CAMPAIGN_SLUG;
  const catalog = sameCampaign ? listSpots() : [];
  const ref = (id: Id) => ({ displayName: nameOf(id), isMe: id === user.id });
  const active = new Set(db().members.filter((m) => m.groupId === groupId && m.status === "active").map((m) => m.userId));
  const refOf = (id: Id) => (active.has(id) ? ref(id) : { displayName: FORMER_MEMBER_LABEL, isMe: false });

  const spots: RallySpotDto[] = catalog.map((c) => {
    const s = stamps.find((x) => x.spotId === c.id);
    return { spotId: c.id, name: c.name, stampName: c.stampName, area: c.area, description: c.description, map: c.map, hue: c.hue,
      acquired: !!s, acquiredBy: s ? refOf(s.acquiredBy) : null, acquiredAt: s ? s.at : null };
  });

  const members: MemberContributionDto[] = [...active].map((id) => ({
    ...ref(id), count: stamps.filter((s) => s.acquiredBy === id).length,
  }));
  const leftCount = stamps.filter((s) => !active.has(s.acquiredBy)).length;
  if (leftCount > 0) members.push({ displayName: FORMER_MEMBER_LABEL, isMe: false, count: leftCount });

  return {
    groupId,
    campaign: group.campaign,
    status: group.lifecycle.status,
    access,
    totalSpots: catalog.length,
    acquiredCount: stamps.length,
    achievementRate: rate(stamps.length, catalog.length),
    spots,
    rewards: deriveRewards(stamps),
    myRewards: listMyRewards(user.id, groupId),
    members,
  };
}
