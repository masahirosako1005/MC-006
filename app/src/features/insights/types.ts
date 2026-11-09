// 13 観光事業者向け需要見込みの型(13 §3.2・4.6・7.5・9)。
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { CountCell, RateCell, CoarseAgeBand } from "@/features/stats/types";

// ---- 事業者(INS-C-06。businesses コレクションの要素型)----
export type BusinessCategory = "lodging" | "food" | "activity" | "souvenir";
export interface TourismBusiness {
  id: string;                  // biz-<slug>
  campaign: string;
  displayName: string;
  category: BusinessCategory;
  regionIds: Id[];
}

// ---- 集計済みデータ(insight-aggregates.json)----
export type AgeKey = CoarseAgeBand | "all";
export type AreaKey = Id | "all";
export type HourBand = "night" | "morning" | "daytime" | "evening";
export type GoodPoint = "interaction" | "scenery" | "stamps" | "rewards" | "none";
export type RequestTheme =
  | "guidance" | "transport" | "rest" | "reward" | "app" | "spot_info" | "shops" | "crowd" | "none";
export type Score5 = "1" | "2" | "3" | "4" | "5";

export interface PastWeek { key: string; from: DateStr; to: DateStr; days: number; useForBaseline: boolean }

export interface InsightAggregates {
  schemaVersion: 1;
  meta: {
    source: "sample-data";
    campaign: string;
    periodFrom: DateStr;
    periodTo: DateStr;
    truncatedFrom: DateStr;
    weeks: PastWeek[];
    minCellCount: number;
    areas: { regionId: Id; spotIds: number[] }[];
  };
  visitVolume: { week: string; area: AreaKey; age: AgeKey; visitors: CountCell; visits: CountCell }[];
  weekdayProfile: { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; age: AgeKey; visits: CountCell; days: number }[];
  hourProfile: { hourBand: HourBand; age: AgeKey; stamps: CountCell; share: RateCell }[];
  participation: { age: AgeKey; registered: CountCell; stamp3plus: CountCell; stamp7plus: CountCell;
                   lap2: CountCell; completeRate: RateCell }[];
  satisfaction: { age: AgeKey; respondents: CountCell; distribution: Record<Score5, CountCell>;
                  satisfiedRate: RateCell; dissatisfiedRate: RateCell }[];
  goodPoints: { age: AgeKey; option: GoodPoint; respondents: CountCell; share: RateCell }[];
  requestThemes: { age: AgeKey; theme: RequestTheme; respondents: CountCell; share: RateCell;
                   dissatisfiedRate: RateCell }[];
}

// ---- 提案カード ----
export type InsightRuleId = "R01" | "R02" | "R03" | "R04" | "R05" | "R06" | "R07" | "R08" | "R09";
export interface SuggestionCard {
  ruleId: InsightRuleId;
  title: string;
  period: { weekStart: DateStr; weekEnd: DateStr; label: string };
  periodBasis: "forecast" | "past_pattern";
  ageBand: CoarseAgeBand | "all";
  ageLabel: string;
  regionId: Id | null;
  regionName: string;
  expected: CountCell;
  evidence: { label: string; value: string }[];
  action: string;
  categories: BusinessCategory[];
  reference: boolean;
}

// ---- 問い合わせ・応答 ----
export interface InsightQuery { region: Id | null }

export interface BusinessScope {
  business: TourismBusiness;
  regions: { id: Id; name: string }[];
}

export interface ForecastCell {
  baseline: CountCell;
  planned: CountCell;
  expected: CountCell;
  partial: boolean;
  increasePercent: number | null;
}
export interface WeekForecast {
  weekStart: DateStr; weekEnd: DateStr; label: string;
  total: ForecastCell;
  byAge: { age: CoarseAgeBand; label: string; cell: ForecastCell }[];
  plannedByCertainty: { confirmed: CountCell; tentative: CountCell };
  groups: CountCell;
}
export interface AreaWeekRow {
  regionId: Id; regionName: string;
  weeks: { weekStart: DateStr; expected: CountCell; planned: CountCell; partial: boolean }[];
}
export interface PastAgeProfile {
  age: CoarseAgeBand; label: string;
  weekdayPerDay: number | null;
  weekendPerDay: number | null;
  eveningShare: RateCell;
  satisfiedRate: RateCell;
  topRequest: { theme: RequestTheme; label: string; share: RateCell } | null;
}
export interface InsightMeta {
  business: { displayName: string; category: BusinessCategory; categoryLabel: string };
  regions: { id: Id; name: string }[];
  query: InsightQuery;
  weekFrom: DateStr; weekTo: DateStr;
  past: { periodFrom: DateStr; periodTo: DateStr; truncatedFrom: DateStr;
          baselineWeeks: { from: DateStr; to: DateStr }[] };
  minCellCount: number;
  includesDemoTrips: boolean;
  generatedAt: IsoDateTime;
}
export interface InsightForecastResponse {
  meta: InsightMeta;
  weeks: WeekForecast[];
  areaTable: AreaWeekRow[];
  pastProfile: PastAgeProfile[];
  limitations: string[];
}
export interface InsightSuggestionsResponse { meta: InsightMeta; cards: SuggestionCard[] }

// 実行時の中間表現(応答に出さない)
export interface PlannedFact {
  regionId: Id; startDate: DateStr; endDate: DateStr;
  certainty: "confirmed" | "tentative";
  ages: CoarseAgeBand[];
}
