"use client";
// 画面用フック(JOIN-TASK-12)。
import { useGroupsApi } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import { joinPaths } from "./paths";
import type { JoinRequestStatus, MyRequestState, OrganizerRequestList } from "./types";

export interface RemoteState<T> { data: T | null; loading: boolean; error: Error | null; reload: () => void }

export function useMyJoinRequest(groupId: Id, opts?: { enabled?: boolean }): RemoteState<MyRequestState> {
  const r = useGroupsApi<MyRequestState>(opts?.enabled === false ? null : joinPaths.mine(groupId));
  return { data: r.data, loading: r.loading, error: r.error, reload: () => { void r.reload(); } };
}

export function useOrganizerRequests(groupId: Id, status?: JoinRequestStatus[]): RemoteState<OrganizerRequestList> {
  const qs = status && status.length ? `?status=${status.join(",")}` : "";
  const r = useGroupsApi<OrganizerRequestList>(joinPaths.list(groupId) + qs);
  return { data: r.data, loading: r.loading, error: r.error, reload: () => { void r.reload(); } };
}
