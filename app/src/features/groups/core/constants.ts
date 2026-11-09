// 01 の定数(設計 01 第 12.1 節)。値は P-2-3 で確定する。
import type { EditableField } from "@/features/groups/types";

export const ORGANIZER_GROUP_LIMIT = 5;
export const INVITE_CODE_LENGTH = 10;
export const INVITE_CODE_CHARSET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const INVITE_CODE_TTL_DAYS = 7;
export const MAX_TRIP_DAYS = 14;
export const SUGGESTED_TAGS: readonly string[] = [];
export const ORGANIZER_CAN_EDIT: readonly EditableField[] = [];
