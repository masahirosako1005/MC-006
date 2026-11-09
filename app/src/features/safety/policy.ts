// 09: 方針定数(設計 4.4)。値は設計どおりで、本実装でもそのまま使う。
import type { ProfileFieldKey, ProfileRelation, Visibility } from "./types";

export const SAFETY_POLICY = {
  sameGroupOnBlock: "stay",
  blockAffectsListAndApply: "symmetric",
  chatHideScope: "blocked_by_me",
  notifyTargetOnReport: false,
  minorPolicy: "deny_writes",
  summaryMinCount: 4,
} as const;

export const VISIBILITY_RANK: Record<Visibility, number> = { public: 0, reviewer: 1, members: 2, self: 3 };
export const RELATION_MAX_RANK: Record<ProfileRelation, number> = { stranger: 0, reviewer: 1, groupmate: 2, self: 3 };

export const FIELD_POLICY: Record<ProfileFieldKey, { editable: boolean; allowed: readonly Visibility[]; initial: Visibility }> = {
  displayName:    { editable: true,  allowed: ["public"],                               initial: "public" },
  ageBand:        { editable: true,  allowed: ["reviewer", "members", "self"],           initial: "reviewer" },
  bio:            { editable: true,  allowed: ["public", "reviewer", "members", "self"], initial: "reviewer" },
  travelPurposes: { editable: true,  allowed: ["public", "reviewer", "members", "self"], initial: "reviewer" },
  realName:       { editable: false, allowed: ["members", "self"],                       initial: "self" },
  contact:        { editable: false, allowed: ["members", "self"],                       initial: "self" },
};

export const RATE_LIMITS = {
  chat_post:      { limit: 10, windowMs: 60_000 },
  join_request:   { limit: 5,  windowMs: 600_000 },
  report:         { limit: 10, windowMs: 600_000 },
  block:          { limit: 20, windowMs: 600_000 },
  profile_update: { limit: 10, windowMs: 60_000 },
  group_create:   { limit: 5,  windowMs: 600_000 },
} as const;
