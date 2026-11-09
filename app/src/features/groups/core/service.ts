// 01 のサービス関数(契約 7.1)。他モジュールはここから import する。
import type { DemoUser, Id, IsoDateTime } from "@/lib/groups-types";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type {
  CreateGroupInput, Group, GroupDetailView, GroupMember, InviteCodeView, MemberRole, MemberView,
  UpdateGroupPatch,
} from "@/features/groups/types";

export { getGroupById, listAllGroups, countActiveMembers, applyLifecyclePatch } from "./repository";
export { normalizeInviteCode, findGroupByInviteCode, assertInviteCode } from "./inviteCode";
export { isMember, isOrganizer, activeMembers } from "./permissions";
export { editableFields } from "./policy";

const ni = (): never => { throw new Error("not implemented"); };

export function createGroup(user: DemoUser, input: CreateGroupInput, lifecycle: GroupLifecycle): Group {
  void user; void input; void lifecycle;
  return ni();
}

export function createGroupInternal(
  input: CreateGroupInput & { official?: boolean; organizerId: Id; lifecycle: GroupLifecycle },
): Group {
  void input;
  return ni();
}

export function getGroup(user: DemoUser, id: Id): GroupDetailView {
  void user; void id;
  return ni();
}

export function updateGroup(
  user: DemoUser, id: Id, patch: UpdateGroupPatch, opts?: { ackReview?: boolean },
): Group {
  void user; void id; void patch; void opts;
  return ni();
}

export function listMembers(user: DemoUser, id: Id): MemberView[] {
  void user; void id;
  return ni();
}

export function addMember(groupId: Id, userId: Id, role?: MemberRole): Readonly<GroupMember> {
  void groupId; void userId; void role;
  return ni();
}

export function markMemberLeft(groupId: Id, userId: Id, at: IsoDateTime): Readonly<GroupMember> {
  void groupId; void userId; void at;
  return ni();
}

export function issueInviteCode(user: DemoUser, id: Id): InviteCodeView {
  void user; void id;
  return ni();
}

export function reissueInviteCode(user: DemoUser, id: Id): InviteCodeView {
  void user; void id;
  return ni();
}

export function getInviteCode(user: DemoUser, id: Id): InviteCodeView | null {
  void user; void id;
  return ni();
}
