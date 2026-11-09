import { describe, expect, it, beforeEach } from "vitest";
import { parseGroupListQuery, serializeFilter } from "./query";
import type { QueryContext } from "./query";
import { normalizeSearchText } from "./text";
import { listRegions, getCampaign } from "./regions";
import { compareGroups, matchesFilter } from "./filter";
import { resetForTest } from "@/test/helpers";
import type { GroupView } from "./internal";
import type { GroupSummary } from "./types";

const ctx: QueryContext = {
  campaigns: ["nttw-demo"],
  defaultCampaign: "nttw-demo",
  regions: [{ id: "r-mizukoto", name: "水琴地方", campaign: "nttw-demo", spotAreas: [] }],
  today: "2026-11-09",
};
const P = (s: string) => new URLSearchParams(s);

describe("parseGroupListQuery", () => {
  it("DSC-T-63 lenient: 別名 from/to", () => {
    const r = parseGroupListQuery(P("region=r-mizukoto&from=2026-12-05&to=2026-12-07"), "lenient", ctx);
    expect(r.filter.region).toBe("r-mizukoto");
    expect(r.filter.dateFrom).toBe("2026-12-05");
    expect(r.filter.dateTo).toBe("2026-12-07");
    expect(r.page).toEqual({ limit: 12, offset: 0 });
    expect(r.ignored).toEqual([]);
  });

  const bad = "region=bad&from=x&utm_source=a&page=0&q=<script>alert(1)</script>";
  it("DSC-T-64 lenient: 不正値は無視して ignored に積む", () => {
    const r = parseGroupListQuery(P(bad), "lenient", ctx);
    expect(r.filter.region).toBeUndefined();
    expect(r.filter.dateFrom).toBeUndefined();
    expect(r.filter.q).toBe("<script>alert(1)</script>");
    expect(r.ignored).toEqual(expect.arrayContaining([
      { key: "region", reason: "invalid_value" },
      { key: "from", reason: "invalid_value" },
      { key: "utm_source", reason: "unknown_key" },
      { key: "page", reason: "invalid_value" },
    ]));
    expect(r.ignored).toHaveLength(4);
  });

  it("DSC-T-65 strict: 同入力は invalid_input", () => {
    expect(() => parseGroupListQuery(P(bad), "strict", ctx)).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });

  it("DSC-T-03 strict: 未知の地方", () => {
    try { parseGroupListQuery(P("region=r-zzz"), "strict", ctx); expect.unreachable(); }
    catch (e) { expect((e as { fields: object }).fields).toHaveProperty("region"); }
  });

  it("DSC-T-06 strict: dateFrom > dateTo", () => {
    try { parseGroupListQuery(P("dateFrom=2026-12-10&dateTo=2026-12-01"), "strict", ctx); expect.unreachable(); }
    catch (e) { expect((e as { fields: object }).fields).toHaveProperty("dateTo"); }
  });

  it("DSC-T-26 strict: status=foo / 過去の日付", () => {
    expect(() => parseGroupListQuery(P("status=foo"), "strict", ctx)).toThrow(expect.objectContaining({ code: "invalid_input" }));
    expect(() => parseGroupListQuery(P("dateFrom=2026-01-01"), "strict", ctx)).toThrow();
  });

  it("strict: limit/offset/sort を読む", () => {
    const r = parseGroupListQuery(P("limit=5&offset=10&sort=vacancy:desc&official=1"), "strict", ctx);
    expect(r.page).toEqual({ limit: 5, offset: 10 });
    expect(r.filter.sort).toBe("vacancy:desc");
    expect(r.filter.official).toBe(true);
  });

  it("DSC-T-66 往復: 既定値は出力されない", () => {
    expect(serializeFilter(parseGroupListQuery(P(""), "strict", ctx).filter).toString()).toBe("");
    const f = parseGroupListQuery(P("region=r-mizukoto&tags=温泉,写真&vacancy=2&q=ハイキング&official=1&sort=start:asc"), "strict", ctx).filter;
    const s = serializeFilter(f);
    expect(parseGroupListQuery(s, "strict", ctx).filter).toEqual(f);
  });
});

describe("normalizeSearchText (DSC-T-13)", () => {
  it("カタカナ折り畳み・全角・空白", () => {
    expect(normalizeSearchText("ハイキング")).toBe(normalizeSearchText("はいきんぐ"));
    expect(normalizeSearchText("　ＡＢＣ　 def ")).toBe("abc def");
  });
});

describe("regions", () => {
  beforeEach(() => resetForTest());
  it("listRegions / getCampaign", () => {
    expect(listRegions("nttw-demo").some((r) => r.id === "r-mizukoto")).toBe(true);
    expect(listRegions("none")).toEqual([]);
    expect(getCampaign("nttw-demo")?.slug).toBe("nttw-demo");
    expect(getCampaign("x")).toBeNull();
  });
});

const sum = (o: Partial<GroupSummary> & { id: string }): GroupSummary => ({
  name: "g", campaign: "nttw-demo", region: { id: "r-mizukoto", name: "水琴地方" },
  trip: { destination: "x", startDate: "2026-12-05", endDate: "2026-12-07", dateNote: "" },
  deadlineDate: "2026-11-20", deadlineAt: "2026-11-20T23:59:00+09:00", tags: ["温泉"], badge: null,
  organizerName: "o", headcount: { min: 2, capacity: 6, current: 3, vacancy: 3, shortfall: 0, isFull: false, reachedMin: true },
  status: "recruiting", statusLabel: "", flags: { full: false, acceptingRequests: true },
  memberSummary: { buckets: ["30-40s"] } as GroupSummary["memberSummary"], viewerRelation: "none", ...o,
});
const view = (s: GroupSummary): GroupView => ({
  group: { official: false } as GroupView["group"], summary: s, activeMembers: [],
  searchText: normalizeSearchText("水琴地方 ハイキング 温泉"), searchTextTags: ["温泉"],
});
const F = (o = {}) => ({ ...parseGroupListQuery(P(""), "strict", ctx).filter, ...o });

describe("matchesFilter / compareGroups", () => {
  it("条件の一致と不一致", () => {
    const v = view(sum({ id: "g-901" }));
    expect(matchesFilter(v, F(), undefined)).toBe(true);
    expect(matchesFilter(v, F({ q: "はいきんぐ" }), undefined)).toBe(true);
    expect(matchesFilter(v, F({ q: "はいきんぐ 海" }), undefined)).toBe(false);
    expect(matchesFilter(v, F({ tags: ["温泉"] }), undefined)).toBe(true);
    expect(matchesFilter(v, F({ dateFrom: "2026-12-08" }), undefined)).toBe(false);
    expect(matchesFilter(v, F({ vacancy: 4 }), undefined)).toBe(false);
    expect(matchesFilter(v, F({ ageBuckets: ["50-60s"] }), undefined)).toBe(false);
    expect(matchesFilter(v, F({ official: true }), undefined)).toBe(false);
  });
  it("受付中が先頭、次に締切順、id で安定化", () => {
    const a = sum({ id: "g-902", status: "confirmed" });
    const b = sum({ id: "g-903", deadlineAt: "2026-11-25T00:00:00+09:00" });
    const c = sum({ id: "g-901" });
    expect([a, b, c].sort(compareGroups("deadline:asc")).map((x) => x.id)).toEqual(["g-901", "g-903", "g-902"]);
  });
});
