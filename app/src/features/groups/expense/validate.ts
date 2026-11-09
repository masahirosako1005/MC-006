// 07 入力検証。P-2-19 で実装。
import type { DateStr } from "@/lib/groups-types";
import type { ExpenseInput, ExpenseUpdateInput } from "./types";

export type ExpenseValidateCtx = {
  activeMemberIds: ReadonlySet<string>;
  allowedLegacyIds?: ReadonlySet<string>;
  today: DateStr;
};

export function validateExpenseInput(_input: unknown, _ctx: ExpenseValidateCtx): ExpenseInput {
  throw new Error("not implemented");
}

export function validateExpenseUpdateInput(_input: unknown, _ctx: ExpenseValidateCtx): ExpenseUpdateInput {
  throw new Error("not implemented");
}
