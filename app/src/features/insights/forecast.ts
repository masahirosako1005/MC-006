// 13 見込みの計算(INS-FN-06・07、13 §6)。純粋関数。
// 12 の privacy.ts は別タスクで未実装のため、少数判定はここで自前に行う(FollowUp 参照)。
import type { DateStr, Id } from "@/lib/groups-types";
import type { CoarseAgeBand, CountCell, RateCell } from "@/features/stats/types";
import { INSIGHT_THRESHOLDS } from "./config";
import { AGE_LABELS, AGE_ORDER, THEME_LABELS } from "./messages";
import type {
  AgeKey, AreaWeekRow, ForecastCell, InsightAggregates, InsightForecastResponse, PastAgeProfile,
  PlannedFact, WeekForecast,
} from "./types";
import { weekLabel } from "./weeks";

const FEW: CountCell = { few: true };
const val = (n: number): CountCell => ({ few: false, value: n });

function toCell(n: number, k: number): CountCell {
  return n > 0 && n < k ? FEW : val(n);
}

/** 内訳(成分)の少数判定と補完秘匿。成分のうち少数が 1 つだけなら、次に小さい非ゼロ成分も少数にする。 */
function suppress(counts: number[], k: number): boolean[] {
  const flags = counts.map((n) => n > 0 && n < k);
  if (flags.filter(Boolean).length === 1) {
    let best = -1;
    counts.forEach((n, i) => {
      if (!flags[i] && n > 0 && (best < 0 || n < counts[best])) best = i;
    });
    if (best >= 0) flags[best] = true;
  }
  return flags;
}

function baselineWeekKeys(agg: InsightAggregates): Set<string> {
  return new Set(agg.meta.weeks.filter((w) => w.useForBaseline).map((w) => w.key));
}

/** エリア r・年代 a の平常値。どれかの週が少数・欠落なら少数。 */
function baselineOf(agg: InsightAggregates, area: Id, age: AgeKey, keys: Set<string>): CountCell {
  let sum = 0;
  for (const key of keys) {
    const row = agg.visitVolume.find((v) => v.week === key && v.area === area && v.age === age);
    if (!row || row.visitors.few) return FEW;
    sum += row.visitors.value;
  }
  return keys.size === 0 ? FEW : val(Math.round(sum / keys.size));
}

/** 複数エリアの平常値の和(少数のエリアは除く)。 */
function baselineSum(
  agg: InsightAggregates, areas: Id[], age: AgeKey, keys: Set<string>,
): { cell: CountCell; partial: boolean } {
  let sum = 0;
  let any = false;
  let partial = false;
  for (const a of areas) {
    const b = baselineOf(agg, a, age, keys);
    if (b.few) partial = true;
    else { any = true; sum += b.value; }
  }
  return { cell: any ? val(sum) : FEW, partial };
}

function makeCell(
  base: { cell: CountCell; partial: boolean }, planned: CountCell,
): ForecastCell {
  const plannedAdd = planned.few ? 0 : planned.value;
  const partial = base.partial || planned.few;
  if (base.cell.few) {
    return { baseline: FEW, planned, expected: FEW, partial, increasePercent: null };
  }
  const b = base.cell.value;
  const expected = b + plannedAdd;
  return {
    baseline: base.cell, planned, expected: val(expected), partial,
    increasePercent: b > 0 ? Math.round(((expected - b) / b) * 100) : null,
  };
}

function overlaps(f: PlannedFact, w: { weekStart: DateStr; weekEnd: DateStr }): boolean {
  return f.startDate <= w.weekEnd && f.endDate >= w.weekStart;
}

