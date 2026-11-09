import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import { on } from "@/lib/events";
import { AppError } from "@/lib/errors";
import { callRoute, insertBlock, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type { DemoUser } from "@/lib/groups-types";

// 09 は同じ波の別タスク。ここでは最小の代替を使う。
vi.mock("@/features/safety/guards/access", async () => {
  const authz = await import("@/lib/authz");
  const { notFound, forbidden } = await import("@/lib/errors");
  return {
    assertGroupAccess: (userId: string, groupId: string, need: "view" | "member" | "organizer") => {
      const g = authz.requireGroup(groupId);
      if (need === "organizer") authz.requireOrganizer(userId, groupId);
      else if (need === "member" && !authz.isMember(userId, groupId)) {
        if (g.visibility === "private") throw notFound("グループ");
        throw forbidden();
      }
      return g;
    },
  };
});
vi.mock("@/features/safety/visibility/profile", () => ({
  visibleProfile: (_v: unknown, targetId: string) => ({ userId: targetId, displayName: `表示名-${targetId}` }),
}));

import {
  addMember, applyLifecyclePatch, assertInviteCode, createGroup, createGroupInternal, findGroupByInviteCode,
  getGroup, getInviteCode, issueInviteCode, listMembers, markMemberLeft, reissueInviteCode, updateGroup,
} from "./service";
import { normalizeInviteCode } from "./validation";
import { listMembersHandler, patchGroupHandler } from "./handlers";

const user = (id: string) => ({ id }) as unknown as DemoUser;
const LC: GroupLifecycle = {
  status: "recruiting", minMembers: 2, deadlineDate: "2026-12-01", deadlineAt: "2026-12-02T00:00:00+09:00",
  deadlineExtendedCount: 0, withdrawalStartedAt: null, withdrawalEndsAt: null, confirmedAt: null, startedAt: null,
  completedAt: null, cancelledAt: null, cancelReason: null, organizerCancelReason: null, replanOfGroupId: null,
  replannedToGroupId: null, replannedAt: null, deadlineSoonNoticeSent: false, withdrawalEndingNoticeSent: false,
  revision: 1,
};
const INPUT = {
  name: "週末の温泉旅", campaign: "nttw-demo", region: "r-mizukoto",
  trip: { destination: "水琴", startDate: "2026-12-10", endDate: "2026-12-11", dateNote: "" },
  capacity: 4, visibility: "public" as const, tags: ["温泉"], description: "",
};

function thrown(fn: () => unknown): AppError {
  try { fn(); } catch (e) { return e as AppError; }
  throw new Error("no throw");
}

const events: string[] = [];
on("group_created", "t-core", () => events.push("group_created"));
on("member_joined", "t-core", () => events.push("member_joined"));
on("member_left", "t-core", () => events.push("member_left"));
on("status_changed", "t-core", () => events.push("status_changed"));

beforeEach(() => { resetForTest(); events.length = 0; });

describe("createGroup", () => {
  it("GRP-T-14 5 件で上限、終了状態があれば作成可", () => {
    const u = "u-950";
    for (let i = 0; i < 5; i++) createGroup(user(u), INPUT, LC);
    const e = thrown(() => createGroup(user(u), INPUT, LC));
    expect(e.code).toBe("conflict");
    expect(e.reason).toBe("organizer_group_limit");
    const first = db().groups.filter((g) => g.organizerId === u)[0];
    db().groups.update(first.id, { lifecycle: { ...first.lifecycle, status: "cancelled" } });
    expect(createGroup(user(u), INPUT, LC).organizerId).toBe(u);
  });

  it("GRP-T-16 成功は group_created のみ、失敗は何も残らない", () => {
    const g = createGroupInternal({ ...INPUT, organizerId: "u-951", lifecycle: LC });
    expect(events).toEqual(["group_created"]);
    expect(db().members.filter((m) => m.groupId === g.id)).toHaveLength(1);
    const before = db().groups.count();
    events.length = 0;
    expect(thrown(() => createGroupInternal({ ...INPUT, name: "", organizerId: "u-951", lifecycle: LC })).code)
      .toBe("invalid_input");
    expect(events).toEqual([]);
    expect(db().groups.count()).toBe(before);
  });

  it("非公開は招待コードを発行する", () => {
    const g = createGroup(user("u-952"), { ...INPUT, visibility: "private" }, LC);
    expect(g.inviteCode?.code).toHaveLength(10);
  });
});

describe("招待コード", () => {
  it("GRP-T-22 再発行で旧コードは無効", () => {
    const g = createGroup(user("u-953"), { ...INPUT, visibility: "private" }, LC);
    const oldCode = issueInviteCode(user("u-953"), g.id).code;
    const newCode = reissueInviteCode(user("u-953"), g.id).code;
    expect(newCode).not.toBe(oldCode);
    expect(findGroupByInviteCode(oldCode)).toBeUndefined();
    expect(thrown(() => assertInviteCode(g.id, oldCode)).code).toBe("not_found");
    expect(findGroupByInviteCode(newCode)?.id).toBe(g.id);
    expect(() => assertInviteCode(g.id, newCode)).not.toThrow();
  });

  it("GRP-T-23 +7 日と 1 秒で失効、+6 日 23 時間は有効", () => {
    const g = createGroup(user("u-954"), { ...INPUT, visibility: "private" }, LC);
    const code = getInviteCode(user("u-954"), g.id)!.code;
    const t0 = clock.now().getTime();
    const iso = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 19) + "+09:00";
    clock.freeze(iso(t0 + 6 * 86400_000 + 23 * 3600_000));
    expect(findGroupByInviteCode(code)).toBeDefined();
    clock.freeze(iso(t0 + 7 * 86400_000 + 1000));
    expect(findGroupByInviteCode(code)).toBeUndefined();
  });

  it("公開グループは conflict、非幹事は forbidden、正規化", () => {
    const g = insertGroup({ id: "g-901", organizerId: "u-955" });
    expect(thrown(() => issueInviteCode(user("u-955"), g.id)).reason).toBe("group_is_public");
    expect(thrown(() => getInviteCode(user("u-956"), g.id)).code).toBe("forbidden");
    expect(normalizeInviteCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCode("ABCDE-FGHIO")).toBeNull();
  });
});

