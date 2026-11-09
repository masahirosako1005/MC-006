"use client";
import { useCallback, useEffect, useState } from "react";

export type Spot = { id: number; stampName: string; name: string; area: string; description: string; map: { x: number; y: number }; hue: number; acquired: boolean };
export type Reward = { id: number; name: string; prize: string; requiredStamps: number; method: string; description: string };
export type UserReward = Reward & { rewardId: number; at: string };
export type Activity = { type: "stamp" | "reward"; label: string; at: string };

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/v2${path}`, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ?? "error"), { code: body.error as string | undefined });
  return body as T;
}

export const post = <T,>(path: string, data?: unknown) => api<T>(path, { method: "POST", body: JSON.stringify(data ?? {}) });

/** GET を取得する最小のフック。reload() で再取得する。 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const reload = useCallback(() => {
    if (path === null) return Promise.resolve();
    return api<T>(path)
      .then((d) => { setData(d); setError(null); })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [path]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}
