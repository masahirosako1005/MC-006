"use client";
// クライアント fetch(00 第 5.9)。
import { useCallback, useEffect, useState } from "react";
import type { DemoUserSummary, MeResponse } from "./groups-types";
import type { ErrorCode } from "./errors";

export class ApiError extends Error {
  code: ErrorCode | "network";
  status: number;
  reason?: string;
  fields?: Record<string, string>;
  detail?: Record<string, unknown>;
  constructor(
    code: ErrorCode | "network",
    status: number,
    message: string,
    opts?: { reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown> },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.reason = opts?.reason;
    this.fields = opts?.fields;
    this.detail = opts?.detail;
  }
}

export const NTF_REFRESH_EVENT = "ntf:refresh";

const NETWORK_MSG = "サーバーに接続できません。起動していることを確認して再試行してください";

function notifyRefresh() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(NTF_REFRESH_EVENT));
}

export async function gapi<T>(path: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? "GET").toUpperCase();
  let res: Response;
  try {
    res = await fetch(path, { cache: "no-store", ...init });
  } catch {
    throw new ApiError("network", 0, NETWORK_MSG);
  }
  if (res.status === 204) {
    if (method !== "GET") notifyRefresh();
    return undefined as T;
  }
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError("network", res.status, NETWORK_MSG);
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: ErrorCode; message?: string; reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown> };
    throw new ApiError(b.error ?? "internal", res.status, b.message ?? "問題が発生しました", { reason: b.reason, fields: b.fields, detail: b.detail });
  }
  if (method !== "GET") notifyRefresh();
  return body as T;
}

const send = <T,>(method: string, path: string, data?: unknown) =>
  gapi<T>(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data ?? {}) });
export const gpost = <T,>(path: string, data?: unknown): Promise<T> => send<T>("POST", path, data);
export const gput = <T,>(path: string, data?: unknown): Promise<T> => send<T>("PUT", path, data);
export const gpatch = <T,>(path: string, data?: unknown): Promise<T> => send<T>("PATCH", path, data);
export const gdelete = <T,>(path: string): Promise<T> => gapi<T>(path, { method: "DELETE" });

export function useGroupsApi<T>(path: string | null): { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const reload = useCallback((): Promise<void> => {
    if (path === null) return Promise.resolve();
    return gapi<T>(path)
      .then((d) => { setData(d); setError(null); })
      .catch((e: unknown) => setError(e instanceof ApiError ? e : new ApiError("internal", 500, (e as Error).message)))
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}

export function useCurrentUser(): { user: DemoUserSummary | null; loading: boolean } {
  const { data, loading } = useGroupsApi<MeResponse>("/api/demo/me");
  return { user: (data as MeResponse | null)?.user ?? null, loading };
}
