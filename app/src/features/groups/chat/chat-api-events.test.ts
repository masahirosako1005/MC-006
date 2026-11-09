import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./service", () => ({
  listMessages: vi.fn(() => ({ items: [], nextCursor: null, latestId: null, unreadCount: 0, access: { canRead: true, canPost: true }, serverTime: "x" })),
  postMessage: vi.fn(() => ({ id: "msg-901" })),
  reportMessage: vi.fn(() => ({ reported: true })),
  markChatRead: vi.fn(() => ({ unreadCount: 0 })),
  chatAccess: vi.fn(), listTemplates: vi.fn(), getUnreadCount: vi.fn(), toDto: vi.fn(),
}));

import { db } from "@/lib/groups-store";
import { emit } from "@/lib/events";
import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { listMessagesHandler, postMessageHandler, markChatReadHandler } from "./handlers";
import * as svc from "./service";
import * as profile from "@/features/safety/visibility/profile";
import "./register";
import { postSystemMessage, renderSystemText, makeNameResolver } from "./system-messages";

const at = "2026-12-02T00:00:00+09:00";
const params = { groupId: "g-901" };
beforeEach(() => {
  resetForTest(); vi.clearAllMocks();
  vi.spyOn(profile, "visibleProfile").mockImplementation(((_v: unknown, id: string) => ({ userId: id, displayName: "名前-" + id })) as typeof profile.visibleProfile);
});

describe("handlers", () => {
  it("一覧(GET)と定型文投稿(POST 201)", async () => {
    insertGroup({ id: "g-901" });
    const r = await callRoute(listMessagesHandler, "/api/groups/g-901/messages?limit=10", { user: "u-001", params });
    expect(r.status).toBe(200);
    expect(svc.listMessages).toHaveBeenCalledWith(expect.anything(), "g-901", { sinceId: undefined, before: undefined, limit: 10 });
    const p = await callRoute(postMessageHandler, "/api/groups/g-901/messages", {
      user: "u-001", params, body: { kind: "template", templateId: "tpl-01" },
    });
    expect(p.status).toBe(201);
    expect(svc.postMessage).toHaveBeenCalledWith(expect.anything(), "g-901", { kind: "template", templateId: "tpl-01" });
  });

  it("不正な kind と lastReadId は 400", async () => {
    insertGroup({ id: "g-901" });
    const a = await callRoute(postMessageHandler, "/api/groups/g-901/messages", {
      user: "u-001", params, body: { kind: "system", body: "x" },
    });
    expect(a.status).toBe(400);
    const b = await callRoute(markChatReadHandler, "/api/groups/g-901/chat/read", {
      user: "u-001", params, body: { lastReadId: "bad" },
    });
    expect(b.status).toBe(400);
  });
});

describe("システムメッセージ(CHT-T-28/29/51)", () => {
  const sys = (gid: string) => db().messages.filter((m) => m.groupId === gid && m.kind === "system");

  it("member_joined で 1 件、名前は visibleProfile 由来", () => {
    insertGroup({ id: "g-901" });
    insertMember("g-901", "u-002");
    emit({ type: "member_joined", groupId: "g-901", userId: "u-002", at });
    const m = sys("g-901");
    expect(m).toHaveLength(1);
    expect(renderSystemText(m[0], makeNameResolver({ id: "u-001" }, "g-901"))).toBe("名前-u-002さんが参加しました。");
  });

  it("status_changed: confirmed/cancelled/replanned は作られ、withdrawal_period は作られない", () => {
    insertGroup({ id: "g-901" });
    for (const to of ["withdrawal_period", "confirmed", "cancelled", "replanned"]) {
      emit({ type: "status_changed", groupId: "g-901", from: "recruiting", to, cancelReason: null, revision: 2, at });
    }
    expect(sys("g-901").map((m) => m.systemEvent)).toEqual(["state_confirmed", "state_cancelled", "state_replanned"]);
  });

  it("member_left は phase で辞退/退会、退会済みは元メンバー", () => {
    insertGroup({ id: "g-901" });
    emit({ type: "member_left", groupId: "g-901", userId: "u-002", phase: "confirmed", withdrawalId: "w-1", at });
    const m = sys("g-901")[0];
    expect(m.systemPhase).toBe("leave");
    expect(renderSystemText(m, makeNameResolver({ id: "u-001" }, "g-901"))).toBe("元メンバーさんが退会しました。");
  });

  it("グループ不在でも例外を外へ出さず console.error にグループ ID だけ出す", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => emit({ type: "status_changed", groupId: "g-999", from: "recruiting", to: "cancelled", cancelReason: null, revision: 2, at })).not.toThrow();
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls[0]).toContain("g-999");
    expect(() => postSystemMessage("g-999", "group_created")).toThrow();
    spy.mockRestore();
  });
});
