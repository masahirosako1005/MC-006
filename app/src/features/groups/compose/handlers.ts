// 合成層(所有 01。どのモジュールからも import されない)。スタブ。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const createGroupHandler = stubRoute();
export const getGroupDetailHandler = stubRoute<GroupParams>();
