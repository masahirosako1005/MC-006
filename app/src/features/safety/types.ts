// 09 安全: 型・列挙(設計 4.2、5 章の補助型、6.3 の返却型)。
import type { DateStr, Id, IsoDateTime } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import type { GroupStatus } from "@/features/groups/lifecycle/types";
import type { JoinRequestStatus } from "@/features/groups/join/types";

export type AgeBand = "18-19" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+";
export type TravelPurpose = "sightseeing" | "food" | "nature" | "history" | "photo" | "relax" | "stamp_rally";

export type ProfileFieldKey = "displayName" | "ageBand" | "bio" | "travelPurposes" | "realName" | "contact";
export type Visibility = "public" | "reviewer" | "members" | "self";

export interface Profile {
  id: Id;                               // userId と同じ
  userId: Id;
  displayName: string;
  ageBand: AgeBand;
  bio: string;
  travelPurposes: TravelPurpose[];
  realName: string | null;
  contact: string | null;
  visibility: Record<ProfileFieldKey, Visibility>;
}

export type ProfileRelation = "self" | "stranger" | "reviewer" | "groupmate";
export type GroupViewerRole = "organizer" | "member" | "applicant" | "outsider";

export type PublicProfile = Partial<Pick<Profile, "displayName" | "ageBand" | "bio" | "travelPurposes" | "realName" | "contact">> & {
  userId: Id;
  displayName: string;
};

export type AgeBucket = "20s-" | "30-40s" | "50-60s" | "70s+";
export interface MemberSummary {
  count: number;
  buckets: AgeBucket[] | null;
  hiddenReason: "few_members" | null;
}

export type ReportTargetType = "message" | "group" | "user";
export type ReportReason =
  | "contact_solicitation"
  | "harassment"
  | "inappropriate_content"
  | "money_solicitation"
  | "off_purpose"
  | "impersonation"
  | "minor_suspected"
  | "other";
export type ReportStatus = "received" | "in_review" | "resolved";

export interface Report {
  id: Id;
  reporterId: Id;
  targetType: ReportTargetType;
  targetId: Id;
  targetUserId: Id;
  groupId: Id | null;
  reason: ReportReason;
  body: string;
  snapshot: string | null;
  status: ReportStatus;
  createdAt: IsoDateTime;
}

export interface Block {
  id: Id;
  blockerId: Id;
  blockedId: Id;
  createdAt: IsoDateTime;
  releasedAt: IsoDateTime | null;
  sourceGroupId: Id | null;
}

export type VerificationStatus = "unverified" | "verified" | "underage";
export interface Verification {
  id: Id;                      // userId と同じ
  userId: Id;
  status: VerificationStatus;
  method: "mock_self_declaration";
  confirmedAt: IsoDateTime | null;
}
export type VerifiedAction = "create_group" | "request_join";

export type TextContext =
  | "group_name" | "group_destination" | "group_date_note" | "group_description" | "group_tag"
  | "join_note" | "reject_reason_free"
  | "plan_item_title" | "plan_note" | "chat_message" | "expense_item" | "expense_memo"
  | "rally_memo" | "rally_photo_caption" | "official_summary" | "official_highlight"
  | "profile_display_name" | "profile_bio" | "report_body";
export type TextCategory =
  | "romance_hint" | "contact_exchange" | "contact_pattern" | "money_solicit" | "gender_filter" | "age_filter";
export type TextVerdict = "ok" | "deny" | "review";
export interface TextFinding { ruleId: string; category: TextCategory; severity: "deny" | "review"; start: number; end: number; matched: string }
export interface TextCheckResult { verdict: TextVerdict; findings: TextFinding[]; reason: string | null; suggestion: string | null }

/** 辞書の 1 規則(辞書の実体は P-1-5)。 */
export interface DictRule {
  id: string;
  category: TextCategory;
  severity: "deny" | "review";
  pattern: string;
  contexts?: readonly TextContext[];
  suggestion?: string;
}

export type ProfileContext =
  | { kind: "list" }
  | { kind: "request"; groupId: Id }
  | { kind: "member"; groupId: Id };

export type GroupRecord = Readonly<Group>;
export interface MaskGroupContext {
  now: Date;
  members: ReadonlyArray<{ userId: Id; ageBand: AgeBand }>;
  organizerProfile: Profile;
  viewerId: Id;
  myRequest?: { id: Id; status: JoinRequestStatus } | null;
}

export interface Normalized {
  plain: string;
  squeezed: string;
  plainMap: number[];
  squeezedMap: number[];
}
export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: Id;
  reason: ReportReason;
  body?: string;
  groupId?: Id;
  alsoBlock?: boolean;
}
export interface BlockView { userId: Id; displayName: string; createdAt: IsoDateTime }
export interface ReportView { id: Id; targetType: ReportTargetType; reason: ReportReason; status: ReportStatus; createdAt: IsoDateTime }
export type ProfileInput = Pick<Profile, "displayName" | "ageBand" | "bio" | "travelPurposes"> & {
  visibility: Record<ProfileFieldKey, Visibility>;
  ackReview?: boolean;
};
export interface MyProfileDto {
  profile: Profile;
  allowed: Record<ProfileFieldKey, readonly Visibility[]>;
  editable: Record<ProfileFieldKey, boolean>;
}

// maskGroup が通してよい項目の上限(ホワイトリスト)。
export interface GroupListItem {
  id: Id; name: string; region: Id;
  trip: { destination: string; startDate: DateStr; endDate: DateStr };
  tags: string[]; capacity: number; minMembers: number; currentCount: number; vacancy: number;
  status: GroupStatus;
  deadlineDate: DateStr; deadlineAt: IsoDateTime;
  official: boolean;
  organizer: { userId: Id; displayName: string };
  memberSummary: MemberSummary;
}
export interface GroupDetailPublicView extends GroupListItem {
  description: string;
  organizerProfile: PublicProfile;
  myRequest: { id: Id; status: JoinRequestStatus } | null;
}
export interface GroupMemberView extends GroupDetailPublicView {
  members: Array<{ userId: Id; role: "organizer" | "member"; profile: PublicProfile }>;
  inviteCode?: string;
}
