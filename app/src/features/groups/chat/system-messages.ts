// 06 システムメッセージ(CHT-FN-05、13)。postSystemMessage は 06 の内部関数(公開しない)。P-2-18 で実装。
import type { Id } from "@/lib/groups-types";
import type { GroupMessage, SystemEventType } from "./types";

export function postSystemMessage(
  _groupId: Id,
  _event: SystemEventType,
  _subject?: { userId: Id; phase?: "withdrawal" | "leave" },
): GroupMessage | null {
  throw new Error("not implemented");
}

export function renderSystemText(_m: GroupMessage, _resolveName: (userId: Id) => string): string {
  throw new Error("not implemented");
}
