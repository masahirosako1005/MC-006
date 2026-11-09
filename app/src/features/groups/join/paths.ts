// API パスの組み立て(画面用)。
import type { Id } from "@/lib/groups-types";

export const joinPaths = {
  create: (groupId: Id) => `/api/groups/${groupId}/join-requests`,
  list: (groupId: Id) => `/api/groups/${groupId}/join-requests`,
  mine: (groupId: Id) => `/api/groups/${groupId}/my-join-request`,
  approve: (groupId: Id, requestId: Id) => `/api/groups/${groupId}/join-requests/${requestId}/approve`,
  reject: (groupId: Id, requestId: Id) => `/api/groups/${groupId}/join-requests/${requestId}/reject`,
  withdraw: (groupId: Id, requestId: Id) => `/api/groups/${groupId}/join-requests/${requestId}/withdraw`,
  myList: () => "/api/me/join-requests",
};
