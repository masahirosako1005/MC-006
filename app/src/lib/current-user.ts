// 現在ユーザー(00 第 5.2)。署名スタブ(P-1-3 で実装)。
import type { DemoUser, DemoUserSummary, Id } from "./groups-types";

export function currentUser(req: Request): Readonly<DemoUser> { void req; throw new Error("not implemented"); }
export function userCookieHeader(userId: Id): string { void userId; throw new Error("not implemented"); }
export function listDemoUsers(): DemoUserSummary[] { throw new Error("not implemented"); }
