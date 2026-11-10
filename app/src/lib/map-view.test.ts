import { describe, expect, it } from "vitest";
import { JAPAN_MAP_VIEWBOX as F } from "@/components/japan-map-data";
import { clampView, zoomAt, zoomOf } from "./map-view";
import { spotPosition } from "./spot-geo";

describe("map-view", () => {
  const full = { x: 0, y: 0, ...F };
  it("倍率を 1〜8 にクランプ", () => {
    expect(zoomOf(zoomAt(full, F, 100), F)).toBeCloseTo(8);
    expect(zoomOf(zoomAt(full, F, 0.01), F)).toBeCloseTo(1);
  });
  it("地図外に出ない", () => {
    const v = clampView({ x: -50, y: 9999, w: F.w / 4, h: F.h / 4 }, F);
    expect(v.x).toBe(0);
    expect(v.y).toBeCloseTo(F.h - F.h / 4);
  });
  it("カーソル位置が固定される", () => {
    const v = zoomAt(full, F, 2, 0.25, 0.25);
    expect(v.x + v.w * 0.25).toBeCloseTo(F.w * 0.25);
  });
});
describe("spotPosition", () => {
  it("決定的で viewBox 内", () => {
    for (let id = 1; id < 50; id++) {
      const area = id % 2 ? "未知" : "鈴風高原";
      const a = spotPosition({ id, area });
      expect(a).toEqual(spotPosition({ id, area }));
      expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x).toBeLessThanOrEqual(F.w);
      expect(a.y).toBeGreaterThanOrEqual(0); expect(a.y).toBeLessThanOrEqual(F.h);
    }
  });
});
