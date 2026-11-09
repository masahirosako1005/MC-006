// 07 サービス層(EXP-FN)。
import { activeMembers, isMember } from "@/lib/authz";
import { clock } from "@/lib/clock";
import { AppError, conflict, forbidden, unavailableState } from "@/lib/errors";
import type { DomainEvent } from "@/lib/events";
import { db, newId, tx } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { LIMITS } from "@/lib/limits";
import { paginate } from "@/lib/query";
import type { Group } from "@/features/groups/core/types";
import { canEditExpenses, statusLabel } from "@/features/groups/lifecycle";
import { assertGroupAccess, assertInGroup } from "@/features/safety/guards/access";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { visibleProfile } from "@/features/safety/visibility/profile";
import { EXPENSE_TRANSFER_HINT_ENABLED, LEFT_MEMBER_LABEL } from "./constants";
import { EXPENSE_MESSAGES } from "./messages";
import { computeBalances, computeTransfers } from "./settlement";
import { splitAmount } from "./split";
import { assertNoPaymentInducement } from "./text-guard";
import { validateExpenseInput, validateExpenseUpdateInput } from "./validate";
import type { ExpenseValidateCtx } from "./validate";
import type {
  ExpenseInput, ExpenseListResult, ExpenseNote, ExpenseNoteView, ExpenseSummary, ExpenseUpdateInput,
} from "./types";

export function canModifyExpense(
  user: DemoUser,
  group: Group,
  note?: ExpenseNote,
): { ok: true } | { ok: false; code: "forbidden" | "unavailable_state"; message: string } {
  void note; // P1: 参加中メンバーなら誰でも編集できる(作成者判定は P2/P3)。
  if (!isMember(user.id, group.id)) {
    return { ok: false, code: "forbidden", message: "グループのメンバーのみができる操作です。" };
  }
  if (!canEditExpenses(group)) {
    return {
      ok: false,
      code: "unavailable_state",
      message: `現在のグループの状態(${statusLabel(group.lifecycle.status)})では費用メモを変更できません。`,
    };
  }
  return { ok: true };
}

function assertCanModify(user: DemoUser, group: Group, note?: ExpenseNote): void {
  const r = canModifyExpense(user, group, note);
  if (r.ok) return;
  if (r.code === "forbidden") throw forbidden(r.message);
  throw unavailableState(r.message, { detail: { state: group.lifecycle.status } });
}

function nameOf(viewer: DemoUser, groupId: Id, userId: Id, activeIds: ReadonlySet<Id>): { name: string; active: boolean } {
  if (!activeIds.has(userId)) return { name: LEFT_MEMBER_LABEL, active: false };
  return { name: visibleProfile({ id: viewer.id }, userId, { kind: "member", groupId }).displayName, active: true };
}

function toView(viewer: DemoUser, groupId: Id, n: ExpenseNote, activeIds: ReadonlySet<Id>): ExpenseNoteView {
  const payer = nameOf(viewer, groupId, n.payerId, activeIds);
  const shares = splitAmount(n.amount, n.targetIds);
  return {
    ...n,
    targetIds: [...n.targetIds],
    payerName: payer.name,
    payerActive: payer.active,
    targets: [...n.targetIds].sort().map((id) => {
      const t = nameOf(viewer, groupId, id, activeIds);
      return { userId: id, displayName: t.name, active: t.active, share: shares[id] };
    }),
    updatedByName: nameOf(viewer, groupId, n.updatedBy, activeIds).name,
  };
}

const activeIdSet = (groupId: Id): Set<Id> => new Set(activeMembers(groupId).map((m) => m.userId));
const notesOf = (groupId: Id): Readonly<ExpenseNote>[] => db().expenses.filter((n) => n.groupId === groupId);

function readOnlyReason(group: Group): string {
  switch (group.lifecycle.status) {
    case "recruiting": case "min_reached": case "withdrawal_period": return EXPENSE_MESSAGES.readOnlyBeforeConfirmed;
    case "cancelled": case "replanned": return EXPENSE_MESSAGES.readOnlyClosed;
    default: return "";
  }
}

export function listExpenses(user: DemoUser, groupId: Id, page: { limit: number; offset: number }): ExpenseListResult {
  const group = assertGroupAccess(user.id, groupId, "member");
  if (!isMember(user.id, groupId)) throw forbidden();
  const active = activeIdSet(groupId);
  const notes = notesOf(groupId).sort((a, b) =>
    a.spentOn !== b.spentOn ? (a.spentOn < b.spentOn ? 1 : -1)
      : a.createdAt !== b.createdAt ? (a.createdAt < b.createdAt ? 1 : -1)
        : a.id < b.id ? 1 : -1);
  const p = paginate(notes, page);
  const status = group.lifecycle.status;
  return {
    ...p,
    items: p.items.map((n) => toView(user, groupId, n, active)),
    totalAmount: notes.reduce((s, n) => s + n.amount, 0),
    members: activeMembers(groupId).map((m) => ({
      userId: m.userId,
      displayName: visibleProfile({ id: user.id }, m.userId, { kind: "member", groupId }).displayName,
    })),
    canEdit: canModifyExpense(user, group as Group).ok,
    groupStatus: status,
    groupStatusLabel: statusLabel(status),
    readOnlyReason: readOnlyReason(group as Group),
  };
}

