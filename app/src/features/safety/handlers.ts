// 09: Route Handler(SAF-API-01〜10、12)。
import { route, created, noContent, ok } from "@/lib/api-route";
import { invalidInput, notFound } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import { LIMITS } from "@/lib/limits";
import { paginate, parsePage } from "@/lib/query";
import { v } from "@/lib/validation";
import { blockUser, listBlocks, unblockUser } from "./blocks/block-service";
import { createReport, listMyReports } from "./reports/report-service";
import { getVerification, setMockVerification } from "./verification/verification-service";
import { getMyProfile, updateProfile, visibleProfile } from "./visibility/profile";
import type { ProfileFieldKey, Visibility } from "./types";

const AGE_BANDS = ["18-19", "20s", "30s", "40s", "50s", "60s", "70s+"] as const;
const PURPOSES = ["sightseeing", "food", "nature", "history", "photo", "relax", "stamp_rally"] as const;
const LEVELS = ["public", "reviewer", "members", "self"] as const;
const REASONS = [
  "contact_solicitation", "harassment", "inappropriate_content", "money_solicitation",
  "off_purpose", "impersonation", "minor_suspected", "other",
] as const;

const level = () => v.enum(LEVELS);
const profileSchema = v.object({
  displayName: v.string({ min: LIMITS.DISPLAY_NAME.min, max: LIMITS.DISPLAY_NAME.max }),
  ageBand: v.enum(AGE_BANDS),
  bio: v.string({ optional: true, max: LIMITS.PROFILE_BIO.max, maxLines: LIMITS.PROFILE_BIO.maxLines, multiline: true }),
  travelPurposes: v.array(v.enum(PURPOSES), { max: LIMITS.TRAVEL_PURPOSES.maxItems, unique: true }),
  visibility: v.object({
    displayName: level(), ageBand: level(), bio: level(), travelPurposes: level(), realName: level(), contact: level(),
  }),
  ackReview: v.boolean({ optional: true }),
});

export const getMyProfileHandler = route(async (c) => getMyProfile(c.user));

export const putMyProfileHandler = route(async (c) => {
  const b = await c.body(profileSchema);
  return updateProfile(c.user, {
    displayName: b.displayName,
    ageBand: b.ageBand,
    bio: b.bio,
    travelPurposes: b.travelPurposes,
    visibility: b.visibility as Record<ProfileFieldKey, Visibility>,
    ackReview: b.ackReview,
  });
});

export const getUserProfileHandler = route<{ userId: string }>(async (c) => {
  const targetId = await c.id("userId", "u");
  const q = c.query(v.object({
    context: v.enum(["request", "member"] as const, { optional: true }),
    groupId: v.id("g", { optional: true }),
  }));
  if (q.context === undefined) {
    if (targetId !== c.user.id) throw invalidInput({ context: "context を指定してください。" });
    return visibleProfile(c.user, targetId, { kind: "list" });
  }
  if (q.groupId === undefined) throw invalidInput({ groupId: "groupId を指定してください。" });
  return visibleProfile(c.user, targetId, { kind: q.context, groupId: q.groupId });
});

export const listBlocksHandler = route(async (c) => listBlocks(c.user, parsePage(c.url.searchParams)));

export const createBlockHandler = route(async (c) => {
  const b = await c.body(v.object({ targetUserId: v.id("u"), sourceGroupId: v.id("g", { optional: true }) }));
  const r = blockUser(c.user, b.targetUserId, b.sourceGroupId);
  return r.created ? created({ blocked: true }) : ok({ blocked: true });
});

export const deleteBlockHandler = route<{ userId: string }>(async (c) => {
  const userId = await c.id("userId", "u");
  unblockUser(c.user, userId);
  return noContent();
});

export const createReportHandler = route(async (c) => {
  const b = await c.body(v.object({
    targetType: v.enum(["message", "group", "user"] as const),
    targetId: v.string({ max: 40 }),
    reason: v.enum(REASONS),
    body: v.string({ optional: true, max: LIMITS.REPORT_BODY.max, multiline: true }),
    groupId: v.id("g", { optional: true }),
    alsoBlock: v.boolean({ optional: true }),
  }));
  const r = createReport(c.user, b);
  const body = { id: r.report.id, status: "received" as const, deduplicated: r.deduplicated };
  return r.deduplicated ? ok(body) : created(body);
});

export const listMyReportsHandler = route(async (c) => listMyReports(c.user, parsePage(c.url.searchParams)));

export const getVerificationHandler = route(async (c) => getVerification(c.user.id));

export const postVerificationHandler = route(async (c) => {
  const b = await c.body(v.object({ declare: v.enum(["adult", "minor", "reset"] as const) }));
  return setMockVerification(c.user.id, b.declare);
});

export const listDemoReportsHandler = route(async (c) => {
  if (process.env.NODE_ENV === "production") throw notFound("ページ");
  const page = parsePage(c.url.searchParams);
  return paginate(db().reports.list().slice().reverse(), page);
}, { demoOnly: true });
