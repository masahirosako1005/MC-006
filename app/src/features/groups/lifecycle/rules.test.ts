import { describe, expect, it } from "vitest";
import * as P from "./policy";
import { statusLabel } from "./messages";
import { addDays } from "./dates";
import { buildInitialLifecycle, deriveBaseStatus, nextDue, notAcceptingReason, validateLifecycleInput } from "./rules";
import type { GroupLike, GroupStatus } from "./types";

const NOW = new Date("2026-11-09T09:00:00+09:00");
const STATUSES: GroupStatus[] = ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress", "completed", "cancelled", "replanned"];

function mk(status: GroupStatus, patch: Partial<GroupLike["lifecycle"]> = {}): GroupLike {
  const lifecycle = { ...buildInitialLifecycle({ minMembers: 3, deadlineDate: "2026-11-20" }, NOW), status, ...patch };
  return { id: "g-901", organizerId: "u-004", capacity: 4, trip: { destination: "x", startDate: "2026-12-05", endDate: "2026-12-06", dateNote: "" }, lifecycle };
}
const ctx = { capacity: 4, startDate: "2026-12-05", now: NOW };

describe("validateLifecycleInput", () => {
  it("正常・既定値・境界", () => {
    expect(validateLifecycleInput({ minMembers: 3, deadlineDate: "2026-11-20" }, ctx)).toEqual({ minMembers: 3, deadlineDate: "2026-11-20" });
    expect(validateLifecycleInput({ deadlineDate: "2026-11-09" }, { ...ctx, capacity: 2 }).minMembers).toBe(2); // T-04, T-08
    expect(validateLifecycleInput({ deadlineDate: "2026-11-20" }, { ...ctx, capacity: 6 }).minMembers).toBe(3); // T-05
    expect(() => validateLifecycleInput({ deadlineDate: "2026-12-02" }, ctx)).not.toThrow();
  });
  it("拒否", () => {
    const f = (i: Parameters<typeof validateLifecycleInput>[0]) => {
      try { validateLifecycleInput(i, ctx); } catch (e) { return (e as { fields: object }).fields; }
    };
    expect(f({ minMembers: 1, deadlineDate: "2026-11-20" })).toHaveProperty("minMembers");
    expect(f({ minMembers: 5, deadlineDate: "2026-11-20" })).toHaveProperty("minMembers");
    expect(f({ deadlineDate: "2026-11-08" })).toHaveProperty("deadlineDate");
    expect(f({ deadlineDate: "2026-12-03" })).toHaveProperty("deadlineDate");
  });
});

describe("buildInitialLifecycle", () => {
  it("初期値", () => {
    const lc = buildInitialLifecycle({ minMembers: 3, deadlineDate: "2026-11-20" }, NOW);
    expect(lc).toMatchObject({ status: "recruiting", revision: 1, deadlineAt: "2026-11-21T00:00:00+09:00", confirmedAt: null });
  });
});

describe("nextDue", () => {
  const at = (s: string) => new Date(s);
  it("締切の直前は何もない・未達は中止", () => {
    expect(nextDue(mk("recruiting"), 2, at("2026-11-20T23:59:59+09:00"))).toBeNull();
    expect(nextDue(mk("recruiting"), 2, at("2026-11-21T00:00:00+09:00"))).toMatchObject({ event: "deadline_missed", to: "cancelled", cancelReason: "min_not_reached" });
  });
  it("達成なら辞退期間へ・人数同期が先", () => {
    expect(nextDue(mk("min_reached"), 3, at("2026-11-21T00:00:00+09:00"))).toMatchObject({ event: "deadline_met", to: "withdrawal_period" });
    expect(nextDue(mk("recruiting"), 3, NOW)).toMatchObject({ event: "count_reached" });
    expect(nextDue(mk("min_reached"), 2, NOW)).toMatchObject({ event: "count_lost" });
  });
  it("辞退期間・確定・実施中", () => {
    const wp = mk("withdrawal_period", { withdrawalEndsAt: "2026-11-23T00:00:00+09:00" });
    expect(nextDue(wp, 3, at("2026-11-22T23:59:59+09:00"))).toBeNull();
    expect(nextDue(wp, 3, at("2026-11-23T00:00:00+09:00"))).toMatchObject({ event: "withdrawal_ended", to: "confirmed" });
    expect(nextDue(mk("confirmed"), 3, at("2026-12-10T00:00:00+09:00"))).toMatchObject({ event: "trip_started" });
    expect(nextDue(mk("in_progress"), 3, at("2026-12-07T00:00:00+09:00"))).toMatchObject({ event: "trip_ended", to: "completed" });
    expect(nextDue(mk("cancelled"), 3, at("2027-01-01T00:00:00+09:00"))).toBeNull();
  });
});

describe("可否・ラベル", () => {
  const table: Record<string, GroupStatus[]> = {
    canEdit: ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress"],
    canChat: ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress"],
    canEditExpenses: ["confirmed", "in_progress", "completed"],
    canCollectStamps: ["in_progress"],
    canReview: ["in_progress", "completed"],
    canWithdraw: ["recruiting", "min_reached", "withdrawal_period", "confirmed"],
    canOrganizerCancel: ["recruiting", "min_reached", "withdrawal_period"],
    canChangeConditions: ["recruiting", "min_reached"],
    canReplan: ["cancelled"],
    canReadHistory: STATUSES,
  };
  it("全 8 状態の表", () => {
    for (const [name, ok] of Object.entries(table)) {
      const fn = (P as unknown as Record<string, (g: GroupLike) => boolean>)[name];
      for (const s of STATUSES) expect(fn(mk(s)), `${name}/${s}`).toBe(ok.includes(s));
    }
  });
  it("canAcceptRequests は締切の 1 ミリ秒前まで", () => {
    const g = mk("min_reached");
    expect(P.canAcceptRequests(g, new Date(Date.parse("2026-11-21T00:00:00+09:00") - 1))).toBe(true);
    expect(P.canAcceptRequests(g, new Date("2026-11-21T00:00:00+09:00"))).toBe(false);
  });
  it("notAcceptingReason と statusLabel", () => {
    expect(notAcceptingReason(mk("recruiting"), NOW)).toBeNull();
    expect(notAcceptingReason(mk("recruiting"), new Date("2026-11-22T00:00:00+09:00"))).toBe("closed_deadline");
    expect(notAcceptingReason(mk("withdrawal_period"), NOW)).toBe("closed_withdrawal_period");
    expect(notAcceptingReason(mk("completed"), NOW)).toBe("closed_confirmed");
    expect(notAcceptingReason(mk("replanned"), NOW)).toBe("closed_cancelled");
    expect(statusLabel("replanned")).toBe("再企画済み");
    expect(deriveBaseStatus(3, 3)).toBe("min_reached");
    expect(addDays("2026-11-21T00:00:00+09:00", 2)).toBe("2026-11-23T00:00:00+09:00");
  });
});