describe("updateGroup", () => {
  it("GRP-T-32 現在人数 4 で capacity 3 は拒否、4 は可", () => {
    const g = insertGroup({ id: "g-902", organizerId: "u-957", capacity: 6 });
    insertMember(g.id, "u-958"); insertMember(g.id, "u-959"); insertMember(g.id, "u-960");
    const e = thrown(() => updateGroup(user("u-957"), g.id, { capacity: 3 }));
    expect(e.code).toBe("conflict");
    expect(e.reason).toBe("capacity_below_members");
    expect(updateGroup(user("u-957"), g.id, { capacity: 4 }).capacity).toBe(4);
  });

  it("状態外の項目は unavailable_state、公開切替でコードが付く", () => {
    const g = insertGroup({ id: "g-903", organizerId: "u-961", lifecycle: { status: "confirmed" } });
    const e = thrown(() => updateGroup(user("u-961"), g.id, { name: "新名称" }));
    expect(e.code).toBe("unavailable_state");
    const h = insertGroup({ id: "g-904", organizerId: "u-962" });
    const r = updateGroup(user("u-962"), h.id, { visibility: "private", name: "新名称" });
    expect(r.name).toBe("新名称");
    expect(r.inviteCode).not.toBeNull();
    expect(updateGroup(user("u-962"), h.id, { visibility: "public" }).inviteCode).toBeNull();
  });

  it("PATCH ハンドラと members ハンドラ", async () => {
    const g = insertGroup({ id: "g-905", organizerId: "u-001" });
    insertMember(g.id, "u-002");
    const r = await callRoute(patchGroupHandler, "/api/groups/g-905", {
      method: "PATCH", user: "u-001", params: { groupId: g.id }, body: { description: "更新" },
    });
    expect(r.status).toBe(200);
    expect(r.body.group.description).toBe("更新");
    expect(r.body.group.inviteCode).toBeUndefined();
    const bad = await callRoute(patchGroupHandler, "/api/groups/g-905", {
      method: "PATCH", user: "u-001", params: { groupId: g.id }, body: { capacity: 99 },
    });
    expect(bad.status).toBe(400);
    const m = await callRoute(listMembersHandler, "/api/groups/g-905/members", { user: "u-002", params: { groupId: g.id } });
    expect(m.status).toBe(200);
    expect(m.body).toHaveLength(2);
    expect(m.body.find((x: { userId: string }) => x.userId === "u-002").isSelf).toBe(true);
  });
});

