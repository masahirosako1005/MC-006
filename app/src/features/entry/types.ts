// 11 入口B・流入計測の型(11 §4.4、§5.1)。
import type { DateStr, Id } from "@/lib/groups-types";
import type { GroupListFilter } from "@/features/groups/discovery/types";
import type { ListingKind } from "@/features/official/types";

export const ENTRY_SOURCES = [
  "muni-site", "muni-pr", "sns", "search", "travel-media", "transport", "other",
] as const;
export type EntrySource = (typeof ENTRY_SOURCES)[number];

export const SOURCE_LABELS = [...ENTRY_SOURCES, "none", "unknown"] as const;
export type SourceLabel = (typeof SOURCE_LABELS)[number];

export const CHANNELS = ["A", "B"] as const;
export type Channel = (typeof CHANNELS)[number];

export const FUNNEL_EVENT_TYPES = [
  "entry_landed", "entry_params_ignored", "list_viewed", "official_viewed", "official_requested",
] as const;
export type FunnelEventType = (typeof FUNNEL_EVENT_TYPES)[number];

export const CLIENT_EVENT_TYPES = ["list_viewed", "official_viewed"] as const;

/** 保存先: db().funnelEvents。ID は newId("fe") */
export interface FunnelEvent {
  id: Id;
  type: FunnelEventType;
  day: DateStr;
  campaign: string;
  channel: Channel;
  source: SourceLabel;
  region: Id | null;
  listingKind: ListingKind | null;
  groupId: Id | null;
}

export interface FunnelEventInput {
  type: FunnelEventType;
  campaign: string;
  channel: Channel;
  source: SourceLabel;
  region?: Id;
  groupId?: Id;
}

export interface FunnelQuery { campaign: string; fromDay?: DateStr; toDay?: DateStr }
export interface FunnelAggregate {
  campaign: string; fromDay: DateStr; toDay: DateStr;
  landedBySource: Record<SourceLabel, number>;
  landedByRegion: Record<string, number>;
  ignoredCount: number;
  listViewedByChannel: Record<Channel, number>;
  officialViewed: number;
  officialRequested: number;
  byListingKind: Record<ListingKind, { viewed: number; requested: number }>;
}

export type RawQuery = Record<string, string | string[] | undefined>;

export type HandoffKey = "region" | "dateFrom" | "dateTo" | "vacancy" | "official";

export type EntryIgnoredReason = "too_long" | "duplicate" | "unknown_value" | "invalid_value";
export interface IgnoredParam {
  key: HandoffKey | "src" | "_unknown" | "_query";
  reason: EntryIgnoredReason;
  count?: number;
}
export interface ParsedEntry {
  filter: GroupListFilter;
  source: SourceLabel;
  ignored: IgnoredParam[];
}
export interface EntryResolution extends ParsedEntry {
  campaign: string;
  groupsPath: string;
  showLanding: boolean;
}

export interface AcceptedConditionView {
  key: HandoffKey;
  label: string;
  value: string;
}

export interface EntryLinkFixture {
  id: string;
  label: string;
  source: EntrySource;
  params: Record<string, string>;
  abnormal?: boolean;
}
