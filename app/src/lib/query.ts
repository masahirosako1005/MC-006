// ページネーション・ソート(00 第 5.6)。
import { invalidInput } from "./errors";
import { LIMITS } from "./limits";
import type { Id, Page } from "./groups-types";

type Dir = "asc" | "desc";

function intParam(raw: string | null): number | undefined | null {
  if (raw === null || raw === "") return undefined;
  return /^\d{1,9}$/.test(raw) ? Number(raw) : null;
}

export function parsePage(
  q: URLSearchParams,
  opts?: { defaultLimit?: number; maxLimit?: number },
): { limit: number; offset: number } {
  const maxLimit = opts?.maxLimit ?? LIMITS.PAGE.maxLimit;
  const defaultLimit = opts?.defaultLimit ?? LIMITS.PAGE.defaultLimit;
  const fields: Record<string, string> = {};
  const l = intParam(q.get("limit"));
  const o = intParam(q.get("offset"));
  if (l === null || (l !== undefined && (l < 1 || l > maxLimit))) fields.limit = `limit は 1〜${maxLimit} の整数で指定してください。`;
  if (o === null) fields.offset = "offset は 0 以上の整数で指定してください。";
  if (Object.keys(fields).length) throw invalidInput(fields);
  return { limit: (l as number | undefined) ?? defaultLimit, offset: (o as number | undefined) ?? 0 };
}

export function paginate<T>(items: readonly T[], page: { limit: number; offset: number }): Page<T> {
  const slice = items.slice(page.offset, page.offset + page.limit);
  return {
    items: slice,
    total: items.length,
    limit: page.limit,
    offset: page.offset,
    hasMore: page.offset + slice.length < items.length,
  };
}

export function parseSort<K extends string>(
  q: URLSearchParams,
  opts: { allowed: readonly K[]; default: { key: K; dir: Dir } },
): { key: K; dir: Dir } {
  const raw = q.get("sort");
  if (raw === null || raw === "") return opts.default;
  const [key, dir = "asc", ...rest] = raw.split(":");
  if (rest.length || (dir !== "asc" && dir !== "desc") || !(opts.allowed as readonly string[]).includes(key)) {
    throw invalidInput({ sort: "sort の指定が正しくありません。" });
  }
  return { key: key as K, dir };
}

export function sortBy<T extends { id: Id }, K extends string>(
  items: readonly T[],
  sort: { key: K; dir: Dir },
  get: Record<K, (x: T) => string | number>,
): T[] {
  const f = get[sort.key];
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const x = f(a);
    const y = f(b);
    if (x < y) return -sign;
    if (x > y) return sign;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}
