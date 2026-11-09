import { beforeEach, describe, expect, it } from "vitest";
import { callRoute, resetForTest } from "@/test/helpers";
import { BUSINESS_OWNER, OTHER_BUSINESS_OWNER } from "@/test/fixtures";
import { getInsightsHandler, getInsightSuggestionsHandler } from "./handlers";

beforeEach(() => resetForTest({ futureTrips: true }));

describe("GET /api/insights", () => {
  it("INS-T-30: 事業者以外は 403 not_business_owner", async () => {
    for (const user of [undefined, "u-001", "u-009", "u-012"]) {
      const r = await callRoute(getInsightsHandler, "/api/insights", { user });
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe("not_business_owner");
    }
  });

  it("INS-T-31: 事業者は 12 週・2 エリアの見込みを得る", async () => {
    const r = await callRoute(getInsightsHandler, "/api/insights", { user: BUSINESS_OWNER });
    expect(r.status).toBe(200);
    expect(r.body.meta.regions.map((x: { id: string }) => x.id)).toEqual(["r-suzukaze", "r-hoshinagi"]);
    expect(r.body.weeks).toHaveLength(12);
    expect(r.body.areaTable).toHaveLength(2);
    expect(r.headers.get("Cache-Control")).toBe("no-store");
    expect(JSON.stringify(r.body)).not.toMatch(/\b(u|g|m|sl)-\d+|biz-/);
  });

  it("INS-T-32: 担当外・存在しないエリアは 403 region_out_of_scope", async () => {
    for (const region of ["r-nijiho", "r-zzz"]) {
      const r = await callRoute(getInsightsHandler, `/api/insights?region=${region}`, { user: BUSINESS_OWNER });
      expect(r.status).toBe(403);
      expect(r.body.reason).toBe("region_out_of_scope");
    }
  });

  it("INS-T-33/34: 形式不正・未知キーは 400", async () => {
    const a = await callRoute(getInsightsHandler, "/api/insights?region=%3Cscript%3E", { user: BUSINESS_OWNER });
    expect(a.status).toBe(400);
    expect(a.body.fields.region).toBeTruthy();
    const b = await callRoute(getInsightsHandler, "/api/insights?foo=1", { user: BUSINESS_OWNER });
    expect(b.status).toBe(400);
    expect(b.body.fields.foo).toBeTruthy();
  });
});

describe("GET /api/insights/suggestions", () => {
  it("INS-T-35: u-014 は food、カードの regionId は r-nijiho か null", async () => {
    const r = await callRoute(getInsightSuggestionsHandler, "/api/insights/suggestions", { user: OTHER_BUSINESS_OWNER });
    expect(r.status).toBe(200);
    expect(r.body.meta.business.category).toBe("food");
    for (const c of r.body.cards) expect([null, "r-nijiho"]).toContain(c.regionId);
  });

  it("u-013 でも 200 を返す", async () => {
    const r = await callRoute(getInsightSuggestionsHandler, "/api/insights/suggestions", { user: BUSINESS_OWNER });
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.cards)).toBe(true);
  });
});
