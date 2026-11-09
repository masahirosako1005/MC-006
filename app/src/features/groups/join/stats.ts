// 申請件数・申請中の有無(JOIN-FN-11)。
import { db } from "@/lib/groups-store";
import type { Id } from "@/lib/groups-types";

export function countPendingRequests(groupId: Id): number {
  return db().joinRequests.count((r) => r.groupId === groupId && r.status === "pending");
}
export function hasPendingRequest(userId: Id, groupId: Id): boolean {
  return db().joinRequests.count((r) => r.groupId === groupId && r.applicantId === userId && r.status === "pending") > 0;
}
