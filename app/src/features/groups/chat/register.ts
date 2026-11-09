// 06 のドメインイベント購読の登録(CHT-FN-09)。bootstrap.ts から import される。
// 各購読は P-2-18 で postSystemMessage を呼ぶ本体に置き換える。
import { on } from "@/lib/events";

export function registerChatSubscribers(): void {
  on("group_created", "chat", () => {});
  on("member_joined", "chat", () => {});
  on("member_left", "chat", () => {});
  on("status_changed", "chat", () => {});
}

registerChatSubscribers();
