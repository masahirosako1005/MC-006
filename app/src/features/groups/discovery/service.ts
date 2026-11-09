// 一覧・参加前詳細・招待コード照合(02 DSC-FN-02〜04)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { GroupListFilter, GroupListResponse, PageRequest, PrivateGroupPreview, PublicGroupDetail } from "./types";

export function listGroups(viewer: DemoUser, filter: GroupListFilter, page: PageRequest): GroupListResponse {
  void viewer; void filter; void page;
  throw new Error("not implemented");
}

export function getPublicGroup(viewer: DemoUser, groupId: Id): PublicGroupDetail {
  void viewer; void groupId;
  throw new Error("not implemented");
}

export function findByInviteCode(viewer: DemoUser, rawCode: string): PrivateGroupPreview {
  void viewer; void rawCode;
  throw new Error("not implemented");
}
