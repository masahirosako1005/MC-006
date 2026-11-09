import { beforeEach, describe, expect, it } from "vitest";
import { clock } from "@/lib/clock";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import { BLOCK_SAMPLE, GROUP_BY_STATUS, UNDERAGE_USER, UNVERIFIED_USER, USER } from "@/test/fixtures";
import { insertBlock, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { assertInGroup, assertGroupAccess } from "./access";
import { checkRate } from "./rate-limit";
import { blockUser, filterVisibleMessages, isBlocked, isBlockedByMe } from "../blocks/block-service";
import { requireVerified, setMockVerification } from "../verification/verification-service";
import { ageBandsOf, formatMemberSummary, memberSummary } from "../visibility/summary";

function code(fn: () => unknown): AppError {
  try { fn(); } catch (e) { return e as AppError; }
  throw new Error("did not throw");
}

beforeEach(() => resetForTest());

describe("summary (SAF-T-10〜15)", () => {
  it("3 人は年代を隠す、4 人は丸める", () => {
    const s3 = memberSummary([{ ageBand: "30s" }, { ageBand: "40s" }, { ageBand: "50s" }]);
    expect(s3).toEqual({ count: 3, buckets: null, hiddenReason: "few_members" });
    expect(formatMemberSummary(s3)).toBe("参加者 3 人(人数が少ないため年代は表示しません)");
    const s4 = memberSummary([{ ageBand: "30s" }, { ageBand: "40s" }, { ageBand: "50s" }, { ageBand: "50s" }]);
    expect(s4.buckets).toEqual(["30-40s", "50-60s"]);
    expect(formatMemberSummary(s4)).toBe("参加者 4 人(30〜40代、50〜60代)");
  });
  it("ageBandsOf は指定順", () => {
    expect(ageBandsOf([USER.misaki, USER.sota, USER.hinata])).toEqual([{ ageBand: "30s" }, { ageBand: "20s" }, { ageBand: "18-19" }]);
  });
});

describe("blocks (SAF-T-20, 24)", () => {
  it("双方向・一方向・メッセージ除外", () => {
    const { blockerId, blockedId } = BLOCK_SAMPLE;
    expect(isBlocked(blockerId, blockedId)).toBe(true);
    expect(isBlocked(blockedId, blockerId)).toBe(true);
    expect(isBlockedByMe(blockerId, blockedId)).toBe(true);
    expect(isBlockedByMe(blockedId, blockerId)).toBe(false);
    const msgs = [{ senderId: blockedId }, { senderId: blockerId }, { senderId: null }];
    expect(filterVisibleMessages(blockerId, msgs)).toHaveLength(2);
    expect(filterVisibleMessages(blockedId, msgs)).toHaveLength(3);
  });
  it("blockUser: 新規・重複・自分自身", () => {
    const me = db().users.getOrThrow(USER.kenta);
    expect(blockUser(me, USER.yui).created).toBe(true);
    expect(blockUser(me, USER.yui).created).toBe(false);
    expect(code(() => blockUser(me, USER.kenta)).code).toBe("invalid_input");
  });
});

describe("verification (SAF-T-53)", () => {
  it("確認済み・未確認・18歳未満", () => {
    expect(() => requireVerified(USER.daisuke, "request_join")).not.toThrow();
    expect(code(() => requireVerified(UNVERIFIED_USER, "create_group")).reason).toBe("not_verified");
    expect(code(() => requireVerified(UNDERAGE_USER, "create_group")).reason).toBe("underage");
    setMockVerification(UNVERIFIED_USER, "adult");
    expect(() => requireVerified(UNVERIFIED_USER, "create_group")).not.toThrow();
    setMockVerification(UNVERIFIED_USER, "reset");
    expect(code(() => requireVerified(UNVERIFIED_USER, "create_group")).reason).toBe("not_verified");
  });
});

describe("access (SAF-T-44, 45)", () => {
  it("幹事・メンバー・非メンバー・非公開・ブロック・不在", () => {
    const gid = GROUP_BY_STATUS.recruiting;
    const g = db().groups.getOrThrow(gid);
    expect(assertGroupAccess(g.organizerId, gid, "organizer").id).toBe(gid);
    const g2 = insertGroup({ id: "g-901", organizerId: USER.kenta });
    insertMember(g2.id, USER.yui, "member");
    expect(code(() => assertGroupAccess(USER.yui, g2.id, "organizer")).code).toBe("forbidden");
    expect(assertGroupAccess(USER.daisuke, g2.id, "view").id).toBe(g2.id);
    expect(code(() => assertGroupAccess(USER.daisuke, g2.id, "member")).code).toBe("forbidden");
    insertBlock(USER.daisuke, USER.yui);
    expect(code(() => assertGroupAccess(USER.daisuke, g2.id, "view")).code).toBe("not_found");
    const priv = insertGroup({ id: "g-902", organizerId: USER.kenta, visibility: "private" });
    expect(code(() => assertGroupAccess(USER.haruka, priv.id, "view")).code).toBe("not_found");
    expect(code(() => assertGroupAccess(USER.haruka, "g-999", "view")).code).toBe("not_found");
  });
  it("assertInGroup", () => {
    expect(code(() => assertInGroup({ groupId: "g-902" }, "g-901")).code).toBe("not_found");
    expect(code(() => assertInGroup(undefined, "g-901")).code).toBe("not_found");
    const it1 = { groupId: "g-901" };
    expect(assertInGroup(it1, "g-901")).toBe(it1);
  });
});

describe("rate limit (SAF-T-46)", () => {
  it("11 回目は拒否、60 秒後に解除、キーは独立", () => {
    for (let i = 0; i < 10; i++) checkRate("chat_post", USER.misaki, "g-901");
    const e = code(() => checkRate("chat_post", USER.misaki, "g-901"));
    expect(e.code).toBe("rate_limited");
    expect(e.detail?.retryAfterSec).toBeGreaterThan(0);
    expect(() => checkRate("chat_post", USER.misaki, "g-902")).not.toThrow();
    expect(() => checkRate("chat_post", USER.kenta, "g-901")).not.toThrow();
    clock.set(new Date(clock.now().getTime() + 60_000).toISOString());
    expect(() => checkRate("chat_post", USER.misaki, "g-901")).not.toThrow();
  });
});
