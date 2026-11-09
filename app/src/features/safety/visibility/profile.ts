// 09: プロフィールの公開範囲(SAF-FN-01〜03、28)。
import { isMember, isOrganizer } from "@/lib/authz";
import { invalidInput, notFound } from "@/lib/errors";
import { db, tx } from "@/lib/groups-store";
import { assertTextAllowed } from "../text/check-text";
import { checkRate } from "../guards/rate-limit";
import { isBlocked } from "../blocks/block-service";
import { FIELD_POLICY, RELATION_MAX_RANK, VISIBILITY_RANK } from "../policy";
import type { DemoUser, Id } from "@/lib/groups-types";
import type {
  MyProfileDto, Profile, ProfileContext, ProfileFieldKey, ProfileInput, ProfileRelation, PublicProfile, Visibility,
} from "../types";

const FIELDS = Object.keys(FIELD_POLICY) as ProfileFieldKey[];

export function maskProfile(profile: Profile, relation: ProfileRelation): PublicProfile {
  const max = RELATION_MAX_RANK[relation];
  const can = (k: ProfileFieldKey) => relation === "self" || VISIBILITY_RANK[profile.visibility[k]] <= max;
  const out: PublicProfile = { userId: profile.userId, displayName: profile.displayName };
  if (can("ageBand")) out.ageBand = profile.ageBand;
  if (can("bio")) out.bio = profile.bio;
  if (can("travelPurposes")) out.travelPurposes = [...profile.travelPurposes];
  if (can("realName") && profile.realName !== null) out.realName = profile.realName;
  if (can("contact") && profile.contact !== null) out.contact = profile.contact;
  return out;
}

export function resolveProfileRelation(viewerId: Id, targetId: Id, ctx: ProfileContext): ProfileRelation {
  if (viewerId === targetId) return "self";
  if (isBlocked(viewerId, targetId)) throw notFound("プロフィール");
  if (ctx.kind === "list") return "stranger";
  if (ctx.kind === "request") {
    if (!isOrganizer(viewerId, ctx.groupId)) throw notFound("プロフィール");
    const jrs = db().joinRequests.filter((r) => r.groupId === ctx.groupId && r.applicantId === targetId);
    if (jrs.length === 0) throw notFound("プロフィール");
    return jrs.some((r) => r.status === "pending") ? "reviewer" : "stranger";
  }
  if (isMember(viewerId, ctx.groupId) && isMember(targetId, ctx.groupId)) return "groupmate";
  throw notFound("プロフィール");
}

export function visibleProfile(viewer: { id: Id }, targetId: Id, ctx: ProfileContext): PublicProfile {
  const relation = resolveProfileRelation(viewer.id, targetId, ctx);
  const profile = db().profiles.get(targetId);
  if (!profile) throw notFound("プロフィール");
  return maskProfile(profile, relation);
}

export function getMyProfile(user: Readonly<DemoUser>): MyProfileDto {
  const profile = db().profiles.getOrThrow(user.id, "プロフィール");
  const allowed = {} as Record<ProfileFieldKey, readonly Visibility[]>;
  const editable = {} as Record<ProfileFieldKey, boolean>;
  for (const k of FIELDS) {
    allowed[k] = FIELD_POLICY[k].allowed;
    editable[k] = FIELD_POLICY[k].editable;
  }
  return { profile: structuredClone(profile) as Profile, allowed, editable };
}

export function updateProfile(user: Readonly<DemoUser>, input: ProfileInput): MyProfileDto {
  checkRate("profile_update", user.id);
  const fields: Record<string, string> = {};
  for (const k of FIELDS) {
    const lv = input.visibility[k];
    if (!(FIELD_POLICY[k].allowed as readonly string[]).includes(lv)) fields[`visibility.${k}`] = "この項目では選べない公開範囲です。";
  }
  if (Object.keys(fields).length > 0) throw invalidInput(fields);
  assertTextAllowed(input.displayName, "profile_display_name", "displayName", { ackReview: input.ackReview });
  assertTextAllowed(input.bio, "profile_bio", "bio", { ackReview: input.ackReview });
  tx((s) => {
    const cur = s.profiles.getOrThrow(user.id, "プロフィール");
    s.profiles.update(user.id, {
      displayName: input.displayName,
      ageBand: input.ageBand,
      bio: input.bio,
      travelPurposes: [...input.travelPurposes],
      visibility: { ...cur.visibility, ...input.visibility },
    });
    s.users.update(user.id, { displayName: input.displayName });
  });
  return getMyProfile(user);
}
