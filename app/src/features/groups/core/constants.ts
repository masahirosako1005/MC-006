// 01 の定数(設計 01 第 12.1 節)。
import type { EditableField } from "@/features/groups/types";

export const ORGANIZER_GROUP_LIMIT = 5;
export const INVITE_CODE_LENGTH = 10;
export const INVITE_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_TTL_DAYS = 7;
export const MAX_TRIP_DAYS = 14;
export const MAX_START_AHEAD_DAYS = 365;
export const SUGGESTED_TAGS: readonly string[] = [
  "温泉", "食べ歩き", "自然", "歴史", "写真", "のんびり", "絶景", "グルメ",
];
// 幹事が編集できる項目の全体(状態別の可否は policy.ts)。
export const ORGANIZER_CAN_EDIT: readonly EditableField[] = [
  "name", "region", "trip", "capacity", "visibility", "tags", "description",
];
