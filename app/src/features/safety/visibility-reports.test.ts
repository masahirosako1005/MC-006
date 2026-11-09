import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { insertBlock, insertGroup, insertMember, resetForTest, callRoute } from "@/test/helpers";
import { USER } from "@/test/fixtures";

// 同じ波の P-2-1 の関数は代替する。
vi.mock("./blocks/block-service", () => {
  const active = (a: string, b: string) =>
    db().blocks.find((x) => x.releasedAt === null && ((x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))) !== undefined;
  return {
    isBlocked: active,
    hasBlockAmong: (v: string, ids: string[]) => ids.some((i) => active(v, i)),
    blockUser: vi.fn((user: { id: string }, target: string) => ({ block: insertBlock(user.id, target), created: true })),
    unblockUser: vi.fn(),
    listBlocks: vi.fn(),
  };
});
vi.mock("./guards/rate-limit", () => ({ checkRate: vi.fn(), resetRateBuckets: vi.fn() }));
vi.mock("./visibility/summary", () => ({
  memberSummary: (m: unknown[]) => ({ count: m.length, buckets: null, hiddenReason: "few_members" }),
}));

import { maskProfile, updateProfile, visibleProfile } from "./visibility/profile";
import { isGroupVisibleTo } from "./visibility/group";
import { createReport } from "./reports/report-service";
import { rejectProhibitedParams } from "./guards/input";
import { blockUser } from "./blocks/block-service";
import { createReportHandler, putMyProfileHandler, getUserProfileHandler } from "./handlers";
import type { DemoUser } from "@/lib/groups-types";

const user = (id: string) => db().users.getOrThrow(id) as DemoUser;

beforeEach(() => resetForTest());

describe("profile", () => {
  it("stranger には public 項目だけ、self には全項目", () => {
    const p = db().profiles.getOrThrow(USER.misaki);
    const s = maskProfile(p, "stranger");
    expect(s.displayName).toBe(p.displayName);
    expect(s.ageBand).toBeUndefined();
    expect(s.realName).toBeUndefined();
    expect(maskProfile(p, "self").realName).toBeDefined();
  });

  it("ブロック関係と無関係なグループは not_found", () => {
    insertBlock(USER.kenta, USER.misaki);
    expect(() => visibleProfile({ id: USER.misaki }, USER.kenta, { kind: "list" })).toThrow(/見つかりません/);
    const g = insertGroup({ organizerId: USER.yui });
    expect(() => visibleProfile({ id: USER.misaki }, USER.yui, { kind: "member", groupId: g.id })).toThrow(/見つかりません/);
  });

  it("updateProfile は Profile と DemoUser の表示名を同時に更新する", () => {
    const cur = db().profiles.getOrThrow(USER.misaki);
    const r = updateProfile(user(USER.misaki), {
      displayName: "新しい名前", ageBand: cur.ageBand, bio: "山が好きです。", travelPurposes: ["nature"], visibility: cur.visibility,
    });
    expect(r.profile.displayName).toBe("新しい名前");
    expect(db().users.getOrThrow(USER.misaki).displayName).toBe("新しい名前");
  });

  it("許可外の公開レベルは invalid_input(HTTP)", async () => {
    const cur = db().profiles.getOrThrow(USER.misaki);
    const res = await callRoute(putMyProfileHandler, "/api/me/profile", {
      method: "PUT", user: USER.misaki,
      body: { displayName: "ミサキ", ageBand: cur.ageBand, bio: "", travelPurposes: [], visibility: { ...cur.visibility, realName: "public" } },
    });
    expect(res.status).toBe(400);
  });

  it("GET /api/users/[id]/profile は context なしの他人を 400", async () => {
    const res = await callRoute(getUserProfileHandler, `/api/users/${USER.kenta}/profile`, { user: USER.misaki, params: { userId: USER.kenta } });
    expect(res.status).toBe(400);
  });
});

describe("group visibility", () => {
  it("公開は真、非公開は関係者のみ、ブロック関係は偽", () => {
    const pub = insertGroup({ id: "g-901", organizerId: USER.yui });
    const priv = insertGroup({ id: "g-902", organizerId: USER.yui, visibility: "private" });
    expect(isGroupVisibleTo(USER.misaki, pub)).toBe(true);
    expect(isGroupVisibleTo(USER.misaki, priv)).toBe(false);
    expect(isGroupVisibleTo(USER.misaki, priv, { inviteVerified: true })).toBe(true);
    expect(isGroupVisibleTo(USER.yui, priv)).toBe(true);
    insertBlock(USER.misaki, USER.yui);
    expect(isGroupVisibleTo(USER.misaki, pub)).toBe(false);
  });
});

describe("report", () => {
  it("グループ通報の作成・重複排除・alsoBlock", () => {
    const g = insertGroup({ id: "g-901", organizerId: USER.yui });
    const input = { targetType: "group" as const, targetId: g.id, reason: "other" as const, body: "理由" };
    const a = createReport(user(USER.misaki), input);
    expect(a.deduplicated).toBe(false);
    expect(a.report.targetUserId).toBe(USER.yui);
    expect(a.report.snapshot).toBeNull();
    expect(createReport(user(USER.misaki), input).deduplicated).toBe(true);
    createReport(user(USER.misaki), { ...input, reason: "harassment", alsoBlock: true });
    expect(blockUser).toHaveBeenCalled();
  });

  it("メッセージ通報は snapshot を持ち、非メンバーは not_found", () => {
    const g = insertGroup({ id: "g-901", organizerId: USER.yui });
    insertMember(g.id, USER.kenta);
    db().messages.insert({
      id: "msg-901", groupId: g.id, senderId: USER.kenta, kind: "text", body: "こんにちは", templateId: null,
      systemEvent: null, systemSubjectUserId: null, systemPhase: null, createdAt: "2026-11-01T10:00:00+09:00",
      reportState: "none", reportedBy: [],
    } as never);
    expect(() => createReport(user(USER.misaki), { targetType: "message", targetId: "msg-901", reason: "other" })).toThrow(/見つかりません/);
    insertMember(g.id, USER.misaki);
    const r = createReport(user(USER.misaki), { targetType: "message", targetId: "msg-901", reason: "other" });
    expect(r.report.snapshot).toBe("こんにちは");
    expect(r.report.targetUserId).toBe(USER.kenta);
  });

  it("POST /api/reports: 201、種類外は 400", async () => {
    const g = insertGroup({ id: "g-901", organizerId: USER.yui });
    const ok = await callRoute(createReportHandler, "/api/reports", {
      user: USER.misaki, body: { targetType: "group", targetId: g.id, reason: "other" },
    });
    expect(ok.status).toBe(201);
    expect(ok.body.status).toBe("received");
    const bad = await callRoute(createReportHandler, "/api/reports", {
      user: USER.misaki, body: { targetType: "plan_item", targetId: "pi-001", reason: "other" },
    });
    expect(bad.status).toBe(400);
  });
});

describe("rejectProhibitedParams", () => {
  it("性別・年齢のクエリを拒否し、他は通す", () => {
    expect(() => rejectProhibitedParams(new URLSearchParams("gender=f"))).toThrow();
    expect(() => rejectProhibitedParams(new URLSearchParams("age_min=20"))).toThrow();
    expect(() => rejectProhibitedParams(new URLSearchParams("region=r-mizukoto&limit=5"))).not.toThrow();
  });
});
