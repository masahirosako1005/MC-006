// 画面用フック(JOIN-TASK-12)。署名スタブ(P-2-8 で useGroupsApi を使う本体に置き換える)。
import type { Id } from "@/lib/groups-types";
import type { JoinRequestStatus, MyRequestState, OrganizerRequestList } from "./types";

export interface RemoteState<T> { data: T | null; loading: boolean; error: Error | null; reload: () => void }

const idle = <T,>(): RemoteState<T> => ({ data: null, loading: false, error: null, reload: () => {} });

export function useMyJoinRequest(groupId: Id, opts?: { enabled?: boolean }): RemoteState<MyRequestState> {
  void groupId; void opts;
  return idle<MyRequestState>();
}
export function useOrganizerRequests(groupId: Id, status?: JoinRequestStatus[]): RemoteState<OrganizerRequestList> {
  void groupId; void status;
  return idle<OrganizerRequestList>();
}
