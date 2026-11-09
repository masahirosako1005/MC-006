// LCY-T-30〜33・40・46・48 の代表。同じ波の他タスクの関数は vi.mock で代替する。
import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import type { DemoUser } from "@/lib/groups-types";
import { insertGroup, insertMember, resetForTest } from "@/test/helpers";

const h = vi.hoisted(() => ({
  notify: vi.fn(),
  onMembershipChanged: vi.fn(() => ({ groupId: "", applied: [] as unknown[] })),
  applyDue: vi.fn(),
}));

vi.mock("@/features/notify/service", () => ({ notify: h.notify }));
vi.mock("./evaluate", () => ({ onMembershipChanged: h.onMembershipChanged }));
vi.mock("./transitions", () => ({ applyDue: h.applyDue }));
vi.mock("./view", () => ({ getLifecycleView: (_u: unknown, id: string) => ({ groupId: id }) }));
vi.mock("./policy", async () => {
  const actual = await vi.importActual<typeof import("./policy")>("./policy");
  return {
    ...actual,
    canWithdraw: (g: { lifecycle: { status: string } }) =>
      ["recruiting", "min_reached", "withdrawal_period", "confirmed"].includes(g.lifecycle.status),
    canOrganizerCancel: (g: { lifecycle: { status: string } }) =>
      ["recruiting", "min_reached", "withdrawal_period"].includes(g.lifecycle.status),
    canChangeConditions: (g: { lifecycle: { status: string } }) =>
      ["recruiting", "min_reached"].includes(g.lifecycle.status),
  };
});
vi.mock("@/features/groups/core/service", async () => {
  const store = await import("@/lib/groups-store");
  return {
    markMemberLeft: (groupId: string, userId: string, at: string) => {
      const m = store.db().members.list().find((x) => x.groupId === groupId && x.userId === userId)!;
      return store.db().members.update(m.id, { status: "left", leftAt: at });
    },
    countActiveMembers: (groupId: string) =>
      store.db().members.list().filter((x) => x.groupId === groupId && x.status === "active").length,
    applyLifecyclePatch: (groupId: string, rev: number, patch: object) => {
      const g = store.db().groups.get(groupId)!;
      if (g.lifecycle.revision !== rev) throw new Error("version_mismatch");
      const lifecycle = { ...g.lifecycle, ...patch, revision: rev + 1 };
      store.db().groups.update(groupId, { lifecycle });
      return lifecycle;
    },
  };
});

import { changeConditions, organizerCancel } from "./conditions";
import { withdraw } from "./withdraw";

const u = (id: string) => ({ id }) as DemoUser;

beforeEach(() => {
  resetForTest();
  vi.clearAllMocks();
});

describe("withdraw", () => {
  it("LCY-T-31: 辞退期間中の辞退は記録・通知・イベントを残す", () => {
    insertGroup({ id: "g-901", organizerId: "u-004", lifecycle: { status: "withdrawal_period", minMembers: 3 } });
    insertMember("g-901", "u-001");
    insertMember("g-901", "u-002");
    insertMember("g-901", "u-003");
    const r = withdraw(u("u-003"), "g-901");
    expect(r).toMatchObject({ status: "withdrawal_period", phase: "withdrawal_period", cancelled: false, currentCount: 3 });
    const wd = db().withdrawals.list().find((w) => w.groupId === "g-901")!;
    expect(wd).toMatchObject({ userId: "u-003", phase: "withdrawal_period", countAfter: 3 });
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "withdrawal_received", eventKey: `wd:${wd.id}` }));
    expect(h.onMembershipChanged).toHaveBeenCalledOnce();
  });

  it("LCY-T-32: 実行確定後の退会は phase confirmed", () => {
    insertGroup({ id: "g-902", organizerId: "u-004", lifecycle: { status: "confirmed", minMembers: 3 } });
    insertMember("g-902", "u-001");
    insertMember("g-902", "u-002");
    const r = withdraw(u("u-002"), "g-902");
    expect(r.phase).toBe("confirmed");
    expect(r.status).toBe("confirmed");
  });

  it("拒否: 幹事は forbidden、実施中は unavailable_state、二重辞退は conflict", () => {
    insertGroup({ id: "g-903", organizerId: "u-004", lifecycle: { status: "recruiting" } });
    insertMember("g-903", "u-001");
    expect(() => withdraw(u("u-004"), "g-903")).toThrow(expect.objectContaining({ code: "forbidden" }));
    withdraw(u("u-001"), "g-903");
    expect(() => withdraw(u("u-001"), "g-903")).toThrow(expect.objectContaining({ code: "conflict" }));
    insertGroup({ id: "g-904", organizerId: "u-004", lifecycle: { status: "in_progress" } });
    insertMember("g-904", "u-001");
    expect(() => withdraw(u("u-001"), "g-904")).toThrow(expect.objectContaining({ code: "unavailable_state" }));
  });
});

