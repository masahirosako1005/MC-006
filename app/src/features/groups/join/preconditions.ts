// 申請の前提条件(JOIN-FN-01)。署名スタブ(P-2-7 で実装)。
import type { DemoUser } from "@/lib/groups-types";
import type { ErrorBody } from "@/lib/errors";
import type { Group } from "@/features/groups/types";

export function checkCanRequest(
  user: DemoUser,
  group: Group,
  input: { inviteCode?: string; consentedMinMembers?: number },
): { ok: true } | { ok: false; error: ErrorBody } {
  void user; void group; void input;
  throw new Error("not implemented");
}
