import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import type { DemoUser } from "@/lib/groups-types";

// 他タスク(01・03・04・09・11、02 の filter/query/regions)の関数は署名に合わせて代替する。
vi.mock("@/features/groups/lifecycle", () => ({
  statusLabel: (s: string) => (s === "replanned" ? "再企画済み" : s),
  canAcceptRequests: (g: { lifecycle: { status: string } }) => ["recruiting", "min_reached"].includes(g.lifecycle.status),
}));
vi.mock("@/features/safety/blocks/block-service", () => ({
  hasBlockAmong: (viewerId: string, ids: string[]) =>
    db().blocks.list().some((b) => (b.blockerId === viewerId && ids.includes(b.blockedId)) || (b.blockedId === viewerId && ids.includes(b.blockerId))),
}));
vi.mock("@/features/safety/visibility/summary", () => ({
  ageBandsOf: () => [],
  memberSummary: () => ({ count: 0, buckets: null, hiddenReason: "few_members" }),
}));
vi.mock("@/features/safety/visibility/profile", () => ({
  visibleProfile: (_v: unknown, id: string) => ({ userId: id, displayName: `表示名-${id}` }),
}));
vi.mock("@/features/safety/visibility/group", () => ({
  isGroupVisibleTo: (viewerId: string, g: { organizerId: string }, o?: { inviteVerified?: boolean }) => {
    const blocked = db().blocks.list().some((b) => (b.blockerId === viewerId && b.blockedId === g.organizerId) || (b.blockedId === viewerId && b.blockerId === g.organizerId));
    return !blocked && (o?.inviteVerified === true || (g as { visibility?: string }).visibility === "public");
  },
}));
vi.mock("@/features/safety/guards/input", () => ({ rejectProhibitedParams: () => undefined }));
vi.mock("@/features/official/service", () => ({ getOfficialBadges: () => ({}) }));
vi.mock("@/features/groups/join/stats", () => ({ hasPendingRequest: () => false }));
vi.mock("@/features/groups/core/service", () => ({
  getGroupById: (id: string) => db().groups.get(id),
  listAllGroups: () => db().groups.list(),
  normalizeInviteCode: (raw: string) => {
    const s = raw.toUpperCase().replace(/[-\s]/g, "");
    return /^[A-Z0-9]{10}$/.test(s) ? s : null;
  },
  findGroupByInviteCode: (raw: string) => {
    const s = raw.toUpperCase().replace(/[-\s]/g, "");
    return db().groups.list().find((g) => g.inviteCode?.code.replace(/-/g, "") === s);
  },
}));
vi.mock("./regions", () => ({
  listRegions: () => [{ id: "r-mizukoto", name: "水琴", campaign: "nttw-demo", spotAreas: [] }],
  getCampaign: (s: string) => (s === "nttw-demo" ? { slug: s, name: "デモ" } : null),
}));
vi.mock("./filter", () => ({
  matchesFilter: () => true,
  compareGroups: () => (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id),
  computeSuggestions: () => [],
}));
vi.mock("./text", () => ({ normalizeSearchText: (s: string) => s.toLowerCase() }));
vi.mock("./query", () => ({
  parseGroupListQuery: () => ({
    filter: { campaign: "nttw-demo", tags: [], ageBuckets: [], official: false, statuses: ["recruiting", "min_reached"], sort: "deadline:asc" },
    page: { limit: 12, offset: 0 },
    ignored: [],
  }),
}));

import { findByInviteCode, getPublicGroup, listGroups } from "./service";
import { listGroupsHandler, lookupInviteHandler, listRegionsHandler } from "./handlers";

const viewer: DemoUser = { id: "u-002", displayName: "閲覧者", role: "traveler" };

