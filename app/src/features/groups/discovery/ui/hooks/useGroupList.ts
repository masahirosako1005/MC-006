"use client";
// 一覧の取得(DSC 3.8)。条件が変わるたびに前のリクエストを中止し、古い応答は反映しない。
import { useCallback, useEffect, useState } from "react";
import { ApiError, gapi } from "@/lib/groups-api";
import { serializeFilter } from "../../query";
import { LIST_PAGE_SIZE } from "../../types";
import type { GroupListFilter, GroupListResponse } from "../../types";

function buildQuery(filter: GroupListFilter, page: number): string {
  const p = serializeFilter(filter);
  p.set("limit", String(LIST_PAGE_SIZE));
  p.set("offset", String((page - 1) * LIST_PAGE_SIZE));
  return p.toString();
}

export function useGroupList(filter: GroupListFilter | null, page: number) {
  const [data, setData] = useState<GroupListResponse | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);
  const query = filter ? buildQuery(filter, page) : null;

  useEffect(() => {
    if (query === null) return;
    const ac = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    gapi<GroupListResponse>("/api/groups?" + query, { signal: ac.signal })
      .then((d) => { if (!ac.signal.aborted) { setData(d); setError(null); setLoading(false); } })
      .catch((e: unknown) => {
        if (ac.signal.aborted) return;
        setError(e instanceof ApiError ? e : new ApiError("internal", 500, (e as Error).message));
        setLoading(false);
      });
    return () => ac.abort();
  }, [query, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, reload };
}
