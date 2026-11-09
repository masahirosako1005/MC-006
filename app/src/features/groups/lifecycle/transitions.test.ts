import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { on } from "@/lib/events";
import { resetForTest, insertGroup, insertMember } from "@/test/helpers";
import { GROUP_BY_STATUS } from "@/test/fixtures";
import type { DueEvent, GroupLike } from "./types";

const notifyMock = vi.hoisted(() => vi.fn(() => ({ created: [], skippedDuplicate: [], recipientCount: 0 })));
vi.mock("@/features/notify/service", () => ({ notify: notifyMock }));
vi.mock("@/features/groups/core/repository", () => ({
  applyLifecyclePatch: (id: string, rev: number, patch: Record<string, unknown>) => {
    const g = db().groups.getOrThrow(id);
    if (g.lifecycle.revision !== rev) throw new Error("version_mismatch");
    const lifecycle = { ...g.lifecycle, ...patch, revision: rev + 1 };
    db().groups.update(id, { lifecycle } as never);
    return lifecycle;
  },
}));
vi.mock("./dates", () => ({
  addDays: (iso: string, n: number) => new Date(Date.parse(iso) + n * 86400_000 + 9 * 3600_000).toISOString().slice(0, 19) + "+09:00",
  jstDate: (d: Date) => d.toISOString().slice(0, 10),
}));
// 04 の rules(P-2-9)の代替。遷移表の最小の写し。
vi.mock("./rules", () => ({
  nextDue: (g: GroupLike, count: number, now: Date): DueEvent | null => {
    const lc = g.lifecycle;
    const at = (iso: string | null) => (iso !== null && Date.parse(iso) <= now.getTime() ? iso : null);
    const nowIso = now.toISOString();
    if (lc.status === "recruiting" || lc.status === "min_reached") {
      const base = count >= lc.minMembers ? "min_reached" : "recruiting";
      if (base !== lc.status) {
        return { event: base === "min_reached" ? "count_reached" : "count_lost", to: base, effectiveAt: nowIso, cancelReason: null };
      }
      const d = at(lc.deadlineAt);
      if (d) {
        return count >= lc.minMembers
          ? { event: "deadline_met", to: "withdrawal_period", effectiveAt: d, cancelReason: null }
          : { event: "deadline_missed", to: "cancelled", effectiveAt: d, cancelReason: "min_not_reached" };
      }
    }
    if (lc.status === "withdrawal_period") {
      const e = at(lc.withdrawalEndsAt);
      if (e) return { event: "withdrawal_ended", to: "confirmed", effectiveAt: e, cancelReason: null };
    }
    return null;
  },
}));

// setup.ts が bootstrap 経由で本物の rules を読み込み済みのため、モジュールを読み直して vi.mock を効かせる。
let applyDue: typeof import("./transitions").applyDue;
let evaluate: typeof import("./evaluate").evaluate;
let evaluateAll: typeof import("./evaluate").evaluateAll;
let onMembershipChanged: typeof import("./evaluate").onMembershipChanged;
let recordCreated: typeof import("./evaluate").recordCreated;
beforeAll(async () => {
  vi.resetModules();
  ({ applyDue } = await import("./transitions"));
  ({ evaluate, evaluateAll, onMembershipChanged, recordCreated } = await import("./evaluate"));
});

const NOW = new Date("2026-11-21T00:00:00+09:00");
const DEADLINE = "2026-11-20T23:59:00+09:00";

beforeEach(() => {
  resetForTest();
  notifyMock.mockClear();
});

function setup(id: string, members: number, minMembers = 3, status: "recruiting" | "min_reached" = "recruiting") {
  insertGroup({ id, lifecycle: { status, minMembers, deadlineAt: DEADLINE, deadlineDate: "2026-11-20" } });
  for (let i = 0; i < members - 1; i++) insertMember(id, `u-00${i + 2}`);
}

describe("遷移の共通処理", () => {
  it("LCY-T-10/17: 人数到達で min_reached。通知・ログ・status_changed が出る", () => {
    setup("g-901", 3);
    const events: unknown[] = [];
    on("status_changed", "test-901", (e) => events.push(e));
    const r = onMembershipChanged("g-901", new Date("2026-11-10T00:00:00+09:00"));
    expect(r.applied.map((a) => a.event)).toEqual(["count_reached"]);
    expect(db().groups.get("g-901")?.lifecycle.status).toBe("min_reached");
    expect(db().groups.get("g-901")?.lifecycle.revision).toBe(2);
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({ kind: "min_reached", eventKey: "reached" }));
    expect(db().groupStatusLogs.filter((l) => l.groupId === "g-901")).toHaveLength(1);
    expect(events).toHaveLength(1);
  });

  it("LCY-T-21/23: 複数の境界をまたぐと時刻順に 1 件ずつ適用する", () => {
    setup("g-902", 3);
    const r = evaluate("g-902", new Date("2026-11-30T00:00:00+09:00"));
    expect(r.applied.map((a) => a.to)).toEqual(["min_reached", "withdrawal_period", "confirmed"]);
    const lc = db().groups.get("g-902")!.lifecycle;
    expect(lc.withdrawalEndsAt).not.toBeNull();
    expect(lc.confirmedAt).not.toBeNull();
    const kinds = notifyMock.mock.calls.map((c) => (c as unknown as [{ kind: string }])[0].kind);
    expect(kinds).toEqual(["min_reached", "withdraw_period_started", "confirmed"]);
    // 冪等: 再評価で何も起きない
    expect(evaluate("g-902", new Date("2026-11-30T00:00:00+09:00")).applied).toEqual([]);
  });

  it("LCY-T-25: 締切で未達なら中止(理由 min_not_reached、申請者にも通知)", () => {
    setup("g-903", 2);
    evaluate("g-903", NOW);
    const lc = db().groups.get("g-903")!.lifecycle;
    expect(lc.status).toBe("cancelled");
    expect(lc.cancelReason).toBe("min_not_reached");
    expect(notifyMock).toHaveBeenCalledWith(expect.objectContaining({
      kind: "cancelled", recipients: [{ type: "groupMembers" }, { type: "pendingApplicants" }],
    }));
  });

  it("revision 不一致は conflict で拒否する", () => {
    setup("g-904", 3);
    const due: DueEvent = { event: "count_reached", to: "min_reached", effectiveAt: NOW.toISOString(), cancelReason: null };
    expect(() => applyDue("g-904", due, NOW, 99)).toThrow();
    expect(db().groups.get("g-904")?.lifecycle.status).toBe("recruiting");
  });

  it("recordCreated: created ログを追記し status_changed は出さない", () => {
    insertGroup({ id: "g-905", lifecycle: { deadlineAt: "2099-01-01T00:00:00+09:00" } });
    const events: unknown[] = [];
    on("status_changed", "test-905", (e) => events.push(e));
    recordCreated("g-905");
    const logs = db().groupStatusLogs.filter((l) => l.groupId === "g-905");
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ event: "created", from: null, to: "recruiting" });
    expect(events).toHaveLength(0);
  });

  it("LCY-T-73: seed の状態は評価で変わらない", () => {
    const before = Object.values(GROUP_BY_STATUS).map((id) => db().groups.get(id)?.lifecycle.status);
    evaluateAll(new Date("2026-11-09T09:00:00+09:00"));
    const after = Object.values(GROUP_BY_STATUS).map((id) => db().groups.get(id)?.lifecycle.status);
    expect(after).toEqual(before);
  });
});
