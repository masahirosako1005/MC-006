import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/groups-store";
import { insertGroup, insertMember, resetForTest } from "@/test/helpers";
import {
  createItem, deleteItem, getPlan, reorderItems, updateItem, updateMeeting, updateScheduleMemo,
} from "./service";

const G = "g-901";
const user = (id: string) => db().users.getOrThrow(id);
const u1 = () => user("u-001");
const u2 = () => user("u-002");

type Err = { code?: string; reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown> };
function errOf(fn: () => unknown): Err {
  try { fn(); } catch (e) { return e as Err; }
  return {};
}

beforeEach(() => {
  resetForTest();
  insertGroup({ id: G });
  insertMember(G, "u-002");
});

describe("plan service", () => {
  it("PLN-T-01 空の旅程を閲覧でき、GET では保存されない", () => {
    const p = getPlan(u2(), G);
    expect(p.editable).toBe(true);
    expect(p.items).toEqual([]);
    expect(p.itemsRevision).toBe(0);
    expect(p.meeting.version).toBe(0);
    expect(db().plans.get(G)).toBeUndefined();
    expect(JSON.stringify(p.spotOptions)).not.toContain("keyword");
  });

  it("PLN-T-02 非メンバーは公開グループで forbidden、非公開で not_found", () => {
    expect(errOf(() => getPlan(user("u-003"), G)).code).toBe("forbidden");
    insertGroup({ id: "g-902", visibility: "private" });
    expect(errOf(() => getPlan(user("u-003"), "g-902")).code).toBe("not_found");
  });

  it("PLN-T-03 完了グループは閲覧のみ(unavailable_state)", () => {
    insertGroup({ id: "g-903", lifecycle: { status: "completed" } });
    const p = getPlan(u1(), "g-903");
    expect(p.editable).toBe(false);
    expect(p.readOnlyReason).toBeTruthy();
    const e = errOf(() => createItem(u1(), "g-903", { date: "2026-12-10", title: "x" }));
    expect(e.code).toBe("unavailable_state");
    expect(e.detail?.state).toBe("completed");
  });

  it("PLN-T-04 項目追加: 同日末尾・version 1・itemsRevision+1", () => {
    const a = createItem(u1(), G, { date: "2026-12-10", title: "A", time: "09:00" });
    const b = createItem(u2(), G, { date: "2026-12-10", title: "B", spotId: 2, note: "メモ" });
    expect([a.seq, b.seq]).toEqual([1, 2]);
    expect(a.version).toBe(1);
    expect(b.spot?.id).toBe(2);
    expect(b.createdBy.userId).toBe("u-002");
    const p = getPlan(u1(), G);
    expect(p.items.map((i) => i.title)).toEqual(["A", "B"]);
    expect(p.itemsRevision).toBe(2);
  });

  it("PLN-T-05 日程外の日付・存在しない spotId は invalid_input", () => {
    expect(errOf(() => createItem(u1(), G, { date: "2026-12-20", title: "x" })).fields?.date).toBeTruthy();
    expect(errOf(() => createItem(u1(), G, { date: "2026-12-10", title: "x", spotId: 99999 })).fields?.spotId).toBeTruthy();
  });

  it("PLN-T-06 同日 15 件を超えると invalid_input(fields.items)", () => {
    for (let n = 0; n < 15; n++) createItem(u1(), G, { date: "2026-12-10", title: `i${n}` });
    expect(errOf(() => createItem(u1(), G, { date: "2026-12-10", title: "over" })).fields?.items).toBeTruthy();
  });

  it("PLN-T-07 項目更新: 版一致で version+1、不一致で conflict(detail.current)", () => {
    const a = createItem(u1(), G, { date: "2026-12-10", title: "A" });
    const upd = updateItem(u2(), G, a.id, { baseVersion: 1, title: "A2" });
    expect(upd.version).toBe(2);
    expect(upd.title).toBe("A2");
    const e = errOf(() => updateItem(u1(), G, a.id, { baseVersion: 1, title: "A3" }));
    expect(e.code).toBe("conflict");
    expect(e.reason).toBe("version_mismatch");
    expect((e.detail?.current as { version: number }).version).toBe(2);
  });

  it("PLN-T-08 日付変更で新しい日の末尾へ移り、元の日の seq が詰まる", () => {
    const a = createItem(u1(), G, { date: "2026-12-10", title: "A" });
    const b = createItem(u1(), G, { date: "2026-12-10", title: "B" });
    createItem(u1(), G, { date: "2026-12-11", title: "C" });
    const moved = updateItem(u1(), G, a.id, { baseVersion: 1, date: "2026-12-11" });
    expect(moved.seq).toBe(2);
    const p = getPlan(u1(), G);
    expect(p.items.find((i) => i.id === b.id)?.seq).toBe(1);
    expect(p.itemsRevision).toBe(4);
  });

  it("PLN-T-09 削除: seq が詰まり itemsRevision+1、版不一致は conflict", () => {
    const a = createItem(u1(), G, { date: "2026-12-10", title: "A" });
    const b = createItem(u1(), G, { date: "2026-12-10", title: "B" });
    expect(errOf(() => deleteItem(u1(), G, a.id, 5)).code).toBe("conflict");
    const r = deleteItem(u1(), G, a.id, 1);
    expect(r.itemsRevision).toBe(3);
    const p = getPlan(u1(), G);
    expect(p.items.map((i) => [i.id, i.seq])).toEqual([[b.id, 1]]);
    expect(errOf(() => deleteItem(u1(), G, a.id, 1)).code).toBe("not_found");
  });

  it("PLN-T-10 並び替え: 成功・revision 不一致は conflict・ID 不一致は invalid_input", () => {
    const a = createItem(u1(), G, { date: "2026-12-10", title: "A" });
    const b = createItem(u1(), G, { date: "2026-12-10", title: "B" });
    const r = reorderItems(u1(), G, { date: "2026-12-10", orderedIds: [b.id, a.id], baseRevision: 2 });
    expect(r.items.map((i) => i.title)).toEqual(["B", "A"]);
    expect(r.itemsRevision).toBe(3);
    const e = errOf(() => reorderItems(u1(), G, { date: "2026-12-10", orderedIds: [a.id, b.id], baseRevision: 2 }));
    expect(e.code).toBe("conflict");
    expect((e.detail?.current as { itemsRevision: number }).itemsRevision).toBe(3);
    expect(errOf(() => reorderItems(u1(), G, { date: "2026-12-10", orderedIds: [a.id], baseRevision: 3 })).code).toBe("invalid_input");
  });

  it("PLN-T-11 集合場所・日程メモ: version 0 から保存でき、古い版は conflict", () => {
    const m = updateMeeting(u1(), G, { baseVersion: 0, text: "駅前", date: "2026-12-10", time: "09:30", spotId: 2 });
    expect(m.version).toBe(1);
    expect(m.spot?.id).toBe(2);
    expect(errOf(() => updateMeeting(u2(), G, { baseVersion: 0, text: "x" })).code).toBe("conflict");
    expect(errOf(() => updateMeeting(u1(), G, { baseVersion: 1, time: "10:00" })).fields?.text).toBeTruthy();
    const memo = updateScheduleMemo(u2(), G, { baseVersion: 0, text: "持ち物" });
    expect(memo.version).toBe(1);
    expect(memo.updatedBy?.userId).toBe("u-002");
    expect(getPlan(u1(), G).scheduleMemo.text).toBe("持ち物");
  });

  it("PLN-T-38 禁止表現(メール)は invalid_input、元メンバーは「元メンバー」表示", () => {
    const e = errOf(() => createItem(u1(), G, { date: "2026-12-10", title: "x", note: "連絡は test@example.com まで" }));
    expect(e.code).toBe("invalid_input");
    expect(e.fields?.note).toBeTruthy();
    const it = createItem(u2(), G, { date: "2026-12-10", title: "ok" });
    const mem = db().members.find((m) => m.groupId === G && m.userId === "u-002")!;
    db().members.update(mem.id, { status: "left" } as never);
    const v = getPlan(u1(), G).items.find((i) => i.id === it.id)!;
    expect(v.createdBy.isFormerMember).toBe(true);
    expect(v.createdBy.displayName).toBe("元メンバー");
  });
});
