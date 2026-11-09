"use client";
// 10: ブラウザ用フック。スタブ(P-2-14 で本体に置き換える)。
import type { Id } from "@/lib/groups-types";
import type { NotificationDto } from "./types";

export function useUnreadCount(intervalMs: number = 15000): { count: number; refresh(): void } {
  void intervalMs;
  return { count: 0, refresh: () => {} };
}

export function useNotifications(opts: { filter: "all" | "unread"; groupId?: Id }): {
  items: NotificationDto[];
  nextCursor: string | null;
  loadMore(): void;
  markRead(id: Id): void;
  markAll(): void;
  reload(): void;
} {
  void opts;
  return { items: [], nextCursor: null, loadMore: () => {}, markRead: () => {}, markAll: () => {}, reload: () => {} };
}
