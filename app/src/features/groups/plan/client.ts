// 05 の薄いクライアント(PLN-FILE-11)。00 の gapi 系を呼ぶだけ。
import { gapi, gdelete, gpatch, gpost, gput } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type {
  CreatePlanItemInput, MeetingNoteView, PlanConflictCurrent, PlanItemId, PlanItemView, PlanView, ReorderInput,
  ScheduleMemoView, UpdateMeetingInput, UpdateMemoInput, UpdatePlanItemInput,
} from "./types";

const base = (groupId: Id) => `/api/groups/${encodeURIComponent(groupId)}/plan`;

export const fetchPlan = (groupId: Id): Promise<PlanView> => gapi<PlanView>(base(groupId));
export const fetchPlanItems = (groupId: Id): Promise<{ items: PlanItemView[]; itemsRevision: number }> =>
  gapi(`${base(groupId)}/items`);
export const putMeeting = (groupId: Id, input: UpdateMeetingInput): Promise<MeetingNoteView> =>
  gput<MeetingNoteView>(`${base(groupId)}/meeting`, input);
export const putMemo = (groupId: Id, input: UpdateMemoInput): Promise<ScheduleMemoView> =>
  gput<ScheduleMemoView>(`${base(groupId)}/memo`, input);
export const postItem = (groupId: Id, input: CreatePlanItemInput): Promise<PlanItemView> =>
  gpost<PlanItemView>(`${base(groupId)}/items`, input);
export const patchItem = (groupId: Id, itemId: PlanItemId, input: UpdatePlanItemInput): Promise<PlanItemView> =>
  gpatch<PlanItemView>(`${base(groupId)}/items/${encodeURIComponent(itemId)}`, input);
export const deleteItem = (groupId: Id, itemId: PlanItemId, baseVersion: number): Promise<{ itemsRevision: number }> =>
  gdelete<{ itemsRevision: number }>(
    `${base(groupId)}/items/${encodeURIComponent(itemId)}?${new URLSearchParams({ baseVersion: String(baseVersion) })}`,
  );
export const putOrder = (groupId: Id, input: ReorderInput): Promise<{ items: PlanItemView[]; itemsRevision: number }> =>
  gput(`${base(groupId)}/order`, input);

/** 409 conflict(reason="version_mismatch")なら detail.current を返す。それ以外は null。 */
export function conflictCurrent(e: unknown): PlanConflictCurrent | null {
  const x = e as { code?: string; reason?: string; detail?: { current?: unknown } } | null;
  if (x && x.code === "conflict" && x.reason === "version_mismatch" && x.detail?.current) {
    return x.detail.current as PlanConflictCurrent;
  }
  return null;
}
