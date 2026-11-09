// 05 の Route Handler(PLN-FILE-06)。スタブ(P-2-16 で route() 本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

type ItemParams = { groupId: string; itemId: string };

export const getPlanHandler = stubRoute<GroupParams>();
export const getItemsHandler = stubRoute<GroupParams>();
export const putMeetingHandler = stubRoute<GroupParams>();
export const putMemoHandler = stubRoute<GroupParams>();
export const postItemHandler = stubRoute<GroupParams>();
export const patchItemHandler = stubRoute<ItemParams>();
export const deleteItemHandler = stubRoute<ItemParams>();
export const putOrderHandler = stubRoute<GroupParams>();
