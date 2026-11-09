// 申請の前提条件(JOIN-FN-01)。第 7.1 節の 1〜3、6〜12。
import type { DemoUser } from "@/lib/groups-types";
import { AppError, conflict, toErrorBody, unavailableState } from "@/lib/errors";
import type { ErrorBody } from "@/lib/errors";
import { isMember } from "@/lib/authz";
import type { Group } from "@/features/groups/types";
import { canAcceptRequests } from "@/features/groups/lifecycle/policy";
import { notAcceptingReason } from "@/features/groups/lifecycle/rules";
import { assertInviteCode, countActiveMembers } from "@/features/groups/core/service";
import { requireVerified } from "@/features/safety/verification/verification-service";
import { assertNotBlocked } from "@/features/safety/blocks/block-service";
import { MAX_REQUESTS_PER_GROUP } from "./constants";
import { JOIN_ERRORS } from "./messages";
import { countBy, findPendingBy, listByGroup } from "./repository";

export interface CheckOpts {
  inviteCode?: string;
  consentedMinMembers?: number;
  /** 順 3 と順 6 の間(頻度制限・内容検査)に実行する処理。 */
  between?: () => void;
  /** 申請済みの本人が自分の申請状態を見る場合など、可視性の検査を省く。 */
  skipVisibility?: boolean;
}

/** 例外を投げる版。requestJoin が使う。 */
export function assertCanRequest(user: DemoUser, group: Group, opts: CheckOpts): void {
  // 1 存在を隠す
  if (!opts.skipVisibility && group.visibility !== "public") {
    try {
      assertInviteCode(group.id, opts.inviteCode ?? "");
    } catch {
      throw new AppError("not_found", JOIN_ERRORS.group_not_found, { reason: "group_not_found" });
    }
  }
  // 2〜3
  requireVerified(user.id, "request_join");
  assertNotBlocked(user.id, group.organizerId);
  opts.between?.();
  // 6
  if (isMember(user, group)) throw conflict(JOIN_ERRORS.already_member, { reason: "already_member" });
  // 7
  const pending = findPendingBy(group.id, user.id);
  if (pending) {
    throw conflict(JOIN_ERRORS.duplicate_request, { reason: "duplicate_request", detail: { existingRequestId: pending.id } });
  }
  // 8
  if (listByGroup(group.id).some((r) => r.applicantId === user.id && r.status === "rejected")) {
    throw conflict(JOIN_ERRORS.already_rejected, { reason: "already_rejected" });
  }
  // 9
  if (countBy(group.id, user.id) >= MAX_REQUESTS_PER_GROUP) {
    throw conflict(JOIN_ERRORS.request_limit, { reason: "request_limit" });
  }
  // 10
  if (!canAcceptRequests(group)) {
    throw unavailableState(JOIN_ERRORS.closed, {
      reason: notAcceptingReason(group) ?? undefined,
      detail: { state: group.lifecycle.status },
    });
  }
  // 11
  if (countActiveMembers(group.id) >= group.capacity) {
    throw conflict(JOIN_ERRORS.group_full, { reason: "group_full" });
  }
  // 12
  if (opts.consentedMinMembers !== undefined && opts.consentedMinMembers !== group.lifecycle.minMembers) {
    throw conflict(JOIN_ERRORS.condition_changed, { reason: "condition_changed" });
  }
}

export function checkWith(user: DemoUser, group: Group, opts: CheckOpts): { ok: true } | { ok: false; error: ErrorBody } {
  try {
    assertCanRequest(user, group, opts);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: toErrorBody(e).body };
    throw e;
  }
}

export function checkCanRequest(
  user: DemoUser,
  group: Group,
  input: { inviteCode?: string; consentedMinMembers?: number },
): { ok: true } | { ok: false; error: ErrorBody } {
  return checkWith(user, group, input);
}
