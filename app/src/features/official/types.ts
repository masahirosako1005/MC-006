// 11 公式枠・地元の枠の型(11 §4.1、§5.1)。
import type { Id, IsoDateTime } from "@/lib/groups-types";
import type { CreateGroupInput } from "@/features/groups/core/types";
import type { LifecycleInput } from "@/features/groups/lifecycle/types";

export interface Municipality {
  id: string;
  campaign: string;
  displayName: string;
  regionIds: Id[];
}

export interface LocalHost {
  id: string;
  campaign: string;
  displayName: string;
  intro: string;
}

export type ListingKind = "official_plan" | "gathering_event" | "host_slot";

export type SponsorRef =
  | { type: "municipality"; id: string }
  | { type: "host"; id: string };

export type ApprovalMode = "organizer";

/** 保存先: db().listings(id = Group.id) */
export interface Listing {
  id: Id;
  kind: ListingKind;
  sponsor: SponsorRef;
  summary: string;
  highlights: string[];
  approvalMode: ApprovalMode;
  createdAt: IsoDateTime;
}

export interface OfficialBadgeView {
  kind: ListingKind;
  official: boolean;
  sponsorName: string;
  badgeLabel: "自治体公式" | "地元の方の同行枠" | "地元の方のイベント";
  summary: string;
  highlights: string[];
}
export type HostBadgeView = OfficialBadgeView & { official: false };

export interface OfficialSlotInput {
  municipalityId: string;
  kind: "official_plan" | "gathering_event";
  group: Omit<CreateGroupInput, "visibility"> & LifecycleInput;
  summary: string;
  highlights: string[];
  ackReview?: boolean;
}
export interface HostSlotInput {
  hostId: string;
  kind: "host_slot" | "gathering_event";
  group: Omit<CreateGroupInput, "visibility"> & LifecycleInput;
  summary: string;
  highlights: string[];
  ackReview?: boolean;
}

export interface SlotCreated { groupId: Id; listing: Listing; badge: OfficialBadgeView }