describe("discovery service", () => {
  beforeEach(() => resetForTest());

  it("詳細: 人数・申請可否・ホワイトリスト(DSC-T-41・43)", () => {
    const g = insertGroup({ id: "g-901", capacity: 4, organizerId: "u-001" });
    const d = getPublicGroup(viewer, g.id);
    expect(d.kind).toBe("public");
    expect(d.headcount).toMatchObject({ min: 2, capacity: 4, current: 1, vacancy: 3, shortfall: 1, isFull: false, reachedMin: false });
    expect(d.applyState).toEqual({ canApply: true });
    expect(d.organizerName).toBe("表示名-u-001");
    expect(JSON.stringify(d)).not.toContain("inviteCode");
    expect(Object.keys(d)).not.toContain("members");
  });

  it("詳細: 満員・中止・終了・締切後(DSC-T-44〜47)", () => {
    const full = insertGroup({ id: "g-902", capacity: 2, organizerId: "u-001" });
    insertMember(full.id, "u-003");
    expect(getPublicGroup(viewer, full.id).applyState).toEqual({ canApply: false, reason: "full" });
    insertGroup({ id: "g-903", lifecycle: { status: "cancelled", cancelReason: "min_not_reached" } });
    const c = getPublicGroup(viewer, "g-903");
    expect(c.applyState.reason).toBe("cancelled");
    expect(c.cancelKind).toBe("auto");
    insertGroup({ id: "g-904", lifecycle: { status: "replanned", cancelReason: "organizer_cancelled", replannedToGroupId: "g-909" } });
    const r = getPublicGroup(viewer, "g-904");
    expect(r).toMatchObject({ statusLabel: "再企画済み", cancelKind: "organizer", replannedToGroupId: "g-909" });
    insertGroup({ id: "g-905", lifecycle: { status: "withdrawal_period" } });
    expect(getPublicGroup(viewer, "g-905").applyState.reason).toBe("closed");
    insertGroup({ id: "g-906", lifecycle: { status: "completed" } });
    expect(getPublicGroup(viewer, "g-906").applyState.reason).toBe("finished");
  });

  it("詳細: 非公開は not_found", () => {
    insertGroup({ id: "g-907", visibility: "private" });
    expect(() => getPublicGroup(viewer, "g-907")).toThrow(expect.objectContaining({ code: "not_found" }));
  });

  it("一覧: 非公開を除外しページを返す", () => {
    insertGroup({ id: "g-908" });
    insertGroup({ id: "g-909", visibility: "private" });
    const r = listGroups(viewer, { campaign: "nttw-demo", tags: [], ageBuckets: [], official: false, statuses: ["recruiting"], sort: "deadline:asc" }, { limit: 100, offset: 0 });
    const ids = r.items.map((i) => i.id);
    expect(ids).toContain("g-908");
    expect(ids).not.toContain("g-909");
    expect(r.filter).not.toHaveProperty("campaign");
  });

  it("招待コード: 正規化して照合、該当なしと形式不正を拒否(DSC-T-57・58)", () => {
    insertGroup({ id: "g-910", visibility: "private", inviteCode: { code: "TESTCDE2X5", issuedAt: "2026-11-01T00:00:00+09:00", expiresAt: "2026-12-01T00:00:00+09:00", revokedAt: null } });
    const a = findByInviteCode(viewer, "TESTC-DE2X5");
    const b = findByInviteCode(viewer, "testc de2x5");
    expect(a.id).toBe("g-910");
    expect(b).toEqual(a);
    expect(Object.keys(a)).not.toContain("tags");
    expect(() => findByInviteCode(viewer, "ZZZZZ-ZZZZZ")).toThrow(expect.objectContaining({ code: "not_found" }));
    expect(() => findByInviteCode(viewer, "!!")).toThrow(expect.objectContaining({ code: "invalid_input" }));
  });
});

describe("discovery handlers", () => {
  beforeEach(() => resetForTest());

  it("GET /api/regions と POST /api/invites/lookup と GET /api/groups", async () => {
    const reg = await callRoute(listRegionsHandler, "/api/regions", { user: "u-002" });
    expect(reg.status).toBe(200);
    expect(reg.body.regions[0]).not.toHaveProperty("spotAreas");
    const bad = await callRoute(listRegionsHandler, "/api/regions?campaign=nope", { user: "u-002" });
    expect(bad.status).toBe(400);
    const lk = await callRoute(lookupInviteHandler, "/api/invites/lookup", { user: "u-002", body: { code: "ZZZZZ-ZZZZZ" } });
    expect(lk.status).toBe(404);
    const list = await callRoute(listGroupsHandler, "/api/groups", { user: "u-002" });
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
  });
});
