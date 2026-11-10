import { describe, expect, it } from "vitest";
import { destinationPoint, spotPoint } from "./group-geo";
import { JAPAN_MAP_VIEWBOX } from "@/components/japan-map-data";

const inBox = (p: { x: number; y: number }) => p.x >= 0 && p.x <= JAPAN_MAP_VIEWBOX.w && p.y >= 0 && p.y <= JAPAN_MAP_VIEWBOX.h;

describe("destinationPoint", () => {
  it("決定的で viewBox 内", () => {
    const a = destinationPoint({ groupId: "g-1", destination: "未知の場所", regionId: "r-mizukoto" });
    const b = destinationPoint({ groupId: "g-1", destination: "未知の場所", regionId: "r-mizukoto" });
    expect(a).toEqual(b);
    expect(inBox(a)).toBe(true);
    expect(a.spotId).toBeNull();
  });
  it("スポット名に一致すればそのスポットの座標", () => {
    const a = destinationPoint({ groupId: "g-1", destination: "雪雫の音楽堂", regionId: "r-suzukaze" });
    expect(a.spotId).toBe(1);
    expect(a).toMatchObject({ x: spotPoint(1)!.x, y: spotPoint(1)!.y });
  });
  it("未知の地方 ID や多数の ID でも viewBox 内", () => {
    for (let i = 0; i < 200; i++) expect(inBox(destinationPoint({ groupId: `g-${i}`, destination: `d${i}`, regionId: i % 2 ? "r-x" + i : "r-nijiho" }))).toBe(true);
  });
});