export function computeForecast(input: {
  agg: InsightAggregates; planned: PlannedFact[]; regions: { id: Id; name: string }[];
  weeks: { weekStart: DateStr; weekEnd: DateStr }[]; k?: number;
}): Pick<InsightForecastResponse, "weeks" | "areaTable"> {
  const k = input.k ?? INSIGHT_THRESHOLDS.minCell;
  const { agg, regions } = input;
  const keys = baselineWeekKeys(agg);
  const areaIds = regions.map((r) => r.id);
  const baseTotal = baselineSum(agg, areaIds, "all", keys);
  const baseAge = new Map<CoarseAgeBand, { cell: CountCell; partial: boolean }>(
    AGE_ORDER.map((a) => [a, baselineSum(agg, areaIds, a, keys)]),
  );
  const facts = input.planned.filter((f) => areaIds.includes(f.regionId));

  const weeks: WeekForecast[] = input.weeks.map((w) => {
    const ov = facts.filter((f) => overlaps(f, w));
    const ageReal = AGE_ORDER.map((a) => ov.reduce((s, f) => s + f.ages.filter((x) => x === a).length, 0));
    const totalReal = ageReal.reduce((s, n) => s + n, 0);
    const conf = ov.filter((f) => f.certainty === "confirmed").reduce((s, f) => s + f.ages.length, 0);
    const tent = totalReal - conf;

    const ageFlags = suppress(ageReal, k);
    const byAge = AGE_ORDER.map((age, i) => ({
      age, label: AGE_LABELS[age],
      cell: makeCell(baseAge.get(age)!, ageFlags[i] ? FEW : val(ageReal[i])),
    }));
    const certFlags = suppress([conf, tent], k);
    return {
      weekStart: w.weekStart, weekEnd: w.weekEnd, label: weekLabel(w.weekStart, w.weekEnd),
      total: makeCell(baseTotal, toCell(totalReal, k)),
      byAge,
      plannedByCertainty: {
        confirmed: certFlags[0] ? FEW : val(conf),
        tentative: certFlags[1] ? FEW : val(tent),
      },
      groups: toCell(ov.length, k),
    };
  });

  // エリア別: 週ごとにエリアの内訳へ補完秘匿
  const perRegionReal = regions.map((r) =>
    input.weeks.map((w) => facts
      .filter((f) => f.regionId === r.id && overlaps(f, w))
      .reduce((s, f) => s + f.ages.length, 0)));
  const areaTable: AreaWeekRow[] = regions.map((r, ri) => ({
    regionId: r.id, regionName: r.name, weeks: [],
  }));
  input.weeks.forEach((w, wi) => {
    const flags = suppress(regions.map((_, ri) => perRegionReal[ri][wi]), k);
    regions.forEach((r, ri) => {
      const base = baselineSum(agg, [r.id], "all", keys);
      const planned = flags[ri] ? FEW : val(perRegionReal[ri][wi]);
      const c = makeCell(base, planned);
      areaTable[ri].weeks.push({ weekStart: w.weekStart, expected: c.expected, planned, partial: c.partial });
    });
  });

  return { weeks, areaTable };
}

// ---- 過去の傾向 ----
function perDay(agg: InsightAggregates, age: CoarseAgeBand, weekdays: number[]): number | null {
  let visits = 0;
  let days = 0;
  for (const wd of weekdays) {
    const row = agg.weekdayProfile.find((r) => r.weekday === wd && r.age === age);
    if (!row || row.visits.few) return null;
    visits += row.visits.value;
    days += row.days;
  }
  return days > 0 ? visits / days : null;
}
export function weekdayWeekendRaw(agg: InsightAggregates, age: CoarseAgeBand): { weekday: number | null; weekend: number | null } {
  return { weekday: perDay(agg, age, [1, 2, 3, 4, 5]), weekend: perDay(agg, age, [0, 6]) };
}
const round1 = (n: number | null): number | null => (n === null ? null : Math.round(n * 10) / 10);
const pct = (c: RateCell): number => (c.kind === "value" || c.kind === "below" ? c.percent : -1);

export function buildPastProfile(agg: InsightAggregates): PastAgeProfile[] {
  return AGE_ORDER.map((age) => {
    const raw = weekdayWeekendRaw(agg, age);
    const evening = agg.hourProfile.find((r) => r.age === age && r.hourBand === "evening");
    const sat = agg.satisfaction.find((r) => r.age === age);
    let top: PastAgeProfile["topRequest"] = null;
    let topPct = -1;
    for (const r of agg.requestThemes) {
      if (r.age !== age || r.theme === "none") continue;
      const p = pct(r.share);
      if (p > topPct) { topPct = p; top = { theme: r.theme, label: THEME_LABELS[r.theme], share: r.share }; }
    }
    return {
      age, label: AGE_LABELS[age],
      weekdayPerDay: round1(raw.weekday), weekendPerDay: round1(raw.weekend),
      eveningShare: evening?.share ?? { kind: "none" },
      satisfiedRate: sat?.satisfiedRate ?? { kind: "none" },
      topRequest: top,
    };
  });
}
