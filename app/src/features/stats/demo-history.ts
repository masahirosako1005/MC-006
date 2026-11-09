// 12 合成履歴(MUN-FN-10)。擬似乱数 mulberry32(種 20261109)による決定論的生成。
import seed from "@/data/seed.json";
import { addDays } from "@/lib/datetime";
import type { CancelReasonCode, GroupStatus } from "@/features/groups/lifecycle/types";
import type { Municipality } from "@/features/official/types";
import type {
  CoarseAgeBand, GroupFact, HistoryFunnelEvent, RequestFact, RequestStatus, SurveyFact, WantAgain,
} from "./types";

const SEED = 20261109;
const MONTHS = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"];
const END_DAY = "2026-10-31";
const POOL = 80;
const SPOT_IDS: number[] = (seed.spots as { id: number }[]).map((s) => s.id);

function mulberry32(a: number): () => number {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Rnd = () => number;
const int = (r: Rnd, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T,>(r: Rnd, items: readonly [T, number][]): T => {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [v, w] of items) { x -= w; if (x < 0) return v; }
  return items[items.length - 1][0];
};
const at = (day: string, r: Rnd) => `${day}T${String(int(r, 8, 20)).padStart(2, "0")}:${String(int(r, 0, 59)).padStart(2, "0")}:00+09:00`;
const pad = (n: number) => String(n).padStart(2, "0");

const score = (r: Rnd) => pick(r, [[1, 1], [2, 1], [3, 3], [4, 4], [5, 4]] as const);

export interface DemoHistory { groups: GroupFact[]; funnelEvents: HistoryFunnelEvent[] }
const cache = new Map<string, DemoHistory>();

export function buildDemoHistory(
  municipalities: readonly Municipality[],
): { groups: GroupFact[]; funnelEvents: HistoryFunnelEvent[] } {
  const key = municipalities.map((m) => `${m.id}:${m.campaign}:${m.regionIds.join(",")}`).join("|");
  const hit = cache.get(key);
  if (hit) return hit;
  const r = mulberry32(SEED);
  const groups: GroupFact[] = [];
  const funnelEvents: HistoryFunnelEvent[] = [];
  let seq = 0;

  const newGroup = (campaign: string, region: string, createdDay: string, official: boolean, replanOf: string | null): GroupFact => {
    seq += 1;
    const groupId = `hist-${String(seq).padStart(4, "0")}`;
    const phaseRoll = replanOf ? pick(r, [["confirmed", 6], ["open", 1], ["cancelled", 3]] as const)
      : pick(r, [["confirmed", 60], ["cancelled", 30], ["open", 10]] as const);
    const createdAt = at(createdDay, r);
    let status: GroupStatus = "recruiting";
    let confirmedAt: string | null = null;
    let cancelledAt: string | null = null;
    let completedAt: string | null = null;
    let cancelReason: CancelReasonCode | null = null;
    let memberCount = 0;
    if (phaseRoll === "confirmed") {
      const d = addDays(createdDay, int(r, 3, 14));
      if (d <= END_DAY) {
        confirmedAt = at(d, r);
        status = d <= "2026-10-15" ? "completed" : "confirmed";
        if (status === "completed") completedAt = at(d, r);
        memberCount = pick(r, [[2, 1], [3, 4], [4, 4], [5, 2], [6, 1]] as const);
      }
    } else if (phaseRoll === "cancelled") {
      const d = addDays(createdDay, int(r, 3, 14));
      if (d <= END_DAY) {
        cancelledAt = at(d, r);
        status = "cancelled";
        cancelReason = pick(r, [["min_not_reached", 70], ["below_min_in_withdrawal", 10], ["organizer_cancelled", 15], ["below_floor", 5]] as const);
        if (cancelReason === "below_floor") confirmedAt = at(addDays(d, -1), r);
      }
    }
    const reqCount = int(r, 2, 8);
    const requests: RequestFact[] = [];
    for (let i = 0; i < reqCount; i++) {
      const st = pick(r, [["approved", 60], ["rejected", 10], ["withdrawn", 15], ["expired", 5], ["pending", 10]] as const) as RequestStatus;
      const rd = addDays(createdDay, int(r, 0, 5));
      requests.push({ at: at(rd, r), status: st, decidedAt: st === "pending" ? null : at(addDays(rd, 1), r) });
    }
    const keys: string[] = [];
    while (keys.length < memberCount) {
      const k = `h-${String(int(r, 0, POOL - 1)).padStart(3, "0")}`;
      if (!keys.includes(k)) keys.push(k);
    }
    const ageBands = keys.map(() => pick(r, [["under30", 3], ["30to49", 4], ["50plus", 3]] as const) as CoarseAgeBand);
    const stamps = confirmedAt && !cancelledAt
      ? Array.from({ length: int(r, 0, 4) }, () => ({ spotId: SPOT_IDS[int(r, 0, SPOT_IDS.length - 1)], at: at(confirmedAt!.slice(0, 10), r) }))
      : [];
    const surveys: SurveyFact[] = status === "completed"
      ? keys.filter(() => r() < 0.7).map(() => ({
          satisfaction: score(r), localInteraction: score(r), localExploration: score(r),
          wantAgain: pick(r, [["yes", 55], ["maybe", 35], ["no", 10]] as const) as WantAgain,
        }))
      : [];
    return {
      groupId, campaign, region, official, status, createdAt, confirmedAt, completedAt, cancelledAt, cancelReason,
      replanOfGroupId: replanOf, memberCount, participantKeys: keys, ageBands, requests, stamps, surveys, origin: "demo-history",
    };
  };

  for (const m of municipalities) {
    const sizes = m.regionIds.length === 1 ? [5] : [8, 6, 4];
    m.regionIds.forEach((region, ri) => {
      for (const month of MONTHS) {
        const base = sizes[Math.min(ri, sizes.length - 1)];
        const n = ri === 2 && m.regionIds.length > 1 ? int(r, 3, 5) : base;
        for (let i = 0; i < n; i++) {
          const day = `${month}-${pad(int(r, 1, 28))}`;
          const g = newGroup(m.campaign, region, day, ri < 2 && r() < 0.25, null);
          groups.push(g);
          if (g.status === "cancelled" && g.cancelledAt && r() < 0.5) {
            const rd = addDays(g.cancelledAt.slice(0, 10), int(r, 1, 7));
            if (rd <= END_DAY) {
              g.status = "replanned";
              groups.push(newGroup(m.campaign, region, rd, g.official, g.groupId));
            }
          }
        }
        // 流入
        const day = (): string => `${month}-${pad(int(r, 1, 28))}`;
        const ev = (type: HistoryFunnelEvent["type"], channel: "A" | "B", source: HistoryFunnelEvent["source"]) =>
          funnelEvents.push({ type, day: day(), campaign: m.campaign, channel, source });
        if (ri === 0) {
          for (let i = 0, n = int(r, 20, 40); i < n; i++) ev("list_viewed", "A", "none");
          for (let i = 0, n = int(r, 25, 40); i < n; i++) {
            ev("entry_landed", "B", pick(r, [["muni-site", 10], ["muni-pr", 5], ["sns", 5], ["search", 4], ["travel-media", 2], ["transport", 1], ["other", 1], ["none", 1]] as const));
          }
          for (let i = 0, n = int(r, 0, 2); i < n; i++) ev("entry_landed", "B", "unknown");
          for (let i = 0, n = int(r, 2, 6); i < n; i++) ev("entry_params_ignored", "B", "none");
          for (let i = 0, n = int(r, 5, 12); i < n; i++) ev("official_viewed", "B", "none");
          for (let i = 0, n = int(r, 2, 6); i < n; i++) ev("official_requested", "B", "none");
        }
      }
    });
  }
  const out = { groups, funnelEvents };
  cache.set(key, out);
  return out;
}
