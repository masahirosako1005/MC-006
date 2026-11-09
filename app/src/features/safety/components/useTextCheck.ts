"use client";
// 09: 入力欄のライブ警告フック。スタブ(P-3-11 で本体に置き換える)。
import type { TextCheckResult, TextContext } from "../types";

const OK: TextCheckResult = { verdict: "ok", findings: [], reason: null, suggestion: null };

export function useTextCheck(context: TextContext): { result: TextCheckResult; onChange(value: string): void } {
  void context;
  return { result: OK, onChange: () => {} };
}
