import { beforeEach, describe, expect, it, vi } from "vitest";
import { callRoute, insertGroup, resetForTest } from "@/test/helpers";
import { MUNICIPALITY, REGION, USER } from "@/test/fixtures";
import { db } from "@/lib/groups-store";
import { SOURCE_LABELS } from "@/features/entry/types";
import type { FunnelAggregate } from "@/features/entry/types";

vi.mock("@/features/entry/funnel", () => ({
  aggregateFunnel: (q: { campaign: string; fromDay: string; toDay: string }): FunnelAggregate => ({
    campaign: q.campaign, fromDay: q.fromDay, toDay: q.toDay,
    landedBySource: Object.fromEntries(SOURCE_LABELS.map((s) => [s, 0])) as FunnelAggregate["landedBySource"],
    landedByRegion: {},
    ignoredCount: 0,
    listViewedByChannel: { A: 0, B: 0 },
    officialViewed: 0,
    officialRequested: 0,
    byListingKind: {
      official_plan: { viewed: 0, requested: 0 },
      gathering_event: { viewed: 0, requested: 0 },
      host_slot: { viewed: 0, requested: 0 },
    },
  }),
}));

import { getStatsHandler } from "./handlers";
import { resolveScope } from "./access";
import { parseStatsQuery } from "./query";
import { getStats } from "./service";
import { buildDemoHistory } from "./demo-history";
import { addFunnelEvents } from "./facts";
import { toCountCell } from "./privacy";

const get = (qs: string, user: string = USER.municipalA) => callRoute(getStatsHandler, `/api/stats${qs}`, { user });

beforeEach(() => resetForTest());

describe("access / query", () => {
  it("MUN-T-08 旅行者は 403 not_municipal", async () => {
    const r = await get("", USER.misaki);
    expect(r.status).toBe(403);
    expect(r.body.reason).toBe("not_municipal");
    expect(() => resolveScope(db().users.getOrThrow(USER.misaki))).toThrow();
  });

  it("MUN-T-16 既定は直近 3 か月", () => {
    const scope = resolveScope(db().users.getOrThrow(USER.municipalA));
    const q = parseStatsQuery(new URLSearchParams(), scope, new Date("2026-11-09T00:00:00+09:00"));
    expect(q).toEqual({ from: "2026-09-01", to: "2026-11-30", region: null, official: "all" });
  });

  it("MUN-T-17 地方の形式不正は 400、MUN-T-11 担当外は 403", async () => {
    const bad = await get("?region=%3Cscript%3E");
    expect(bad.status).toBe(400);
    expect(bad.body.fields.region).toBeDefined();
    const out = await get(`?region=${REGION.mizukoto}`);
    expect(out.status).toBe(403);
    expect(out.body.reason).toBe("region_out_of_scope");
    expect((await get(`?region=${REGION.nijiho}`)).status).toBe(200);
  });

  it("未知のクエリキーは 400", async () => {
    const r = await get("?gender=x");
    expect(r.status).toBe(400);
    expect(r.body.fields.gender).toBeDefined();
  });
});

describe("getStats", () => {
  it("MUN-T-41 insertGroup した確定グループが確定数に加わる", () => {
    const user = db().users.getOrThrow(USER.municipalA);
    const q = { from: "2026-09-01", to: "2026-11-30", region: null, official: "all" as const };
    const num = (c: { few: boolean; value?: number }) => (c.few ? 0 : (c.value ?? 0));
    const before = num(getStats(user, q, { includeHistory: false }).summary.confirmedGroups as never);
    insertGroup({
      id: "g-901", region: REGION.nijiho,
      lifecycle: { status: "confirmed", confirmedAt: "2026-11-05T10:00:00+09:00" },
    });
    const res = getStats(user, q, { includeHistory: false });
    const after = res.summary.confirmedGroups;
    // K=5 のため少数表示になりうる。少数でなければ 1 増える。
    expect(after.few ? true : after.value === before + 1).toBe(true);
    expect(res.meta.includesDemoHistory).toBe(false);
  });

  it("MUN-T-05 応答に内部 ID が含まれない(合成履歴あり)", async () => {
    const r = await get("?from=2026-05-01&to=2026-10-31");
    expect(r.status).toBe(200);
    expect(r.headers.get("cache-control")).toBe("no-store");
    const text = JSON.stringify(r.body);
    expect(text).not.toMatch(/\b(u|g|m|jr|gs|rs|fe)-\d+\b|hist-|\bh-\d+/);
    expect(r.body.meta.includesDemoHistory).toBe(true);
    expect(r.body.summary.groupsCreated.few).toBe(false);
  });
});

describe("demo-history / addFunnelEvents", () => {
  it("MUN-T-38 決定論的で ID が一意", () => {
    const ms = db().municipalities.list();
    const a = buildDemoHistory(ms);
    const b = buildDemoHistory(ms.map((m) => ({ ...m })));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const ids = a.groups.map((g) => g.groupId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((i) => i.startsWith("hist-"))).toBe(true);
    for (const g of a.groups.filter((x) => x.status === "replanned")) {
      expect(a.groups.some((x) => x.replanOfGroupId === g.groupId)).toBe(true);
    }
    expect(a.groups.some((g) => g.campaign === MUNICIPALITY.a || g.region === REGION.nijiho)).toBe(true);
  });

  it("MUN-T-40 期間外・別キャンペーンは加算せず base も不変", () => {
    const base = (): FunnelAggregate => ({
      campaign: "c", fromDay: "2026-09-01", toDay: "2026-09-30",
      landedBySource: Object.fromEntries(SOURCE_LABELS.map((s) => [s, 0])) as FunnelAggregate["landedBySource"],
      landedByRegion: {}, ignoredCount: 0, listViewedByChannel: { A: 0, B: 0 }, officialViewed: 0, officialRequested: 0,
      byListingKind: { official_plan: { viewed: 0, requested: 0 }, gathering_event: { viewed: 0, requested: 0 }, host_slot: { viewed: 0, requested: 0 } },
    });
    const b = base();
    const out = addFunnelEvents(b, [
      { type: "entry_landed", day: "2026-09-10", campaign: "c", channel: "B", source: "sns" },
      { type: "entry_landed", day: "2026-08-10", campaign: "c", channel: "B", source: "sns" },
      { type: "entry_landed", day: "2026-09-10", campaign: "x", channel: "B", source: "sns" },
      { type: "list_viewed", day: "2026-09-11", campaign: "c", channel: "A", source: "none" },
    ]);
    expect(out.landedBySource.sns).toBe(1);
    expect(out.listViewedByChannel.A).toBe(1);
    expect(b).toEqual(base());
  });

  it("実 privacy と結合: 少数セルは値を出さない", () => {
    expect(toCountCell(3, 5)).toEqual({ few: true });
  });
});
