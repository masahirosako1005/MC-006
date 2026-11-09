import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { callRoute, insertBlock, insertGroup, insertMember, resetForTest } from "@/test/helpers";

const m = vi.hoisted(() => ({
  createGroup: vi.fn(),
  getGroup: vi.fn(),
  getPublicGroup: vi.fn(),
  validateCreateGroupInput: vi.fn(),
  validateLifecycleInput: vi.fn(),
  buildInitialLifecycle: vi.fn(),
  recordCreated: vi.fn(),
  requireVerified: vi.fn(),
  checkRate: vi.fn(),
  assertTextAllowed: vi.fn(),
  isGroupVisibleTo: vi.fn(),
}));

vi.mock("@/features/groups/core/service", () => ({ createGroup: m.createGroup, getGroup: m.getGroup }));
vi.mock("@/features/groups/core/validation", () => ({ validateCreateGroupInput: m.validateCreateGroupInput }));
vi.mock("@/features/groups/lifecycle", () => ({
  validateLifecycleInput: m.validateLifecycleInput,
  buildInitialLifecycle: m.buildInitialLifecycle,
  recordCreated: m.recordCreated,
}));
vi.mock("@/features/groups/discovery/service", () => ({ getPublicGroup: m.getPublicGroup }));
vi.mock("@/features/safety/text/check-text", () => ({ assertTextAllowed: m.assertTextAllowed }));
vi.mock("@/features/safety/guards/rate-limit", () => ({ checkRate: m.checkRate }));
vi.mock("@/features/safety/verification/verification-service", () => ({ requireVerified: m.requireVerified }));

vi.mock("@/features/safety/visibility/group", () => ({ isGroupVisibleTo: m.isGroupVisibleTo }));

import { createGroupHandler, getGroupDetailHandler } from "./handlers";

const INPUT = {
  name: "試験の旅", campaign: "c", region: "r-mizukoto", capacity: 4, visibility: "public", tags: ["a"], description: "d",
  trip: { destination: "どこか", startDate: "2026-12-10", endDate: "2026-12-11", dateNote: "" },
};

beforeEach(() => {
  resetForTest();
  vi.clearAllMocks();
  m.validateCreateGroupInput.mockImplementation(() => INPUT);
  m.validateLifecycleInput.mockImplementation((i) => i);
  m.buildInitialLifecycle.mockReturnValue({ status: "recruiting" });
  m.createGroup.mockReturnValue({ id: "g-901" });
  m.getGroup.mockImplementation((_u, id) => ({ kind: "member", group: { id } }));
  // 09 の本体は並行作成中。公開かつブロック関係なしの判定を簡易に代替する。
  m.isGroupVisibleTo.mockImplementation(
    (viewer: string, g: { visibility: string; organizerId: string }) =>
      g.visibility === "public" && !db().blocks.list().some((b) => b.blockerId === g.organizerId && b.blockedId === viewer),
  );
  m.getPublicGroup.mockImplementation((_u, id) => ({ kind: "public", id }));
});

describe("createGroupHandler", () => {
  it("201 で作成し、04・01 を順に呼ぶ", async () => {
    const r = await callRoute(createGroupHandler, "/api/groups", {
      user: "u-001", body: { ...INPUT, minMembers: 2, deadlineDate: "2026-12-01" },
    });
    expect(r.status).toBe(201);
    expect(r.body.kind).toBe("member");
    expect(m.requireVerified).toHaveBeenCalledWith("u-001", "create_group");
    expect(m.checkRate).toHaveBeenCalledWith("group_create", "u-001");
    expect(m.validateLifecycleInput).toHaveBeenCalledWith(
      { minMembers: 2, deadlineDate: "2026-12-01" },
      expect.objectContaining({ capacity: 4, startDate: "2026-12-10" }),
    );
    expect(m.createGroup).toHaveBeenCalled();
    expect(m.recordCreated).toHaveBeenCalledWith("g-901");
  });

  it("deadlineDate が無ければ 400", async () => {
    const r = await callRoute(createGroupHandler, "/api/groups", { user: "u-001", body: INPUT });
    expect(r.status).toBe(400);
    expect(m.createGroup).not.toHaveBeenCalled();
  });
});

describe("getGroupDetailHandler", () => {
  it("関係者は member 詳細", async () => {
    const g = insertGroup({ id: "g-901", organizerId: "u-001" });
    const r = await callRoute(getGroupDetailHandler, `/api/groups/${g.id}`, { user: "u-001", params: { groupId: g.id } });
    expect(r.status).toBe(200);
    expect(r.body.kind).toBe("member");
  });

  it("公開の非関係者は public 詳細", async () => {
    insertGroup({ id: "g-902", organizerId: "u-001" });
    const r = await callRoute(getGroupDetailHandler, "/api/groups/g-902", { user: "u-002", params: { groupId: "g-902" } });
    expect(r.status).toBe(200);
    expect(r.body.kind).toBe("public");
  });

  it("非公開の非メンバーは 404", async () => {
    insertGroup({ id: "g-903", organizerId: "u-001", visibility: "private" });
    const r = await callRoute(getGroupDetailHandler, "/api/groups/g-903", { user: "u-002", params: { groupId: "g-903" } });
    expect(r.status).toBe(404);
  });

  it("ブロック関係は 404、存在しない ID も 404", async () => {
    insertGroup({ id: "g-904", organizerId: "u-001" });
    insertMember("g-904", "u-003");
    insertBlock("u-001", "u-002");
    const r = await callRoute(getGroupDetailHandler, "/api/groups/g-904", { user: "u-002", params: { groupId: "g-904" } });
    expect(r.status).toBe(404);
    const r2 = await callRoute(getGroupDetailHandler, "/api/groups/g-999", { user: "u-001", params: { groupId: "g-999" } });
    expect(r2.status).toBe(404);
  });
});
