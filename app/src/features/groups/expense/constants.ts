// 07 の制約値(EXP 4.1)。上限は 00 の LIMITS を参照する。
import { LIMITS } from "@/lib/limits";

export const EXPENSE_LIMITS = {
  targetsMax: LIMITS.CAPACITY.max,
  dateMin: "2020-01-01",
  dateFutureDays: 366,
  pageLimit: 50,
} as const;
export const EXPENSE_TRANSFER_HINT_ENABLED = true;
export const LEFT_MEMBER_LABEL = "元メンバー";
