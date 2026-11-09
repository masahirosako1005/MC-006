// デモ API(/api/demo/*)のハンドラ(CMN-API-01〜06)。
// app/api/demo/*/route.ts はここからの再エクスポートだけを書く(P-0-2)。
import { route, ok } from "./api-route";
import { clock } from "./clock";
import { currentUser, listDemoUsers, userCookieHeader } from "./current-user";
import { invalidInput } from "./errors";
import { db, resetStore } from "./groups-store";
import { runHooks } from "./hooks";
import { v } from "./validation";
import type { DemoUser, DemoUserSummary } from "./groups-types";

const toolsOn = () => process.env.DEMO_TOOLS !== "off";
const summary = (u: Pick<DemoUser, "id" | "displayName" | "role">): DemoUserSummary => ({
  id: u.id,
  displayName: u.displayName,
  role: u.role,
});

const meBody = () => v.object({ userId: v.id("u") });
const clockBody = () => v.object({
  action: v.enum(["advanceDays", "set", "reset"] as const),
  days: v.int({ min: 1, max: 365, optional: true }),
  at: v.datetime({ optional: true }),
});

export const getMeHandler = route(
  (c) => ok({ user: summary(currentUser(c.req)), clock: clock.info(), tools: toolsOn() }),
  { auth: "none" },
);

export const postMeHandler = route(
  async (c) => {
    const { userId } = await c.body(meBody());
    const u = db().users.get(userId);
    if (!u) throw invalidInput({ userId: "存在しないユーザーです。" });
    return ok({ user: summary(u) }, { "Set-Cookie": userCookieHeader(u.id) });
  },
  { demoOnly: true },
);

export const getUsersHandler = route(() => ok({ items: listDemoUsers() }), { demoOnly: true });

export const getClockHandler = route(() => ok(clock.info()));

export const postClockHandler = route(
  async (c) => {
    const b = await c.body(clockBody());
    let info;
    if (b.action === "advanceDays") {
      if (b.days === undefined) throw invalidInput({ days: "days は 1〜365 の整数で指定してください。" });
      info = clock.advanceDays(b.days);
    } else if (b.action === "set") {
      if (b.at === undefined) throw invalidInput({ at: "at は日時で指定してください。" });
      info = clock.set(b.at);
    } else {
      info = clock.reset();
    }
    runHooks("afterClockChange");
    return ok(info);
  },
  { demoOnly: true },
);

export const postResetHandler = route(
  async (c) => {
    // 本文は省略可。入口検査(Content-Type)は route() が済ませている。
    void c;
    resetStore();
    const info = clock.reset();
    runHooks("afterReset");
    return ok({ ok: true, clock: info });
  },
  { demoOnly: true, skipHooks: true },
);
