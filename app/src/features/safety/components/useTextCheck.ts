"use client";
// 09: 入力欄のライブ警告フック(SAF-UI-05)。クライアント側で checkText を実行する。
import { useCallback, useState } from "react";
import { checkText } from "../text/check-text";
import type { TextCheckResult, TextContext } from "../types";

const OK: TextCheckResult = { verdict: "ok", findings: [], reason: null, suggestion: null };

export function useTextCheck(context: TextContext): { result: TextCheckResult; onChange(value: string): void } {
  const [result, setResult] = useState<TextCheckResult>(OK);
  const onChange = useCallback((value: string) => {
    try { setResult(value ? checkText(value, context) : OK); } catch { setResult(OK); }
  }, [context]);
  return { result, onChange };
}
