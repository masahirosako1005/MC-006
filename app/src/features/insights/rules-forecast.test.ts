import { describe, expect, it } from "vitest";
import { buildPastProfile, computeForecast } from "./forecast";
import { evaluateRules } from "./rules";
import { fillTemplate } from "./messages";
import { forecastWeeks } from "./weeks";
import type { InsightAggregates, PlannedFact, TourismBusiness } from "./types";

const V = (n: number) => ({ few: false as const, value: n });
const FEW = { few: true as const };
const R = (p: number) => ({ kind: "value" as const, percent: p });

function agg(): InsightAggregates {
  const vv = (area: string, age: string, a: number, b: number) => [
    { week: "W1", area, age, visitors: V(a), visits: V(a) },
    { week: "W2", area, age, visitors: V(b), visits: V(b) },
    { week: "W3", area, age, visitors: V(1), visits: V(1) },
  ];
  return {
    schemaVersion: 1,
    meta: {
      source: "sample-data", campaign: "c", periodFrom: "2026-10-01", periodTo: "2026-10-20",
      truncatedFrom: "2026-10-16", minCellCount: 5, areas: [],
      weeks: [
        { key: "W1", from: "2026-10-05", to: "2026-10-11", days: 7, useForBaseline: true },
        { key: "W2", from: "2026-10-12", to: "2026-10-18", days: 7, useForBaseline: true },
        { key: "W3", from: "2026-10-19", to: "2026-10-20", days: 2, useForBaseline: false },
      ],
    },
    visitVolume: [
      ...vv("r-suzukaze", "under30", 20, 30), ...vv("r-suzukaze", "30to49", 40, 40),
      { week: "W1", area: "r-suzukaze", age: "50plus", visitors: FEW, visits: FEW },
      { week: "W2", area: "r-suzukaze", age: "50plus", visitors: V(10), visits: V(10) },
      ...vv("r-suzukaze", "all", 70, 80),
    ],
    weekdayProfile: [1, 2, 3, 4, 5, 0, 6].map((wd) => ({
      weekday: wd as 0, age: "under30" as const, visits: V(wd === 0 || wd === 6 ? 27 : 20), days: 2,
    })),
    hourProfile: [{ hourBand: "evening", age: "under30", stamps: V(50), share: R(40) }],
    participation: [], satisfaction: [], goodPoints: [],
    requestThemes: [
      { age: "under30", theme: "reward", respondents: V(10), share: R(20), dissatisfiedRate: R(30) },
      { age: "under30", theme: "none", respondents: V(50), share: R(60), dissatisfiedRate: R(5) },
    ],
  } as InsightAggregates;
}

const fact = (start: string, end: string, certainty: "confirmed" | "tentative", ages: string[]): PlannedFact =>
  ({ regionId: "r-suzukaze", startDate: start, endDate: end, certainty, ages } as PlannedFact);

const regions = [{ id: "r-suzukaze", name: "鈴風高原" }];
const weeks = forecastWeeks("2026-11-09", 3).slice(1); // 11/16, 11/23
const planned = [
  fact("2026-11-21", "2026-11-23", "confirmed", ["under30", "under30", "under30", "under30", "30to49"]),
  fact("2026-11-17", "2026-11-17", "tentative", ["under30", "under30", "50plus"]),
];

describe("weeks (INS-T-16)", () => {
  it("月曜始まり12週、日曜は前の月曜", () => {
    const w = forecastWeeks("2026-11-09", 12);
    expect(w).toHaveLength(12);
    expect(w[0]).toEqual({ weekStart: "2026-11-09", weekEnd: "2026-11-15" });
    expect(w[11]).toEqual({ weekStart: "2027-01-25", weekEnd: "2027-01-31" });
    expect(forecastWeeks("2026-11-15", 1)[0].weekStart).toBe("2026-11-09");
  });
});

