// 状態の表示(設計 04 LCY-FN-10・12)。署名スタブ(P-2-12 で実装)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { GroupCapabilities, GroupLike, LifecycleView } from "./types";

export function getCapabilities(g: GroupLike, user: DemoUser, now?: Date): GroupCapabilities {
  void g; void user; void now;
  throw new Error("not implemented");
}
export function getLifecycleView(user: DemoUser, groupId: Id): LifecycleView {
  void user; void groupId;
  throw new Error("not implemented");
}
