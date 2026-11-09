// 06 のドメインイベント購読の登録(CHT-FN-09)。bootstrap.ts から import される。
import { on } from "@/lib/events";
import type { Id } from "@/lib/groups-types";
import { postSystemMessage } from "./system-messages";
import type { SystemEventType } from "./types";

const STATE_EVENTS: Record<string, SystemEventType> = {
  min_reached: "state_min_reached",
  confirmed: "state_confirmed",
  cancelled: "state_cancelled",
  in_progress: "state_started",
  completed: "state_completed",
  replanned: "state_replanned",
};

// 例外は外へ出さない(状態変更を巻き戻さない)。ID とエラーコードだけを記録する。
function safe(groupId: Id, fn: () => unknown): void {
  try {
    fn();
  } catch (e) {
    const code = (e as { code?: string } | null)?.code ?? "error";
    console.error("[chat] system message failed", groupId, code);
  }
}

export function registerChatSubscribers(): void {
  on("group_created", "chat", (e) => safe(e.groupId, () => postSystemMessage(e.groupId, "group_created")));
  on("member_joined", "chat", (e) =>
    safe(e.groupId, () => postSystemMessage(e.groupId, "member_joined", { userId: e.userId })));
  on("member_left", "chat", (e) =>
    safe(e.groupId, () =>
      postSystemMessage(e.groupId, "member_left", {
        userId: e.userId,
        phase: e.phase === "confirmed" || e.phase === "in_progress" ? "leave" : "withdrawal",
      })));
  on("status_changed", "chat", (e) => {
    const ev = STATE_EVENTS[e.to];
    if (ev) safe(e.groupId, () => postSystemMessage(e.groupId, ev));
  });
}

registerChatSubscribers();