describe("organizerCancel", () => {
  it("LCY-T-46/48: 中止して理由を保存し、applyDue を呼ぶ", () => {
    insertGroup({ id: "g-905", organizerId: "u-004", lifecycle: { status: "min_reached" } });
    h.applyDue.mockImplementation((id: string) => {
      const g = db().groups.get(id)!;
      db().groups.update(id, { lifecycle: { ...g.lifecycle, status: "cancelled", revision: g.lifecycle.revision + 1 } });
    });
    organizerCancel(u("u-004"), "g-905", "schedule_conflict");
    expect(h.applyDue).toHaveBeenCalledWith("g-905", expect.objectContaining({ event: "organizer_cancelled", to: "cancelled" }), expect.any(Date), 1);
    expect(db().groups.get("g-905")!.lifecycle.organizerCancelReason).toBe("schedule_conflict");
  });

  it("拒否: 理由が列挙外なら invalid_input、実行確定は unavailable_state", () => {
    insertGroup({ id: "g-906", organizerId: "u-004", lifecycle: { status: "recruiting" } });
    expect(() => organizerCancel(u("u-004"), "g-906", "x" as never)).toThrow(expect.objectContaining({ code: "invalid_input" }));
    insertGroup({ id: "g-907", organizerId: "u-004", lifecycle: { status: "confirmed" } });
    expect(() => organizerCancel(u("u-004"), "g-907", "other")).toThrow(expect.objectContaining({ code: "unavailable_state" }));
  });
});

describe("changeConditions", () => {
  it("LCY-T-42: 締切を 1 回延長し、フラグを戻して通知する", () => {
    insertGroup({
      id: "g-908", organizerId: "u-004",
      lifecycle: { status: "recruiting", minMembers: 3, deadlineDate: "2026-11-20", deadlineSoonNoticeSent: true },
    });
    changeConditions(u("u-004"), "g-908", { deadlineDate: "2026-11-25" });
    const lc = db().groups.get("g-908")!.lifecycle;
    expect(lc).toMatchObject({
      deadlineDate: "2026-11-25", deadlineAt: "2026-11-26T00:00:00+09:00", deadlineExtendedCount: 1, deadlineSoonNoticeSent: false,
    });
    expect(h.notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "conditions_changed", eventKey: "cond:2" }));
    expect(h.onMembershipChanged).toHaveBeenCalled();
    expect(() => changeConditions(u("u-004"), "g-908", { deadlineDate: "2026-11-28" }))
      .toThrow(expect.objectContaining({ code: "conflict" }));
  });

  it("LCY-T-40/45: 最少人数を上げると invalid_input、非幹事は forbidden", () => {
    insertGroup({ id: "g-909", organizerId: "u-004", lifecycle: { status: "recruiting", minMembers: 3 } });
    expect(() => changeConditions(u("u-004"), "g-909", { minMembers: 4 })).toThrow(expect.objectContaining({ code: "invalid_input" }));
    expect(() => changeConditions(u("u-001"), "g-909", { minMembers: 2 })).toThrow(expect.objectContaining({ code: "forbidden" }));
    changeConditions(u("u-004"), "g-909", { minMembers: 2 });
    expect(db().groups.get("g-909")!.lifecycle.minMembers).toBe(2);
  });
});
