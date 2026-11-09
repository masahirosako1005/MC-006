// 08: 個人特典の付与。
import { db, newId, type Db } from "@/lib/groups-store";
import type { Id, IsoDateTime } from "@/lib/groups-types";
import { listRewards } from "./catalog";
import type { MyRewardDto, RallyRewardDto, RallyRewardGrant } from "./types";

/** 到達した特典を、その時点の参加中メンバー全員に付与する。tx の中からだけ呼ぶ。 */
export function grantRewardsOnReach(db_: Db, groupId: Id, reached: RallyRewardDto[], at: IsoDateTime): RallyRewardGrant[] {
  const members = db_.members.filter((m) => m.groupId === groupId && m.status === "active");
  const made: RallyRewardGrant[] = [];
  for (const r of reached) {
    for (const m of members) {
      const exists = db_.rallyRewardGrants.find((g) => g.userId === m.userId && g.rewardId === r.rewardId);
      if (exists) continue;
      made.push(db_.rallyRewardGrants.insert({ id: newId("rg"), userId: m.userId, rewardId: r.rewardId, groupId, at }));
    }
  }
  return made;
}

export function listMyRewards(userId: Id, currentGroupId: Id): MyRewardDto[] {
  const catalog = listRewards();
  return db().rallyRewardGrants
    .filter((g) => g.userId === userId)
    .slice()
    .sort((a, b) => a.at.localeCompare(b.at))
    .flatMap((g) => {
      const r = catalog.find((x) => x.id === g.rewardId);
      if (!r) return [];
      return [{
        rewardId: r.id, name: r.name, prize: r.prize, requiredStamps: r.requiredStamps,
        grantedAt: g.at,
        groupName: db().groups.get(g.groupId)?.name ?? "",
        fromThisGroup: g.groupId === currentGroupId,
      }];
    });
}
