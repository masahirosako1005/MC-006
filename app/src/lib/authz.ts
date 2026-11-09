// 権限ヘルパー(00 第 5.7)。
import { db } from "./groups-store";
import { forbidden, notFound } from "./errors";
import type { DemoUser, Group, GroupMember, Id, UserRole } from "./groups-types";

export type UserRef = Id | { id: Id };
export type GroupRef = Id | { id: Id };
type MemberRoleLike = GroupMember["role"];

const idOf = (r: UserRef | GroupRef): Id => (typeof r === "string" ? r : r.id);

function activeRow(user: UserRef, group: GroupRef): Readonly<GroupMember> | undefined {
  const u = idOf(user);
  const g = idOf(group);
  return db().members.find((m) => m.groupId === g && m.userId === u && m.status === "active");
}

export const isMember = (user: UserRef, group: GroupRef): boolean => activeRow(user, group) !== undefined;
export const isOrganizer = (user: UserRef, group: GroupRef): boolean => activeRow(user, group)?.role === "organizer";
export const memberRole = (user: UserRef, group: GroupRef): MemberRoleLike | null => activeRow(user, group)?.role ?? null;

export const activeMembers = (group: GroupRef): Readonly<GroupMember>[] => {
  const g = idOf(group);
  return db()
    .members.filter((m) => m.groupId === g && m.status === "active")
    .sort((a, b) => (a.joinedAt < b.joinedAt ? -1 : a.joinedAt > b.joinedAt ? 1 : a.id < b.id ? -1 : 1));
};

export const requireGroup = (id: Id): Readonly<Group> => {
  const g = db().groups.get(id);
  if (!g) throw notFound("グループ");
  return g;
};

export const requireMember = (user: UserRef, group: GroupRef): Readonly<GroupMember> => {
  const m = activeRow(user, group);
  if (!m) throw forbidden("グループのメンバーのみができる操作です。");
  return m;
};

export const requireOrganizer = (user: UserRef, group: GroupRef): Readonly<GroupMember> => {
  const m = activeRow(user, group);
  if (!m || m.role !== "organizer") throw forbidden("幹事のみができる操作です。");
  return m;
};

export const requireRole = (user: Readonly<DemoUser>, role: UserRole): void => {
  if (user.role !== role) throw forbidden();
};
