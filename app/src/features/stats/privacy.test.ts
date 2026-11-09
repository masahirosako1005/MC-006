import { describe, expect, it } from "vitest";
import { coarseAgeBand, suppressBreakdown, toCountCell, toRateCell } from "./privacy";

describe("privacy", () => {
  it("MUN-T-01", () => {
    expect(toCountCell(4, 5)).toEqual({ few: true });
    expect(toCountCell(5, 5)).toEqual({ few: false, value: 5 });
    expect(toCountCell(0, 5)).toEqual({ few: false, value: 0 });
    expect(toCountCell(1, 5)).toEqual({ few: true });
  });
  it("MUN-T-02", () => {
    expect(toRateCell(3, 4, 5)).toEqual({ kind: "few" });
    expect(toRateCell(0, 0, 5)).toEqual({ kind: "none" });
  });
  it("MUN-T-03", () => {
    expect(toRateCell(3, 20, 5)).toEqual({ kind: "below", percent: 25 });
    expect(toRateCell(4, 10, 5)).toEqual({ kind: "below", percent: 50 });
    expect(toRateCell(6, 10, 5)).toEqual({ kind: "value", percent: 60 });
    expect(toRateCell(0, 10, 5)).toEqual({ kind: "value", percent: 0 });
  });
  it("MUN-T-04", () => {
    expect(suppressBreakdown([3, 8, 12, 20], 5)).toEqual([true, true, false, false]);
    expect(suppressBreakdown([3, 2, 12, 20], 5)).toEqual([true, true, false, false]);
    expect(suppressBreakdown([0, 8, 12], 5)).toEqual([false, false, false]);
    expect(suppressBreakdown([8, 12, 20], 5)).toEqual([false, false, false]);
  });
  it("MUN-T-06", () => {
    const bands = ["18-19", "20s", "30s", "40s", "50s", "60s", "70s+", undefined] as const;
    expect(bands.map((b) => coarseAgeBand(b))).toEqual([
      "under30", "under30", "30to49", "30to49", "50plus", "50plus", "50plus", null,
    ]);
  });
});
