// 03 のハンドラ(JOIN-API-01〜07)。入力の形式検証と service の呼び出しのみ。
import { route, ok, created } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { parsePage } from "@/lib/query";
import { LIMITS } from "@/lib/limits";
import { rejectProhibitedParams } from "@/features/safety/guards/input";
import type { GroupParams } from "@/features/stub";
import * as svc from "./service";
import { toJoinRequestView } from "./service";
import { joinPaths } from "./paths";

type RequestParams = GroupParams & { requestId: string };

const STATUSES = ["pending", "approved", "rejected", "withdrawn", "expired"] as const;
const REASONS = ["plan_mismatch", "schedule_mismatch", "not_specified"] as const;

export const listJoinRequestsHandler = route<GroupParams>(async (c) => {
  rejectProhibitedParams(c.url.searchParams);
  const groupId = await c.id("groupId", "g");
  const q = c.query(v.object({ status: v.csv(v.enum(STATUSES), { optional: true }) }));
  const page = parsePage(c.url.searchParams);
  const status = q.status && q.status.length ? q.status : ["pending" as const];
  return ok(svc.listRequests(c.user, groupId, { status, ...page }));
});

export const createJoinRequestHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const body = await c.body(v.object({
    note: v.string({ optional: true, max: LIMITS.JOIN_NOTE.max, maxLines: LIMITS.JOIN_NOTE.maxLines, multiline: true }),
    consentMinMembers: v.boolean(),
    consentedMinMembers: v.int({ min: 1 }),
    inviteCode: v.string({ optional: true }),
    reentryOfGroupId: v.id("g", { optional: true }),
    ackReview: v.boolean({ optional: true }),
  }));
  const req = svc.requestJoin(c.user, groupId, {
    note: body.note ?? "",
    consentMinMembers: body.consentMinMembers,
    consentedMinMembers: body.consentedMinMembers,
    inviteCode: body.inviteCode || undefined,
    reentryOfGroupId: body.reentryOfGroupId,
    ackReview: body.ackReview,
  });
  return created(toJoinRequestView(req), joinPaths.mine(groupId));
});

export const getMyJoinRequestHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return ok(svc.getMyRequest(c.user, groupId));
});

export const approveJoinRequestHandler = route<RequestParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const requestId = await c.id("requestId", "jr");
  return ok(svc.approve(c.user, groupId, requestId));
});

export const rejectJoinRequestHandler = route<RequestParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const requestId = await c.id("requestId", "jr");
  const text = await c.req.clone().text();
  const body = text.trim() === "" ? {} : await c.body(v.object({ reasonId: v.enum(REASONS, { optional: true }) }));
  return ok(toJoinRequestView(svc.reject(c.user, groupId, requestId, (body as { reasonId?: (typeof REASONS)[number] }).reasonId)));
});

export const withdrawJoinRequestHandler = route<RequestParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const requestId = await c.id("requestId", "jr");
  return ok(toJoinRequestView(svc.withdrawRequest(c.user, groupId, requestId)));
});

export const listMyJoinRequestsHandler = route(async (c) => {
  rejectProhibitedParams(c.url.searchParams);
  const page = parsePage(c.url.searchParams);
  c.query(v.object({}));
  return ok(svc.listMyRequests(c.user, page));
});
