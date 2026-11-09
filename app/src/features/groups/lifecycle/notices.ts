// 遷移・操作 → 10 の notify 入力の組み立て(設計 04 §5.7)。署名スタブ(P-2-10 で実装)。
import type { Id } from "@/lib/groups-types";
import type { CancelReasonCode, GroupStatus } from "./types";

export function noticeForTransition(groupId: Id, from: GroupStatus, to: GroupStatus, cancelReason: CancelReasonCode | null): void {
  void groupId; void from; void to; void cancelReason;
  throw new Error("not implemented");
}
