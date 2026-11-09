// 13 提案ルール(INS-FN-08、13 §7)。純粋関数。LLM は使わない。
import type { CoarseAgeBand, CountCell, RateCell } from "@/features/stats/types";
import type { Id } from "@/lib/groups-types";
import { INSIGHT_THRESHOLDS } from "./config";
import { weekdayWeekendRaw } from "./forecast";
import {
  AGE_LABELS, AGE_ORDER, CAMPAIGN_WIDE_NOTE, RULE_TEMPLATES, RULE_TITLES, THEME_ACTIONS, THEME_FOLLOWUP,
  THEME_LABELS, fillTemplate,
} from "./messages";
import type {
  BusinessCategory, ForecastCell, InsightAggregates, InsightForecastResponse, InsightRuleId, RequestTheme,
  SuggestionCard, TourismBusiness, WeekForecast,
} from "./types";
import { weekLabel } from "./weeks";

type Th = typeof INSIGHT_THRESHOLDS;
type Age = CoarseAgeBand | "all";
const RULE_ORDER: InsightRuleId[] = ["R01", "R02", "R03", "R04", "R05", "R06", "R07", "R08", "R09"];
const ALL_AREAS = "担当エリアすべて";

const cnt = (c: CountCell): string => (c.few ? "少数" : `${c.value} 人`);
const rateVal = (c: RateCell | undefined): number | null => (c && c.kind === "value" ? c.percent : null);
const cntVal = (c: CountCell | undefined): number | null => (c && !c.few ? c.value : null);

