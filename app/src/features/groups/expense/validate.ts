// 07 入力検証(EXP 7.1)。
import { AppError } from "@/lib/errors";
import { LIMITS } from "@/lib/limits";
import { parse, v } from "@/lib/validation";
import type { DateStr } from "@/lib/groups-types";
import { EXPENSE_LIMITS } from "./constants";
import type { ExpenseInput, ExpenseUpdateInput } from "./types";

export type ExpenseValidateCtx = {
  activeMemberIds: ReadonlySet<string>;
  allowedLegacyIds?: ReadonlySet<string>;
  today: DateStr;
};

const baseShape = {
  title: v.string({ min: LIMITS.EXPENSE_TITLE.min, max: LIMITS.EXPENSE_TITLE.max }),
  amount: v.int({ min: LIMITS.AMOUNT.min, max: LIMITS.AMOUNT.max }),
  payerId: v.id("u"),
  targetIds: v.array(v.id("u"), { min: 1, max: EXPENSE_LIMITS.targetsMax, unique: true }),
  spentOn: v.date(),
  memo: v.string({ optional: true, multiline: true, min: LIMITS.EXPENSE_MEMO.min, max: LIMITS.EXPENSE_MEMO.max, maxLines: LIMITS.EXPENSE_MEMO.maxLines }),
  ackReview: v.boolean({ optional: true }),
};
const inputSchema = v.object(baseShape);
const updateSchema = v.object({ ...baseShape, baseVersion: v.int({ min: 1 }) });

const addDays = (d: string, days: number): string => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + days);
  return t.toISOString().slice(0, 10);
};

function check(value: ExpenseInput, ctx: ExpenseValidateCtx): void {
  const fields: Record<string, string> = {};
  const okMember = (id: string) => ctx.activeMemberIds.has(id) || ctx.allowedLegacyIds?.has(id) === true;
  if (!okMember(value.payerId)) fields.payerId = "立て替えた人を参加中メンバーから選んでください。";
  if (!value.targetIds.every(okMember)) fields.targetIds = "対象メンバーは参加中メンバーから選んでください。";
  if (value.spentOn < EXPENSE_LIMITS.dateMin || value.spentOn > addDays(ctx.today, EXPENSE_LIMITS.dateFutureDays)) {
    fields.spentOn = "日付が正しくありません。";
  }
  if (Object.keys(fields).length) throw new AppError("invalid_input", "入力内容を確認してください。", { fields });
}

function finish<T extends ExpenseInput>(value: T): T {
  return { ...value, targetIds: [...value.targetIds].sort(), memo: value.memo ?? "" };
}

export function validateExpenseInput(input: unknown, ctx: ExpenseValidateCtx): ExpenseInput {
  const value = parse(inputSchema, input) as ExpenseInput;
  check(value, ctx);
  return finish(value);
}

export function validateExpenseUpdateInput(input: unknown, ctx: ExpenseValidateCtx): ExpenseUpdateInput {
  const value = parse(updateSchema, input) as ExpenseUpdateInput;
  check(value, ctx);
  return finish(value);
}
