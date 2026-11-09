// 09: 禁止表現の検査。スタブ(P-1-5)。クライアントでも実行できる純粋関数にする。
import type { DictRule, TextCheckResult, TextContext } from "../types";

export function checkText(text: string, context: TextContext, opts?: { extraRules?: DictRule[] }): TextCheckResult {
  void text; void context; void opts;
  throw new Error("not implemented");
}

export function assertTextAllowed(
  text: string,
  context: TextContext,
  field: string,
  opts?: { ackReview?: boolean },
): void {
  void text; void context; void field; void opts;
  throw new Error("not implemented");
}
