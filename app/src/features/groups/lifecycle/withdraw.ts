// 辞退・退会(設計 04 LCY-FN-13)。署名スタブ(P-2-11 で実装)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { WithdrawResult } from "./types";

export function withdraw(user: DemoUser, groupId: Id, now?: Date): WithdrawResult {
  void user; void groupId; void now;
  throw new Error("not implemented");
}
