// 少数セルの秘匿(12 の MUN-FN-06〜08 と同じ規則)。K は引数。
export function toCountCell(n, k) {
  return n >= 1 && n < k ? { few: true } : { few: false, value: n };
}

export function toRateCell(num, den, k) {
  if (den === 0) return { kind: "none" };
  if (den < k) return { kind: "few" };
  if (num === 0) return { kind: "value", percent: 0 };
  if (num < k) return { kind: "below", percent: Math.ceil((k / den) * 100) };
  return { kind: "value", percent: Math.round((num / den) * 100) };
}

// 内訳の秘匿フラグ(true=少数)。少数が 1 個だけなら、少数でない最小の(0 でない)セルも少数にする。
export function suppressBreakdown(counts, k) {
  const flags = counts.map((n) => n >= 1 && n < k);
  if (flags.filter(Boolean).length === 1) {
    let best = -1;
    counts.forEach((n, i) => {
      if (!flags[i] && n > 0 && (best < 0 || n < counts[best])) best = i;
    });
    if (best >= 0) flags[best] = true;
  }
  return flags;
}
