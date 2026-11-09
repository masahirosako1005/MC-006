// 10: Route Handler(NTF-API-01〜03)。NTF-API-04(read-all)は見送りのためスタブのまま。
import { route } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { stubRoute } from "@/features/stub";
import { listNotifications, markRead, unreadCount } from "./service";

const listQuery = v.object({
  limit: v.int({ min: 1, max: 100, coerce: true, optional: true }),
  cursor: v.id("n", { optional: true }),
  unread: v.string({ optional: true, pattern: /^1$/ }),
  groupId: v.id("g", { optional: true }),
});

export const listNotificationsHandler = route(async (c) => {
  const q = c.query(listQuery) as { limit?: number; cursor?: string; unread?: string; groupId?: string };
  return listNotifications(c.user, {
    limit: q.limit,
    cursor: q.cursor || undefined,
    unreadOnly: q.unread === "1",
    groupId: q.groupId || undefined,
  });
});

export const unreadCountHandler = route(async (c) => ({ count: unreadCount(c.user) }));

export const markReadHandler = route(async (c) => {
  const b = await c.body(v.object({ id: v.id("n") }));
  return markRead(c.user, b.id);
});

export const markAllReadHandler = stubRoute();
