// 08: 個人特典の付与。スタブ(P-2-20)。
import type { Db } from "@/lib/groups-store";
import type { Id, IsoDateTime } from "@/lib/groups-types";
import type { MyRewardDto, RallyRewardDto, RallyRewardGrant } from "./types";

export function grantRewardsOnReach(db: Db, groupId: Id, reached: RallyRewardDto[], at: IsoDateTime): RallyRewardGrant[] {
  void db; void groupId; void reached; void at;
  throw new Error("not implemented");
}

export function listMyRewards(userId: Id, currentGroupId: Id): MyRewardDto[] {
  void userId; void currentGroupId;
  throw new Error("not implemented");
}
