// CMN-T-13〜15 の代表と、query・demo API の試験。ストア・検証・時計は署名に対して vi.mock で代替する。
import { describe, it, expect, vi, beforeEach } from "vitest";

const users = [
  { id: "u-001", displayName: "ミサキ", role: "traveler" },
  { id: "u-002", displayName: "ケンタ", role: "traveler" },
  { id: "u-101", displayName: "旅行者101", role: "traveler", background: true },
];
const resetStore = vi.fn();
const clockInfo = { nowIso: "2026-11-09T09:00:00+09:00", today: "2026-11-09", mode: "frozen", shiftedDays: 0 };

vi.mock("@/lib/groups-store", () => ({
  db: () => ({ users: { get: (id: string) => users.find((u) => u.id === id), getOrThrow: (id: string) => users.find((u) => u.id === id)!, list: () => users } }),
  resetStore: (...a: unknown[]) => resetStore(...a),
  newId: () => "x-000",
}));
vi.mock("@/lib/clock", () => ({
  clock: { info: () => clockInfo, reset: () => clockInfo, advanceDays: () => ({ ...clockInfo, shiftedDays: 1 }), set: () => clockInfo },
}));
vi.mock("@/lib/validation", () => {
  const passthrough = { parse: (i: unknown) => i };
  return {
    v: {
      id: () => passthrough,
      int: () => passthrough,
      enum: () => passthrough,
      datetime: () => passthrough,
      string: () => passthrough,
      object: (shape: Record<string, unknown>) => ({
        parse: (i: unknown, _p: string, issues: Record<string, string>) => {
          if (typeof i !== "object" || i === null) { issues[""] = "object"; return Symbol.for("invalid"); }
          const out: Record<string, unknown> = {};
          for (const k of Object.keys(shape)) if (k in i) out[k] = (i as Record<string, unknown>)[k];
          return out;
        },
      }),
    },
    safeParse: (s: { parse: (i: unknown, p: string, iss: Record<string, string>) => unknown }, i: unknown) => {
      const issues: Record<string, string> = {};
      const value = s.parse(i, "", issues);
      return Object.keys(issues).length ? { ok: false, fields: issues } : { ok: true, value };
    },
  };
});

import { route, ok } from "./api-route";
import { parsePage, parseSort } from "./query";
import { getMeHandler, postMeHandler, getUsersHandler, postResetHandler } from "./demo-handlers";
import { runHooks, registerHook } from "./hooks";
import { callRoute, asUser } from "@/test/helpers";
import { v } from "./validation";

const echo = route(async (c) => ok({ q: c.url.search, user: c.user.id }));
const withBody = route(async (c) => ok(await c.body(v.object({ a: v.int() }))));
const withId = route<{ groupId: string }>(async (c) => ok({ id: await c.id("groupId", "g") }));
const withQuery = route(async (c) => ok(c.query(v.object({ q: v.string() }))));

beforeEach(() => resetStore.mockClear());

describe("route 入口検査 (CMN-T-13)", () => {
  it("POST: text/plain は 415", async () => {
    const r = await callRoute(withBody, "/x", { body: { a: 1 }, headers: { "Content-Type": "text/plain" } });
    expect(r.status).toBe(415);
  });
  it("POST: 他オリジンは 403 forbidden", async () => {
    const r = await callRoute(withBody, "/x", { body: { a: 1 }, headers: { Origin: "http://evil.example", Host: "localhost:3000" } });
    expect(r.status).toBe(403);
    expect(r.body.error).toBe("forbidden");
  });
  it("POST: 70KB は 413、不正 JSON は 400", async () => {
    expect((await callRoute(withBody, "/x", { rawBody: JSON.stringify({ a: "x".repeat(70_000) }) })).status).toBe(413);
    const r = await callRoute(withBody, "/x", { rawBody: "{" });
    expect(r.status).toBe(400);
    expect(r.body.error).toBe("invalid_input");
  });
  it("POST 正常系", async () => {
    const r = await callRoute(withBody, "/x", { body: { a: 1 } });
    expect(r).toMatchObject({ status: 200, body: { a: 1 } });
  });
});

