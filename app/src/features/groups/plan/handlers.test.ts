import { beforeEach, describe, expect, it, vi } from "vitest";
import { callRoute, resetForTest } from "@/test/helpers";

const m = vi.hoisted(() => ({
  getPlan: vi.fn(),
  listItems: vi.fn(),
  updateMeeting: vi.fn(),
  updateScheduleMemo: vi.fn(),
  createItem: vi.fn(),
  updateItem: vi.fn(),
  deleteItem: vi.fn(),
  reorderItems: vi.fn(),
}));

vi.mock("./service", () => ({ ...m }));

import {
  deleteItemHandler, getPlanHandler, patchItemHandler, postItemHandler, putOrderHandler,
} from "./handlers";

beforeEach(() => {
  resetForTest();
  Object.values(m).forEach((f) => f.mockReset());
});

describe("05 plan handlers", () => {
  it("GET plan: サービスの結果を 200 で返す", async () => {
    m.getPlan.mockReturnValue({ groupId: "g-901", items: [] });
    const r = await callRoute(getPlanHandler, "/api/groups/g-901/plan", { user: "u-001", params: { groupId: "g-901" } });
    expect(r.status).toBe(200);
    expect(r.body.groupId).toBe("g-901");
    expect(m.getPlan.mock.calls[0][0].id).toBe("u-001");
    expect(m.getPlan.mock.calls[0][1]).toBe("g-901");
  });

  it("POST items: 201 と Location、未知キーは捨てる", async () => {
    m.createItem.mockReturnValue({ id: "pi-901", title: "朝食" });
    const r = await callRoute(postItemHandler, "/api/groups/g-901/plan/items", {
      method: "POST", user: "u-001", params: { groupId: "g-901" },
      body: { date: "2026-12-10", title: "朝食", version: 9 },
    });
    expect(r.status).toBe(201);
    expect(r.headers.get("Location")).toBe("/api/groups/g-901/plan/items/pi-901");
    const input = m.createItem.mock.calls[0][2];
    expect(input.title).toBe("朝食");
    expect(input.version).toBeUndefined();
  });

  it("POST items: title 欠落は 400", async () => {
    const r = await callRoute(postItemHandler, "/api/groups/g-901/plan/items", {
      method: "POST", user: "u-001", params: { groupId: "g-901" }, body: { date: "2026-12-10" },
    });
    expect(r.status).toBe(400);
    expect(m.createItem).not.toHaveBeenCalled();
  });

  it("PUT order: 200 で orderedIds を渡す", async () => {
    m.reorderItems.mockReturnValue({ items: [], itemsRevision: 2 });
    const r = await callRoute(putOrderHandler, "/api/groups/g-901/plan/order", {
      method: "PUT", user: "u-001", params: { groupId: "g-901" },
      body: { date: "2026-12-10", orderedIds: ["pi-902", "pi-901"], baseRevision: 1 },
    });
    expect(r.status).toBe(200);
    expect(m.reorderItems.mock.calls[0][2].orderedIds).toEqual(["pi-902", "pi-901"]);
  });

  it("PATCH items: 未指定は undefined のまま渡す", async () => {
    m.updateItem.mockReturnValue({ id: "pi-901" });
    const r = await callRoute(patchItemHandler, "/api/groups/g-901/plan/items/pi-901", {
      method: "PATCH", user: "u-001", params: { groupId: "g-901", itemId: "pi-901" },
      body: { baseVersion: 0, time: null },
    });
    expect(r.status).toBe(200);
    const input = m.updateItem.mock.calls[0][3];
    expect(input.time).toBeNull();
    expect("title" in input).toBe(false);
  });

  it("DELETE items: クエリの baseVersion を数値で渡す。欠落は 400", async () => {
    m.deleteItem.mockReturnValue({ itemsRevision: 3 });
    const params = { groupId: "g-901", itemId: "pi-901" };
    const ok = await callRoute(deleteItemHandler, "/api/groups/g-901/plan/items/pi-901?baseVersion=2", {
      method: "DELETE", user: "u-001", params,
    });
    expect(ok.status).toBe(200);
    expect(m.deleteItem.mock.calls[0][3]).toBe(2);
    const ng = await callRoute(deleteItemHandler, "/api/groups/g-901/plan/items/pi-901", {
      method: "DELETE", user: "u-001", params,
    });
    expect(ng.status).toBe(400);
  });
});
