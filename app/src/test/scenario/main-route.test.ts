// P-3-16 API の通し試験(主ルート)。契約 16.1、JOIN-T-39、LCY-T-73、EXP-T-45。
// 2A の範囲(作成・一覧・申請・承認・時計による遷移)は実物で通す。2B 未マージの API は skip。
import { beforeEach, describe, expect, it } from "vitest";

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
import { POST as postPlanItem } from "@/app/api/groups/[groupId]/plan/items/route";
import { GET as getPlan } from "@/app/api/groups/[groupId]/plan/route";
import { POST as postMessage, GET as listMessages } from "@/app/api/groups/[groupId]/messages/route";
import { POST as addExpense } from "@/app/api/groups/[groupId]/expenses/route";
import { GET as expenseSummary } from "@/app/api/groups/[groupId]/expense-summary/route";
import { POST as postStamp } from "@/app/api/groups/[groupId]/stamps/route";
import { PUT as putMemo } from "@/app/api/groups/[groupId]/review/memo/route";
import { PUT as putSurvey } from "@/app/api/groups/[groupId]/review/survey/route";
import { GET as getReview } from "@/app/api/groups/[groupId]/review/route";
import { GET as getStats } from "@/app/api/stats/route";
import { GET as getInsights } from "@/app/api/insights/route";
import seed from "@/data/seed.json";

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

  it("GET lifecycle / 幹事の中止 / 再企画 / 再申請", async () => {
    const gid = await createAndFill();
    await joinAndApprove(gid, USER.kenta);
    const lc = await callRoute(getLifecycle, `/api/groups/${gid}/lifecycle`, { user: USER.misaki, params: { groupId: gid } });
    expect(lc.status, JSON.stringify(lc.body)).toBe(200);
    const c = await callRoute(cancel, `/api/groups/${gid}/cancel`, {
      user: USER.misaki, body: { reason: "schedule_conflict" }, params: { groupId: gid },
    });
    expect(c.status, JSON.stringify(c.body)).toBe(200);
    expect(statusOf(gid)).toBe("cancelled");
    const before = db().groups.count(() => true);
    const r = await callRoute(replan, `/api/groups/${gid}/replan`, {
      user: USER.misaki, params: { groupId: gid },
      body: { startDate: "2026-11-28", endDate: "2026-11-29", deadlineDate: "2026-11-20" },
    });
    expect(r.status, JSON.stringify(r.body)).toBe(201);
    const newId: string = r.body.groupId;
    expect(newId).toBeTruthy();
    expect(db().groups.count(() => true)).toBe(before + 1);
    expect(statusOf(newId)).toBe("recruiting");
    // F-002: recordCreated が二重にならない
    const logs = db().groupStatusLogs.filter((l) => l.groupId === newId);
    expect(logs.length, JSON.stringify(logs)).toBe(1);
    await joinAndApprove(newId, USER.kenta);
    expect(statusOf(newId)).toBe("min_reached");
  });

  it("主な通知が通知 API から見える", async () => {
    const gid = await createAndFill();
    await joinAndApprove(gid, USER.kenta);
    const org = await callRoute(listNotifications, "/api/me/notifications", { user: USER.misaki });
    expect(org.status, JSON.stringify(org.body)).toBe(200);
    expect(JSON.stringify(org.body)).toContain("join_requested");
    const mem = await callRoute(listNotifications, "/api/me/notifications", { user: USER.kenta });
    expect(JSON.stringify(mem.body)).toContain("join_approved");
  });

  it("実施中の 旅程・チャット・費用・スタンプ・振り返り → 完了 → stats / insights", async () => {
    const gid = await createAndFill();
    await joinAndApprove(gid, USER.kenta);
    await advanceTo("2026-11-20T09:00:00+09:00");
    expect(statusOf(gid)).toBe("in_progress");
    const p = { groupId: gid };
    const base = `/api/groups/${gid}`;
    const item = await callRoute(postPlanItem, `${base}/plan/items`, {
      user: USER.misaki, params: p, body: { date: "2026-11-20", time: "10:00", title: "朝市へ行く" },
    });
    expect(item.status, JSON.stringify(item.body)).toBe(201);
    const plan = await callRoute(getPlan, `${base}/plan`, { user: USER.kenta, params: p });
    expect(plan.status, JSON.stringify(plan.body)).toBe(200);
    expect(JSON.stringify(plan.body)).toContain("朝市へ行く");
    const msg = await callRoute(postMessage, `${base}/messages`, {
      user: USER.kenta, params: p, body: { kind: "normal", body: "よろしくお願いします" },
    });
    expect(msg.status, JSON.stringify(msg.body)).toBe(201);
    const msgs = await callRoute(listMessages, `${base}/messages`, { user: USER.misaki, params: p });
    expect(JSON.stringify(msgs.body)).toContain("よろしくお願いします");
    const ex = await callRoute(addExpense, `${base}/expenses`, {
      user: USER.misaki, params: p,
      body: { title: "ランチ", amount: 3000, payerId: USER.misaki, targetIds: [USER.misaki, USER.kenta], spentOn: "2026-11-20" },
    });
    expect(ex.status, JSON.stringify(ex.body)).toBe(201);
    const sum = await callRoute(expenseSummary, `${base}/expense-summary`, { user: USER.kenta, params: p });
    expect(sum.status, JSON.stringify(sum.body)).toBe(200);
    const kw = (seed.spots as unknown as { keyword: string }[])[0].keyword;
    const st = await callRoute(postStamp, `${base}/stamps`, { user: USER.misaki, params: p, body: { keyword: kw } });
    expect(st.status, JSON.stringify(st.body)).toBe(201);
    const memo = await callRoute(putMemo, `${base}/review/memo`, {
      user: USER.misaki, method: "PUT", params: p, body: { body: "楽しかった" },
    });
    expect(memo.status, JSON.stringify(memo.body)).toBe(200);
    const survey = await callRoute(putSurvey, `${base}/review/survey`, {
      user: USER.misaki, method: "PUT", params: p,
      body: { satisfaction: 5, planClarity: 4, wantAgain: "yes", localInteraction: 4, localExploration: 5 },
    });
    expect(survey.status, JSON.stringify(survey.body)).toBe(200);
    const rev = await callRoute(getReview, `${base}/review`, { user: USER.misaki, params: p });
    expect(rev.status, JSON.stringify(rev.body)).toBe(200);
    await advanceTo("2026-11-22T09:00:00+09:00");
    expect(statusOf(gid)).toBe("completed");
    const stats = await callRoute(getStats, "/api/stats", { user: USER.municipalA });
    expect(stats.status, JSON.stringify(stats.body)).toBe(200);
    const ins = await callRoute(getInsights, "/api/insights", { user: USER.businessOwner });
    expect(ins.status, JSON.stringify(ins.body)).toBe(200);
  });
});
