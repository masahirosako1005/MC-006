// 09: グループへのアクセス判定(設計 10.4)。
import { forbidden, notFound } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import type { Id } from "@/lib/groups-types";
import { isBlocked } from "../blocks/block-service";
import type { GroupRecord } from "../types";

export function assertGroupAccess(userId: Id, groupId: Id, need: "view" | "member" | "organizer"): GroupRecord {
  const group = db().groups.get(groupId);
  if (!group) throw notFound("グループ");
  const active = db().members.filter((m) => m.groupId === groupId && m.status === "active");
  const mine = active.find((m) => m.userId === userId);
  if (mine) {
    if (need === "organizer" && mine.role !== "organizer" && group.organizerId !== userId) throw forbidden();
    return group;
  }
  if (group.visibility === "private") throw notFound("グループ");
  if (active.some((m) => isBlocked(userId, m.userId)) || isBlocked(userId, group.organizerId)) throw notFound("グループ");
  if (need === "view") return group;
  throw forbidden();
}

export function assertInGroup<T extends { groupId: Id }>(item: T | undefined, groupId: Id): T {
  if (!item || item.groupId !== groupId) throw notFound();
  return item;
}
