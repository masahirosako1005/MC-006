// 01 単独の API ハンドラ(スタブ。P-2-3 で route() の本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const patchGroupHandler = stubRoute<GroupParams>();
export const listMembersHandler = stubRoute<GroupParams>();
export const getInviteCodeHandler = stubRoute<GroupParams>();
export const issueInviteCodeHandler = stubRoute<GroupParams>();
export const reissueInviteCodeHandler = stubRoute<GroupParams>();
