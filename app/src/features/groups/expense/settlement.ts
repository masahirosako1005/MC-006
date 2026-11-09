// 07 差額・精算の目安の計算(greedy-v1)。
import type { ExpenseNote, TransferHint } from "./types";
import { splitAmount } from "./split";

export function computeBalances(
  notes: readonly Pick<ExpenseNote, "amount" | "payerId" | "targetIds">[],
  memberIds: readonly string[],
): Record<string, { paid: number; owed: number; net: number }> {
  const m = new Map<string, { paid: number; owed: number }>();
  const row = (id: string) => {
    let r = m.get(id);
    if (!r) m.set(id, (r = { paid: 0, owed: 0 }));
    return r;
  };
  for (const id of memberIds) row(id);
  for (const n of notes) {
    row(n.payerId).paid += n.amount;
    const shares = splitAmount(n.amount, n.targetIds);
    for (const id of Object.keys(shares)) row(id).owed += shares[id];
  }
  const out: Record<string, { paid: number; owed: number; net: number }> = Object.create(null);
  for (const [id, r] of m) out[id] = { paid: r.paid, owed: r.owed, net: r.paid - r.owed };
  return out;
}

export function computeTransfers(net: Readonly<Record<string, number>>): TransferHint[] {
  const ids = Object.keys(net);
  if (ids.reduce((s, id) => s + net[id], 0) !== 0) throw new RangeError("net must sum to 0");
  const rem = new Map<string, number>(ids.map((id) => [id, net[id]]));
  const pick = (sign: 1 | -1) =>
    [...rem.entries()]
      .filter(([, v]) => v * sign > 0)
      .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]) || (a[0] < b[0] ? -1 : 1))[0];
  const out: TransferHint[] = [];
  for (;;) {
    const d = pick(-1);
    const c = pick(1);
    if (!d || !c) break;
    const amount = Math.min(-d[1], c[1]);
    out.push({ fromUserId: d[0], toUserId: c[0], amount });
    rem.set(d[0], d[1] + amount);
    rem.set(c[0], c[1] - amount);
  }
  return out;
}
