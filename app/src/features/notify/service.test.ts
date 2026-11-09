import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetForTest, callRoute } from "@/test/helpers";
import { db } from "@/lib/groups-store";
import { USER } from "@/test/fixtures";
import { listNotificationsHandler, markReadHandler, unreadCountHandler } from "./handlers";
import type { GroupNotification } from "./types";

vi.mock("./render", () => ({
  toDto: (n: GroupNotification) => ({
    id: n.id, kind: n.kind, groupId: n.groupId, title: "t", body: "b",
    link: { groupId: n.groupId, view: "detail" }, createdAt: n.createdAt, read: n.readAt !== null,
  }),
}));

const A = USER.misaki;
const B = USER.kenta;
const ids = (r: { body: { items: { id: string }[] } }) => r.body.items.map((x) => x.id);

function add(id: string, userId: string, createdAt: string) {
  db().notifications.insert({
    id, userId, kind: "join_approved", groupId: "g-001", params: { groupTitle: "x" },
    dedupeKey: id, createdAt, readAt: null,
  } as GroupNotification);
}

describe("notify api", () => {
  beforeEach(() => {
    resetForTest();
    [...db().notifications.list()].forEach((n) => db().notifications.remove(n.id));
    add("n-901", A, "2026-11-01T00:00:00+09:00");
    add("n-902", A, "2026-11-02T00:00:00+09:00");
    add("n-903", A, "2026-11-03T00:00:00+09:00");
    add("n-904", B, "2026-11-04T00:00:00+09:00");
  });

  it("T-20/21 一覧は本人宛のみ・新しい順、内部項目なし", async () => {
    const r = await callRoute(listNotificationsHandler, "/api/me/notifications", { user: A });
    expect(r.status).toBe(200);
    expect(ids(r)).toEqual(["n-903", "n-902", "n-901"]);
    expect(r.body.unreadCount).toBe(3);
    expect(r.body.items[0].params).toBeUndefined();
    const b = await callRoute(listNotificationsHandler, "/api/me/notifications", { user: B });
    expect(ids(b)).toEqual(["n-904"]);
  });

  it("カーソルと limit", async () => {
    const r = await callRoute(listNotificationsHandler, "/api/me/notifications?limit=2", { user: A });
    expect(r.body.nextCursor).toBe("n-902");
    const r2 = await callRoute(listNotificationsHandler, "/api/me/notifications?limit=2&cursor=n-902", { user: A });
    expect(ids(r2)).toEqual(["n-901"]);
    expect(r2.body.nextCursor).toBeNull();
  });

  it("T-22/23/24 未読件数と既読(冪等)", async () => {
    const c = await callRoute(unreadCountHandler, "/api/me/unread-count", { user: A });
    expect(c.body).toEqual({ count: 3 });
    const r = await callRoute(markReadHandler, "/api/me/notifications/read", { user: A, body: { id: "n-901" } });
    expect(r.status).toBe(200);
    expect(r.body.read).toBe(true);
    const at = db().notifications.get("n-901")!.readAt;
    await callRoute(markReadHandler, "/api/me/notifications/read", { user: A, body: { id: "n-901" } });
    expect(db().notifications.get("n-901")!.readAt).toBe(at);
    expect((await callRoute(unreadCountHandler, "/api/me/unread-count", { user: A })).body.count).toBe(2);
  });

  it("T-25/26 他人・不在は 404、形式不正は 400", async () => {
    const o = await callRoute(markReadHandler, "/api/me/notifications/read", { user: B, body: { id: "n-901" } });
    expect(o.status).toBe(404);
    expect(db().notifications.get("n-901")!.readAt).toBeNull();
    const m = await callRoute(markReadHandler, "/api/me/notifications/read", { user: A, body: { id: "n-999999" } });
    expect(m.status).toBe(404);
    const bad = await callRoute(markReadHandler, "/api/me/notifications/read", { user: A, body: { id: "../x" } });
    expect(bad.status).toBe(400);
    expect(bad.body.fields.id).toBeTruthy();
  });

  it("T-29 unread=1", async () => {
    await callRoute(markReadHandler, "/api/me/notifications/read", { user: A, body: { id: "n-903" } });
    const r = await callRoute(listNotificationsHandler, "/api/me/notifications?unread=1", { user: A });
    expect(ids(r)).toEqual(["n-902", "n-901"]);
  });
});
