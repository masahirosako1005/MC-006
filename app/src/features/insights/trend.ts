// 週別の旅行者人数(過去の実績+未来の予定)と年代別内訳(グラフ用)。純粋関数。
import type { CoarseAgeBand, CountCell } from "@/features/stats/types";
import type { DateStr, Id } from "@/lib/groups-types";
import { AGE_LABELS, AGE_ORDER } from "./messages";
import type { InsightAggregates, TrendWeek, WeekForecast } from "./types";
import { weekLabel } from "./weeks";

const FEW: CountCell = { few: true };
const val = (n: number): CountCell => ({ few: false, value: n });
/** 円グラフを出す最小の公開人数(年代が 4 人未満なら出さない)。 */
export const PIE_MIN_TOTAL = 4;

/** 少数セルを除いて合算。全て少数なら少数。 */
export function sumCells(cells: CountCell[]): CountCell {
  let sum = 0;
  let any = false;
  for (const c of cells) if (!c.few) { any = true; sum += c.value; }
  return any ? val(sum) : FEW;
}

export function ageChartState(byAge: { cell: CountCell }[]): TrendWeek["ageChart"] {
  if (byAge.every((a) => !a.cell.few && a.cell.value === 0)) return "empty";
  const shown = byAge.reduce((s, a) => s + (a.cell.few ? 0 : a.cell.value), 0);
  return shown < PIE_MIN_TOTAL ? "hidden" : "ok";
}

export function buildTrend(agg: InsightAggregates, regionIds: Id[], future: WeekForecast[]): TrendWeek[] {
  const out: TrendWeek[] = [];
  for (const w of agg.meta.weeks) {
    const pick = (age: CoarseAgeBand | "all") => sumCells(regionIds.map((r) => {
      const row = agg.visitVolume.find((v) => v.week === w.key && v.area === r && v.age === age);
      return row ? row.visitors : FEW;
    }));
    const byAge = AGE_ORDER.map((age) => ({ age, label: AGE_LABELS[age], cell: pick(age) }));
    out.push({
      kind: "past", weekStart: w.from as DateStr, weekEnd: w.to as DateStr, label: weekLabel(w.from as DateStr, w.to as DateStr),
      total: pick("all"), byAge, ageChart: ageChartState(byAge), partial: w.days < 7,
    });
  }
  for (const f of future) {
    const byAge = f.byAge.map((a) => ({ age: a.age, label: a.label, cell: a.cell.planned }));
    out.push({
      kind: "future", weekStart: f.weekStart, weekEnd: f.weekEnd, label: f.label,
      total: f.total.planned, byAge, ageChart: ageChartState(byAge), partial: false,
    });
  }
  return out;
}
