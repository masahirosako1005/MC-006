// 09: 本人確認(モック)。
import { clock } from "@/lib/clock";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import type { Id } from "@/lib/groups-types";
import type { Verification, VerifiedAction } from "../types";

export function getVerification(userId: Id): Verification {
  const v = db().verifications.get(userId);
  if (v) return v;
  return { id: userId, userId, status: "unverified", method: "mock_self_declaration", confirmedAt: null };
}

export function setMockVerification(userId: Id, declared: "adult" | "minor" | "reset"): Verification {
  const status = declared === "adult" ? "verified" : declared === "minor" ? "underage" : "unverified";
  const next: Verification = {
    id: userId,
    userId,
    status,
    method: "mock_self_declaration",
    confirmedAt: declared === "reset" ? null : clock.nowIso(),
  };
  const repo = db().verifications;
  if (repo.get(userId)) return repo.update(userId, next);
  return repo.insert(next);
}

export function requireVerified(userId: Id, action: VerifiedAction): void {
  void action;
  const v = getVerification(userId);
  if (v.status === "verified") return;
  if (v.status === "underage") {
    throw new AppError("forbidden", "このサービスは18歳以上の方が対象です。", { reason: "underage" });
  }
  throw new AppError("forbidden", "本人確認(モック)が必要です。", { reason: "not_verified" });
}
