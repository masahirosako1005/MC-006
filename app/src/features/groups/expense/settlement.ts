// 07 差額・精算の目安の計算。P-1-9 で実装。
import type { ExpenseNote, TransferHint } from "./types";

export function computeBalances(
  _notes: readonly Pick<ExpenseNote, "amount" | "payerId" | "targetIds">[],
  _memberIds: readonly string[],
): Record<string, { paid: number; owed: number; net: number }> {
  throw new Error("not implemented");
}

export function computeTransfers(_net: Readonly<Record<string, number>>): TransferHint[] {
  throw new Error("not implemented");
}
