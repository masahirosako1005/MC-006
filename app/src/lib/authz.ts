// 権限ヘルパー(00 第 5.7)。署名スタブ(P-1-2 以降で実装)。
// Group・GroupMember・MemberRole の型は 01 の types.ts が揃う P-0-2 で差し替える。
import type { DemoUser, Id, UserRole } from "./groups-types";

export type UserRef = Id | { id: Id };
export type GroupRef = Id | { id: Id };
type GroupLike = { id: Id; [k: string]: unknown };
type MemberLike = { id: Id; [k: string]: unknown };
type MemberRoleLike = string;

const ni = (): never => { throw new Error("not implemented"); };

export const isMember = (user: UserRef, group: GroupRef): boolean => { void user; void group; return ni(); };
export const isOrganizer = (user: UserRef, group: GroupRef): boolean => { void user; void group; return ni(); };
export const memberRole = (user: UserRef, group: GroupRef): MemberRoleLike | null => { void user; void group; return ni(); };
export const activeMembers = (group: GroupRef): Readonly<MemberLike>[] => { void group; return ni(); };
export const requireGroup = (id: Id): Readonly<GroupLike> => { void id; return ni(); };
export const requireMember = (user: UserRef, group: GroupRef): Readonly<MemberLike> => { void user; void group; return ni(); };
export const requireOrganizer = (user: UserRef, group: GroupRef): Readonly<MemberLike> => { void user; void group; return ni(); };
export const requireRole = (user: Readonly<DemoUser>, role: UserRole): void => { void user; void role; ni(); };
