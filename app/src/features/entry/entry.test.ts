import { beforeEach, describe, expect, it, vi } from "vitest";

// 02 は並行実装のため、署名に対する代替を置く。
vi.mock("@/features/groups/discovery/query", () => ({
  parseGroupListQuery: (p: URLSearchParams) => {
    const filter: Record<string, unknown> = { campaign: "nttw-demo", tags: [], ageBuckets: [], official: false, statuses: [], sort: "deadline:asc" };
    const ignored: { key: string; reason: string }[] = [];
    for (const [k, val] of p) {
      if (k === "region") {
        if (val === "r-nijiho") filter.region = val; else ignored.push({ key: k, reason: "invalid_value" });
      } else if (k === "vacancy") {
        if (/^[1-5]$/.test(val)) filter.vacancy = Number(val); else ignored.push({ key: k, reason: "invalid_value" });
      } else if (k === "dateFrom") {
        filter.dateFrom = val;
      } else if (k === "official") {
        if (val === "1") filter.official = true; else ignored.push({ key: k, reason: "invalid_value" });
      } else ignored.push({ key: k, reason: "unknown_key" });
    }
    return { filter, page: {}, ignored };
  },
  serializeFilter: (f: Record<string, unknown>) => {
    const sp = new URLSearchParams();
    if (f.region) sp.set("region", String(f.region));
    if (f.vacancy) sp.set("vacancy", String(f.vacancy));
    if (f.official) sp.set("official", "1");
    return sp;
  },
}));
vi.mock("@/features/groups/discovery/regions", () => ({
  listRegions: () => [{ id: "r-nijiho", name: "虹帆", campaign: "nttw-demo", spotAreas: [] }],
  getCampaign: (s: string) => (s === "nttw-demo" ? { slug: s, name: "demo" } : null),
}));

import { callRoute, resetForTest } from "@/test/helpers";
import { db } from "@/lib/groups-store";
import { aggregateFunnel, recordFunnelEvent } from "./funnel";
import { postEntryEventHandler, resolveEntryHandler } from "./handlers";
import { buildGroupsPath, resolveEntry } from "./parse";

const ORIGIN = { Origin: "http://localhost:3000", Host: "localhost:3000" };

beforeEach(() => resetForTest());

describe("resolveEntry", () => {
  it("有効な条件は一覧へ(着地なし)", () => {
    const r = resolveEntry("nttw-demo", { region: "r-nijiho", vacancy: "2", src: "sns" });
    expect(r.showLanding).toBe(false);
    expect(r.source).toBe("sns");
    expect(r.groupsPath).toBe("/nttw-demo/groups?region=r-nijiho&vacancy=2");
  });
  it("パラメータなしは条件なしの一覧へ", () => {
    const r = resolveEntry("nttw-demo", {});
    expect(r.groupsPath).toBe("/nttw-demo/groups");
    expect(r.source).toBe("none");
  });
  it("異常値は無視して着地ページ、リダイレクト用キーは使われない", () => {
    const r = resolveEntry("nttw-demo", { region: "<script>", next: "https://example.invalid", src: "zzz", vacancy: ["1", "2"] });
    expect(r.showLanding).toBe(true);
    expect(r.source).toBe("unknown");
    expect(r.groupsPath).toBe("/nttw-demo/groups?vacancy=1");
    expect(r.ignored).toEqual(expect.arrayContaining([
      { key: "region", reason: "invalid_value" },
      { key: "src", reason: "unknown_value" },
      { key: "vacancy", reason: "duplicate" },
      { key: "_unknown", reason: "unknown_value", count: 1 },
    ]));
  });
  it("別名 from/to は dateFrom/dateTo として 02 へ渡る", () => {
    const r = resolveEntry("nttw-demo", { from: "2026-12-05" });
    expect(r.filter.dateFrom).toBe("2026-12-05");
  });
  it("campaign 不正は not_found", () => {
    expect(() => resolveEntry("nope", {})).toThrow();
    expect(() => buildGroupsPath("//evil", { campaign: "x" } as never)).toThrow();
  });
});

describe("funnel", () => {
  it("記録して集計できる", () => {
    const b = aggregateFunnel({ campaign: "nttw-demo" });
    recordFunnelEvent({ type: "entry_landed", campaign: "nttw-demo", channel: "B", source: "sns", region: "r-nijiho" });
    recordFunnelEvent({ type: "entry_params_ignored", campaign: "nttw-demo", channel: "B", source: "sns" });
    recordFunnelEvent({ type: "official_viewed", campaign: "nttw-demo", channel: "A", source: "none", groupId: "g-002" });
    const a = aggregateFunnel({ campaign: "nttw-demo" });
    expect(a.landedBySource.sns).toBe(b.landedBySource.sns + 1);
    expect(a.landedByRegion["r-nijiho"]).toBe((b.landedByRegion["r-nijiho"] ?? 0) + 1);
    expect(a.ignoredCount).toBe(b.ignoredCount + 1);
    expect(a.byListingKind.official_plan.viewed).toBe(b.byListingKind.official_plan.viewed + 1);
  });
  it("組み合わせ違反は例外を出さず破棄", () => {
    const before = db().funnelEvents.count();
    recordFunnelEvent({ type: "list_viewed", campaign: "nttw-demo", channel: "B", source: "sns" });
    recordFunnelEvent({ type: "official_viewed", campaign: "nttw-demo", channel: "A", source: "none", groupId: "g-900" });
    recordFunnelEvent({ type: "bogus" as never, campaign: "nttw-demo", channel: "A", source: "none" });
    expect(db().funnelEvents.count()).toBe(before);
  });
  it("期間不正は invalid_input", () => {
    expect(() => aggregateFunnel({ campaign: "nttw-demo", fromDay: "2026-12-01", toDay: "2026-11-01" })).toThrow();
  });
});

describe("API", () => {
  it("ENT-API-01 は副作用なしで 200", async () => {
    const before = db().funnelEvents.count();
    const r = await callRoute(resolveEntryHandler, "/api/entry/resolve?campaign=nttw-demo&region=r-nijiho&x=1");
    expect(r.status).toBe(200);
    expect(r.body.groupsPath).toBe("/nttw-demo/groups?region=r-nijiho");
    expect(db().funnelEvents.count()).toBe(before);
  });
  it("ENT-API-01 campaign 欠落は 404", async () => {
    const r = await callRoute(resolveEntryHandler, "/api/entry/resolve");
    expect(r.status).toBe(404);
  });
  it("ENT-API-02 は 204、列挙外は 400", async () => {
    const before = db().funnelEvents.count();
    const ok = await callRoute(postEntryEventHandler, "/api/entry/events", {
      body: { type: "list_viewed", campaign: "nttw-demo", channel: "A", source: "none" }, user: "u-001", headers: ORIGIN,
    });
    expect(ok.status).toBe(204);
    expect(db().funnelEvents.count()).toBe(before + 1);
    const ng = await callRoute(postEntryEventHandler, "/api/entry/events", {
      body: { type: "entry_landed", campaign: "nttw-demo", channel: "A", source: "none" }, user: "u-001", headers: ORIGIN,
    });
    expect(ng.status).toBe(400);
  });
});
