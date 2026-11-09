// db().joinRequests の読み取り補助(設計 03 §8.1)。署名スタブ(P-2-7 で実装)。
import type { Id } from "@/lib/groups-types";
import type { JoinRequest } from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function listByGroup(groupId: Id): readonly Readonly<JoinRequest>[] { void groupId; return ni(); }
export function findPendingBy(groupId: Id, applicantId: Id): Readonly<JoinRequest> | undefined {
  void groupId; void applicantId; return ni();
}
export function countBy(groupId: Id, applicantId: Id): number { void groupId; void applicantId; return ni(); }
