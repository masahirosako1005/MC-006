// 05 サービス層(PLN-FILE-05)。署名スタブ。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Db } from "@/lib/groups-store";
import type { Group } from "@/features/groups/core/types";
import type {
  CreatePlanItemInput, GroupPlan, MeetingNoteView, PlanItem, PlanItemId, PlanItemView, PlanView,
  ReorderInput, ScheduleMemoView, UpdateMeetingInput, UpdateMemoInput, UpdatePlanItemInput,
} from "./types";

type U = Readonly<DemoUser>;
const ni = (): never => { throw new Error("not implemented"); };

export function getPlan(_user: U, _groupId: Id): PlanView { return ni(); }
export function updateMeeting(_user: U, _groupId: Id, _input: UpdateMeetingInput): MeetingNoteView { return ni(); }
export function updateScheduleMemo(_user: U, _groupId: Id, _input: UpdateMemoInput): ScheduleMemoView { return ni(); }
export function listItems(_user: U, _groupId: Id): { items: PlanItemView[]; itemsRevision: number } { return ni(); }
export function createItem(_user: U, _groupId: Id, _input: CreatePlanItemInput): PlanItemView { return ni(); }
export function updateItem(_user: U, _groupId: Id, _itemId: PlanItemId, _input: UpdatePlanItemInput): PlanItemView { return ni(); }
export function deleteItem(_user: U, _groupId: Id, _itemId: PlanItemId, _baseVersion: number): { itemsRevision: number } { return ni(); }
export function reorderItems(_user: U, _groupId: Id, _input: ReorderInput): { items: PlanItemView[]; itemsRevision: number } { return ni(); }
export function sortItems(_items: readonly PlanItem[]): PlanItem[] { return ni(); }
export function assertCanRead(_user: U, _groupId: Id): Group { return ni(); }
export function assertCanEdit(_user: U, _groupId: Id): Group { return ni(); }
export function assertPlanTextsAllowed(
  _input: { title?: string; note?: string; text?: string },
  _kind: "item" | "meeting" | "memo",
  _ackReview?: boolean,
): void { ni(); }
export function ensurePlan(_db: Db, _groupId: Id): Readonly<GroupPlan> { return ni(); }
export function emptyPlan(_groupId: Id): GroupPlan { return ni(); }
