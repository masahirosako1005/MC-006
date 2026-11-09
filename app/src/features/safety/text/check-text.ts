// 09: 禁止表現の検査(SAF-FN-16、17)。クライアントでも実行できる純粋関数(AppError は純 TS)。
import { AppError } from "@/lib/errors";
import type { DictRule, TextCheckResult, TextContext, TextFinding } from "../types";
import { RULE_GROUPS, TEXT_CONTEXTS } from "./contexts";
import dictionary from "./dictionary.json";
import { normalizeForCheck } from "./normalize";

type DictEntry = DictRule & { target?: "plain" | "squeezed" };

const COMPILED = new Map<string, RegExp>();
function regexOf(rule: DictEntry): RegExp {
  const key = rule.id + "\u0000" + rule.pattern;
  let re = COMPILED.get(key);
  if (!re) {
    // 検査対象はひらがなをカタカナに統一済みのため、パターン側も同様に統一する
    const folded = rule.pattern.replace(/[ぁ-ゖ]/g, (c) => String.fromCodePoint(c.codePointAt(0)! + 0x60));
    re = new RegExp(folded, "giu");
    COMPILED.set(key, re);
  }
  return re;
}

function groupOf(rule: DictEntry): number {
  const key = rule.category === "contact_pattern" && rule.id.startsWith("contact.url") ? "contact_url" : rule.category;
  return RULE_GROUPS.indexOf(key as (typeof RULE_GROUPS)[number]);
}

export function checkText(text: string, context: TextContext, opts?: { extraRules?: DictRule[] }): TextCheckResult {
  const spec = TEXT_CONTEXTS[context];
  const ok: TextCheckResult = { verdict: "ok", findings: [], reason: null, suggestion: null };
  if (!spec || !text) return ok;
  const n = normalizeForCheck(text);
  const rules = [...(dictionary as DictEntry[]), ...((opts?.extraRules ?? []) as DictEntry[])];
  const findings: TextFinding[] = [];
  const suggestionOf = new Map<string, string | undefined>();
  for (const rule of rules) {
    if (rule.contexts && !rule.contexts.includes(context)) continue;
    const g = groupOf(rule);
    const level = g >= 0 ? spec.levels[g] : "D";
    if (level === "-") continue;
    const severity: "deny" | "review" = level === "R" ? "review" : rule.severity;
    const useSqueezed = (rule.target ?? "squeezed") === "squeezed";
    const src = useSqueezed ? n.squeezed : n.plain;
    const map = useSqueezed ? n.squeezedMap : n.plainMap;
    const re = regexOf(rule);
    re.lastIndex = 0;
    for (const m of src.matchAll(re)) {
      if (m[0].length === 0) continue;
      const s = m.index!;
      const start = map[s];
      const lastStart = map[s + m[0].length - 1];
      const end = lastStart + String.fromCodePoint(text.codePointAt(lastStart)!).length;
      findings.push({ ruleId: rule.id, category: rule.category, severity, start, end, matched: text.slice(start, end) });
      suggestionOf.set(rule.id, rule.suggestion);
    }
  }
  if (findings.length === 0) return ok;
  const deny = findings.find((f) => f.severity === "deny");
  const top = deny ?? findings[0];
  const verdict = deny ? "deny" : "review";
  const reason =
    verdict === "deny"
      ? `「${top.matched}」は使用できない表現です。`
      : `「${top.matched}」が含まれています。内容を確認してください。`;
  return { verdict, findings, reason, suggestion: suggestionOf.get(top.ruleId) ?? null };
}

export function assertTextAllowed(
  text: string,
  context: TextContext,
  field: string,
  opts?: { ackReview?: boolean },
): void {
  const r = checkText(text, context);
  if (r.verdict === "ok") return;
  const reason = r.reason ?? "入力内容を確認してください。";
  if (r.verdict === "deny") {
    throw new AppError("invalid_input", reason, { reason: "text_denied", fields: { [field]: reason } });
  }
  if (opts?.ackReview !== true) {
    throw new AppError("invalid_input", reason, {
      reason: "text_review_required",
      fields: { [field]: reason },
      detail: { reviewRequired: true },
    });
  }
}
