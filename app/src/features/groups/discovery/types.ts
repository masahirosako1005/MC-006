// 02 グループ探索の型・定数(02 §4.2)。
import type { Id, DateStr, IsoDateTime, Page } from "@/lib/groups-types";
import type { Trip } from "../core/types";
import type { GroupStatus } from "../lifecycle/types";
import type { AgeBand, AgeBucket, MemberSummary } from "@/features/safety/types";
import type { OfficialBadgeView } from "@/features/official/types";

export type { IgnoredReason, QueryContext, ParsedListQuery } from "./query";

export const SORT_KEYS = ["deadline", "start", "created", "vacancy"] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export const SORT_OPTIONS = ["deadline:asc", "start:asc", "created:desc", "vacancy:desc"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];
export const DEFAULT_SORT: SortOption = "deadline:asc";

export interface Region { id: Id; name: string; campaign: string; spotAreas: string[] }
export interface CampaignInfo { slug: string; name: string }

export const DEFAULT_LIST_STATUSES: GroupStatus[] = ["recruiting", "min_reached"];
export const LISTABLE_STATUSES: GroupStatus[] =
  ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress", "completed", "cancelled", "replanned"];
export const CLOSED_INCLUDED_STATUSES: GroupStatus[] =
  ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress", "completed"];

export interface GroupListFilter {
  campaign: string;
  region?: Id;
  dateFrom?: DateStr;
  dateTo?: DateStr;
  vacancy?: number;
  tags: string[];
  q?: string;
  ageBuckets: AgeBucket[];
  official: boolean;
  statuses: GroupStatus[];
  sort: SortOption;
}

export interface HeadcountView {
  min: number; capacity: number; current: number;
  vacancy: number;
  shortfall: number;
  isFull: boolean;
  reachedMin: boolean;
}

export type ViewerRelation = "organizer" | "member" | "requested" | "none";

export interface GroupSummary {
  id: Id;
  name: string;
  description: string;
  campaign: string;
  region: { id: Id; name: string };
  trip: Trip;
  deadlineDate: DateStr;
  deadlineAt: IsoDateTime;
  tags: string[];
  badge: OfficialBadgeView | null;
  organizerName: string;
  headcount: HeadcountView;
  status: GroupStatus;
  statusLabel: string;
  flags: { full: boolean; acceptingRequests: boolean };
  memberSummary: MemberSummary;
  viewerRelation: ViewerRelation;
}

export interface RelaxSuggestion {
  kind: "clear_dates" | "clear_region" | "clear_tags" | "clear_age" | "clear_query" | "clear_vacancy" | "clear_official" | "include_closed";
  label: string;
  resultCount: number;
}
export type GroupListResponse = Page<GroupSummary> & {
  filter: Omit<GroupListFilter, "campaign">;
  facets: { tags: { tag: string; count: number }[] };
  suggestions: RelaxSuggestion[];
  asOf: IsoDateTime;
};
export const LIST_PAGE_SIZE = 12;

export type ApplyBlockReason = "full" | "closed" | "cancelled" | "finished" | "already_member" | "already_requested";
export interface ApplyState { canApply: boolean; reason?: ApplyBlockReason }

export interface PublicGroupDetail extends GroupSummary {
  kind: "public";
  description: string;
  organizer: { displayName: string; ageBand?: AgeBand };
  applyState: ApplyState;
  replanOfGroupId: Id | null;
  replannedToGroupId: Id | null;
  cancelKind: "auto" | "organizer" | null;
}

export interface PrivateGroupPreview {
  id: Id; name: string; region: { id: Id; name: string }; trip: Trip; headcount: HeadcountView;
  status: GroupStatus; statusLabel: string; organizerName: string; applyState: ApplyState;
}

export interface PageRequest { limit: number; offset: number }
