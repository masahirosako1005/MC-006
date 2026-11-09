import { describe, it, expect } from "vitest";
import { parse, safeParse, v, sanitizeText, type Schema } from "./validation";
import { isId } from "./ids";
import { AppError } from "./errors";
import { addDays, daysBetween, toJstIso, jstDate, isDateStr, parseIso, formatJst, startOfNextJstDay } from "./datetime";

const fieldsOf = (s: Schema, x: unknown) => {
  const r = safeParse(s, x);
  return r.ok ? null : r.fields;
};

describe("validation", () => {
  it("T-01 必須文字列", () => {
    const s = v.object({ name: v.string({ max: 30 }) });
    try { parse(s, { name: "" }); expect.fail(); } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe("invalid_input");
      expect((e as AppError).fields?.name).toBe("入力してください");
    }
  });
  it("T-02 整形・長さ・行数", () => {
    const s = v.object({ n: v.string({ max: 30 }) });
    expect(parse(s, { n: "  旅  " })).toEqual({ n: "旅" });
    expect(fieldsOf(s, { n: "a".repeat(31) })).toHaveProperty("n");
    expect(safeParse(s, { n: "😀".repeat(30) }).ok).toBe(true);
    const m = v.object({ t: v.string({ multiline: true, maxLines: 10 }) });
    expect(fieldsOf(m, { t: Array(11).fill("a").join("\n") })?.t).toBe("10行までです");
  });
  it("T-03 sanitizeText", () => {
    expect(sanitizeText("a\u0000b‮c​")).toBe("abc");
    expect(() => sanitizeText("a\nb")).toThrow();
    expect(sanitizeText("a\r\nb", { multiline: true })).toBe("a\nb");
  });
  it("T-04 int", () => {
    const s = v.object({ n: v.int({ min: 2, max: 6 }) });
    for (const x of [2.5, "3", NaN, 2 ** 53, 1, 7]) expect(safeParse(s, { n: x }).ok).toBe(false);
    expect(safeParse(s, { n: 2 }).ok && safeParse(s, { n: 6 }).ok).toBe(true);
    expect(parse(v.object({ n: v.int({ coerce: true }) }), { n: "3" })).toEqual({ n: 3 });
  });
  it("T-05 enum/boolean", () => {
    expect(fieldsOf(v.object({ k: v.enum(["a", "b"]) }), { k: "x" })?.k).toBe("選択肢から選んでください");
    expect(safeParse(v.object({ b: v.boolean() }), { b: "true" }).ok).toBe(false);
  });
  it("T-06 array", () => {
    const s = v.object({ tags: v.array(v.string({ max: 10 }), { max: 5, unique: true }) });
    expect(fieldsOf(s, { tags: ["a", "b", "c", "d", "e", "f"] })?.tags).toBe("5件までです");
    expect(fieldsOf(s, { tags: ["a", "b", ""] })).toHaveProperty(["tags.2"]);
    expect(fieldsOf(s, { tags: ["a", "a"] })).toHaveProperty("tags");
  });
  it("T-07 未知キー除去", () => {
    const s = v.object({ name: v.string() });
    expect(parse(s, { name: "x", official: true, lifecycle: { status: "confirmed" }, organizerId: "u-002" })).toEqual({ name: "x" });
  });
  it("T-08 date/datetime", () => {
    expect(safeParse(v.date(), "2026-02-30").ok).toBe(false);
    expect(safeParse(v.date(), "2026-12-05").ok).toBe(true);
    expect(safeParse(v.datetime(), "2026-12-05T10:00:00").ok).toBe(false);
    expect(parse(v.datetime(), "2026-12-05T10:00:00+09:00")).toBe("2026-12-05T10:00:00+09:00");
    expect(parse(v.datetime(), "2026-12-05T01:00:00Z")).toBe("2026-12-05T10:00:00+09:00");
  });
  it("T-09 id", () => {
    const s = v.id("g");
    expect(safeParse(s, "g-001").ok).toBe(true);
    for (const x of ["../etc", "u-001", "g-1", "g-001 ", "g-123456789"]) expect(safeParse(s, x).ok).toBe(false);
    expect(isId("msg", "msg-001") && isId("pi", "pi-010") && isId("fe", "fe-001")).toBe(true);
    expect(isId("m", "msg-001")).toBe(false);
  });
  it("T-10 複数エラー集約", () => {
    const s = v.object({ a: v.string(), b: v.int(), c: v.enum(["x"]) });
    expect(Object.keys(fieldsOf(s, {})!)).toEqual(["a", "b", "c"]);
  });
  it("T-38 非破壊 / nullable / csv", () => {
    expect(parse(v.object({ t: v.string() }), { t: "<script>alert(1)</script>" })).toEqual({ t: "<script>alert(1)</script>" });
    const s = v.object({ x: v.nullable(v.string({ optional: true })) });
    expect(parse(s, { x: null })).toEqual({ x: null });
    expect(parse(s, {})).toEqual({ x: "" });
    expect(safeParse(v.object({ x: v.string({ optional: true }) }), { x: null }).ok).toBe(false);
    expect(parse(v.csv(v.string()), "a,b")).toEqual(["a", "b"]);
  });
});

describe("datetime (T-33)", () => {
  it("各ヘルパー", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(daysBetween("2026-11-09", "2026-12-05")).toBe(26);
    expect(toJstIso(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-09T09:00:00+09:00");
    expect(jstDate("2026-11-08T15:30:00Z")).toBe("2026-11-09");
    expect(isDateStr("2026-02-30")).toBe(false);
    expect(parseIso("2026-11-09T09:00:00")).toBeNull();
    expect(formatJst("2026-11-09T09:05:00+09:00")).toBe("11月9日 9:05");
    expect(formatJst("2026-11-08T15:30:00Z", "YYYY-MM-DD HH:mm")).toBe("2026-11-09 00:30");
    expect(formatJst("2026-11-20")).toBe("11月20日");
    expect(startOfNextJstDay("2026-11-20")).toBe("2026-11-21T00:00:00+09:00");
  });
});
