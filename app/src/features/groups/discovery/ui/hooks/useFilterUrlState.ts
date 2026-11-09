"use client";
// URL クエリ ⇔ GroupListFilter(URL が唯一の正)。
import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { parseGroupListQuery, serializeFilter } from "../../query";
import type { ParsedListQuery, QueryContext } from "../../query";
import { DEFAULT_LIST_STATUSES, DEFAULT_SORT } from "../../types";
import type { GroupListFilter } from "../../types";

export function useFilterUrlState(ctx: QueryContext | null) {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spKey = sp.toString();

  const parsed: { filter: GroupListFilter; ignored: ParsedListQuery["ignored"]; pageNo: number } | null = useMemo(() => {
    if (!ctx) return null;
    const r = parseGroupListQuery(new URLSearchParams(spKey), "lenient", ctx);
    return { filter: r.filter, ignored: r.ignored, pageNo: Math.floor(r.page.offset / r.page.limit) + 1 };
  }, [ctx, spKey]);

  const push = useCallback((f: GroupListFilter) => {
    const qs = serializeFilter(f).toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname]);

  const update = useCallback((next: Partial<GroupListFilter>) => {
    if (parsed) push({ ...parsed.filter, ...next });
  }, [parsed, push]);

  const clear = useCallback(() => {
    if (!parsed) return;
    push({ campaign: parsed.filter.campaign, tags: [], ageBuckets: [], official: false, statuses: [...DEFAULT_LIST_STATUSES], sort: DEFAULT_SORT });
  }, [parsed, push]);

  return { filter: parsed?.filter ?? null, page: parsed?.pageNo ?? 1, ignored: parsed?.ignored ?? [], update, clear };
}
