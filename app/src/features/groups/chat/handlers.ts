// 06 の Route Handler(CHT-API-01〜04)。スタブ(P-2-18 で route() 本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const listMessagesHandler = stubRoute<GroupParams>();
export const postMessageHandler = stubRoute<GroupParams>();
export const reportMessageHandler = stubRoute<{ groupId: string; messageId: string }>();
export const markChatReadHandler = stubRoute<GroupParams>();
