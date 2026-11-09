// モック API のインメモリ状態。再起動で seed.json の状態に戻る。
import seed from "@/data/seed.json";

export type Stamp = { spotId: number; at: string };
type State = { lap: number; stamps: Stamp[]; rewards: { rewardId: number; at: string }[]; inquiries: unknown[] };

const g = globalThis as unknown as { __raundMock?: State };

function initial(): State {
  const lapNow = Math.max(1, ...seed.history.map((h) => h.lap));
  const byName = new Map(seed.spots.map((s) => [s.stampName, s.id]));
  const stamps = seed.history
    .filter((h) => h.lap === lapNow && byName.has(h.stampName))
    .map((h) => ({ spotId: byName.get(h.stampName)!, at: h.at }));
  const rewards = seed.rewardHistory
    .map((r) => ({ rewardId: seed.rewards.find((x) => x.name === r.name)?.id ?? 0, at: r.at }))
    .filter((r) => r.rewardId);
  return { lap: lapNow, stamps, rewards, inquiries: [] };
}

export const state = (): State => (g.__raundMock ??= initial());
export const resetAll = () => (g.__raundMock = initial());

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

/** 合言葉でスタンプを押す。獲得できた特典も返す。 */
export function acquire(keyword: string) {
  const s = state();
  const spot = seed.spots.find((x) => x.keyword.toLowerCase() === keyword.trim().toLowerCase());
  if (!spot) return { ok: false as const, code: "invalid_code" };
  if (s.stamps.some((x) => x.spotId === spot.id)) return { ok: false as const, code: "already_acquired" };
  s.stamps.push({ spotId: spot.id, at: now() });
  const granted = seed.rewards.filter(
    (r) => s.stamps.length >= r.requiredStamps && !s.rewards.some((x) => x.rewardId === r.id),
  );
  for (const r of granted) s.rewards.push({ rewardId: r.id, at: now() });
  return { ok: true as const, spot, granted };
}

export function reset() {
  const s = state();
  s.lap += 1;
  s.stamps = [];
}