describe("getGroup / listMembers", () => {
  it("詳細は招待コードを含まず、非公開の非メンバーは not_found", () => {
    const g = createGroup(user("u-963"), { ...INPUT, visibility: "private" }, LC);
    const d = getGroup(user("u-963"), g.id);
    expect(d.kind).toBe("member");
    expect(d.hasActiveInviteCode).toBe(true);
    expect("inviteCode" in d.group).toBe(false);
    expect(d.canEdit).toBe(true);
    expect(thrown(() => listMembers(user("u-964"), g.id)).code).toBe("not_found");
  });

  it("ブロックは試験データとして作れる(09 側の判定は別タスク)", () => {
    expect(insertBlock("u-001", "u-002").id).toMatch(/^bl-9/);
  });
});

describe("メンバー", () => {
  it("GRP-T-36 満席・重複は conflict、空きは成功で member_joined", () => {
    const g = insertGroup({ id: "g-906", organizerId: "u-965", capacity: 2 });
    expect(thrown(() => addMember(g.id, "u-965")).reason).toBe("already_member");
    addMember(g.id, "u-966");
    expect(events).toEqual(["member_joined"]);
    events.length = 0;
    expect(thrown(() => addMember(g.id, "u-967")).reason).toBe("group_full");
    expect(events).toEqual([]);
  });

  it("GRP-T-37・38 再参加は新しい行、markMemberLeft", () => {
    const g = insertGroup({ id: "g-907", organizerId: "u-968" });
    const first = addMember(g.id, "u-969");
    const left = markMemberLeft(g.id, "u-969", "2026-11-09T10:00:00+09:00");
    expect(left.status).toBe("left");
    expect(left.leftAt).toBe("2026-11-09T10:00:00+09:00");
    expect(events).toEqual(["member_joined"]);
    expect(thrown(() => markMemberLeft(g.id, "u-969", "2026-11-09T10:00:00+09:00")).code).toBe("not_found");
    expect(thrown(() => markMemberLeft(g.id, "u-970", "2026-11-09T10:00:00+09:00")).code).toBe("not_found");
    const again = addMember(g.id, "u-969");
    expect(again.id).not.toBe(first.id);
    expect(db().members.get(first.id)?.status).toBe("left");
  });
});

describe("applyLifecyclePatch", () => {
  it("GRP-T-40", () => {
    const g = insertGroup({ id: "g-908", organizerId: "u-971", capacity: 4 });
    const next = applyLifecyclePatch(g.id, 1, { status: "min_reached", revision: 99 });
    expect(next.revision).toBe(2);
    expect(next.status).toBe("min_reached");
    expect(db().groups.get(g.id)?.name).toBe(g.name);
    const e = thrown(() => applyLifecyclePatch(g.id, 1, { status: "recruiting" }));
    expect(e.code).toBe("conflict");
    expect(e.reason).toBe("version_mismatch");
    expect(e.detail?.current).toMatchObject({ revision: 2 });
    expect(thrown(() => applyLifecyclePatch(g.id, 2, { minMembers: 5 })).code).toBe("invalid_input");
  });
});
