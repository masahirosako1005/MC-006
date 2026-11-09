// 基本型・DemoUser・共通 DTO(00 第 4.2。INS-C-01)。
// 各モジュールの型の再エクスポート(Group、Profile ほか)は、所有モジュールの types.ts が揃う P-0-2 で追記する。
export { ID_PREFIXES, SLUG_PREFIXES } from "./ids";
export type { IdPrefix, SlugPrefix } from "./ids";

export type Id = string;
export type DateStr = string;
export type IsoDateTime = string;

export type UserRole = "traveler" | "municipal" | "host" | "business_owner";
export interface DemoUser {
  id: Id;
  displayName: string;
  role: UserRole;
  municipalityId?: string;      // role=municipal のとき必須
  hostId?: string;              // role=host のとき必須
  businessId?: string;          // role=business_owner のとき必須。TourismBusiness.id(biz-<slug>)
  background?: boolean;         // 未来日程の背景ユーザー。デモバーの切替候補に出さない
}

export interface Page<T> { items: T[]; total: number; limit: number; offset: number; hasMore: boolean; }
export interface CursorPage<T> { items: T[]; nextCursor: string | null; }
export type DemoUserSummary = Pick<DemoUser, "id" | "displayName" | "role">;
export interface ClockInfo { nowIso: IsoDateTime; today: DateStr; mode: "live" | "frozen"; shiftedDays: number; }
export interface MeResponse { user: DemoUserSummary; clock: ClockInfo; tools: boolean; }
