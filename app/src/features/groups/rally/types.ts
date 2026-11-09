// 08 グループ・スタンプラリー: 型(設計 4.1)。
import type { Id, IsoDateTime } from "@/lib/groups-types";
import type { GroupStatus } from "@/features/groups/lifecycle/types";

/** 取得方法。デモは合言葉のみ。 */
export type StampMethod = "keyword";

/** グループ専用のスタンプ記録。(groupId, spotId) で一意。db().groupStamps */
export interface GroupStamp {
  id: Id;                // newId("gs")
  groupId: Id;
  spotId: number;        // seed.json spots[].id
  acquiredBy: Id;
  method: StampMethod;
  at: IsoDateTime;
}

/** 個人特典の付与記録。(userId, rewardId) で一意。db().rallyRewardGrants */
export interface RallyRewardGrant {
  id: Id;                // newId("rg")
  userId: Id;
  rewardId: number;
  groupId: Id;
  at: IsoDateTime;
}

/** 振り返りメモ。(groupId, userId) で 1 件。db().rallyMemos */
export interface ReviewMemo {
  id: Id;                // newId("rm")
  groupId: Id;
  userId: Id;
  body: string;
  updatedAt: IsoDateTime;
}

export type WantAgain = "yes" | "maybe" | "no";
export type Scale5 = 1 | 2 | 3 | 4 | 5;

/** 振り返りアンケート(5 項目)。(groupId, userId) で 1 件。db().rallySurveys */
export interface SurveyAnswer {
  id: Id;                       // newId("rs")
  groupId: Id;
  userId: Id;
  satisfaction: Scale5;
  planClarity: Scale5;
  wantAgain: WantAgain;
  localInteraction: Scale5;
  localExploration: Scale5;
  answeredAt: IsoDateTime;
}

/** 写真投稿(ダミー)。db().rallyPhotos */
export interface PhotoPost {
  id: Id;                // newId("ph")
  groupId: Id;
  userId: Id;
  spotId: number | null;
  caption: string;
  createdAt: IsoDateTime;
}

export type RallyUnavailableReason = "recruiting" | "not_started" | "finished" | "cancelled" | "replanned";

export interface RallyAccess {
  canView: boolean;
  canCollectStamps: boolean;
  canReviewRead: boolean;
  canReviewWrite: boolean;
  stampReason: RallyUnavailableReason | null;
  reviewReason: RallyUnavailableReason | null;
}

export interface SpotCatalogItem {
  id: number; name: string; stampName: string; area: string; description: string;
  map: { x: number; y: number }; hue: number;
}

// ---- DTO ----
export interface MemberRefDto { displayName: string; isMe: boolean }

export interface RallySpotDto {
  spotId: number; name: string; stampName: string; area: string; description: string;
  map: { x: number; y: number }; hue: number;
  acquired: boolean;
  acquiredBy: MemberRefDto | null;
  acquiredAt: IsoDateTime | null;
}

export interface RallyRewardDto {
  rewardId: number; name: string; prize: string; requiredStamps: number;
  reached: boolean; reachedAt: IsoDateTime | null;
}

export interface MyRewardDto {
  rewardId: number; name: string; prize: string; requiredStamps: number;
  grantedAt: IsoDateTime;
  groupName: string;
  fromThisGroup: boolean;
}

export interface MemberContributionDto extends MemberRefDto { count: number }

export interface RallyProgressDto {
  groupId: Id;
  campaign: string;
  status: GroupStatus;
  access: RallyAccess;
  totalSpots: number;
  acquiredCount: number;
  achievementRate: number;
  spots: RallySpotDto[];
  rewards: RallyRewardDto[];
  myRewards: MyRewardDto[];
  members: MemberContributionDto[];
}

export interface AcquireResultDto {
  spot: Pick<RallySpotDto, "spotId" | "name" | "stampName">;
  acquiredCount: number;
  achievementRate: number;
  newlyReached: RallyRewardDto[];
  myNewRewards: MyRewardDto[];
}

export interface ReviewMemoDto { id: Id; author: MemberRefDto; body: string; updatedAt: IsoDateTime; mine: boolean }
export interface SurveyAnswerDto {
  satisfaction: Scale5; planClarity: Scale5; wantAgain: WantAgain;
  localInteraction: Scale5; localExploration: Scale5; answeredAt: IsoDateTime;
}
export interface PhotoPostDto { id: Id; author: MemberRefDto; spotId: number | null; hue: number; caption: string; createdAt: IsoDateTime; mine: boolean }

export interface ReviewDto {
  groupId: Id;
  groupName: string;
  period: { start: string; end: string };
  status: GroupStatus;
  access: RallyAccess;
  progress: Pick<RallyProgressDto, "totalSpots" | "acquiredCount" | "achievementRate" | "spots" | "rewards">;
  myRewards: MyRewardDto[];
  memos: ReviewMemoDto[];
  mySurvey: SurveyAnswerDto | null;
  surveyAnswered: number;
  memberCount: number;
  photos: PhotoPostDto[];
}

/** saveSurvey の入力(SurveyAnswer の 5 項目)。 */
export type SurveyInput = Pick<SurveyAnswer, "satisfaction" | "planClarity" | "wantAgain" | "localInteraction" | "localExploration">;
