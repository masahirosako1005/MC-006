// 07 サービス層(EXP-FN)。署名スタブ(P-2-19 で実装)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { DomainEvent } from "@/lib/events";
import type { Group } from "@/features/groups/core/types";
import type {
  ExpenseInput, ExpenseListResult, ExpenseNote, ExpenseNoteView, ExpenseSummary, ExpenseUpdateInput,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function listExpenses(_user: DemoUser, _groupId: Id, _page: { limit: number; offset: number }): ExpenseListResult { return ni(); }
export function addExpense(_user: DemoUser, _groupId: Id, _input: ExpenseInput): ExpenseNoteView { return ni(); }
export function updateExpense(_user: DemoUser, _groupId: Id, _expenseId: Id, _input: ExpenseUpdateInput): ExpenseNoteView { return ni(); }
export function deleteExpense(_user: DemoUser, _groupId: Id, _expenseId: Id, _baseVersion: number): void { ni(); }
export function getExpenseSummary(_user: DemoUser, _groupId: Id): ExpenseSummary { return ni(); }
export function canModifyExpense(
  _user: DemoUser,
  _group: Group,
  _note?: ExpenseNote,
): { ok: true } | { ok: false; code: "forbidden" | "unavailable_state"; message: string } { return ni(); }
export function unsettledBalanceOf(_groupId: Id, _userId: Id): number { return ni(); }
export function onGroupMemberLeft(_e: Extract<DomainEvent, { type: "member_left" }>): void {
  // 項目は残す(EXP-DEC-04)。将来の匿名化処理の置き場所。
}
