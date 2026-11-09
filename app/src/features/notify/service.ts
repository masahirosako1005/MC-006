// 10: 通知の生成・一覧・既読。スタブ(notify は P-2-13、他は P-2-14)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { NotificationDto, NotificationKind, NotificationPage, NotifyInput, NotifyResult } from "./types";

export function notify<K extends NotificationKind>(input: NotifyInput<K>): NotifyResult {
  void input;
  throw new Error("not implemented");
}

export function listNotifications(
  user: DemoUser,
  opts?: { limit?: number; cursor?: Id; unreadOnly?: boolean; groupId?: Id },
): NotificationPage {
  void user; void opts;
  throw new Error("not implemented");
}

export function unreadCount(user: DemoUser): number {
  void user;
  throw new Error("not implemented");
}

export function markRead(user: DemoUser, id: Id): NotificationDto {
  void user; void id;
  throw new Error("not implemented");
}

export function markAllRead(user: DemoUser, groupId?: Id): number {
  void user; void groupId;
  throw new Error("not implemented");
}

export function pruneNotifications(userId: Id, now: Date): number {
  void userId; void now;
  throw new Error("not implemented");
}
