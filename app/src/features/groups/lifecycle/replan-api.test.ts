import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { notFound } from "@/lib/errors";
import { forbidden } from "@/lib/errors";
import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { PRIVATE_GROUP } from "@/test/fixtures";

const mocks = vi.hoisted(() => ({
  notify: vi.fn(),
  createGroupInternal: vi.fn(),
  withdraw: vi.fn(),
}));

vi.mock("@/features/notify/service", () => ({ notify: mocks.notify }));
vi.mock("@/features/safety/verification/verification-service", () => ({ requireVerified: vi.fn() }));
vi.mock("@/features/safety/text/check-text", () => ({ assertTextAllowed: vi.fn() }));
vi.mock("@/features/safety/guards/access", async () => {
  const { db } = await import("@/lib/groups-store");
  return {
    assertGroupAccess: (userId: string, groupId: string) => {
      const g = db().groups.get(groupId);
      const isM = db().members.find((m) => m.groupId === groupId && m.userId === userId && m.status === "active");
      if (!g || (g.visibility === "private" && !isM)) throw notFound("グループ");
      return g;
    },
  };
});
vi.mock("@/features/groups/core/service", async () => {
  const { db } = await import("@/lib/groups-store");
  return {
    countActiveMembers: (id: string) => db().members.filter((m) => m.groupId === id && m.status === "active").length,
    createGroupInternal: mocks.createGroupInternal,
    applyLifecyclePatch: (id: string, _rev: number, patch: object) => {
      const g = db().groups.getOrThrow(id);
      const lifecycle = { ...g.lifecycle, ...patch, revision: g.lifecycle.revision + 1 };
      db().groups.update(id, { lifecycle });
      return lifecycle;
    },
  };
});
vi.mock("./rules", () => ({
  validateLifecycleInput: (i: unknown) => i,
  buildInitialLifecycle: (i: { minMembers: number; deadlineDate: string }, _n: Date, o: { replanOfGroupId: string }) => ({
    status: "recruiting", minMembers: i.minMembers, deadlineDate: i.deadlineDate, replanOfGroupId: o.replanOfGroupId, revision: 1,
  }),
}));
vi.mock("./evaluate", () => ({ recordCreated: vi.fn() }));
vi.mock("./policy", async (orig) => ({
  ...(await orig<object>()),
  canAcceptRequests: () => true, canEdit: () => true, canChat: () => true, canReadHistory: () => true,
  canEditExpenses: () => true, canCollectStamps: () => true, canReview: () => true, canWithdraw: () => true,
  canOrganizerCancel: () => true, canChangeConditions: () => true, canReplan: () => true,
}));
vi.mock("./withdraw", () => ({ withdraw: mocks.withdraw }));

import { getLifecycleHandler, getReplanDraftHandler, replanHandler, withdrawHandler } from "./handlers";

const params = (id: string) => ({ params: { groupId: id } });
const dates = { startDate: "2026-12-19", endDate: "2026-12-20", deadlineDate: "2026-12-10" };

function cancelledGroup() {
  const g = insertGroup({
    id: "g-901", name: "元の旅", capacity: 5,
    lifecycle: { status: "cancelled", cancelReason: "organizer_cancelled", organizerCancelReason: "other" },
  });
  insertMember(g.id, "u-002");
  insertMember(g.id, "u-003");
  return g;
}

beforeEach(() => {
  resetForTest();
  mocks.notify.mockReset();
  mocks.createGroupInternal.mockReset();
  mocks.createGroupInternal.mockImplementation((i: { lifecycle: object }) =>
    db().groups.insert({
      id: "g-902", name: "新", campaign: "c", region: "r-mizukoto", capacity: 5, visibility: "public", tags: [],
      description: "", official: false, inviteCode: null, createdAt: "x", updatedAt: "x", organizerId: "u-001",
      trip: { destination: "d", startDate: "2026-12-19", endDate: "2026-12-20", dateNote: "" },
      ...i, lifecycle: i.lifecycle,
    } as never),
  );
});

describe("04 再企画・状態の表示", () => {
  it("LCY-T-50: 中止後の再企画で新グループができ、元は replanned になる", async () => {
    cancelledGroup();
    const r = await callRoute(replanHandler, "/api/groups/g-901/replan", { user: "u-001", body: dates, ...params("g-901") });
    expect(r.status).toBe(201);
    expect(r.body).toEqual({ groupId: "g-902", invited: 2 });
    const orig = db().groups.get("g-901")!;
    expect(orig.lifecycle.status).toBe("replanned");
    expect(orig.lifecycle.replannedToGroupId).toBe("g-902");
    expect(mocks.createGroupInternal.mock.calls[0][0].lifecycle.replanOfGroupId).toBe("g-901");
    expect(mocks.notify).toHaveBeenCalledOnce();
  });

  it("LCY-T-52: 再企画で元のメンバーは新グループのメンバーにならない", async () => {
    cancelledGroup();
    await callRoute(replanHandler, "/api/groups/g-901/replan", { user: "u-001", body: dates, ...params("g-901") });
    const members = db().members.filter((m) => m.groupId === "g-902").map((m) => m.userId);
    expect(members).not.toContain("u-002");
  });

  it("再企画の拒否: 幹事以外 403、中止でない 409、初期値取得", async () => {
    cancelledGroup();
    const a = await callRoute(getReplanDraftHandler, "/api/groups/g-901/replan-draft", { user: "u-002", ...params("g-901") });
    expect(a.status).toBe(403);
    const b = await callRoute(getReplanDraftHandler, "/api/groups/g-901/replan-draft", { user: "u-001", ...params("g-901") });
    expect(b.status).toBe(200);
    expect(b.body.recipientCount).toBe(2);
    insertGroup({ id: "g-903" });
    const c = await callRoute(replanHandler, "/api/groups/g-903/replan", { user: "u-001", body: dates, ...params("g-903") });
    expect(c.status).toBe(409);
  });

  it("LCY-T-65: 非公開グループを非メンバーが取得すると 404", async () => {
    const r = await callRoute(getLifecycleHandler, `/api/groups/${PRIVATE_GROUP}/lifecycle`, { user: "u-010", ...params(PRIVATE_GROUP) });
    expect(r.status).toBe(404);
  });

  it("getLifecycleView: 中止グループの organizerCancelReason を返す", async () => {
    cancelledGroup();
    const r = await callRoute(getLifecycleHandler, "/api/groups/g-901/lifecycle", { user: "u-001", ...params("g-901") });
    expect(r.status).toBe(200);
    expect(r.body.organizerCancelReason).toBe("other");
    expect(r.body.currentCount).toBe(3);
    expect(r.body.statusLabel).toBe("中止");
  });

  it("LCY-T-34: 幹事の辞退は 403(withdraw の例外を応答にする)", async () => {
    mocks.withdraw.mockImplementation(() => { throw forbidden("幹事は辞退できません。", { reason: "organizer_cannot_withdraw" }); });
    cancelledGroup();
    const r = await callRoute(withdrawHandler, "/api/groups/g-901/withdraw", { method: "POST", user: "u-001", rawBody: "{}", ...params("g-901") });
    expect(r.status).toBe(403);
    expect(r.body.reason).toBe("organizer_cannot_withdraw");
  });
});
