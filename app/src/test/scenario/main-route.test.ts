// P-3-16 API の通し試験(主ルート)。契約 16.1、JOIN-T-39、LCY-T-73、EXP-T-45。
// 2A の範囲(作成・一覧・申請・承認・時計による遷移)は実物で通す。2B 未マージの API は skip。
import { beforeEach, describe, expect, it, vi } from "vitest";

// 11 公式枠(P-2-14、Wave 2B)が未マージのため、バッジ取得だけ空で代替する。
vi.mock("@/features/official/service", async (orig) => ({
  ...(await orig<object>()),
  getOfficialBadges: () => ({}),
}));
import { callRoute, resetForTest } from "../helpers";
import { USER } from "../fixtures";
import { db } from "@/lib/groups-store";
import { POST as createGroup, GET as listGroups } from "@/app/api/groups/route";
import { GET as getGroup } from "@/app/api/groups/[groupId]/route";
import { POST as requestJoin } from "@/app/api/groups/[groupId]/join-requests/route";
import { POST as approve } from "@/app/api/groups/[groupId]/join-requests/[requestId]/approve/route";
import { GET as getLifecycle } from "@/app/api/groups/[groupId]/lifecycle/route";
import { POST as cancel } from "@/app/api/groups/[groupId]/cancel/route";
import { POST as replan } from "@/app/api/groups/[groupId]/replan/route";
import { GET as listNotifications } from "@/app/api/me/notifications/route";
import { POST as postClock } from "@/app/api/demo/clock/route";

const advanceTo = (at: string) => callRoute(postClock, "/api/demo/clock", { body: { action: "set", at } });
const statusOf = (id: string) => db().groups.get(id)!.lifecycle.status;

async function createAndFill() {
  const created = await callRoute(createGroup, "/api/groups", {
    user: USER.misaki,
    body: {
      name: "通し試験の旅", campaign: "nttw-demo", region: "r-mizukoto", capacity: 4, visibility: "public",
      trip: { destination: "水琴の里", startDate: "2026-11-20", endDate: "2026-11-21" },
      tags: [], description: "", minMembers: 2, deadlineDate: "2026-11-12",
    },
  });
  expect(created.status, JSON.stringify(created.body)).toBe(201);
  const gid: string = created.body.id ?? created.body.group?.id;
  expect(gid).toBeTruthy();
  return gid;
}

async function joinAndApprove(gid: string, userId: string) {
  const r = await callRoute(requestJoin, `/api/groups/${gid}/join-requests`, {
    user: userId, params: { groupId: gid },
    body: { note: "", consentMinMembers: true, consentedMinMembers: 2 },
  });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const a = await callRoute(approve, `/api/groups/${gid}/join-requests/${r.body.id}/approve`, {
    user: USER.misaki, method: "POST", body: {}, params: { groupId: gid, requestId: r.body.id },
  });
  expect(a.status, JSON.stringify(a.body)).toBe(200);
}

describe("主ルート(2A の範囲)", () => {
  beforeEach(() => resetForTest());

  it("作成 → 一覧 → 申請 → 承認(最少人数到達)", async () => {
    const gid = await createAndFill();
    expect(statusOf(gid)).toBe("recruiting");
    const list = await callRoute(listGroups, "/api/groups?limit=50", { user: USER.kenta });
    expect(list.status, JSON.stringify(list.body)).toBe(200);
    expect(JSON.stringify(list.body)).toContain(gid);
    const detail = await callRoute(getGroup, `/api/groups/${gid}`, { user: USER.kenta, params: { groupId: gid } });
    expect(detail.status, JSON.stringify(detail.body)).toBe(200);
    await joinAndApprove(gid, USER.kenta);
    expect(statusOf(gid)).toBe("min_reached");
  });

  it("時計で 締切 → 辞退期間 → 実行確定 → 実施中 → 完了", async () => {
    const gid = await createAndFill();
    await joinAndApprove(gid, USER.kenta);
    expect((await advanceTo("2026-11-13T09:00:00+09:00")).status).toBe(200);
    expect(statusOf(gid)).toBe("withdrawal_period");
    await advanceTo("2026-11-16T09:00:00+09:00");
    expect(statusOf(gid)).toBe("confirmed");
    await advanceTo("2026-11-20T09:00:00+09:00");
    expect(statusOf(gid)).toBe("in_progress");
    await advanceTo("2026-11-22T09:00:00+09:00");
    expect(statusOf(gid)).toBe("completed");
    const kinds = new Set(db().notifications.filter((n) => n.groupId === gid).map((n) => n.kind));
    for (const k of ["join_requested", "join_approved", "confirmed"]) expect(kinds, [...kinds].join(",")).toContain(k);
  });

  it("最少人数に届かず締切 → 中止", async () => {
    const gid = await createAndFill();
    await advanceTo("2026-11-13T09:00:00+09:00");
    expect(statusOf(gid)).toBe("cancelled");
  });

  // 以下は 2B(または P-2-11 の lifecycle ハンドラ・通知生成)のマージ後に有効化する。
  it.skip("GET lifecycle / 幹事の中止 / 再企画 / 再申請(04 ハンドラ・replan 未実装)", async () => {
    void getLifecycle; void cancel; void replan;
  });
  it.skip("主な通知の発生(notify() 未実装)", async () => {
    void listNotifications;
  });
  it.todo("旅程メモ・チャット・費用メモ・スタンプ・振り返り(05〜08 のマージ後)");
});
