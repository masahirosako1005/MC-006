// 02 内部型(非公開)。
import type { Id } from "@/lib/groups-types";
import type { Group, GroupMember } from "../core/types";
import type { OfficialBadgeView } from "@/features/official/types";
import type { GroupSummary, Region, ViewerRelation } from "./types";

export interface GroupView {
  group: Group;
  summary: GroupSummary;
  activeMembers: readonly GroupMember[];
  searchText: string;
  searchTextTags: string[];
}
export interface ViewContext {
  now: Date;
  regions: Map<Id, Region>;
  badges: Record<Id, OfficialBadgeView>;
  relation(groupId: Id): ViewerRelation;
}
