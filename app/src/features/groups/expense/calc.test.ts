import { describe, it, expect } from "vitest";
import { splitAmount } from "./split";
import { computeBalances, computeTransfers } from "./settlement";

const net = (b: ReturnType<typeof computeBalances>) =>
  Object.fromEntries(Object.entries(b).map(([k, v]) => [k, v.net]));

describe("splitAmount", () => {
  it("T-02 端数は昇順の先頭へ", () => {
    expect({ ...splitAmount(1000, ["a", "b", "c"]) }).toEqual({ a: 334, b: 333, c: 333 });
  });
  it("T-06 入力順に依存しない", () => {
    expect({ ...splitAmount(1000, ["c", "a", "b"]) }).toEqual({ a: 334, b: 333, c: 333 });
  });
  it("T-04 1円", () => {
    expect({ ...splitAmount(1, ["a", "b"]) }).toEqual({ a: 1, b: 0 });
  });
  it("T-07 不正入力は RangeError", () => {
    expect(() => splitAmount(100, [])).toThrow(RangeError);
    expect(() => splitAmount(10.5, ["a"])).toThrow(RangeError);
  });
});

describe("settlement", () => {
  it("T-08", () => {
    const b = computeBalances(
      [
        { amount: 3000, payerId: "a", targetIds: ["a", "b", "c"] },
        { amount: 1000, payerId: "b", targetIds: ["a", "b", "c"] },
      ],
      ["a", "b", "c"],
    );
    expect(net(b)).toEqual({ a: 1666, b: -333, c: -1333 });
    expect(computeTransfers(net(b))).toEqual([
      { fromUserId: "c", toUserId: "a", amount: 1333 },
      { fromUserId: "b", toUserId: "a", amount: 333 },
    ]);
  });
  it("T-09", () => {
    const b = computeBalances(
      [
        { amount: 4000, payerId: "a", targetIds: ["a", "b", "c", "d"] },
        { amount: 2000, payerId: "b", targetIds: ["a", "b", "c", "d"] },
      ],
      ["a", "b", "c", "d"],
    );
    expect(net(b)).toEqual({ a: 2500, b: 500, c: -1500, d: -1500 });
    expect(computeTransfers(net(b))).toEqual([
      { fromUserId: "c", toUserId: "a", amount: 1500 },
      { fromUserId: "d", toUserId: "a", amount: 1000 },
      { fromUserId: "d", toUserId: "b", amount: 500 },
    ]);
  });
  it("T-11 自分だけ対象なら空", () => {
    const b = computeBalances([{ amount: 1000, payerId: "a", targetIds: ["a"] }], ["a"]);
    expect(computeTransfers(net(b))).toEqual([]);
  });
  it("T-12 元メンバーの行が残る", () => {
    const b = computeBalances([{ amount: 1000, payerId: "a", targetIds: ["a", "z"] }], ["a"]);
    expect(b.z.net).toBe(-500);
    expect(Object.values(b).reduce((s, r) => s + r.net, 0)).toBe(0);
  });
  it("T-13 合計が 0 でなければ RangeError", () => {
    expect(() => computeTransfers({ a: 1, b: 0 })).toThrow(RangeError);
  });
});
