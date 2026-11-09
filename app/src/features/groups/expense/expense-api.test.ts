import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/safety/visibility/profile", () => ({
  visibleProfile: vi.fn((_v: unknown, id: string) => ({ userId: id, displayName: `名前${id}` })),
}));

import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { assertNoPaymentInducement } from "./text-guard";

// setup.ts が実体を先に読み込むため、モック後に読み直す。db も読み直し後のものを使う。
let db: typeof import("@/lib/groups-store").db;
let addExpenseHandler: typeof import("./handlers").addExpenseHandler;
let deleteExpenseHandler: typeof import("./handlers").deleteExpenseHandler;
let getExpenseSummaryHandler: typeof import("./handlers").getExpenseSummaryHandler;
let listExpensesHandler: typeof import("./handlers").listExpensesHandler;
let updateExpenseHandler: typeof import("./handlers").updateExpenseHandler;

const G = "g-901";
const base = { title: "ランチ", amount: 1000, payerId: "u-001", targetIds: ["u-001", "u-002", "u-003"], spentOn: "2026-11-05" };
const path = `/api/groups/${G}/expenses`;

function setup(status: "in_progress" | "recruiting" = "in_progress", id = G) {
  insertGroup({ id, lifecycle: { status } });
  insertMember(id, "u-002");
  insertMember(id, "u-003");
}
const add = (body: unknown, user = "u-001", groupId = G) =>
  callRoute(addExpenseHandler, `/api/groups/${groupId}/expenses`, { body, user, params: { groupId } });

beforeEach(async () => {
  vi.resetModules();
  ({ db } = await import("@/lib/groups-store"));
  ({ addExpenseHandler, deleteExpenseHandler, getExpenseSummaryHandler, listExpensesHandler, updateExpenseHandler } =
    await import("./handlers"));
  resetForTest();
});

describe("費用メモ API", () => {
  it("追加 → 一覧 → 更新 → 削除(EXP-T-22/26)", async () => {
    setup();
    const r = await add({ ...base, version: 99, createdBy: "u-002", groupId: "g-999" });
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({ version: 1, createdBy: "u-001", groupId: G });
    expect(r.body.targets.map((t: { share: number }) => t.share)).toEqual([334, 333, 333]);
    const id = r.body.id as string;

    const list = await callRoute(listExpensesHandler, path, { user: "u-002", params: { groupId: G } });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({ total: 1, totalAmount: 1000, canEdit: true });

    const p = { groupId: G, expenseId: id };
    const up = await callRoute(updateExpenseHandler, `${path}/${id}`, { method: "PUT", user: "u-002", params: p, body: { ...base, amount: 2000, baseVersion: 1 } });
    expect(up.status).toBe(200);
    expect(up.body).toMatchObject({ version: 2, updatedBy: "u-002", amount: 2000 });

    const stale = await callRoute(updateExpenseHandler, `${path}/${id}`, { method: "PUT", user: "u-001", params: p, body: { ...base, baseVersion: 1 } });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: "conflict", reason: "version_mismatch" });
    expect(stale.body.detail.current.version).toBe(2);

    const sum = await callRoute(getExpenseSummaryHandler, `/api/groups/${G}/expense-summary`, { user: "u-001", params: { groupId: G } });
    expect(sum.status).toBe(200);
    expect(sum.body.totalAmount).toBe(2000);
    expect(sum.body.members.reduce((s: number, m: { net: number }) => s + m.net, 0)).toBe(0);

    const del = await callRoute(deleteExpenseHandler, `${path}/${id}?baseVersion=2`, { method: "DELETE", user: "u-001", params: p });
    expect(del.status).toBe(204);
    expect(db().expenses.get(id)).toBeUndefined();
  });

  it("金額不正は 400 fields.amount(EXP-T-14)", async () => {
    setup();
    for (const amount of [0, -1, 1.5, "100", 1000001]) {
      const r = await add({ ...base, amount });
      expect(r.status).toBe(400);
      expect(r.body.fields.amount).toBeTruthy();
    }
  });

  it("101 件目は 409 limit_exceeded(EXP-T-21)", async () => {
    setup();
    for (let i = 0; i < 100; i++) {
      db().expenses.insert({
        id: `ex-${901 + i}`, groupId: G, title: "x", amount: 1, payerId: "u-001", targetIds: ["u-001"], spentOn: "2026-11-05",
        memo: "", version: 1, createdBy: "u-001", createdAt: "2026-11-05T00:00:00+09:00", updatedBy: "u-001", updatedAt: "2026-11-05T00:00:00+09:00",
      });
    }
    const r = await add(base);
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "conflict", reason: "limit_exceeded" });
  });

  it("非メンバーは 403、編集不可の状態は 409 unavailable_state(EXP-T-24/27)", async () => {
    setup();
    const x = await add(base, "u-004");
    expect(x.status).toBe(403);
    insertGroup({ id: "g-902", lifecycle: { status: "recruiting" } });
    const r = await add(base, "u-001", "g-902");
    expect(r.status).toBe(409);
    expect(r.body).toMatchObject({ error: "unavailable_state", detail: { state: "recruiting" } });
    const l = await callRoute(listExpensesHandler, "/api/groups/g-902/expenses", { user: "u-001", params: { groupId: "g-902" } });
    expect(l.status).toBe(200);
    expect(l.body.canEdit).toBe(false);
    expect(l.body.readOnlyReason).not.toBe("");
  });

  it("元メンバーの GET は 403(EXP-T-25)", async () => {
    setup();
    const m = db().members.find((x) => x.groupId === G && x.userId === "u-003")!;
    db().members.update(m.id, { status: "left", leftAt: "2026-11-06T00:00:00+09:00" });
    const r = await callRoute(listExpensesHandler, path, { user: "u-003", params: { groupId: G } });
    expect(r.status).toBe(403);
  });

  it("決済誘導は拒否(text-guard)", () => {
    expect(() => assertNoPaymentInducement("PayPayで送金", "title")).toThrow();
    expect(() => assertNoPaymentInducement("ランチ代", "title")).not.toThrow();
  });
});
