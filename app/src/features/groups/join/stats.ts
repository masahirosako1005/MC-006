// 申請件数・申請中の有無(JOIN-FN-11)。署名スタブ(P-2-7 で実装)。
import type { Id } from "@/lib/groups-types";

export function countPendingRequests(groupId: Id): number { void groupId; throw new Error("not implemented"); }
export function hasPendingRequest(userId: Id, groupId: Id): boolean {
  void userId; void groupId; throw new Error("not implemented");
}
