import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/groups-store";
import { AppError } from "@/lib/errors";
import { parse } from "@/lib/validation";
import { insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { USER } from "@/test/fixtures";
import { findSpotByKeyword } from "./catalog";
import { rallyAccess } from "./access";
import { acquireForGroup, groupProgress } from "./stamps";
import { listMyRewards } from "./rewards";
import { keywordSchema } from "./validate";

const G = "g-901";
const u = (id: string) => db().users.getOrThrow(id);

function setup(status: "in_progress" | "completed" | "recruiting" = "in_progress") {
  for (const g of [...db().rallyRewardGrants.list()]) db().rallyRewardGrants.remove(g.id); // seed の付与と (userId, rewardId) が衝突しないように
  insertGroup({ id: G, organizerId: USER.misaki, lifecycle: { status } });
  insertMember(G, USER.kenta);
  insertMember(G, USER.yui);
}

function codeOf(fn: () => unknown): AppError {
  try { fn(); } catch (e) { return e as AppError; }
  throw new Error("expected throw");
}

describe("rally stamps", () => {
  beforeEach(() => resetForTest());

  it("catalog: trim・大文字小文字無視で照合、keyword を返さない", () => {
    const s = findSpotByKeyword("  spot01 ");
    expect(s?.id).toBe(1);
    expect(s).not.toHaveProperty("keyword");
    expect(findSpotByKeyword("nope")).toBeUndefined();
  });

  it("validate: 合言葉の制御文字・空・65 文字を拒否", () => {
    expect(parse(keywordSchema, " SPOT01 ")).toBe("SPOT01");
    expect(() => parse(keywordSchema, "a\nb")).toThrow();
    expect(() => parse(keywordSchema, "  ")).toThrow();
    expect(() => parse(keywordSchema, "a".repeat(65))).toThrow();
    expect(() => parse(keywordSchema, 1)).toThrow();
  });

  it("access: 状態ごとの可否", () => {
    const mk = (status: string) => rallyAccess({ lifecycle: { status } } as never);
    expect(mk("in_progress")).toMatchObject({ canCollectStamps: true, canReviewWrite: true, stampReason: null, reviewReason: null });
    expect(mk("completed")).toMatchObject({ canCollectStamps: false, canReviewWrite: true, stampReason: "finished" });
    expect(mk("confirmed")).toMatchObject({ canCollectStamps: false, stampReason: "not_started", reviewReason: "not_started" });
    expect(mk("min_reached")).toMatchObject({ stampReason: "recruiting" });
    expect(mk("cancelled")).toMatchObject({ stampReason: "cancelled", reviewReason: "cancelled" });
  });

  it("取得 → 達成率・重複拒否・特典を全員に付与", () => {
    setup();
    const r1 = acquireForGroup(u(USER.kenta), G, " spot01");
    expect(r1.acquiredCount).toBe(1);
    expect(r1.achievementRate).toBe(14);
    expect(r1.newlyReached).toHaveLength(0);

    const dup = codeOf(() => acquireForGroup(u(USER.yui), G, "SPOT01"));
    expect(dup.code).toBe("conflict");
    expect(dup.reason).toBe("already_acquired");

    acquireForGroup(u(USER.kenta), G, "SPOT02");
    const r3 = acquireForGroup(u(USER.yui), G, "SPOT03");
    expect(r3.newlyReached.map((r) => r.rewardId)).toEqual([1]);
    expect(r3.myNewRewards.map((r) => r.rewardId)).toEqual([1]);
    // 押印していない幹事にも付与
    expect(listMyRewards(USER.misaki, G).map((r) => r.rewardId)).toEqual([1]);

    const p = groupProgress(u(USER.misaki), G);
    expect(p.acquiredCount).toBe(3);
    expect(p.rewards.filter((r) => r.reached)).toHaveLength(1);
    expect(p.members.find((m) => m.isMe)?.count).toBe(0);
    expect(p.members.reduce((a, m) => a + m.count, 0)).toBe(3);
    expect(p.myRewards[0].fromThisGroup).toBe(true);
  });

  it("拒否: 不一致の合言葉は invalid_code、取得不可の状態は unavailable_state", () => {
    setup();
    const bad = codeOf(() => acquireForGroup(u(USER.kenta), G, "WRONG"));
    expect(bad.code).toBe("invalid_input");
    expect(bad.reason).toBe("invalid_code");
    expect(db().groupStamps.count((s) => s.groupId === G)).toBe(0);

    db().groups.update(G, { lifecycle: { ...db().groups.getOrThrow(G).lifecycle, status: "completed" } });
    const e = codeOf(() => acquireForGroup(u(USER.kenta), G, "SPOT01"));
    expect(e.code).toBe("unavailable_state");
    expect(e.reason).toBe("finished");
  });

  it("拒否: 非メンバー(公開)は forbidden", () => {
    setup();
    const e = codeOf(() => acquireForGroup(u(USER.daisuke), G, "SPOT01"));
    expect(e.code).toBe("forbidden");
  });
});
