// 12 自治体向け集計の型(12 §6.2)。
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { GroupStatus, CancelReasonCode } from "@/features/groups/lifecycle/types";
import type { FunnelAggregate, FunnelEvent } from "@/features/entry/types";

// ---- 列挙 ----
export type OfficialFilter = "all" | "official" | "general";
export type GroupPhase = "open" | "confirmed" | "cancelled";
export type CancelReasonGroup = "deadline_unmet" | "organizer" | "other";
export type CoarseAgeBand = "under30" | "30to49" | "50plus";
export type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "expired";
export type Score = 1 | 2 | 3 | 4 | 5;
export type WantAgain = "yes" | "maybe" | "no";

// ---- 中間表現 ----
export interface RequestFact {
  at: IsoDateTime;
  status: RequestStatus;
  decidedAt: IsoDateTime | null;
}
export interface StampFact { spotId: number; at: IsoDateTime }
export interface SurveyFact {
  satisfaction: Score;
  wantAgain: WantAgain;
  localInteraction: Score;
  localExploration: Score;
}
export interface GroupFact {
  groupId: string;
  campaign: string;
  region: Id;
  official: boolean;
  status: GroupStatus;
  createdAt: IsoDateTime;
  confirmedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  cancelReason: CancelReasonCode | null;
  replanOfGroupId: string | null;
  memberCount: number;
  participantKeys: string[];
  ageBands: (CoarseAgeBand | null)[];
  requests: RequestFact[];
  stamps: StampFact[];
  surveys: SurveyFact[];
  origin: "live" | "demo-history";
}

// ---- 問い合わせ ----
export interface StatsQuery {
  from: DateStr;
  to: DateStr;
  region: Id | null;
  official: OfficialFilter;
}

// ---- 個人非特定のセル ----
export type CountCell = { few: false; value: number } | { few: true };
export type RateCell =
  | { kind: "value"; percent: number }
  | { kind: "below"; percent: number }
  | { kind: "few" }
  | { kind: "none" };
export interface LabeledCell { key: string; label: string; cell: CountCell }

// ---- 応答 ----
export interface StatsMeta {
  municipalityName: string;
  campaign: string;
  regions: { id: Id; name: string }[];
  query: StatsQuery;
  minCellCount: number;
  includesDemoHistory: boolean;
  generatedAt: IsoDateTime;
}
export interface StatsSummary {
  groupsCreated: CountCell;
  joinRequests: CountCell;
  approvalRate: RateCell;
  confirmedGroups: CountCell;
  confirmRate: RateCell;
  cancelRate: RateCell;
  replanRate: RateCell;
  stampsAcquired: CountCell;
  repeatRate: RateCell;
}
export interface TimePoint {
  month: string;
  groupsCreated: CountCell;
  joinRequests: CountCell;
  confirmedGroups: CountCell;
  stampsAcquired: CountCell;
}
export interface RegionRow {
  regionId: Id; regionName: string;
  groupsCreated: CountCell; joinRequests: CountCell; confirmedGroups: CountCell;
  cancelRate: RateCell;
}
export interface FunnelStep { key: "cancelled" | "replanned" | "replanConfirmed"; label: string; cell: CountCell }
export interface SpotRow { spotId: number; spotName: string; groups: CountCell }
export interface InflowStats {
  byEntry: LabeledCell[];
  bySource: LabeledCell[];
  byType: LabeledCell[];
}
export interface SurveyItemStat {
  key: "satisfaction" | "wantAgain" | "localInteraction" | "localExploration";
  label: string;
  positiveRate: RateCell;
  distribution: LabeledCell[];
}
export interface SurveyStats {
  responses: CountCell;
  responseRate: RateCell;
  items: SurveyItemStat[];
}
export interface StatsResponse {
  meta: StatsMeta;
  summary: StatsSummary;
  timeSeries: TimePoint[];
  regionTable: RegionRow[];
  funnel: FunnelStep[];
  cancelReasons: LabeledCell[];
  memberCountDistribution: LabeledCell[];
  inflow: InflowStats;
  topSpots: SpotRow[];
  ageBands: LabeledCell[];
  survey: SurveyStats;
}

// ---- 範囲 ----
export interface MunicipalScope {
  municipality: { id: string; campaign: string; displayName: string };
  regions: { id: Id; name: string }[];
}
export type { FunnelAggregate };
export type HistoryFunnelEvent = Pick<FunnelEvent, "type" | "day" | "campaign" | "channel" | "source">;
