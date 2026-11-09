// ビュー生成(02 DSC-FN-08・11・13・14)。
import type { DemoUser } from "@/lib/groups-types";
import type { Group, GroupMember } from "../core/types";
import { canAcceptRequests, statusLabel } from "@/features/groups/lifecycle";
import { hasBlockAmong } from "@/features/safety/blocks/block-service";
import { ageBandsOf, memberSummary } from "@/features/safety/visibility/summary";
import { visibleProfile } from "@/features/safety/visibility/profile";
import { activeMembers } from "@/lib/authz";
import type { ViewContext } from "./internal";
import type { ApplyState, GroupSummary, HeadcountView, ViewerRelation } from "./types";

export function toHeadcount(g: Group, activeCount: number): HeadcountView {
  const min = g.lifecycle.minMembers;
  return {
    min,
    capacity: g.capacity,
    current: activeCount,
    vacancy: Math.max(0, g.capacity - activeCount),
    shortfall: Math.max(0, min - activeCount),
    isFull: activeCount >= g.capacity,
    reachedMin: activeCount >= min,
  };
}

export function toGroupSummary(viewer: DemoUser, g: Group, ctx: ViewContext): GroupSummary {
  const members = activeMembers(g.id);
  const h = toHeadcount(g, members.length);
  const region = ctx.regions.get(g.region);
  const organizer = visibleProfile(viewer, g.organizerId, { kind: "list" });
  return {
    id: g.id,
    name: g.name,
    campaign: g.campaign,
    region: { id: g.region, name: region?.name ?? g.region },
    trip: { ...g.trip },
    deadlineDate: g.lifecycle.deadlineDate,
    deadlineAt: g.lifecycle.deadlineAt,
    tags: [...g.tags],
    badge: ctx.badges[g.id] ?? null,
    organizerName: organizer.displayName,
    headcount: h,
    status: g.lifecycle.status,
    statusLabel: statusLabel(g.lifecycle.status),
    flags: { full: h.isFull, acceptingRequests: canAcceptRequests(g, ctx.now) && !h.isFull },
    memberSummary: memberSummary(ageBandsOf(members.map((m) => m.userId))),
    viewerRelation: ctx.relation(g.id),
  };
}

export function buildApplyState(g: Group, h: HeadcountView, rel: ViewerRelation): ApplyState {
  const st = g.lifecycle.status;
  if (rel === "organizer" || rel === "member") return { canApply: false, reason: "already_member" };
  if (rel === "requested") return { canApply: false, reason: "already_requested" };
  if (st === "cancelled" || st === "replanned") return { canApply: false, reason: "cancelled" };
  if (st === "completed" || st === "in_progress") return { canApply: false, reason: "finished" };
  if (!canAcceptRequests(g)) return { canApply: false, reason: "closed" };
  if (h.isFull) return { canApply: false, reason: "full" };
  return { canApply: true };
}

export function isListVisible(viewer: DemoUser, g: Group, members: readonly GroupMember[]): boolean {
  if (g.visibility !== "public") return false;
  return !hasBlockAmong(viewer.id, [g.organizerId, ...members.map((m) => m.userId)]);
}
