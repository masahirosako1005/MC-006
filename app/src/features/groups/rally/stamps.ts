// 08: スタンプの取得と進捗。スタブ(P-2-20)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { AcquireResultDto, GroupStamp, RallyProgressDto, RallyRewardDto } from "./types";

export function acquireForGroup(user: DemoUser, groupId: Id, keyword: string): AcquireResultDto {
  void user; void groupId; void keyword;
  throw new Error("not implemented");
}

export function groupProgress(user: DemoUser, groupId: Id): RallyProgressDto {
  void user; void groupId;
  throw new Error("not implemented");
}

export function deriveRewards(stamps: readonly GroupStamp[]): RallyRewardDto[] {
  void stamps;
  throw new Error("not implemented");
}