describe("route 共通ヘッダ・内部エラー (CMN-T-14)", () => {
  it("成功・エラーとも共通ヘッダが付く", async () => {
    for (const r of [await callRoute(echo, "/x"), await callRoute(withBody, "/x", { rawBody: "{" })]) {
      expect(r.headers.get("cache-control")).toBe("no-store");
      expect(r.headers.get("content-type")).toContain("application/json");
      expect(r.headers.get("x-content-type-options")).toBe("nosniff");
    }
  });
  it("例外は 500 internal で内容を出さない", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = await callRoute(route(() => { throw new Error("secret path C:\\x"); }), "/x");
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain("secret");
    expect(r.body.detail.requestId).toBeTruthy();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
  it("beforeRequest は実行され、skipHooks では実行されない", async () => {
    const fn = vi.fn();
    registerHook("beforeRequest", "t-api-route", fn);
    await callRoute(echo, "/x");
    expect(fn).toHaveBeenCalledTimes(1);
    await callRoute(postResetHandler, "/api/demo/reset", { method: "POST" });
    expect(fn).toHaveBeenCalledTimes(1);
    registerHook("beforeRequest", "t-api-route", () => {});
    runHooks("beforeRequest");
  });
  it("Cookie の視点を使い、不正値は既定ユーザー", async () => {
    expect((await callRoute(echo, "/x", { user: "u-002" })).body.user).toBe("u-002");
    expect((await callRoute(echo, "/x", { headers: { Cookie: "demoUser=u-999" } })).body.user).toBe("u-001");
  });
});

describe("c.id / c.query (CMN-T-15)", () => {
  it("正常な ID", async () => {
    expect((await callRoute(withId, "/x", { params: { groupId: "g-001" } })).body).toEqual({ id: "g-001" });
  });
  it("形式不正・別接頭辞は 404", async () => {
    for (const groupId of ["..%2Fx", "u-001"]) {
      const r = await callRoute(withId, "/x", { params: { groupId } });
      expect(r.status).toBe(404);
      expect(r.body.error).toBe("not_found");
    }
  });
  it("query は未知キーを invalid_input にする(limit は許可)", async () => {
    expect((await callRoute(withQuery, "/x?q=a&limit=5")).status).toBe(200);
    const r = await callRoute(withQuery, "/x?q=a&zzz=1");
    expect(r.status).toBe(400);
    expect(r.body.fields.zzz).toBeTruthy();
  });
});

describe("parsePage / parseSort", () => {
  it("既定値と不正値", () => {
    expect(parsePage(new URLSearchParams())).toEqual({ limit: 20, offset: 0 });
    expect(parsePage(new URLSearchParams("limit=5&offset=10"))).toEqual({ limit: 5, offset: 10 });
    expect(() => parsePage(new URLSearchParams("limit=51"))).toThrow();
  });
  it("sort", () => {
    const o = { allowed: ["deadline", "name"] as const, default: { key: "deadline" as const, dir: "asc" as const } };
    expect(parseSort(new URLSearchParams("sort=name:desc"), o)).toEqual({ key: "name", dir: "desc" });
    expect(() => parseSort(new URLSearchParams("sort=zzz:asc"), o)).toThrow();
  });
});

describe("demo API", () => {
  it("GET me は Cookie の視点を返す", async () => {
    const r = await callRoute(getMeHandler, "/api/demo/me", { user: "u-002" });
    expect(r.body).toMatchObject({ user: { id: "u-002" }, tools: true });
  });
  it("POST me は Set-Cookie を返し、存在しない ID は 400", async () => {
    const r = await callRoute(postMeHandler, "/api/demo/me", { body: { userId: "u-002" } });
    expect(r.headers.get("set-cookie")).toContain("demoUser=u-002");
    expect((await callRoute(postMeHandler, "/api/demo/me", { body: { userId: "u-777" } })).status).toBe(400);
  });
  it("users は背景ユーザーを除く。DEMO_TOOLS=off で 404", async () => {
    const r = await callRoute(getUsersHandler, "/api/demo/users");
    expect(r.body.items.map((u: { id: string }) => u.id)).toEqual(["u-001", "u-002"]);
    vi.stubEnv("DEMO_TOOLS", "off");
    expect((await callRoute(getUsersHandler, "/api/demo/users")).status).toBe(404);
    vi.unstubAllEnvs();
  });
  it("reset は resetStore を呼ぶ", async () => {
    const r = await callRoute(postResetHandler, "/api/demo/reset", { method: "POST" });
    expect(r.body.ok).toBe(true);
    expect(resetStore).toHaveBeenCalled();
    void asUser;
  });
});
