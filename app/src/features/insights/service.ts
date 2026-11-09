// 13 サービス(INS-FN-10・11)。
import { clock } from "@/lib/clock";
import { db } from "@/lib/groups-store";
import type { DemoUser } from "@/lib/groups-types";
import { resolveBusinessScope } from "./access";
import { getAggregates } from "./aggregates";
import { INSIGHT_WEEKS } from "./config";
import { collectPlanned } from "./facts";
import { buildPastProfile, computeForecast } from "./forecast";
import { CATEGORY_LABELS, LIMITATIONS } from "./messages";
import { evaluateRules } from "./rules";
import type {
  BusinessScope, InsightForecastResponse, InsightMeta, InsightQuery, InsightSuggestionsResponse,
} from "./types";
import { forecastWeeks } from "./weeks";

function compute(user: DemoUser, query: InsightQuery) {
  const scope = resolveBusinessScope(user);
  const agg = getAggregates();
  const regions = query.region ? scope.regions.filter((r) => r.id === query.region) : scope.regions;
  const weeks = forecastWeeks(clock.today(), INSIGHT_WEEKS);
  const planned = collectPlanned(scope, query);
  const forecast = computeForecast({ agg, planned, regions, weeks });
  return { scope, agg, regions, weeks, planned, forecast };
}

function buildMeta(scope: BusinessScope, regions: { id: string; name: string }[], query: InsightQuery,
  weeks: { weekStart: string; weekEnd: string }[], agg: ReturnType<typeof getAggregates>): InsightMeta {
  return {
    business: {
      displayName: scope.business.displayName, category: scope.business.category,
      categoryLabel: CATEGORY_LABELS[scope.business.category],
    },
    regions, query,
    weekFrom: weeks[0].weekStart, weekTo: weeks[weeks.length - 1].weekEnd,
    past: {
      periodFrom: agg.meta.periodFrom, periodTo: agg.meta.periodTo, truncatedFrom: agg.meta.truncatedFrom,
      baselineWeeks: agg.meta.weeks.filter((w) => w.useForBaseline).map((w) => ({ from: w.from, to: w.to })),
    },
    minCellCount: agg.meta.minCellCount,
    includesDemoTrips: db().users.list().some((u) => /^u-1\d\d+$/.test(u.id)),
    generatedAt: clock.nowIso(),
  };
}

export function getInsightForecast(user: DemoUser, query: InsightQuery): InsightForecastResponse {
  const c = compute(user, query);
  return {
    meta: buildMeta(c.scope, c.regions, query, c.weeks, c.agg),
    weeks: c.forecast.weeks,
    areaTable: c.forecast.areaTable,
    pastProfile: buildPastProfile(c.agg),
    limitations: LIMITATIONS,
  };
}

export function getInsightSuggestions(user: DemoUser, query: InsightQuery): InsightSuggestionsResponse {
  const c = compute(user, query);
  // 担当エリアが複数のときだけエリア別の見込みを渡す(1 エリアなら全体と同じ)
  const perArea = c.regions.length > 1
    ? c.regions.map((r) => computeForecast({ agg: c.agg, planned: c.planned, regions: [r], weeks: c.weeks }))
    : [];
  const cards = evaluateRules({
    forecast: c.forecast, perArea, agg: c.agg, business: c.scope.business, regions: c.regions,
  });
  return { meta: buildMeta(c.scope, c.regions, query, c.weeks, c.agg), cards };
}
