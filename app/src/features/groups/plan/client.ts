// 05 の薄いクライアント(PLN-FILE-11)。P-2-16 で 00 の gapi 系を呼ぶ本体に置き換える。
import type { Id } from "@/lib/groups-types";
import type {
  CreatePlanItemInput, MeetingNoteView, PlanItemId, PlanItemView, PlanView, ReorderInput,
  ScheduleMemoView, UpdateMeetingInput, UpdateMemoInput, UpdatePlanItemInput,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export const fetchPlan = (_groupId: Id): Promise<PlanView> => ni();
export const fetchPlanItems = (_groupId: Id): Promise<{ items: PlanItemView[]; itemsRevision: number }> => ni();
export const putMeeting = (_groupId: Id, _input: UpdateMeetingInput): Promise<MeetingNoteView> => ni();
export const putMemo = (_groupId: Id, _input: UpdateMemoInput): Promise<ScheduleMemoView> => ni();
export const postItem = (_groupId: Id, _input: CreatePlanItemInput): Promise<PlanItemView> => ni();
export const patchItem = (_groupId: Id, _itemId: PlanItemId, _input: UpdatePlanItemInput): Promise<PlanItemView> => ni();
export const deleteItem = (_groupId: Id, _itemId: PlanItemId, _baseVersion: number): Promise<{ itemsRevision: number }> => ni();
export const putOrder = (_groupId: Id, _input: ReorderInput): Promise<{ items: PlanItemView[]; itemsRevision: number }> => ni();
