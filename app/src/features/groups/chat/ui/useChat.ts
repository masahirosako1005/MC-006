"use client";
// 06 useChat: 固定間隔ポーリング(5 秒)。sinceId で差分取得し、読み取りマークを送る。
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, gapi, gpost } from "@/lib/groups-api";
import { POLL_INTERVAL_MS } from "../constants";
import type { ChatAccess, ListMessagesResponse, MessageDto, PostMessageInput } from "../types";

export function useChat(groupId: string) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [access, setAccess] = useState<ChatAccess | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const latest = useRef<string | null>(null);
  const base = `/api/groups/${groupId}/messages`;

  const markRead = useCallback((id: string | null) => {
    if (id) gpost(`/api/groups/${groupId}/chat/read`, { lastReadId: id }).catch(() => {});
  }, [groupId]);

  const poll = useCallback(async (initial: boolean) => {
    try {
      const q = !initial && latest.current ? `?sinceId=${latest.current}` : "";
      const r = await gapi<ListMessagesResponse>(base + q);
      setAccess(r.access);
      setError(null);
      if (initial) { setMessages(r.items); setHasMore(r.nextCursor !== null); }
      else if (r.items.length) {
        setMessages((prev) => {
          const ids = new Set(prev.map((m) => m.id));
          return [...prev, ...r.items.filter((m) => !ids.has(m.id))];
        });
      }
      if (r.latestId && r.latestId !== latest.current) { latest.current = r.latestId; markRead(r.latestId); }
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("internal", 500, (e as Error).message));
    } finally {
      setLoading(false);
    }
  }, [base, markRead]);

  useEffect(() => {
    latest.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    void poll(true);
    const t = setInterval(() => { if (!document.hidden) void poll(false); }, POLL_INTERVAL_MS);
    return () => clearInterval(t);
  }, [poll]);

  const loadOlder = useCallback(async () => {
    const first = messages[0];
    if (!first) return;
    const r = await gapi<ListMessagesResponse>(`${base}?before=${first.id}`);
    setMessages((prev) => [...r.items, ...prev]);
    setHasMore(r.nextCursor !== null);
  }, [base, messages]);

  const post = useCallback(async (input: PostMessageInput) => {
    await gpost<MessageDto>(base, input);
    await poll(false);
  }, [base, poll]);

  return { messages, access, error, loading, hasMore, loadOlder, post, reload: () => poll(true) };
}
