import { describe, expect, it } from "vitest";
import { callRoute, resetForTest } from "@/test/helpers";
import { BUSINESS_OWNER } from "@/test/fixtures";
import { getInsightsHandler } from "./handlers";
import { ageChartState, sumCells } from "./trend";

describe("trend(週別の旅行者人数)", () => {
  it("sumCells は少数を除いて合算し、全て少数なら少数", () => {
    expect(sumCells([{ few: false, value: 3 }, { few: true }, { few: false, value: 4 }])).toEqual({ few: false, value: 7 });
    expect(sumCells([{ few: true }, { few: true }])).toEqual({ few: true });
  });

  it("ageChartState: 空・4 人未満は非表示、それ以外は ok", () => {
    const c = (...v: (number | null)[]) => v.map((n) => ({ cell: n === null ? { few: true as const } : { few: false as const, value: n } }));
    expect(ageChartState(c(0, 0, 0))).toBe("empty");
    expect(ageChartState(c(null, 3, null))).toBe("hidden");
    expect(ageChartState(c(null, 5, 6))).toBe("ok");
  });

  it("GET /api/insights は過去+未来の trend を返す", async () => {
    resetForTest({ futureTrips: true });
    const r = await callRoute(getInsightsHandler, "/api/insights", { user: BUSINESS_OWNER });
    const kinds = r.body.trend.map((w: { kind: string }) => w.kind);
    expect(kinds.filter((k: string) => k === "past").length).toBeGreaterThan(0);
    expect(kinds.filter((k: string) => k === "future")).toHaveLength(12);
    for (const w of r.body.trend) for (const a of w.byAge) {
      if (!a.cell.few) expect(a.cell.value === 0 || a.cell.value >= 5).toBe(true);
    }
  });
});
