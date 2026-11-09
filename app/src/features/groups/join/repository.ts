// db().joinRequests の読み取り補助(設計 03 §8.1)。
import { db } from "@/lib/groups-store";
import type { Id } from "@/lib/groups-types";
import type { JoinRequest } from "./types";

export function listByGroup(groupId: Id): readonly Readonly<JoinRequest>[] {
  return db().joinRequests.filter((r) => r.groupId === groupId);
}
export function findPendingBy(groupId: Id, applicantId: Id): Readonly<JoinRequest> | undefined {
  return db().joinRequests.find((r) => r.groupId === groupId && r.applicantId === applicantId && r.status === "pending");
}
export function countBy(groupId: Id, applicantId: Id): number {
  return db().joinRequests.count((r) => r.groupId === groupId && r.applicantId === applicantId);
}
