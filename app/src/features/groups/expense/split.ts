// 07 分担額の計算(EXP-DEC-02 d 案)。
export function splitAmount(amount: number, targetIds: readonly string[]): Record<string, number> {
  if (!Number.isInteger(amount)) throw new RangeError("amount must be an integer");
  if (targetIds.length === 0) throw new RangeError("targetIds must not be empty");
  const ids = [...targetIds].sort();
  const n = ids.length;
  const base = Math.floor(amount / n);
  const r = amount % n;
  const out: Record<string, number> = Object.create(null);
  ids.forEach((id, i) => {
    out[id] = base + (i < r ? 1 : 0);
  });
  return out;
}