describe("computeForecast (INS-T-19〜21)", () => {
  const r = computeForecast({ agg: agg(), planned, regions, weeks });
  it("6.4 の例", () => {
    const w1 = r.weeks[0];
    const u = w1.byAge[0].cell;
    expect(u.expected).toEqual(V(31)); expect(u.increasePercent).toBe(24);
    expect(w1.byAge[1].cell.expected).toEqual(V(40)); expect(w1.byAge[1].cell.partial).toBe(true);
    expect(w1.byAge[2].cell.expected).toEqual(FEW);
    expect(w1.total.expected).toEqual(V(80 - 0 + 3 + 0 > 0 ? 83 : 0)); expect(w1.total.increasePercent).toBe(11);
    expect(w1.plannedByCertainty).toEqual({ confirmed: FEW, tentative: FEW });
    expect(w1.groups).toEqual(FEW);
    expect(r.weeks[1].total.expected).toEqual(V(80));
    expect(r.weeks[1].byAge[0].cell.planned).toEqual(FEW);
  });
  it("週をまたぐ・重ならない旅行", () => {
    const rr = computeForecast({ agg: agg(), planned: [fact("2026-11-15", "2026-11-15", "confirmed", Array(9).fill("under30"))], regions, weeks });
    expect(rr.weeks[0].total.planned).toEqual(V(0));
  });
  it("エリア別の表", () => {
    expect(r.areaTable).toHaveLength(1);
    expect(r.areaTable[0].weeks[0].expected).toEqual(V(83));
  });
});

describe("buildPastProfile (INS-T-24)", () => {
  it("1日あたりと topRequest", () => {
    const p = buildPastProfile(agg())[0];
    expect(p.weekdayPerDay).toBe(10); expect(p.weekendPerDay).toBe(13.5);
    expect(p.topRequest?.theme).toBe("reward");
  });
});

describe("evaluateRules (INS-T-25〜29)", () => {
  const biz: TourismBusiness = { id: "biz-x", campaign: "c", displayName: "店", category: "food", regionIds: ["r-suzukaze"] };
  const run = (pl: PlannedFact[]) => {
    const f = computeForecast({ agg: agg(), planned: pl, regions, weeks });
    return evaluateRules({ forecast: f, perArea: [{ weeks: f.weeks }], agg: agg(), business: biz, regions });
  };
  it("R01 成立と文言、ID を含まない", () => {
    const cards = run(planned);
    const r01 = cards.filter((c) => c.ruleId === "R01");
    expect(r01).toHaveLength(1);
    expect(r01[0].ageBand).toBe("under30");
    expect(r01[0].action).toContain("約 24%");
    expect(r01[0].action).toContain("特典・景品");
    expect(JSON.stringify(cards)).not.toMatch(/\b(u|g|m|biz)-\d|biz-/);
  });
  it("R01 少数は不成立 / R02 は 4 件で不成立・5 件で成立", () => {
    const four = Array.from({ length: 4 }, () => fact("2026-11-17", "2026-11-17", "tentative", ["under30", "under30"]));
    const five = Array.from({ length: 5 }, () => fact("2026-11-17", "2026-11-17", "tentative", ["under30", "under30"]));
    expect(run(four).some((c) => c.ruleId === "R02")).toBe(false);
    const c5 = run(five).filter((c) => c.ruleId === "R02");
    expect(c5).toHaveLength(1);
    expect(c5[0].action).toContain("5 組");
    expect(run([fact("2026-11-17", "2026-11-17", "confirmed", ["under30", "under30", "under30", "under30"])]).some((c) => c.ruleId === "R01")).toBe(false);
  });
  it("R03・R04 は過去の傾向で、見込み最大の週に当てる。R04 は参考", () => {
    const cards = run(planned);
    const r03 = cards.find((c) => c.ruleId === "R03")!;
    expect(r03.ageBand).toBe("under30");
    expect(r03.period.weekStart).toBe("2026-11-16");
    expect(cards.find((c) => c.ruleId === "R04")!.reference).toBe(true);
  });
  it("food の事業者はカード food を含むものが先", () => {
    const cards = run(planned);
    const flags = cards.map((c) => c.categories.includes("food"));
    expect(flags).toEqual([...flags].sort((a, b) => Number(b) - Number(a)));
  });
});

describe("fillTemplate", () => {
  it("差し込み", () => {
    expect(fillTemplate("{a}と{b}", { a: "x", b: "y" })).toBe("xとy");
  });
});
