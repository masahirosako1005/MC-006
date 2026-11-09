import { beforeEach, describe, expect, it, vi } from "vitest";

// recordCreated は 04 の別タスクで実装中のため代替する。
vi.mock("@/features/groups/lifecycle/evaluate", async (orig) => ({ ...(await orig<object>()), recordCreated: () => {} }));
import { db } from "@/lib/groups-store";
import { callRoute, resetForTest } from "@/test/helpers";
import { HOST, MUNICIPALITY, OFFICIAL_GROUPS, REGION, USER } from "@/test/fixtures";
import { postOfficialSlotHandler } from "./handlers";
import { assertListingInvariants, getListing, getOfficialBadges, resolveSponsor } from "./service";
import type { DemoUser } from "@/lib/groups-types";

const body = (over: Record<string, unknown> = {}) => ({
  municipalityId: MUNICIPALITY.a,
  kind: "official_plan",
  group: {
    name: "公式の散策会",
    campaign: "nttw-demo",
    region: REGION.nijiho,
    trip: { destination: "虹帆町", startDate: "2026-12-10", endDate: "2026-12-11", dateNote: "" },
    capacity: 6,
    tags: [],
    description: "",
    minMembers: 2,
    deadlineDate: "2026-12-01",
  },
  summary: "町を歩くプランです。",
  highlights: ["夜市"],
  ...over,
});

describe("official", () => {
  beforeEach(() => resetForTest());

  it("バッジと Listing を取得できる(seed)", () => {
    const b = getOfficialBadges([...OFFICIAL_GROUPS, "g-001"]);
    expect(Object.keys(b).sort()).toEqual([...OFFICIAL_GROUPS].sort());
    expect(b["g-002"].badgeLabel).toBe("自治体公式");
    expect(getListing("g-001")).toBeUndefined();
  });

  it("ENT-T-21 seed の不変条件に違反がない", () => {
    expect(assertListingInvariants()).toEqual([]);
  });

  it("自治体ロールが公式枠を作れる(201)", async () => {
    const r = await callRoute(postOfficialSlotHandler, "/api/official", { user: USER.municipalA, body: body() });
    expect(r.status).toBe(201);
    const g = db().groups.get(r.body.groupId)!;
    expect(g.official).toBe(true);
    expect(g.visibility).toBe("public");
    expect(r.body.listing.sponsor).toEqual({ type: "municipality", id: MUNICIPALITY.a });
    expect(assertListingInvariants()).toEqual([]);
  });

  it("ENT-T-16 一般ユーザーは 403 で何も作られない", async () => {
    const g = db().groups.count();
    const l = db().listings.count();
    const r = await callRoute(postOfficialSlotHandler, "/api/official", { user: USER.daisuke, body: body() });
    expect(r.status).toBe(403);
    expect(db().groups.count()).toBe(g);
    expect(db().listings.count()).toBe(l);
  });

  it("ENT-T-33 他の自治体の ID は 403", async () => {
    const g = db().groups.count();
    const r1 = await callRoute(postOfficialSlotHandler, "/api/official", {
      user: USER.municipalA, body: body({ municipalityId: MUNICIPALITY.b }),
    });
    const r2 = await callRoute(postOfficialSlotHandler, "/api/official", {
      user: USER.municipalB, body: body({ municipalityId: MUNICIPALITY.a }),
    });
    expect([r1.status, r2.status]).toEqual([403, 403]);
    expect(db().groups.count()).toBe(g);
  });

  it("本人確認未了は 403 not_verified", async () => {
    const r = await callRoute(postOfficialSlotHandler, "/api/official", { user: USER.unverified, body: body() });
    expect(r.status).toBe(403);
  });

  it("fields に group. 接頭辞が付く", async () => {
    const b = body();
    (b.group as Record<string, unknown>).name = "";
    const r = await callRoute(postOfficialSlotHandler, "/api/official", { user: USER.municipalA, body: b });
    expect(r.status).toBe(400);
    expect(Object.keys(r.body.fields)).toContain("group.name");
  });

  it("resolveSponsor", () => {
    const u = (id: string) => db().users.get(id) as unknown as DemoUser;
    expect(resolveSponsor(u(USER.municipalA), "municipality").id).toBe(MUNICIPALITY.a);
    expect(resolveSponsor(u(USER.host), "host").id).toBe(HOST.a);
    expect(() => resolveSponsor(u(USER.daisuke), "municipality")).toThrow();
  });
});
