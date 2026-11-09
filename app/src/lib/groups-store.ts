// ストア本体(00 第 5.1)。署名スタブ(P-1-1 で実装)。
// 各モジュールの型(Group ほか)が揃う P-0-2 以降に、コレクションの要素型を所有モジュールの型へ置き換える。
import type { Id } from "./groups-types";
import type { IdPrefix } from "./ids";

export interface Repo<T extends { id: Id }> {
  list(): readonly Readonly<T>[];
  get(id: Id): Readonly<T> | undefined;
  getOrThrow(id: Id, label?: string): Readonly<T>;
  find(pred: (x: Readonly<T>) => boolean): Readonly<T> | undefined;
  filter(pred: (x: Readonly<T>) => boolean): Readonly<T>[];
  count(pred?: (x: Readonly<T>) => boolean): number;
  insert(entity: T): Readonly<T>;
  update(id: Id, patch: Partial<Omit<T, "id">>): Readonly<T>;
  remove(id: Id): boolean;
}

export const COLLECTION_NAMES = [
  "users", "profiles", "verifications", "blocks", "reports", "regions", "groups", "members", "joinRequests",
  "withdrawals", "groupStatusLogs", "notifications", "plans", "messages", "chatReads", "expenses",
  "groupStamps", "rallyMemos", "rallySurveys", "rallyPhotos", "rallyRewardGrants",
  "municipalities", "hosts", "listings", "funnelEvents", "businesses",
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];

/** 暫定: 要素型は P-0-2 以降に所有モジュールの型へ置き換える。 */
export type Db = { [K in CollectionName]: Repo<{ id: Id }> };

const ni = (): never => { throw new Error("not implemented"); };

export function db(): Db { return ni(); }
export function tx<T>(fn: (db: Db) => T): T { void fn; return ni(); }
export function resetStore(): void { ni(); }
export function newId(prefix: IdPrefix): Id { void prefix; return ni(); }
