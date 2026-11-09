// 10: 宛先の解決。スタブ(P-2-13)。
import type { Id } from "@/lib/groups-types";
import type { RecipientSpec } from "./types";

export function resolveRecipients(groupId: Id, specs: RecipientSpec[]): Id[] {
  void groupId; void specs;
  throw new Error("not implemented");
}
