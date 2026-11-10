import { describe, it, expect, vi } from "vitest";
import { db, tx, resetStore, newId } from "./groups-store";
import { clock } from "./clock";
import { parseSeed } from "./group-seed";
import { registerHook, runHooks } from "./hooks";
import { emit, on } from "./events";
import seed from "@/data/group-seed.json";

describe("store", () => {
  it("CMN-T-16/17 tx の巻き戻しと入れ子・非同期禁止", () => {
    resetStore();
    const n = db().groups.count();
    const sample = db().groups.list()[0];
    expect(() => tx((d) => { d.groups.insert({ ...sample, id: newId("g") }); throw new Error("x"); })).toThrow("x");
    expect(db().groups.count()).toBe(n);
    expect(newId("g")).toBe("g-014");
    expect(() => tx(() => { tx(() => { throw new Error("in"); }); })).toThrow("in");
    expect(() => tx((async () => {}) as never)).toThrow();
  });
  it("CMN-T-19 resetStore", () => {
    const sample = db().groups.list()[0];
    db().groups.insert({ ...sample, id: "g-901" });
    clock.advanceDays(3);
    resetStore();
    expect(db().groups.count()).toBe(seed.groups.length);
    expect(clock.info().today).toBe("2026-11-09");
    expect(newId("g")).toBe("g-014");
  });
  it("Repo の基本操作と拒否", () => {
    resetStore();
    const u = db().users.getOrThrow("u-001");
    expect(db().users.update("u-001", { displayName: "変更" }).displayName).toBe("変更");
    expect(() => db().users.getOrThrow("u-999")).toThrow();
    expect(() => db().users.insert({ ...u })).toThrow();
    expect(db().businesses.count()).toBe(seed.businesses.length);
  });
  it("parseSeed の拒否", () => {
    expect(parseSeed(seed).schemaVersion).toBe(2);
    expect(() => parseSeed({ ...seed, schemaVersion: 1 })).toThrow();
    expect(() => parseSeed({ ...seed, users: [...seed.users, seed.users[0]] })).toThrow();
  });
  it("future trips 連結", () => {
    resetStore({ futureTrips: true });
    expect(db().groups.count()).toBe(seed.groups.length + 735); // 公開 100 + 非公開の背景グループ 635
    expect(newId("g")).toBe("g-201");
    resetStore();
  });
});

describe("clock", () => {
  it("freeze / advanceDays / set / reset", () => {
    clock.freeze("2026-11-09T09:00:00+09:00");
    expect(clock.advanceDays(2)).toMatchObject({ today: "2026-11-11", mode: "frozen", shiftedDays: 2 });
    expect(clock.set("2026-11-01T00:00:00+09:00").today).toBe("2026-11-01");
    expect(clock.reset().today).toBe("2026-11-09");
    expect(() => clock.advanceDays(0)).toThrow();
    expect(() => clock.set("bad")).toThrow();
  });
});

describe("hooks / events", () => {
  it("フックは全て実行し最初の例外を再 throw", () => {
    const c = vi.fn();
    registerHook("afterReset", "t1", () => { throw new Error("first"); });
    registerHook("afterReset", "t2", c);
    expect(() => runHooks("afterReset")).toThrow("first");
    expect(c).toHaveBeenCalled();
  });
  it("on/emit", () => {
    const h = vi.fn();
    on("group_created", "t", h);
    emit({ type: "group_created", groupId: "g-901", organizerId: "u-001", at: "2026-11-09T09:00:00+09:00" });
    expect(h).toHaveBeenCalledTimes(1);
  });
});
