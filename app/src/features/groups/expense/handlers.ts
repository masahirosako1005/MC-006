// 07 の Route Handler(EXP-API-01〜05)。
import { route, ok, created, noContent } from "@/lib/api-route";
import { v } from "@/lib/validation";
import type { Schema } from "@/lib/validation";
import { parsePage } from "@/lib/query";
import type { GroupParams } from "@/features/stub";
import { EXPENSE_LIMITS } from "./constants";
import { addExpense, deleteExpense, getExpenseSummary, listExpenses, updateExpense } from "./service";
import type { ExpenseInput, ExpenseUpdateInput } from "./types";

// 検証は service(validate.ts)が行うので、本文はそのまま渡す。
const rawBody: Schema<unknown> = { parse: (input) => input };
type ItemParams = { groupId: string; expenseId: string };

export const listExpensesHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const page = parsePage(c.url.searchParams, { defaultLimit: EXPENSE_LIMITS.pageLimit, maxLimit: EXPENSE_LIMITS.pageLimit });
  return ok(listExpenses(c.user, groupId, page));
});

export const addExpenseHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const body = await c.body(rawBody);
  const note = addExpense(c.user, groupId, body as ExpenseInput);
  return created(note, `/api/groups/${groupId}/expenses/${note.id}`);
});

export const updateExpenseHandler = route<ItemParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const expenseId = await c.id("expenseId", "ex");
  const body = await c.body(rawBody);
  return ok(updateExpense(c.user, groupId, expenseId, body as ExpenseUpdateInput));
});

export const deleteExpenseHandler = route<ItemParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const expenseId = await c.id("expenseId", "ex");
  const q = c.query(v.object({ baseVersion: v.int({ min: 1, coerce: true }) }));
  deleteExpense(c.user, groupId, expenseId, q.baseVersion);
  return noContent();
});

export const getExpenseSummaryHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  return ok(getExpenseSummary(c.user, groupId));
});
