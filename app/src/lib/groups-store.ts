// ストア本体(00 第 5.1)。
import type {
  Id, DemoUser, Profile, Verification, Block, Report, Region, Group, GroupMember, JoinRequest, Withdrawal,
  GroupStatusLog, GroupNotification, GroupPlan, GroupMessage, ChatReadMark, ExpenseNote, GroupStamp, ReviewMemo,
  SurveyAnswer, PhotoPost, RallyRewardGrant, Municipality, LocalHost, Listing, FunnelEvent, TourismBusiness,
} from "./groups-types";
import type { IdPrefix } from "./ids";
import { ID_PREFIXES } from "./ids";
import groupSeedJson from "@/data/group-seed.json";
import { parseSeed, withFutureTrips } from "./group-seed";
import { clock } from "./clock";
import { runHooks } from "./hooks";
import { notFound } from "./errors";

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

export interface DbTypes {
  users: DemoUser; profiles: Profile; verifications: Verification; blocks: Block; reports: Report;
  regions: Region; groups: Group; members: GroupMember; joinRequests: JoinRequest;
  withdrawals: Withdrawal; groupStatusLogs: GroupStatusLog; notifications: GroupNotification;
  plans: GroupPlan; messages: GroupMessage; chatReads: ChatReadMark; expenses: ExpenseNote;
  groupStamps: GroupStamp; rallyMemos: ReviewMemo; rallySurveys: SurveyAnswer; rallyPhotos: PhotoPost;
  rallyRewardGrants: RallyRewardGrant; municipalities: Municipality; hosts: LocalHost; listings: Listing;
  funnelEvents: FunnelEvent; businesses: TourismBusiness;
}
export type Db = { [K in CollectionName]: Repo<DbTypes[K]> };

type Counters = Record<IdPrefix, number>;
type Store = { [K in CollectionName]: DbTypes[K][] } & { counters: Counters };

// 採番接頭辞 → 最大連番を拾うコレクション(plans・profiles などは親 ID なので対象外)
const COUNTER_SOURCES: Partial<Record<IdPrefix, CollectionName>> = {
  u: "users", g: "groups", m: "members", jr: "joinRequests", wd: "withdrawals", sl: "groupStatusLogs",
  n: "notifications", msg: "messages", ex: "expenses", gs: "groupStamps", rm: "rallyMemos", rs: "rallySurveys",
  ph: "rallyPhotos", rg: "rallyRewardGrants", rp: "reports", bl: "blocks", fe: "funnelEvents",
};

const g = globalThis as unknown as { __groupsStore?: Store; __groupsTxDepth?: number };
const asRec = (x: unknown) => x as Record<string, unknown>;

function buildStore(futureTrips: boolean): Store {
  const raw = futureTrips ? withFutureTrips(groupSeedJson) : groupSeedJson;
  const seed = asRec(structuredClone(parseSeed(raw)));
  const store = { counters: {} as Counters } as Store;
  for (const name of COLLECTION_NAMES) asRec(store)[name] = (seed[name] as unknown[]) ?? [];
  for (const p of ID_PREFIXES) {
    let max = 0;
    const coll = COUNTER_SOURCES[p];
    if (coll) {
      for (const e of store[coll] as { id: Id }[]) {
        const m = /^([a-z]+)-(\d+)$/.exec(e.id);
        if (m && m[1] === p) max = Math.max(max, Number(m[2]));
      }
    }
    store.counters[p] = max;
  }
  return store;
}

// 試験(NODE_ENV=test)は未来日程を含めない。実行時は含める(INS-C-07)。
const defaultFuture = () => process.env.NODE_ENV !== "test";
const store = (): Store => (g.__groupsStore ??= buildStore(defaultFuture()));

function makeRepo<K extends CollectionName>(name: K): Repo<DbTypes[K]> {
  type T = DbTypes[K];
  const arr = (): T[] => store()[name] as T[];
  const get = (id: Id) => arr().find((x) => x.id === id);
  return {
    list: () => arr(),
    get,
    getOrThrow: (id, label) => {
      const r = get(id);
      if (!r) throw notFound(label);
      return r;
    },
    find: (pred) => arr().find(pred),
    filter: (pred) => arr().filter(pred),
    count: (pred) => (pred ? arr().filter(pred).length : arr().length),
    insert: (entity) => {
      if (get(entity.id)) throw new Error(`duplicate id: ${name}/${entity.id}`);
      arr().push(entity);
      return entity;
    },
    update: (id, patch) => {
      const a = arr();
      const i = a.findIndex((x) => x.id === id);
      if (i < 0) throw notFound();
      const next = { ...a[i], ...patch, id } as T;
      a[i] = next;
      return next;
    },
    remove: (id) => {
      const a = arr();
      const i = a.findIndex((x) => x.id === id);
      if (i < 0) return false;
      a.splice(i, 1);
      return true;
    },
  };
}

const repos = {} as Db;
for (const n of COLLECTION_NAMES) asRec(repos)[n] = makeRepo(n);

export function db(): Db {
  store();
  return repos;
}

export function tx<T>(fn: (db: Db) => T): T {
  const s = store();
  if ((g.__groupsTxDepth ?? 0) > 0) return fn(repos); // 入れ子は外側に合流
  const snap = structuredClone(s);
  g.__groupsTxDepth = 1;
  try {
    const r = fn(repos);
    if (r && typeof (r as { then?: unknown }).then === "function") {
      throw new Error("tx: fn must be synchronous (do not await inside tx)");
    }
    return r;
  } catch (e) {
    for (const n of COLLECTION_NAMES) asRec(s)[n] = asRec(snap)[n];
    s.counters = snap.counters;
    throw e;
  } finally {
    g.__groupsTxDepth = 0;
  }
}

export function resetStore(opts?: { futureTrips?: boolean }): void {
  g.__groupsTxDepth = 0;
  g.__groupsStore = buildStore(opts?.futureTrips ?? defaultFuture());
  clock.reset();
  runHooks("afterReset");
}

export function newId(prefix: IdPrefix): Id {
  if (!(ID_PREFIXES as readonly string[]).includes(prefix)) throw new Error(`unknown id prefix: ${prefix}`);
  const c = store().counters;
  c[prefix] += 1;
  return `${prefix}-${String(c[prefix]).padStart(3, "0")}`;
}
