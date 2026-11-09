// ストア本体(00 第 5.1)。署名スタブ(P-1-1 で実装)。
// 各モジュールの型(Group ほか)が揃う P-0-2 以降に、コレクションの要素型を所有モジュールの型へ置き換える。
import type {
  Id, DemoUser, Profile, Verification, Block, Report, Region, Group, GroupMember, JoinRequest, Withdrawal,
  GroupStatusLog, GroupNotification, GroupPlan, GroupMessage, ChatReadMark, ExpenseNote, GroupStamp, ReviewMemo,
  SurveyAnswer, PhotoPost, RallyRewardGrant, Municipality, LocalHost, Listing, FunnelEvent, TourismBusiness,
} from "./groups-types";
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

const ni = (): never => { throw new Error("not implemented"); };

export function db(): Db { return ni(); }
export function tx<T>(fn: (db: Db) => T): T { void fn; return ni(); }
export function resetStore(): void { ni(); }
export function newId(prefix: IdPrefix): Id { void prefix; return ni(); }
