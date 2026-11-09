import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/lib/groups-store";
import type { AppError } from "@/lib/errors";
import { GROUP_BY_STATUS, USER } from "@/test/fixtures";
import { insertBlock, insertGroup, insertMember, resetForTest } from "@/test/helpers";

vi.mock("@/features/safety/visibility/profile", () => ({
  visibleProfile: (_v: unknown, id: string) => ({ userId: id, displayName: `name-${id}` }),
}));
vi.mock("@/features/safety/reports/report-service", () => ({
  createReport: vi.fn(() => ({ report: {}, deduplicated: false })),
}));
vi.mock("./system-messages", () => ({ renderSystemText: () => "system text", postSystemMessage: () => null }));

import { listMessages, markChatRead, postMessage, reportMessage, getUnreadCount } from "./service";

const user = (id: string) => db().users.getOrThrow(id);
function err(fn: () => unknown): AppError {
  try { fn(); } catch (e) { return e as AppError; }
  throw new Error("did not throw");
}

beforeEach(() => resetForTest());

function setup() {
  const g = insertGroup({ id: "g-901", organizerId: USER.kenta });
  insertMember(g.id, USER.yui, "member");
  insertMember(g.id, USER.misaki, "member");
  return g.id;
}

describe("chat service", () => {
  it("非メンバーは 403 (CHT-T-01)", () => {
    const gid = setup();
    expect(err(() => listMessages(user(USER.daisuke), gid)).code).toBe("forbidden");
  });

  it("通常・定型文の投稿 (CHT-T-03, 04)", () => {
    const gid = setup();
    const a = postMessage(user(USER.yui), gid, { kind: "normal", body: "集合は10時でどうですか" });
    expect(a.kind).toBe("normal");
    expect(a.id.startsWith("msg-")).toBe(true);
    expect(a.isMine).toBe(true);
    const b = postMessage(user(USER.yui), gid, { kind: "template", templateId: "tpl-01" });
    expect(b.kind).toBe("template");
    expect(b.text).toBe("集合時間を相談したいです");
  });

  it("禁止表現は 400 で保存されない (CHT-T-10)", () => {
    const gid = setup();
    const before = db().messages.count();
    const e = err(() => postMessage(user(USER.yui), gid, { kind: "normal", body: "LINE 交換しよう" }));
    expect(e.code).toBe("invalid_input");
    expect(db().messages.count()).toBe(before);
  });

  it("中止グループは投稿 409 (CHT-T-17)", () => {
    const gid = GROUP_BY_STATUS.cancelled;
    const org = db().groups.getOrThrow(gid).organizerId;
    expect(err(() => postMessage(user(org), gid, { kind: "template", templateId: "tpl-05" })).code).toBe("unavailable_state");
  });

  it("ブロックした相手の投稿は隠れ、latestId は含む (CHT-T-20)", () => {
    const gid = setup();
    postMessage(user(USER.yui), gid, { kind: "template", templateId: "tpl-05" });
    const last = postMessage(user(USER.misaki), gid, { kind: "template", templateId: "tpl-06" });
    insertBlock(USER.kenta, USER.misaki);
    const r = listMessages(user(USER.kenta), gid);
    expect(r.items.map((i) => i.senderId)).toEqual([USER.yui]);
    expect(r.latestId).toBe(last.id);
    expect(listMessages(user(USER.yui), gid).items).toHaveLength(2);
  });

  it("sinceId・既読・通報", () => {
    const gid = setup();
    const m1 = postMessage(user(USER.yui), gid, { kind: "template", templateId: "tpl-05" });
    const r1 = listMessages(user(USER.kenta), gid);
    expect(r1.unreadCount).toBe(1);
    expect(listMessages(user(USER.kenta), gid, { sinceId: r1.latestId! }).items).toEqual([]);
    expect(markChatRead(user(USER.kenta), gid, m1.id).unreadCount).toBe(0);
    postMessage(user(USER.yui), gid, { kind: "template", templateId: "tpl-06" });
    expect(getUnreadCount(user(USER.kenta), gid)).toBe(1);
    expect(reportMessage(user(USER.kenta), gid, m1.id, "harassment")).toEqual({ reported: true });
    expect(listMessages(user(USER.kenta), gid).items[0].reportedByMe).toBe(true);
    expect(listMessages(user(USER.misaki), gid).items[0].reportedByMe).toBe(false);
    expect(err(() => reportMessage(user(USER.yui), gid, m1.id, "harassment")).code).toBe("invalid_input");
  });
});
