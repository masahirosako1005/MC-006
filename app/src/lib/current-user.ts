// 現在ユーザー(00 第 5.2)。Cookie `demoUser=<id>` で視点を表す。不正・不在は defaultUserId にフォールバックする。
import seed from "@/data/group-seed.json";
import { db } from "./groups-store";
import { isId } from "./ids";
import type { DemoUser, DemoUserSummary, Id } from "./groups-types";

const COOKIE = "demoUser";

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return undefined;
}

export function currentUser(req: Request): Readonly<DemoUser> {
  const v = readCookie(req.headers.get("cookie"), COOKIE);
  if (v !== undefined && isId("u", v)) {
    const u = db().users.get(v);
    if (u) return u;
  }
  return db().users.getOrThrow(seed.meta.defaultUserId, "ユーザー");
}

export function userCookieHeader(userId: Id): string {
  return `${COOKIE}=${userId}; Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000`;
}

export function listDemoUsers(): DemoUserSummary[] {
  return db()
    .users.list()
    .filter((u) => !u.background)
    .map((u) => ({ id: u.id, displayName: u.displayName, role: u.role }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
