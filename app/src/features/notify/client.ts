"use client";
// 10: ブラウザ用フック(ポーリング、ntf:refresh、非表示時は停止)。
import { useCallback, useEffect, useRef, useState } from "react";
import { gapi, gpost, NTF_REFRESH_EVENT } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { NotificationDto, NotificationPage } from "./types";

export function useUnreadCount(intervalMs: number = 15000): { count: number; refresh(): void } {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => {
    gapi<{ count: number }>("/api/me/unread-count").then((r) => setCount(r.count)).catch(() => {});
  }, []);
  useEffect(() => {
    refresh();
    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (timer === null) timer = setInterval(refresh, intervalMs); };
    const stop = () => { if (timer !== null) { clearInterval(timer); timer = null; } };
    const onVis = () => { if (document.visibilityState === "visible") { refresh(); start(); } else stop(); };
    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener(NTF_REFRESH_EVENT, refresh);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener(NTF_REFRESH_EVENT, refresh);
    };
  }, [refresh, intervalMs]);
  return { count, refresh };
}

export function useNotifications(opts: { filter: "all" | "unread"; groupId?: Id }): {
  items: NotificationDto[];
  nextCursor: string | null;
  loadMore(): void;
  markRead(id: Id): void;
  markAll(): void;
  reload(): void;
} {
  const { filter, groupId } = opts;
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  useEffect(() => { cursorRef.current = nextCursor; }, [nextCursor]);

  const url = useCallback((cursor?: string | null) => {
    const q = new URLSearchParams();
    if (filter === "unread") q.set("unread", "1");
    if (groupId) q.set("groupId", groupId);
    if (cursor) q.set("cursor", cursor);
    const s = q.toString();
    return "/api/me/notifications" + (s ? `?${s}` : "");
  }, [filter, groupId]);

  const reload = useCallback(() => {
    gapi<NotificationPage>(url()).then((p) => { setItems(p.items); setNextCursor(p.nextCursor); }).catch(() => {});
  }, [url]);

  const loadMore = useCallback(() => {
    if (!cursorRef.current) return;
    gapi<NotificationPage>(url(cursorRef.current))
      .then((p) => { setItems((prev) => [...prev, ...p.items]); setNextCursor(p.nextCursor); })
      .catch(() => {});
  }, [url]);

  const markRead = useCallback((id: Id) => {
    gpost<NotificationDto>("/api/me/notifications/read", { id })
      .then((d) => setItems((prev) => prev.map((x) => (x.id === id ? d : x))))
      .catch(() => {});
  }, []);

  // 見送り: すべて既読(NTF-API-04)。
  const markAll = useCallback(() => {}, []);

  useEffect(() => {
    reload();
    window.addEventListener(NTF_REFRESH_EVENT, reload);
    return () => window.removeEventListener(NTF_REFRESH_EVENT, reload);
  }, [reload]);

  return { items, nextCursor, loadMore, markRead, markAll, reload };
}
