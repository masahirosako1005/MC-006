// 03 参加申請の型(設計 03 §4.1)。
import type { Id, IsoDateTime, Page } from "@/lib/groups-types";
import type { ErrorBody } from "@/lib/errors";
import type { GroupStatus, NotAcceptingReason } from "@/features/groups/lifecycle/types";
import type { PublicProfile } from "@/features/safety/types";

export type JoinRequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "expired";

export type RejectReasonId = "plan_mismatch" | "schedule_mismatch" | "not_specified";

/** コレクション joinRequests(`jr-NNN`)。 */
export interface JoinRequest {
  id: Id;
  groupId: Id;
  applicantId: Id;
  note: string;
  status: JoinRequestStatus;
  consentMinMembers: boolean;
  consentAt: IsoDateTime | null;
  consentedMinMembers: number | null;
  viaInviteCode: boolean;
  reentryOfGroupId: Id | null;
  reasonId: RejectReasonId | null;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
  decidedBy: Id | "system" | null;
}

export interface RequestJoinInput {
  note: string;
  consentMinMembers: boolean;
  consentedMinMembers: number;
  inviteCode?: string;
  reentryOfGroupId?: Id;
  ackReview?: boolean;
}

export interface JoinRequestView {
  id: Id;
  groupId: Id;
  status: JoinRequestStatus;
  note: string;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
  rejectReasonLabel: string | null;
}

export interface OrganizerRequestView {
  request: JoinRequestView & { consentedMinMembers: number | null; consentAt: IsoDateTime | null; viaInviteCode: boolean };
  applicant: PublicProfile;
  canApprove: boolean;
  cannotApproveReason: JoinReason | null;
}

export type OrganizerRequestList = Page<OrganizerRequestView> & {
  capacity: { current: number; max: number; min: number; status: GroupStatus };
  pendingCount: number;
};

export interface MyRequestState {
  request: JoinRequestView;
  canApply: { ok: true } | { ok: false; error: ErrorBody };
  consentText: string;
  consentedMinMembers: number;
}

export interface ApproveResult {
  request: JoinRequestView;
  memberAdded: boolean;
  currentMembers: number;
  groupStatus: GroupStatus;
}

export type JoinReason =
  | "group_not_found" | "request_not_found"
  | "not_verified" | "underage"
  | "not_organizer" | "not_applicant"
  | "already_member" | "duplicate_request" | "already_rejected" | "request_limit"
  | "group_full" | "condition_changed" | "request_not_pending"
  | "text_denied" | "text_review_required"
  | NotAcceptingReason;
