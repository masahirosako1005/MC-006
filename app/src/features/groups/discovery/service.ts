// 一覧・参加前詳細・招待コード照合(02 DSC-FN-02〜04)。
import { clock } from "@/lib/clock";
import { invalidInput, notFound } from "@/lib/errors";
import { activeMembers, isMember, isOrganizer } from "@/lib/authz";
import { paginate } from "@/lib/query";
import type { DemoUser, Id } from "@/lib/groups-types";
import { findGroupByInviteCode, getGroupById, listAllGroups, normalizeInviteCode } from "../core/service";
import type { Group } from "../core/types";
import { hasPendingRequest } from "../join/stats";
import { statusLabel } from "@/features/groups/lifecycle";
import { getOfficialBadges } from "@/features/official/service";
import { isGroupVisibleTo } from "@/features/safety/visibility/group";
import { visibleProfile } from "@/features/safety/visibility/profile";
import { compareGroups, computeSuggestions, matchesFilter } from "./filter";
import type { GroupView, ViewContext } from "./internal";
import { listRegions } from "./regions";
import { normalizeSearchText } from "./text";
import type {
  GroupListFilter, GroupListResponse, PageRequest, PrivateGroupPreview, PublicGroupDetail, ViewerRelation,
} from "./types";
import { buildApplyState, isListVisible, toGroupSummary, toHeadcount } from "./view";

function makeContext(viewer: DemoUser, campaign: string, groupIds: Id[]): ViewContext {
  return {
    now: clock.now(),
    regions: new Map(listRegions(campaign).map((r) => [r.id, r])),
    badges: getOfficialBadges(groupIds),
    relation(groupId): ViewerRelation {
      if (isOrganizer(viewer, groupId)) return "organizer";
      if (isMember(viewer, groupId)) return "member";
      if (hasPendingRequest(viewer.id, groupId)) return "requested";
      return "none";
    },
  };
}

export function listGroups(viewer: DemoUser, filter: GroupListFilter, page: PageRequest): GroupListResponse {
  const candidates = listAllGroups()
    .filter((g) => g.campaign === filter.campaign && g.visibility === "public")
    .filter((g) => isListVisible(viewer, g, activeMembers(g.id)));
  const ctx = makeContext(viewer, filter.campaign, candidates.map((g) => g.id));
  const views: GroupView[] = candidates.map((g) => {
    const region = ctx.regions.get(g.region);
    return {
      group: g,
      summary: toGroupSummary(viewer, g, ctx),
      activeMembers: activeMembers(g.id),
      searchText: normalizeSearchText(
        [g.name, g.trip.destination, region?.name ?? "", ...(region?.spotAreas ?? []), ...g.tags].join(" "),
      ),
      searchTextTags: g.tags.map(normalizeSearchText),
    };
  });
  const matched = views.filter((v) => matchesFilter(v, filter, ctx.regions.get(v.group.region)));
  const sorted = matched.map((v) => v.summary).sort(compareGroups(filter.sort));
  const p = paginate(sorted, page);

  const noTags: GroupListFilter = { ...filter, tags: [] };
  const counts = new Map<string, number>();
  for (const v of views) {
    if (!matchesFilter(v, noTags, ctx.regions.get(v.group.region))) continue;
    for (const t of v.group.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const facets = {
    tags: [...counts]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)),
  };
  const rest: Omit<GroupListFilter, "campaign"> = { ...filter };
  delete (rest as Partial<GroupListFilter>).campaign;
  return {
    ...p,
    filter: rest,
    facets,
    suggestions: p.total === 0 ? computeSuggestions(viewer, filter, views) : [],
    asOf: clock.nowIso(),
  };
}

function cancelKindOf(g: Group): PublicGroupDetail["cancelKind"] {
  switch (g.lifecycle.cancelReason) {
    case "min_not_reached":
    case "below_min_in_withdrawal":
    case "below_floor":
      return "auto";
    case "organizer_cancelled":
    case "organizer_left":
      return "organizer";
    default:
      return null;
  }
}

export function getPublicGroup(viewer: DemoUser, groupId: Id): PublicGroupDetail {
  const g = getGroupById(groupId);
  if (!g || g.visibility !== "public" || !isGroupVisibleTo(viewer.id, g)) throw notFound("グループ");
  const ctx = makeContext(viewer, g.campaign, [g.id]);
  const s = toGroupSummary(viewer, g, ctx);
  const org = visibleProfile(viewer, g.organizerId, { kind: "list" });
  const organizer: PublicGroupDetail["organizer"] = { displayName: org.displayName };
  if (org.ageBand !== undefined) organizer.ageBand = org.ageBand;
  return {
    ...s,
    kind: "public",
    description: g.description,
    organizer,
    applyState: buildApplyState(g, s.headcount, s.viewerRelation),
    replanOfGroupId: g.lifecycle.replanOfGroupId,
    replannedToGroupId: g.lifecycle.replannedToGroupId,
    cancelKind: cancelKindOf(g),
  };
}

const TERMINAL = new Set(["completed", "cancelled", "replanned"]);

export function findByInviteCode(viewer: DemoUser, rawCode: string): PrivateGroupPreview {
  if (normalizeInviteCode(rawCode) === null) throw invalidInput({ code: "コードの形式が正しくありません。" });
  const g = findGroupByInviteCode(rawCode);
  if (!g || TERMINAL.has(g.lifecycle.status) || !isGroupVisibleTo(viewer.id, g, { inviteVerified: true })) {
    throw notFound("コード");
  }
  const ctx = makeContext(viewer, g.campaign, []);
  const h = toHeadcount(g, activeMembers(g.id).length);
  const region = ctx.regions.get(g.region);
  const org = visibleProfile(viewer, g.organizerId, { kind: "list" });
  return {
    id: g.id,
    name: g.name,
    region: { id: g.region, name: region?.name ?? g.region },
    trip: { ...g.trip },
    headcount: h,
    status: g.lifecycle.status,
    statusLabel: statusLabel(g.lifecycle.status),
    organizerName: org.displayName,
    applyState: buildApplyState(g, h, ctx.relation(g.id)),
  };
}
