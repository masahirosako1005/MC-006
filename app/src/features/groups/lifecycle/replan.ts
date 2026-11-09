// 再企画(設計 04 LCY-FN-16・17)。署名スタブ(P-2-12 で実装)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { ReplanDraft, ReplanInput, ReplanResult } from "./types";

export function getReplanDraft(user: DemoUser, groupId: Id): ReplanDraft {
  void user; void groupId;
  throw new Error("not implemented");
}
export function replan(user: DemoUser, groupId: Id, input: ReplanInput): ReplanResult {
  void user; void groupId; void input;
  throw new Error("not implemented");
}
