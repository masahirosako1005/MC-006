// 09: 通報(SAF-FN-15)。対象は message・group・user の 3 種。
import { isMember, isOrganizer } from "@/lib/authz";
import { clock } from "@/lib/clock";
import { invalidInput, notFound } from "@/lib/errors";
import { isId } from "@/lib/ids";
import { db, newId, tx } from "@/lib/groups-store";
import { paginate } from "@/lib/query";
import { sanitizeText } from "@/lib/validation";
import { blockUser } from "../blocks/block-service";
import { checkRate } from "../guards/rate-limit";
import { isGroupVisibleTo } from "../visibility/group";
import type { DemoUser, Id, Page } from "@/lib/groups-types";
import type { CreateReportInput, Report, ReportView } from "../types";

const DAY_MS = 24 * 3600_000;
const PREFIX = { message: "msg", group: "g", user: "u" } as const;

function resolveTarget(
  user: Readonly<DemoUser>,
  input: CreateReportInput,
): { targetUserId: Id; groupId: Id | null; snapshot: string | null } {
  const uid = user.id;
  if (input.targetType === "message") {
    const msg = db().messages.get(input.targetId);
    if (!msg || msg.senderId === null || !isMember(uid, msg.groupId)) throw notFound();
    return { targetUserId: msg.senderId, groupId: msg.groupId, snapshot: sanitizeText(msg.body, { multiline: true }).slice(0, 200) };
  }
  if (input.targetType === "group") {
    const g = db().groups.get(input.targetId);
    if (!g) throw notFound();
    const applicant = db().joinRequests.find((r) => r.groupId === g.id && r.applicantId === uid) !== undefined;
    if (!isMember(uid, g.id) && !applicant && !isGroupVisibleTo(uid, g)) throw notFound();
    return { targetUserId: g.organizerId, groupId: g.id, snapshot: null };
  }
  const target = input.targetId;
  if (target === uid || !db().users.get(target)) throw notFound();
  const gid = input.groupId ?? null;
  if (gid !== null) {
    const g = db().groups.get(gid);
    if (!g) throw notFound();
    const both = isMember(uid, gid) && isMember(target, gid);
    const reqs = db().joinRequests.filter((r) => r.groupId === gid) as { applicantId: Id }[];
    const orgApplicant =
      (g.organizerId === uid && reqs.some((r) => r.applicantId === target)) ||
      (g.organizerId === target && reqs.some((r) => r.applicantId === uid));
    if (both || orgApplicant) return { targetUserId: target, groupId: gid, snapshot: null };
  }
  const visible = db().groups.find((g) => isOrganizer(target, g.id) && isGroupVisibleTo(uid, g)) !== undefined;
  if (!visible) throw notFound();
  return { targetUserId: target, groupId: gid, snapshot: null };
}

export function createReport(
  user: Readonly<DemoUser>,
  input: CreateReportInput,
): { report: Report; deduplicated: boolean } {
  if (!(input.targetType in PREFIX)) throw invalidInput({ targetType: "対象の種類が正しくありません。" });
  if (!isId(PREFIX[input.targetType], input.targetId)) throw invalidInput({ targetId: "対象の指定が正しくありません。" });
  checkRate("report", user.id);
  const t = resolveTarget(user, input);
  const now = clock.now().getTime();
  const dup = db().reports.find(
    (r) =>
      r.reporterId === user.id && r.targetType === input.targetType && r.targetId === input.targetId &&
      r.reason === input.reason && now - Date.parse(r.createdAt) < DAY_MS,
  );
  if (dup) return { report: dup as Report, deduplicated: true };
  const report = tx((s) => {
    const r = s.reports.insert({
      id: newId("rp"),
      reporterId: user.id,
      targetType: input.targetType,
      targetId: input.targetId,
      targetUserId: t.targetUserId,
      groupId: t.groupId,
      reason: input.reason,
      body: sanitizeText(input.body ?? "", { multiline: true }),
      snapshot: t.snapshot,
      status: "received",
      createdAt: clock.nowIso(),
    });
    if (input.alsoBlock === true) blockUser(user, t.targetUserId, t.groupId ?? undefined);
    return r;
  });
  return { report: report as Report, deduplicated: false };
}

export function listMyReports(user: Readonly<DemoUser>, page: { limit: number; offset: number }): Page<ReportView> {
  const mine = db()
    .reports.filter((r) => r.reporterId === user.id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : a.id < b.id ? 1 : -1))
    .map((r): ReportView => ({ id: r.id, targetType: r.targetType, reason: r.reason, status: r.status, createdAt: r.createdAt }));
  return paginate(mine, page);
}
