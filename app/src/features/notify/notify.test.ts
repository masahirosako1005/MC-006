import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/safety/visibility/summary", () => ({
  ageBandsOf: vi.fn(() => []),
  memberSummary: vi.fn(() => ({})),
  formatMemberSummary: vi.fn(() => "20代2人、30代1人"),
}));

import { resetForTest, insertGroup, insertMember } from "@/test/helpers";
import { USER } from "@/test/fixtures";
import { db } from "@/lib/groups-store";
import { notify } from "./index";
import { renderNotification, toDto } from "./render";
import { resolveRecipients } from "./recipients";
import { KIND_META } from "./kinds";
import { NOTIFICATION_KINDS, type GroupNotification } from "./types";

const G = "g-901";

beforeEach(() => {
  resetForTest();
  insertGroup({ id: G, organizerId: USER.misaki, name: "試験グループ" });
  insertMember(G, USER.kenta);
  insertMember(G, USER.yui);
});

describe("notify", () => {
  it("min_reached を参加中メンバー全員へ作る", () => {
    const r = notify({
      kind: "min_reached", groupId: G, eventKey: "reached",
      params: { groupTitle: "試験グループ", minParticipants: 3, count: 3 },
      recipients: [{ type: "groupMembers" }],
    });
    expect(r.created).toHaveLength(3);
    expect(r.recipientCount).toBe(3);
    expect(r.created[0].readAt).toBeNull();
    expect(renderNotification(r.created[0]).body).toContain("最少人数(3人)に達しました");
  });

  it("同じ eventKey の再呼び出しは重複作成しない", () => {
    const input = {
      kind: "join_requested" as const, groupId: G, eventKey: "jr:jr-901",
      params: { groupTitle: "試験グループ", pendingCount: 1 },
      recipients: [{ type: "organizer" as const }],
    };
    expect(notify(input).created).toHaveLength(1);
    const again = notify(input);
    expect(again.created).toHaveLength(0);
    expect(again.skippedDuplicate).toEqual([USER.misaki]);
    expect(db().notifications.count((n) => n.groupId === G)).toBe(1);
  });

  it("confirmed は summaryText を付ける(呼び出し側の値は使わない)", () => {
    const r = notify({
      kind: "confirmed", groupId: G, eventKey: "confirmed",
      params: { groupTitle: "試験グループ", count: 3, summaryText: "偽" } as never,
      recipients: [{ type: "groupMembers" }],
    });
    const p = r.created[0].params as { summaryText?: string };
    expect(p.summaryText).toBe("20代2人、30代1人");
    expect(renderNotification(r.created[0]).body).toContain("参加者の概要: 20代2人、30代1人");
  });

  it("不正な params と eventKey は invalid_input、存在しないグループは not_found", () => {
    const base = { kind: "cancelled" as const, groupId: G, eventKey: "cancelled", recipients: [{ type: "organizer" as const }] };
    expect(() => notify({ ...base, params: { groupTitle: "x", reason: "min_not_reached" } })).toThrowError(
      expect.objectContaining({ code: "invalid_input" }),
    );
    expect(() => notify({ ...base, eventKey: "bad key!", params: { groupTitle: "x", reason: "organizer_cancelled" } })).toThrowError(
      expect.objectContaining({ code: "invalid_input" }),
    );
    expect(() => notify({ ...base, groupId: "g-999", params: { groupTitle: "x", reason: "organizer_cancelled" } })).toThrowError(
      expect.objectContaining({ code: "not_found" }),
    );
  });

  it("宛先 0 件はエラーにしない", () => {
    const r = notify({
      kind: "join_approved", groupId: G, eventKey: "ja:jr-901",
      params: { groupTitle: "試験グループ" }, recipients: [{ type: "users", userIds: ["u-999"] }],
    });
    expect(r).toEqual({ created: [], skippedDuplicate: [], recipientCount: 0 });
  });
});

describe("resolveRecipients", () => {
  it("幹事除外・除外ID・和集合・昇順", () => {
    db().joinRequests.insert({
      id: "jr-901", groupId: G, applicantId: USER.sota, note: "", status: "pending", consentMinMembers: true,
      consentAt: null, consentedMinMembers: null, viaInviteCode: false, reentryOfGroupId: null, reasonId: null,
      createdAt: "2026-11-01T00:00:00+09:00", decidedAt: null, decidedBy: null,
    });
    expect(resolveRecipients(G, [{ type: "groupMembers", excludeOrganizer: true }, { type: "pendingApplicants" }])).toEqual(
      [USER.kenta, USER.yui, USER.sota],
    );
    expect(resolveRecipients(G, [{ type: "groupMembers", excludeUserIds: [USER.kenta] }])).toEqual([USER.misaki, USER.yui]);
    expect(resolveRecipients(G, [{ type: "organizer" }])).toEqual([USER.misaki]);
  });
  it("退会者は除く", () => {
    const m = db().members.find((x) => x.groupId === G && x.userId === USER.kenta)!;
    db().members.update(m.id, { status: "left" });
    expect(resolveRecipients(G, [{ type: "groupMembers" }])).toEqual([USER.misaki, USER.yui]);
  });
});

describe("render", () => {
  const mk = (kind: string, params: unknown, groupId = G): GroupNotification =>
    ({ id: "n-901", userId: USER.kenta, kind, groupId, params, dedupeKey: "k", createdAt: "2026-11-01T00:00:00+09:00", readAt: null }) as GroupNotification;

  it("cancelled は 5 理由で文面が変わり、organizer_left は案内なし", () => {
    const body = (reason: string) => renderNotification(mk("cancelled", { groupTitle: "旅", reason, minParticipants: 3 })).body;
    expect(body("min_not_reached")).toContain("最少人数(3人)に達しなかった");
    expect(body("below_min_in_withdrawal")).toContain("下回った");
    expect(body("below_floor")).toContain("2人未満");
    expect(body("organizer_cancelled")).toContain("幹事の操作");
    expect(body("organizer_cancelled")).toContain("再企画できます");
    expect(body("organizer_left")).not.toContain("再企画できます");
  });

  it("conditions_changed・withdraw_period_started は日時を整形、replan_invited は新グループへ", () => {
    expect(renderNotification(mk("conditions_changed", {
      groupTitle: "旅", minParticipants: { from: 3, to: 4 }, deadline: { from: "2026-11-20", to: "2026-11-25" },
    })).body).toContain("最少人数が3人から4人になりました。締切が11月20日から11月25日になりました。");
    expect(renderNotification(mk("withdraw_period_started", { groupTitle: "旅", count: 3, withdrawUntil: "2026-11-30T18:00:00+09:00" })).body)
      .toContain("11月30日 18:00まで");
    const r = renderNotification(mk("replan_invited", { groupTitle: "旅", newGroupId: "g-902" }));
    expect(r.link).toEqual({ groupId: "g-902", view: "detail" });
  });

  it("必須 12 種はテンプレートとメタを持ち、未知 kind は例外", () => {
    for (const k of NOTIFICATION_KINDS) expect(KIND_META[k]).toBeDefined();
    expect(KIND_META.chat_new?.optional).toBe(true);
    expect(KIND_META.join_requested?.defaultView).toBe("requests");
    expect(() => renderNotification(mk("nope", { groupTitle: "x" }))).toThrow();
    expect(toDto(mk("join_approved", { groupTitle: "旅" })).read).toBe(false);
  });
});
