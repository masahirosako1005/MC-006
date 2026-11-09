// 10: 通知の生成・一覧・既読。スタブ(notify は P-2-13、他は P-2-14)。
import { db } from "@/lib/groups-store";
import { invalidInput, notFound } from "@/lib/errors";
import { clock } from "@/lib/clock";
import { toDto } from "./render";
import type { DemoUser, Id } from "@/lib/groups-types";
import type { NotificationDto, NotificationPage } from "./types";

// notify の本体は publish.ts(P-2-13)。join・lifecycle が本ファイルから import するため再エクスポートする。
export { notify } from "./publish";

const num = (id: string) => Number(id.slice(id.lastIndexOf("-") + 1));

export function listNotifications(
  user: DemoUser,
  opts?: { limit?: number; cursor?: Id; unreadOnly?: boolean; groupId?: Id },
): NotificationPage {
  const limit = opts?.limit ?? 30;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw invalidInput({ limit: "limit は 1〜100 の整数で指定してください。" });
  }
  const mine = db().notifications
    .filter((n) => n.userId === user.id)
    .sort((a, b) => (a.createdAt === b.createdAt ? num(b.id) - num(a.id) : a.createdAt < b.createdAt ? 1 : -1));
  let start = 0;
  if (opts?.cursor !== undefined) {
    const i = mine.findIndex((n) => n.id === opts.cursor);
    if (i < 0) throw invalidInput({ cursor: "cursor が正しくありません。" });
    start = i + 1;
  }
  const rows = mine
    .slice(start)
    .filter((n) => (opts?.unreadOnly ? n.readAt === null : true) && (opts?.groupId === undefined || n.groupId === opts.groupId));
  const pageRows = rows.slice(0, limit);
  return {
    items: pageRows.map(toDto),
    nextCursor: rows.length > limit ? pageRows[pageRows.length - 1].id : null,
    unreadCount: unreadCount(user),
  };
}

export function unreadCount(user: DemoUser): number {
  return db().notifications.count((n) => n.userId === user.id && n.readAt === null);
}

export function markRead(user: DemoUser, id: Id): NotificationDto {
  const n = db().notifications.get(id);
  if (!n || n.userId !== user.id) throw notFound("通知");
  return toDto(n.readAt === null ? db().notifications.update(id, { readAt: clock.nowIso() }) : n);
}

export function markAllRead(user: DemoUser, groupId?: Id): number {
  void user; void groupId;
  throw new Error("not implemented");
}

export function pruneNotifications(userId: Id, now: Date): number {
  void userId; void now;
  throw new Error("not implemented");
}
