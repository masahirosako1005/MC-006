// 09: TextContext と適用表(設計 8.5)。スタブ(P-1-5)。上限値は 00 の LIMITS を参照する。
import type { TextContext } from "../types";

export interface TextContextSpec {
  multiline: boolean;
}

export const TEXT_CONTEXTS: Partial<Record<TextContext, TextContextSpec>> = {};
