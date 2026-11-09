import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/notify/service", () => ({ notify: vi.fn() }));
vi.mock("@/features/safety/guards/input", () => ({
  rejectProhibitedParams: vi.fn((p: URLSearchParams) => {
    if (p.has("gender")) throw new (class extends Error {})("prohibited");
  }),
}));
vi.mock("./service", () => ({
  requestJoin: vi.fn(), approve: vi.fn(), reject: vi.fn(), withdrawRequest: vi.fn(),
  listRequests: vi.fn(() => ({ items: [], total: 0, limit: 20, offset: 0, hasMore: false })),
  getMyRequest: vi.fn(), listMyRequests: vi.fn(),
  toJoinRequestView: vi.fn((r: unknown) => r),
}));

import { db } from "@/lib/groups-store";
import { AppError } from "@/lib/errors";
import { callRoute, insertGroup, insertMember, resetForTest } from "@/test/helpers";
import { listJoinRequestsHandler, approveJoinRequestHandler } from "./handlers";
import * as svc from "./service";
import type { JoinRequest } from "./types";

function jr(id: string, groupId: string, applicantId: string): JoinRequest {
  return db().joinRequests.insert({
    id, groupId, applicantId, note: "", status: "pending", consentMinMembers: true, consentAt: null,
    consentedMinMembers: 2, viaInviteCode: false, reentryOfGroupId: null, reasonId: null,
    createdAt: "2026-11-01T00:00:00+09:00", decidedAt: null, decidedBy: null,
  }) as JoinRequest;
}

const ev = (groupId: string, to: string) =>
  ({ type: "status_changed", groupId, from: "min_reached", to, cancelReason: null, revision: 2, at: "2026-12-02T00:00:00+09:00" }) as const;

let notify: typeof import("@/features/notify/service").notify;
let expireOnStatusChanged: typeof import("./expire").expireOnStatusChanged;
beforeEach(async () => {
  resetForTest(); vi.clearAllMocks();
  // setup.ts が先に実 notify を読み込むため、モック後に読み直す。
  vi.resetModules();
  notify = (await import("@/features/notify/service")).notify;
  expireOnStatusChanged = (await import("./expire")).expireOnStatusChanged;
});

describe("expireOnStatusChanged (JOIN-T-31/41/42)", () => {
  it("T5 withdrawal_period: pending を expired にして join_expired を送る。再処理で増えない", () => {
    const g = insertGroup({ id: "g-901" });
    jr("jr-901", g.id, "u-005");
    expect(expireOnStatusChanged(ev(g.id, "withdrawal_period"))).toBe(1);
    const r = db().joinRequests.get("jr-901")!;
    expect(r.status).toBe("expired");
    expect(r.decidedBy).toBe("system");
    expect(r.decidedAt).toBe("2026-12-02T00:00:00+09:00");
    expect(notify).toHaveBeenCalledTimes(1);
    expect(vi.mocked(notify).mock.calls[0][0]).toMatchObject({ kind: "join_expired", eventKey: "je:jr-901" });
    expect(expireOnStatusChanged(ev(g.id, "withdrawal_period"))).toBe(0);
    expect(notify).toHaveBeenCalledTimes(1);
  });
  it("cancelled: expired になるが join_expired は送らない", () => {
    const g = insertGroup({ id: "g-902" });
    jr("jr-902", g.id, "u-003");
    expect(expireOnStatusChanged(ev(g.id, "cancelled"))).toBe(1);
    expect(db().joinRequests.get("jr-902")!.status).toBe("expired");
    expect(notify).not.toHaveBeenCalled();
  });
  it("recruiting に戻るだけなら pending のまま", () => {
    const g = insertGroup({ id: "g-903" });
    jr("jr-903", g.id, "u-003");
    expect(expireOnStatusChanged(ev(g.id, "recruiting"))).toBe(0);
    expect(db().joinRequests.get("jr-903")!.status).toBe("pending");
  });
});

describe("handlers (JOIN-T-20/46)", () => {
  it("一覧は service を呼んで 200", async () => {
    const g = insertGroup({ id: "g-904", organizerId: "u-001" });
    insertMember(g.id, "u-001", "organizer", "m-950");
    const r = await callRoute(listJoinRequestsHandler, `/api/groups/${g.id}/join-requests`, { user: "u-001", params: { groupId: g.id } });
    expect(r.status).toBe(200);
    expect(svc.listRequests).toHaveBeenCalled();
  });
  it("service の拒否(not_organizer)はそのまま 403", async () => {
    vi.mocked(svc.approve).mockImplementationOnce(() => { throw new AppError("forbidden", "幹事のみ", { reason: "not_organizer" }); });
    const r = await callRoute(approveJoinRequestHandler, "/x", {
      method: "POST", body: {}, user: "u-002", params: { groupId: "g-001", requestId: "jr-001" },
    });
    expect(r.status).toBe(403);
  });
  it("gender クエリは 400 ではなく先頭で拒否される(rejectProhibitedParams を呼ぶ)", async () => {
    const r = await callRoute(listJoinRequestsHandler, "/x?gender=female", { user: "u-001", params: { groupId: "g-001" } });
    expect(r.status).toBeGreaterThanOrEqual(400);
    expect(svc.listRequests).not.toHaveBeenCalled();
  });
});
