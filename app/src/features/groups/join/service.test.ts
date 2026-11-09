import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { AppError } from "@/lib/errors";
import { insertBlock, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { USER } from "@/test/fixtures";
import type { DemoUser } from "@/lib/groups-types";

// 同じ波の他タスクの関数は署名に合わせて代替する。
vi.mock("@/features/groups/lifecycle/policy", () => ({ canAcceptRequests: vi.fn(() => true) }));
vi.mock("@/features/groups/lifecycle/rules", () => ({ notAcceptingReason: vi.fn(() => "closed_deadline") }));
vi.mock("@/features/groups/lifecycle/evaluate", () => ({ onMembershipChanged: vi.fn() }));
vi.mock("@/features/groups/core/service", () => ({
  assertInviteCode: vi.fn(),
  countActiveMembers: (groupId: string) => db().members.count((m) => m.groupId === groupId && m.status === "active"),
  addMember: (groupId: string, userId: string) =>
    db().members.insert({
      id: `m-test-${userId}-${groupId}`, groupId, userId, role: "member", status: "active",
      joinedAt: "2026-11-09T00:00:00+09:00", leftAt: null,
    }),
}));
vi.mock("@/features/notify/service", () => ({ notify: vi.fn() }));
vi.mock("@/features/safety/guards/rate-limit", () => ({ checkRate: vi.fn() }));
vi.mock("@/features/safety/text/check-text", () => ({ assertTextAllowed: vi.fn() }));
vi.mock("@/features/safety/verification/verification-service", () => ({ requireVerified: vi.fn() }));
vi.mock("@/features/safety/blocks/block-service", () => {
  const isBlocked = (a: string, b: string) =>
    db().blocks.count((x) => x.releasedAt === null && ((x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))) > 0;
  return {
    isBlocked,
    assertNotBlocked: (a: string, b: string) => {
      if (isBlocked(a, b)) throw new AppError("blocked", "この操作は行えません。");
    },
  };
});
vi.mock("@/features/safety/visibility/profile", () => ({
  visibleProfile: (_v: unknown, id: string) => ({ userId: id }),
}));

import { notify } from "@/features/notify/service";
import { canAcceptRequests } from "@/features/groups/lifecycle/policy";
import { approve, listRequests, reject, requestJoin, withdrawRequest } from "./service";
import { hasPendingRequest } from "./stats";

const user = (id: string) => ({ id }) as DemoUser;
const input = { note: "よろしく", consentMinMembers: true, consentedMinMembers: 2 };

function code(fn: () => unknown): string | undefined {
  try { fn(); } catch (e) { return e instanceof AppError ? (e.reason ?? e.code) : "other"; }
  return undefined;
}

describe("join service", () => {
  let gid: string;
  beforeEach(() => {
    resetForTest();
    vi.mocked(canAcceptRequests).mockReturnValue(true);
    vi.mocked(notify).mockClear();
    gid = insertGroup({ organizerId: USER.misaki, capacity: 3 }).id;
  });

  it("T-01 申請して幹事へ通知する", () => {
    const r = requestJoin(user(USER.kenta), gid, input);
    expect(r.status).toBe("pending");
    expect(r.consentAt).not.toBeNull();
    expect(hasPendingRequest(USER.kenta, gid)).toBe(true);
    expect(vi.mocked(notify).mock.calls[0][0].kind).toBe("join_requested");
  });

  it("重複申請は duplicate_request", () => {
    requestJoin(user(USER.kenta), gid, input);
    expect(code(() => requestJoin(user(USER.kenta), gid, input))).toBe("duplicate_request");
  });

  it("受付対象外は unavailable_state", () => {
    vi.mocked(canAcceptRequests).mockReturnValue(false);
    expect(code(() => requestJoin(user(USER.kenta), gid, input))).toBe("closed_deadline");
  });

  it("T-02 承認でメンバー追加", () => {
    const r = requestJoin(user(USER.kenta), gid, input);
    const res = approve(user(USER.misaki), gid, r.id);
    expect(res.memberAdded).toBe(true);
    expect(res.currentMembers).toBe(2);
    expect(res.request.status).toBe("approved");
    expect(approve(user(USER.misaki), gid, r.id).memberAdded).toBe(false); // 冪等
  });

  it("T-23 定員なら group_full、幹事以外は not_organizer", () => {
    const r = requestJoin(user(USER.kenta), gid, input);
    expect(code(() => approve(user(USER.yui), gid, r.id))).toBe("not_organizer");
    insertMember(gid, USER.yui);
    insertMember(gid, USER.daisuke);
    expect(code(() => approve(user(USER.misaki), gid, r.id))).toBe("group_full");
  });

  it("T-03 却下と T-04 取り下げ", () => {
    const r1 = requestJoin(user(USER.kenta), gid, input);
    const rej = reject(user(USER.misaki), gid, r1.id, "plan_mismatch");
    expect(rej.status).toBe("rejected");
    expect(rej.reasonId).toBe("plan_mismatch");
    expect(code(() => requestJoin(user(USER.kenta), gid, input))).toBe("already_rejected");

    const r2 = requestJoin(user(USER.yui), gid, input);
    expect(code(() => withdrawRequest(user(USER.kenta), gid, r2.id))).toBe("not_applicant");
    expect(withdrawRequest(user(USER.yui), gid, r2.id).status).toBe("withdrawn");
    expect(code(() => approve(user(USER.misaki), gid, r2.id))).toBe("request_not_pending");
  });

  it("T-33 一覧はブロック関係を除く", () => {
    requestJoin(user(USER.kenta), gid, input);
    requestJoin(user(USER.yui), gid, input);
    insertBlock(USER.misaki, USER.yui);
    const list = listRequests(user(USER.misaki), gid);
    expect(list.items).toHaveLength(1);
    expect(list.pendingCount).toBe(2);
    expect(list.items[0].canApprove).toBe(true);
  });
});
