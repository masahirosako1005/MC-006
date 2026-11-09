// 04 のハンドラ(LCY-API-01〜07)。スタブ(P-2-12 で route() 本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const getLifecycleHandler = stubRoute<GroupParams>();
export const withdrawHandler = stubRoute<GroupParams>();
export const cancelHandler = stubRoute<GroupParams>();
export const changeConditionsHandler = stubRoute<GroupParams>();
export const getReplanDraftHandler = stubRoute<GroupParams>();
export const replanHandler = stubRoute<GroupParams>();
export const getStatusLogHandler = stubRoute<GroupParams>();
