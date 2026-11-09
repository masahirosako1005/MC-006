// 09: グループの公開範囲。スタブ(P-2-2)。
import type { Id } from "@/lib/groups-types";
import type {
  GroupDetailPublicView, GroupListItem, GroupMemberView, GroupRecord, GroupViewerRole, MaskGroupContext,
} from "../types";

export function getGroupRole(viewerId: Id, groupId: Id): GroupViewerRole {
  void viewerId; void groupId;
  throw new Error("not implemented");
}

export function maskGroup(
  group: GroupRecord,
  role: GroupViewerRole,
  ctx: MaskGroupContext,
): GroupListItem | GroupDetailPublicView | GroupMemberView {
  void group; void role; void ctx;
  throw new Error("not implemented");
}

export function isGroupVisibleTo(viewerId: Id, group: GroupRecord, opts?: { inviteVerified?: boolean }): boolean {
  void viewerId; void group; void opts;
  throw new Error("not implemented");
}
