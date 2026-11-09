// 申請・承認・却下・取り下げ(JOIN-FN-02〜08・12)。署名スタブ(P-2-7 で実装)。
import type { DemoUser, Id, Page } from "@/lib/groups-types";
import type {
  ApproveResult, JoinRequest, JoinRequestStatus, JoinRequestView, MyRequestState,
  OrganizerRequestList, RejectReasonId, RequestJoinInput,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function requestJoin(user: DemoUser, groupId: Id, input: RequestJoinInput): JoinRequest {
  void user; void groupId; void input; return ni();
}
export function approve(user: DemoUser, groupId: Id, requestId: Id): ApproveResult {
  void user; void groupId; void requestId; return ni();
}
export function reject(user: DemoUser, groupId: Id, requestId: Id, reasonId?: RejectReasonId): JoinRequest {
  void user; void groupId; void requestId; void reasonId; return ni();
}
export function withdrawRequest(user: DemoUser, groupId: Id, requestId: Id): JoinRequest {
  void user; void groupId; void requestId; return ni();
}
export function listRequests(
  user: DemoUser, groupId: Id, opts?: { status?: JoinRequestStatus[]; limit?: number; offset?: number },
): OrganizerRequestList { void user; void groupId; void opts; return ni(); }
export function getMyRequest(user: DemoUser, groupId: Id): MyRequestState { void user; void groupId; return ni(); }
export function listMyRequests(user: DemoUser, page: { limit: number; offset: number }): Page<JoinRequestView> {
  void user; void page; return ni();
}
export function toJoinRequestView(req: JoinRequest): JoinRequestView { void req; return ni(); }
