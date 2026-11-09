// 09: グループへのアクセス判定。スタブ(P-2-1)。
import type { Id } from "@/lib/groups-types";
import type { GroupRecord } from "../types";

export function assertGroupAccess(userId: Id, groupId: Id, need: "view" | "member" | "organizer"): GroupRecord {
  void userId; void groupId; void need;
  throw new Error("not implemented");
}

export function assertInGroup<T extends { groupId: Id }>(item: T | undefined, groupId: Id): T {
  void item; void groupId;
  throw new Error("not implemented");
}
