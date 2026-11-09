// 05 旅程の型(PLN-FILE-01)。
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { GroupStatus } from "@/features/groups/lifecycle/types";
import { LIMITS } from "@/lib/limits";

export type PlanItemId = Id;
export type ClockTime = string;

export interface PlanItem {
  id: PlanItemId;
  groupId: Id;
  date: DateStr;
  time: ClockTime | null;
  title: string;
  spotId: number | null;
  note: string;
  seq: number;
  version: number;
  createdBy: Id;
  createdAt: IsoDateTime;
  updatedBy: Id;
  updatedAt: IsoDateTime;
}

export interface MeetingNote {
  text: string;
  spotId: number | null;
  date: DateStr | null;
  time: ClockTime | null;
  version: number;
  updatedBy: Id | null;
  updatedAt: IsoDateTime | null;
}

export interface ScheduleMemo {
  text: string;
  version: number;
  updatedBy: Id | null;
  updatedAt: IsoDateTime | null;
}

/** db().plans の要素(id = groupId) */
export interface GroupPlan {
  id: Id;
  groupId: Id;
  meeting: MeetingNote;
  scheduleMemo: ScheduleMemo;
  items: PlanItem[];
  itemsRevision: number;
}

export interface SpotRef { id: number; name: string; area: string }
export interface ActorRef { userId: Id; displayName: string; isFormerMember: boolean }

export interface PlanItemView extends Omit<PlanItem, "spotId" | "createdBy" | "updatedBy"> {
  spot: SpotRef | null;
  createdBy: ActorRef;
  updatedBy: ActorRef;
  outOfRange: boolean;
}
export interface MeetingNoteView extends Omit<MeetingNote, "spotId" | "updatedBy"> {
  spot: SpotRef | null;
  updatedBy: ActorRef | null;
  outOfRange: boolean;
}
export interface ScheduleMemoView extends Omit<ScheduleMemo, "updatedBy"> { updatedBy: ActorRef | null }

export interface PlanView {
  groupId: Id;
  groupStatus: GroupStatus;
  editable: boolean;
  readOnlyReason: string | null;
  schedule: { startDate: DateStr; endDate: DateStr };
  meeting: MeetingNoteView;
  scheduleMemo: ScheduleMemoView;
  items: PlanItemView[];
  itemsRevision: number;
  spotOptions: SpotRef[];
  limits: typeof PLAN_LIMITS;
  serverTime: IsoDateTime;
}

export type PlanConflictCurrent =
  | PlanItemView | MeetingNoteView | ScheduleMemoView | { items: PlanItemView[]; itemsRevision: number };

export interface UpdateMeetingInput  { baseVersion: number; text?: string; spotId?: number | null; date?: DateStr | null; time?: ClockTime | null; ackReview?: boolean }
export interface UpdateMemoInput     { baseVersion: number; text?: string; ackReview?: boolean }
export interface CreatePlanItemInput { date: DateStr; time?: ClockTime | null; title: string; spotId?: number | null; note?: string; ackReview?: boolean }
export interface UpdatePlanItemInput { baseVersion: number; date?: DateStr; time?: ClockTime | null; title?: string; spotId?: number | null; note?: string; ackReview?: boolean }
export interface ReorderInput        { date: DateStr; orderedIds: PlanItemId[]; baseRevision: number }

export const PLAN_LIMITS = {
  titleMax: LIMITS.PLAN_ITEM_TITLE.max,
  noteMax: LIMITS.PLAN_ITEM_NOTE.max,
  noteLinesMax: LIMITS.PLAN_ITEM_NOTE.maxLines,
  meetingTextMax: LIMITS.MEETING.max,
  memoMax: LIMITS.SCHEDULE_MEMO.max,
  itemsPerGroupMax: LIMITS.PLAN_ITEMS.maxItems,
  itemsPerDateMax: LIMITS.PLAN_ITEMS.maxPerDate,
} as const;
