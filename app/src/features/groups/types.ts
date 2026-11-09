// 01 グループ中核の型(設計 01 第 4.2 節・第 5.1 節。契約 4.2)。
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { GroupLifecycle, LifecycleInput } from "@/features/groups/lifecycle/types";
import type { AgeBand } from "@/features/safety/types";

export type Visibility = "public" | "private";
export type MemberRole = "organizer" | "member";
export type MemberStatus = "active" | "left";

export interface Trip {
  destination: string;
  startDate: DateStr;
  endDate: DateStr;
  dateNote: string;
}

export interface InviteCode {
  code: string;
  issuedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  revokedAt: IsoDateTime | null;
}

export interface Group {
  id: Id;
  name: string;
  campaign: string;
  region: Id;
  trip: Trip;
  capacity: number;
  visibility: Visibility;
  tags: string[];
  description: string;
  official: boolean;
  organizerId: Id;
  inviteCode: InviteCode | null;
  lifecycle: GroupLifecycle;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface GroupMember {
  id: Id;
  groupId: Id;
  userId: Id;
  role: MemberRole;
  status: MemberStatus;
  joinedAt: IsoDateTime;
  leftAt: IsoDateTime | null;
}

export interface CreateGroupInput {
  name: string;
  campaign: string;
  region: Id;
  trip: Trip;
  capacity: number;
  visibility: Visibility;
  tags: string[];
  description: string;
}

export type CreateGroupRequest = CreateGroupInput & LifecycleInput & { ackReview?: boolean };

export type EditableField =
  | "name" | "region" | "trip" | "capacity" | "visibility" | "tags" | "description";

export type UpdateGroupPatch = Partial<Pick<CreateGroupInput, EditableField>>;
export type UpdateGroupRequest = UpdateGroupPatch & { ackReview?: boolean };

export interface GroupDetailView {
  kind: "member";
  group: Omit<Group, "inviteCode">;
  role: MemberRole;
  activeCount: number;
  canEdit: boolean;
  hasActiveInviteCode: boolean;
}

export interface MemberView {
  userId: Id;
  displayName: string;
  ageBand: AgeBand | null;
  role: MemberRole;
  joinedAt: IsoDateTime;
  isSelf: boolean;
}

export interface InviteCodeView {
  code: string;
  issuedAt: IsoDateTime;
  expiresAt: IsoDateTime;
  expired: boolean;
}
