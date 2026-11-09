// ページネーション・ソート(00 第 5.6)。署名スタブ(P-1-3 で実装)。
import type { Id, Page } from "./groups-types";

type Dir = "asc" | "desc";
const ni = (): never => { throw new Error("not implemented"); };

export function parsePage(q: URLSearchParams, opts?: { defaultLimit?: number; maxLimit?: number }): { limit: number; offset: number } {
  void q; void opts; return ni();
}
export function paginate<T>(items: readonly T[], page: { limit: number; offset: number }): Page<T> { void items; void page; return ni(); }
export function parseSort<K extends string>(
  q: URLSearchParams,
  opts: { allowed: readonly K[]; default: { key: K; dir: Dir } },
): { key: K; dir: Dir } { void q; void opts; return ni(); }
export function sortBy<T extends { id: Id }, K extends string>(
  items: readonly T[],
  sort: { key: K; dir: Dir },
  get: Record<K, (x: T) => string | number>,
): T[] { void items; void sort; void get; return ni(); }
