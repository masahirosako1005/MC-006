// 03 のハンドラ(JOIN-API-01〜07)。スタブ(P-2-8 で route() 本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

type RequestParams = GroupParams & { requestId: string };

export const listJoinRequestsHandler = stubRoute<GroupParams>();
export const createJoinRequestHandler = stubRoute<GroupParams>();
export const getMyJoinRequestHandler = stubRoute<GroupParams>();
export const approveJoinRequestHandler = stubRoute<RequestParams>();
export const rejectJoinRequestHandler = stubRoute<RequestParams>();
export const withdrawJoinRequestHandler = stubRoute<RequestParams>();
export const listMyJoinRequestsHandler = stubRoute();
