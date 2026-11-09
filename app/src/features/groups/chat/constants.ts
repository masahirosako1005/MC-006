// 06 の制約値(CHT 4.3)。本文長などの上限は 00 の LIMITS.CHAT を参照する。
export const PAGE_DEFAULT = 50;
export const PAGE_MAX = 100;
export const POLL_INTERVAL_MS = 5000;
export const POLL_BACKOFF_MS = [5000, 10000, 30000] as const;
export const READ_DEBOUNCE_MS = 1000;
export const AT_BOTTOM_PX = 80;
export const SYSTEM_DEDUPE_SEC = 5;
export const GROUP_RETENTION = 500;
export const CHAT_FREE_INPUT = true;
