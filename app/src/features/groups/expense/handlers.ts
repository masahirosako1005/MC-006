// 07 の Route Handler(EXP-API-01〜05)。スタブ(P-2-19 で route() 本体に置き換える)。
import { stubRoute } from "@/features/stub";
import type { GroupParams } from "@/features/stub";

export const listExpensesHandler = stubRoute<GroupParams>();
export const addExpenseHandler = stubRoute<GroupParams>();
export const updateExpenseHandler = stubRoute<{ groupId: string; expenseId: string }>();
export const deleteExpenseHandler = stubRoute<{ groupId: string; expenseId: string }>();
export const getExpenseSummaryHandler = stubRoute<GroupParams>();
