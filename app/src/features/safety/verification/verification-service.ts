// 09: 本人確認(モック)。スタブ(P-2-1)。
import type { Id } from "@/lib/groups-types";
import type { Verification, VerifiedAction } from "../types";

export function getVerification(userId: Id): Verification {
  void userId;
  throw new Error("not implemented");
}

export function setMockVerification(userId: Id, declared: "adult" | "minor" | "reset"): Verification {
  void userId; void declared;
  throw new Error("not implemented");
}

export function requireVerified(userId: Id, action: VerifiedAction): void {
  void userId; void action;
  throw new Error("not implemented");
}