function ctxFor(groupId: Id, legacy?: ExpenseNote): ExpenseValidateCtx {
  const active = activeIdSet(groupId);
  const allowedLegacyIds = legacy
    ? new Set([legacy.payerId, ...legacy.targetIds].filter((id) => !active.has(id)))
    : undefined;
  return { activeMemberIds: active, allowedLegacyIds, today: clock.today() };
}

function guardText(input: ExpenseInput): void {
  assertNoPaymentInducement(input.title, "title");
  assertNoPaymentInducement(input.memo ?? "", "memo");
  const opts = { ackReview: input.ackReview };
  assertTextAllowed(input.title, "expense_item", "title", opts);
  if (input.memo) assertTextAllowed(input.memo, "expense_memo", "memo", opts);
}

export function addExpense(user: DemoUser, groupId: Id, input: ExpenseInput): ExpenseNoteView {
  const group = assertGroupAccess(user.id, groupId, "member") as Group;
  assertCanModify(user, group);
  const value = validateExpenseInput(input, ctxFor(groupId));
  guardText(value);
  return tx(() => {
    if (notesOf(groupId).length >= LIMITS.EXPENSES.maxItems) {
      throw conflict(`これ以上追加できません(${LIMITS.EXPENSES.maxItems} 件)。`, { reason: "limit_exceeded" });
    }
    const now = clock.nowIso();
    const note = db().expenses.insert({
      id: newId("ex"),
      groupId,
      title: value.title,
      amount: value.amount,
      payerId: value.payerId,
      targetIds: value.targetIds,
      spentOn: value.spentOn,
      memo: value.memo ?? "",
      version: 1,
      createdBy: user.id,
      createdAt: now,
      updatedBy: user.id,
      updatedAt: now,
    });
    return toView(user, groupId, note, activeIdSet(groupId));
  });
}

function mismatch(user: DemoUser, groupId: Id, note: ExpenseNote): AppError {
  return conflict("他の人が先に更新しました。画面を再読み込みしてからやり直してください。", {
    reason: "version_mismatch",
    detail: { current: toView(user, groupId, note, activeIdSet(groupId)) },
  });
}

export function updateExpense(user: DemoUser, groupId: Id, expenseId: Id, input: ExpenseUpdateInput): ExpenseNoteView {
  const group = assertGroupAccess(user.id, groupId, "member") as Group;
  assertCanModify(user, group);
  const existing = assertInGroup(db().expenses.get(expenseId), groupId);
  const value = validateExpenseUpdateInput(input, ctxFor(groupId, existing));
  guardText(value);
  return tx(() => {
    const cur = assertInGroup(db().expenses.get(expenseId), groupId);
    if (value.baseVersion !== cur.version) throw mismatch(user, groupId, cur);
    const next = db().expenses.update(expenseId, {
      title: value.title,
      amount: value.amount,
      payerId: value.payerId,
      targetIds: value.targetIds,
      spentOn: value.spentOn,
      memo: value.memo ?? "",
      version: cur.version + 1,
      updatedBy: user.id,
      updatedAt: clock.nowIso(),
    });
    return toView(user, groupId, next, activeIdSet(groupId));
  });
}

export function deleteExpense(user: DemoUser, groupId: Id, expenseId: Id, baseVersion: number): void {
  const group = assertGroupAccess(user.id, groupId, "member") as Group;
  assertCanModify(user, group);
  assertInGroup(db().expenses.get(expenseId), groupId);
  tx(() => {
    const cur = assertInGroup(db().expenses.get(expenseId), groupId);
    if (baseVersion !== cur.version) throw mismatch(user, groupId, cur);
    db().expenses.remove(expenseId);
  });
}

function balancesOf(groupId: Id) {
  const notes = notesOf(groupId);
  const active = activeIdSet(groupId);
  const ids = new Set<Id>(active);
  for (const n of notes) { ids.add(n.payerId); n.targetIds.forEach((t) => ids.add(t)); }
  return { notes, active, ids: [...ids].sort(), bal: computeBalances(notes, [...ids]) };
}

export function getExpenseSummary(user: DemoUser, groupId: Id): ExpenseSummary {
  assertGroupAccess(user.id, groupId, "member");
  if (!isMember(user.id, groupId)) throw forbidden();
  const { notes, active, ids, bal } = balancesOf(groupId);
  const net: Record<string, number> = {};
  for (const id of ids) net[id] = bal[id].net;
  return {
    currency: "JPY",
    totalAmount: notes.reduce((s, n) => s + n.amount, 0),
    count: notes.length,
    members: ids.map((id) => {
      const n = nameOf(user, groupId, id, active);
      return { userId: id, displayName: n.name, active: n.active, paid: bal[id].paid, owed: bal[id].owed, net: bal[id].net };
    }),
    transfers: EXPENSE_TRANSFER_HINT_ENABLED ? computeTransfers(net) : [],
    disclaimer: EXPENSE_MESSAGES.summaryNotice,
    rounding: "first-n-get-one-yen",
  };
}

export function unsettledBalanceOf(groupId: Id, userId: Id): number {
  const { bal } = balancesOf(groupId);
  return bal[userId]?.net ?? 0;
}

export function onGroupMemberLeft(e: Extract<DomainEvent, { type: "member_left" }>): void {
  try {
    // 項目は残す(EXP-DEC-04)。将来の匿名化処理の置き場所。
    void e;
  } catch (err) {
    console.error("[expense] onGroupMemberLeft", e.groupId, e.userId, err instanceof AppError ? err.code : "error");
  }
}