export function evaluateRules(input: {
  forecast: Pick<InsightForecastResponse, "weeks" | "areaTable">;
  perArea: Pick<InsightForecastResponse, "weeks">[];
  agg: InsightAggregates;
  business: TourismBusiness;
  regions: { id: Id; name: string }[];
  thresholds?: typeof INSIGHT_THRESHOLDS;
}): SuggestionCard[] {
  const th: Th = input.thresholds ?? INSIGHT_THRESHOLDS;
  const { agg, regions, forecast } = input;
  const weeks = forecast.weeks;
  const cards: SuggestionCard[] = [];
  const areas = input.perArea.length > 0
    ? input.perArea.map((p, i) => ({ region: regions[i], weeks: p.weeks })).filter((a) => a.region)
    : regions.length === 1 ? [{ region: regions[0], weeks }] : [];

  // ---- 年代別の上位テーマ(T7) ----
  const topTheme = (age: Age): Exclude<RequestTheme, "none"> | null => {
    let best: Exclude<RequestTheme, "none"> | null = null;
    let bp = -1;
    for (const r of agg.requestThemes) {
      if (r.age !== age || r.theme === "none" || r.share.kind !== "value") continue;
      if (r.share.percent > bp) { bp = r.share.percent; best = r.theme; }
    }
    return best;
  };
  const followup = (age: Age): string => {
    const t = topTheme(age);
    if (!t) return "";
    return fillTemplate(THEME_FOLLOWUP, {
      年代: AGE_LABELS[age], テーマ: THEME_LABELS[t], テーマの施策: THEME_ACTIONS[t].text,
    });
  };

  // ---- 過去ルールの対象週(見込み最大。同値は早い週。少数は選ばない) ----
  const cellOf = (w: WeekForecast, age: Age): ForecastCell =>
    age === "all" ? w.total : w.byAge.find((b) => b.age === age)!.cell;
  const peakWeek = (age: Age): { w: WeekForecast; cell: ForecastCell } | null => {
    let best: { w: WeekForecast; cell: ForecastCell } | null = null;
    for (const w of weeks) {
      const cell = cellOf(w, age);
      if (cell.expected.few) continue;
      if (!best || cell.expected.value > (best.cell.expected as { value: number }).value) best = { w, cell };
    }
    return best;
  };

  const pushPast = (
    ruleId: InsightRuleId, ages: CoarseAgeBand[], mk: (age: Age) => {
      params: Record<string, string>; evidence: { label: string; value: string }[];
      categories: BusinessCategory[]; suffix?: string; reference?: boolean;
    },
  ): void => {
    if (ages.length === 0) return;
    const targets: Age[] = ages.length === AGE_ORDER.length ? ["all"] : ages;
    for (const age of targets) {
      const pk = peakWeek(age);
      if (!pk) continue;
      const m = mk(age);
      const params = { 年代: AGE_LABELS[age], ...m.params };
      cards.push({
        ruleId,
        title: fillTemplate(RULE_TITLES[ruleId], params),
        period: { weekStart: pk.w.weekStart, weekEnd: pk.w.weekEnd, label: weekLabel(pk.w.weekStart, pk.w.weekEnd) },
        periodBasis: "past_pattern",
        ageBand: age, ageLabel: AGE_LABELS[age],
        regionId: null, regionName: ALL_AREAS,
        expected: pk.cell.expected,
        evidence: [...m.evidence, { label: "データ", value: CAMPAIGN_WIDE_NOTE }],
        action: fillTemplate(RULE_TEMPLATES[ruleId], params) + (m.suffix ? m.suffix : ""),
        categories: m.categories,
        reference: m.reference ?? false,
      });
    }
  };

  // ---- R01 ----
  for (const a of areas) {
    for (const w of a.weeks) {
      for (const b of w.byAge) {
        const c = b.cell;
        const pv = cntVal(c.planned);
        if (c.increasePercent === null || c.increasePercent < th.forecastIncreasePercent) continue;
        if (pv === null || pv < th.minCell || c.expected.few || c.baseline.few) continue;
        const params = {
          期間: weekLabel(w.weekStart, w.weekEnd), エリア: a.region.name, 年代: b.label,
          増加率: String(c.increasePercent),
        };
        const fu = followup(b.age);
        cards.push({
          ruleId: "R01",
          title: fillTemplate(RULE_TITLES.R01, params),
          period: { weekStart: w.weekStart, weekEnd: w.weekEnd, label: weekLabel(w.weekStart, w.weekEnd) },
          periodBasis: "forecast",
          ageBand: b.age, ageLabel: b.label, regionId: a.region.id, regionName: a.region.name,
          expected: c.expected,
          evidence: [
            { label: "見込み", value: cnt(c.expected) },
            { label: "平常値(過去の週平均)", value: cnt(c.baseline) },
            { label: "参加予定", value: cnt(c.planned) },
            { label: "増加率", value: `${c.increasePercent}%` },
          ],
          action: fillTemplate(RULE_TEMPLATES.R01, params) + fu,
          categories: ["lodging", "food", "activity", "souvenir"],
          reference: false,
        });
      }
    }
  }

  // ---- R02 ----
  for (const a of areas) {
    for (const w of a.weeks) {
      const g = cntVal(w.groups);
      if (g === null || g < th.groupsPerWeekArea) continue;
      const params = {
        期間: weekLabel(w.weekStart, w.weekEnd), エリア: a.region.name, 組数: String(g),
        人数: cntVal(w.total.planned) === null ? "少数" : String(cntVal(w.total.planned)),
      };
      cards.push({
        ruleId: "R02",
        title: RULE_TITLES.R02,
        period: { weekStart: w.weekStart, weekEnd: w.weekEnd, label: weekLabel(w.weekStart, w.weekEnd) },
        periodBasis: "forecast",
        ageBand: "all", ageLabel: AGE_LABELS.all, regionId: a.region.id, regionName: a.region.name,
        expected: w.total.expected,
        evidence: [
          { label: "グループ旅行", value: `${g} 組` },
          { label: "参加予定", value: cnt(w.total.planned) },
        ],
        action: fillTemplate(RULE_TEMPLATES.R02, params),
        categories: ["lodging", "food", "activity"],
        reference: false,
      });
    }
  }

  // ---- R03 ----
  {
    const ratios = new Map<CoarseAgeBand, { wd: number; we: number }>();
    for (const age of AGE_ORDER) {
      const { weekday, weekend } = weekdayWeekendRaw(agg, age);
      if (weekday !== null && weekend !== null && weekday > 0 && weekend / weekday >= th.weekendRatio - 1e-9) {
        ratios.set(age, { wd: weekday, we: weekend });
      }
    }
    pushPast("R03", [...ratios.keys()], (age) => {
      const r = age === "all" ? null : ratios.get(age)!;
      return {
        params: {},
        evidence: r
          ? [{ label: "平日 1 日あたり", value: r.wd.toFixed(1) }, { label: "週末 1 日あたり", value: r.we.toFixed(1) },
             { label: "週末/平日", value: (r.we / r.wd).toFixed(2) }]
          : [{ label: "週末/平日", value: `${th.weekendRatio} 倍以上` }],
        categories: ["food", "activity"],
      };
    });
  }

  // ---- R04 ----
  {
    const shares = new Map<CoarseAgeBand, number>();
    for (const age of AGE_ORDER) {
      const p = rateVal(agg.hourProfile.find((r) => r.age === age && r.hourBand === "evening")?.share);
      if (p !== null && p >= th.eveningSharePercent) shares.set(age, p);
    }
    pushPast("R04", [...shares.keys()], (age) => {
      const p = age === "all" ? Math.min(...shares.values()) : shares.get(age)!;
      return {
        params: { 割合: String(p) },
        evidence: [{ label: "17 時以降の割合", value: `${p}%` }],
        categories: ["food", "activity"], reference: true,
      };
    });
  }

  // ---- R05 ----
  {
    const all = agg.satisfaction.find((r) => r.age === "all");
    const allRate = rateVal(all?.satisfiedRate);
    const hits = new Map<CoarseAgeBand, { v: number; gap: number }>();
    if (allRate !== null) {
      for (const age of AGE_ORDER) {
        const row = agg.satisfaction.find((r) => r.age === age);
        const v = rateVal(row?.satisfiedRate);
        const n = cntVal(row?.respondents);
        if (v !== null && n !== null && n >= th.minDenominator && allRate - v >= th.satisfiedGapPoints) {
          hits.set(age, { v, gap: allRate - v });
        }
      }
    }
    pushPast("R05", [...hits.keys()], (age) => {
      const h = age === "all" ? [...hits.values()][0] : hits.get(age)!;
      return {
        params: { 値: String(h.v), 差: String(h.gap) },
        evidence: [
          { label: "満足の割合", value: `${h.v}%` }, { label: "全体", value: `${allRate}%` },
          { label: "回答者", value: `${th.minDenominator} 人以上` },
        ],
        categories: ["lodging", "food", "activity", "souvenir"],
        suffix: followup(age),
      };
    });
  }

  // ---- R06・R07(テーマ。全年代の T7) ----
  const themeRows = agg.requestThemes.filter((r) => r.age === "all" && r.theme !== "none");
  const allSat = agg.satisfaction.find((r) => r.age === "all");
  const peakAll = peakWeek("all");
  const pushTheme = (
    ruleId: "R06" | "R07", theme: Exclude<RequestTheme, "none">, params: Record<string, string>,
    evidence: { label: string; value: string }[],
  ): void => {
    if (!peakAll) return;
    const act = THEME_ACTIONS[theme];
    const p = { テーマ: THEME_LABELS[theme], テーマの施策: act.text, ...params };
    cards.push({
      ruleId, title: RULE_TITLES[ruleId],
      period: { weekStart: peakAll.w.weekStart, weekEnd: peakAll.w.weekEnd, label: weekLabel(peakAll.w.weekStart, peakAll.w.weekEnd) },
      periodBasis: "past_pattern",
      ageBand: "all", ageLabel: AGE_LABELS.all, regionId: null, regionName: ALL_AREAS,
      expected: peakAll.cell.expected,
      evidence: [...evidence, { label: "データ", value: CAMPAIGN_WIDE_NOTE }],
      action: fillTemplate(RULE_TEMPLATES[ruleId], p),
      categories: act.categories, reference: false,
    });
  };
  {
    const den = cntVal(allSat?.respondents);
    const sorted = [...themeRows].sort((a, b) => (rateVal(b.share) ?? -1) - (rateVal(a.share) ?? -1));
    for (const r of sorted) {
      const s = rateVal(r.share);
      const d = den ?? cntVal(r.respondents);
      if (s === null || d === null || d < th.minDenominator || s < th.themeSharePercent) continue;
      pushTheme("R06", r.theme as Exclude<RequestTheme, "none">, { 割合: String(s) },
        [{ label: "要望の割合", value: `${s}%` }, { label: "回答者", value: `${th.minDenominator} 人以上` }]);
    }
  }
  {
    const allDis = rateVal(allSat?.dissatisfiedRate);
    const sorted = [...themeRows].sort((a, b) => (rateVal(b.dissatisfiedRate) ?? -1) - (rateVal(a.dissatisfiedRate) ?? -1));
    if (allDis !== null) {
      for (const r of sorted) {
        const dv = rateVal(r.dissatisfiedRate);
        const n = cntVal(r.respondents);
        if (dv === null || n === null || n < th.minDenominator) continue;
        if (dv < allDis * th.themeDissatisfiedMultiplier) continue;
        const ratio = allDis > 0 ? (dv / allDis).toFixed(1) : "-";
        pushTheme("R07", r.theme as Exclude<RequestTheme, "none">,
          { 値: String(dv), 全体: String(allDis), 倍率: ratio },
          [{ label: "不満の割合", value: `${dv}%` }, { label: "全体", value: `${allDis}%` }]);
      }
    }
  }

  // ---- R08 ----
  {
    const allC = rateVal(agg.participation.find((r) => r.age === "all")?.completeRate);
    const hits = new Map<CoarseAgeBand, number>();
    if (allC !== null) {
      for (const age of AGE_ORDER) {
        const row = agg.participation.find((r) => r.age === age);
        const v = rateVal(row?.completeRate);
        const n = cntVal(row?.registered);
        if (v !== null && n !== null && n >= th.minDenominator && v - allC >= th.completeGapPoints) hits.set(age, v);
      }
    }
    pushPast("R08", [...hits.keys()], (age) => {
      const v = age === "all" ? Math.min(...hits.values()) : hits.get(age)!;
      return {
        params: {},
        evidence: [{ label: "全スポット巡回の割合", value: `${v}%` }, { label: "全体", value: `${allC}%` }],
        categories: ["lodging", "food", "souvenir"],
      };
    });
  }

  // ---- R09 ----
  {
    const order = ["interaction", "scenery", "stamps", "rewards", "none"] as const;
    const hits: CoarseAgeBand[] = [];
    for (const age of AGE_ORDER) {
      const rows = agg.goodPoints.filter((r) => r.age === age);
      let top: (typeof order)[number] | null = null;
      let tv = -1;
      for (const o of order) {
        const v = cntVal(rows.find((r) => r.option === o)?.respondents) ?? 0;
        if (v > tv) { tv = v; top = o; }
      }
      if (top !== "interaction") continue;
      const n = cntVal(agg.satisfaction.find((r) => r.age === age)?.respondents)
        ?? rows.reduce((s, r) => s + (cntVal(r.respondents) ?? 0), 0);
      if (n >= th.minDenominator) hits.push(age);
    }
    pushPast("R09", hits, () => ({
      params: {},
      evidence: [{ label: "最多の良かった点", value: "旅先の交流" }],
      categories: ["activity", "lodging"],
    }));
  }

  // ---- 並び・上限 ----
  const idx = new Map(cards.map((c, i) => [c, i]));
  const incr = (c: SuggestionCard): number => {
    const m = c.evidence.find((e) => e.label === "増加率");
    return m ? parseInt(m.value, 10) : 0;
  };
  cards.sort((a, b) =>
    RULE_ORDER.indexOf(a.ruleId) - RULE_ORDER.indexOf(b.ruleId)
    || (a.period.weekStart < b.period.weekStart ? -1 : a.period.weekStart > b.period.weekStart ? 1 : 0)
    || incr(b) - incr(a)
    || idx.get(a)! - idx.get(b)!);
  const mine = (c: SuggestionCard): number => (c.categories.includes(input.business.category) ? 0 : 1);
  const ordered = cards.map((c, i) => ({ c, i })).sort((a, b) => mine(a.c) - mine(b.c) || a.i - b.i).map((x) => x.c);
  const counts: Record<string, number> = {};
  return ordered.filter((c) => {
    const cap = c.ruleId === "R01" ? th.maxCardsPerRule.R01 : c.ruleId === "R02" ? th.maxCardsPerRule.R02 : th.maxCardsPerRule.other;
    counts[c.ruleId] = (counts[c.ruleId] ?? 0) + 1;
    return counts[c.ruleId] <= cap;
  });
}

