import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import { unavailableState } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { USER } from "@/test/fixtures";
import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { assertGroupAccess } from "@/features/safety/guards/access";

// 08 の access/stamps/rewards(P-2-20)は署名に対して代替する。
vi.mock("./access", () => ({
  loadRallyContext: (user: { id: string }, groupId: string) => {
    const group = assertGroupAccess(user.id, groupId, "member");
    const s = group.lifecycle.status;
    const ok = s === "in_progress" || s === "completed";
    return { group, access: { canView: true, canCollectStamps: s === "in_progress", canReviewRead: ok, canReviewWrite: ok, stampReason: null, reviewReason: ok ? null : "not_started" } };
  },
  assertRallyOp: (ctx: { access: { canReviewWrite: boolean } }) => {
    if (!ctx.access.canReviewWrite) throw unavailableState("使えません", { reason: "not_started" });
  },
}));
vi.mock("./stamps", () => ({
  groupProgress: () => ({
    totalSpots: 1, acquiredCount: 0, achievementRate: 0, rewards: [],
    spots: [{ spotId: 1, name: "s", stampName: "s", area: "a", description: "", map: { x: 0, y: 0 }, hue: 120, acquired: false, acquiredBy: null, acquiredAt: null }],
  }),
  acquireForGroup: vi.fn(),
}));
vi.mock("./rewards", () => ({ listMyRewards: () => [] }));

import { deletePhotoHandler, getReviewHandler, postPhotoHandler, putMemoHandler } from "./handlers";

const G = "g-901";
const OTHER = "g-902";
const m1 = USER.misaki;
const m2 = USER.kenta;

beforeEach(() => {
  resetForTest();
  insertGroup({ id: G, organizerId: m1, lifecycle: { status: "completed" } });
  insertMember(G, m2);
  insertGroup({ id: OTHER, organizerId: m2, lifecycle: { status: "completed" } });
});

const put = (body: unknown, user = m1) => callRoute(putMemoHandler, `/api/groups/${G}/review/memo`, { method: "PUT", body, user, params: { groupId: G } });
const post = (body: unknown, user = m1) => callRoute(postPhotoHandler, `/api/groups/${G}/review/photos`, { body, user, params: { groupId: G } });

describe("振り返り", () => {
  it("T-31 メモは上書きで 1 件のまま。上限超過は 400", async () => {
    const a = await put({ body: "あ".repeat(LIMITS.RALLY_MEMO.max) });
    expect(a.status).toBe(200);
    const b = await put({ body: "更新" });
    expect(b.body.id).toBe(a.body.id);
    expect(db().rallyMemos.count((m) => m.groupId === G)).toBe(1);
    const c = await put({ body: "あ".repeat(LIMITS.RALLY_MEMO.max + 1) });
    expect(c.status).toBe(400);
    expect(c.body.fields.body).toBeTruthy();
  });

  it("T-33 禁止語は 400 で保存されない", async () => {
    const r = await put({ body: "テスト禁止語を含む" });
    expect(r.status).toBe(400);
    expect(db().rallyMemos.count((m) => m.groupId === G)).toBe(0);
  });

  it("T-38 写真は 1 人 maxPerUser 件まで", async () => {
    for (let i = 0; i < LIMITS.PHOTOS.maxPerUser; i++) expect((await post({ caption: `c${i}` })).status).toBe(201);
    const r = await post({ spotId: 1, caption: "x" });
    expect(r.status).toBe(409);
    expect(r.body.reason).toBe("limit_exceeded");
    const g = await callRoute(getReviewHandler, `/api/groups/${G}/review`, { user: m1, params: { groupId: G } });
    expect(g.status).toBe(200);
    expect(g.body.photos).toHaveLength(LIMITS.PHOTOS.maxPerUser);
  });

  it("T-54 別グループの写真は 404 で削除されない", async () => {
    const p = db().rallyPhotos.insert({ id: "ph-901", groupId: OTHER, userId: m2, spotId: null, caption: "", createdAt: "2026-11-09T00:00:00+09:00" });
    const r = await callRoute(deletePhotoHandler, `/api/groups/${G}/review/photos/${p.id}`, { method: "DELETE", user: m1, params: { groupId: G, photoId: p.id } });
    expect(r.status).toBe(404);
    expect(db().rallyPhotos.get(p.id)).toBeTruthy();
  });

  it("他人の写真は 403、本人は 204", async () => {
    const p = (await post({ caption: "" })).body;
    const call = (user: string) => callRoute(deletePhotoHandler, `/api/groups/${G}/review/photos/${p.id}`, { method: "DELETE", user, params: { groupId: G, photoId: p.id } });
    expect((await call(m2)).status).toBe(403);
    expect((await call(m1)).status).toBe(204);
  });
});
