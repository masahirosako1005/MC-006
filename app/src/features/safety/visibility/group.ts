// 09: グループの公開範囲(SAF-FN-04〜06)。
import { isMember, isOrganizer, requireGroup } from "@/lib/authz";
import { db } from "@/lib/groups-store";
import { hasBlockAmong } from "../blocks/block-service";
import { maskProfile, visibleProfile } from "./profile";
import { memberSummary } from "./summary";
import type { Id } from "@/lib/groups-types";
import type {
  GroupDetailPublicView, GroupListItem, GroupMemberView, GroupRecord, GroupViewerRole, MaskGroupContext, PublicProfile,
} from "../types";

export function getGroupRole(viewerId: Id, groupId: Id): GroupViewerRole {
  requireGroup(groupId);
  if (isOrganizer(viewerId, groupId)) return "organizer";
  if (isMember(viewerId, groupId)) return "member";
  const pending = db().joinRequests.find((r) => r.groupId === groupId && r.applicantId === viewerId && r.status === "pending");
  return pending ? "applicant" : "outsider";
}

export function maskGroup(
  group: GroupRecord,
  role: GroupViewerRole,
  ctx: MaskGroupContext,
): GroupListItem | GroupDetailPublicView | GroupMemberView {
  const currentCount = ctx.members.length;
  const lc = group.lifecycle;
  const inside = role === "organizer" || role === "member";
  const orgRelation = ctx.viewerId === group.organizerId ? "self" : inside ? "groupmate" : "stranger";
  const organizerProfile: PublicProfile = maskProfile(ctx.organizerProfile, orgRelation);
  const list: GroupListItem = {
    id: group.id,
    name: group.name,
    region: group.region,
    trip: { destination: group.trip.destination, startDate: group.trip.startDate, endDate: group.trip.endDate },
    tags: [...group.tags],
    capacity: group.capacity,
    minMembers: lc.minMembers,
    currentCount,
    vacancy: Math.max(0, group.capacity - currentCount),
    status: lc.status,
    deadlineDate: lc.deadlineDate,
    deadlineAt: lc.deadlineAt,
    official: group.official,
    organizer: { userId: group.organizerId, displayName: ctx.organizerProfile.displayName },
    memberSummary: memberSummary(ctx.members),
  };
  const detail: GroupDetailPublicView = {
    ...list,
    description: group.description,
    organizerProfile,
    myRequest: role === "applicant" || role === "outsider" ? (ctx.myRequest ?? null) : null,
  };
  if (!inside) return detail;
  const members = ctx.members.map((m) => {
    let profile: PublicProfile;
    try {
      profile = visibleProfile({ id: ctx.viewerId }, m.userId, { kind: "member", groupId: group.id });
    } catch {
      // ブロック関係でも同じグループには留まる(SAF-RULE-25)。公開項目だけを返す。
      const p = db().profiles.get(m.userId);
      profile = p ? maskProfile(p, "stranger") : { userId: m.userId, displayName: "" };
    }
    return { userId: m.userId, role: m.userId === group.organizerId ? ("organizer" as const) : ("member" as const), profile };
  });
  const view: GroupMemberView = { ...detail, myRequest: null, members };
  if (role === "organizer" && group.inviteCode && group.inviteCode.revokedAt === null) view.inviteCode = group.inviteCode.code;
  return view;
}

export function isGroupVisibleTo(viewerId: Id, group: GroupRecord, opts?: { inviteVerified?: boolean }): boolean {
  const role = getGroupRole(viewerId, group.id);
  if (role !== "outsider") return true;
  const ids = db().members.filter((m) => m.groupId === group.id && m.status === "active").map((m) => m.userId);
  if (hasBlockAmong(viewerId, [group.organizerId, ...ids])) return false;
  return group.visibility === "public" || opts?.inviteVerified === true;
}
