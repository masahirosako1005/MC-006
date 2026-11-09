// 12 指標の計算(MUN-FN-04・11〜14)。M-01〜M-12(M-13〜17 のアンケートは SurveyStats を空で返す)。
import type { GroupStatus, CancelReasonCode } from "@/features/groups/lifecycle/types";
import { ENTRY_SOURCES } from "@/features/entry/types";
import seed from "@/data/seed.json";
import { MIN_CELL_COUNT } from "./config";
import { suppressBreakdown, toCountCell, toRateCell } from "./privacy";
import type {
  CancelReasonGroup, CountCell, FunnelAggregate, GroupFact, GroupPhase, HistoryFunnelEvent,
  LabeledCell, RateCell, StatsMeta, StatsQuery, StatsResponse,
} from "./types";

const JST_MS = 9 * 3600 * 1000;
/** ISO 日時 → JST の日付(YYYY-MM-DD)。 */
function jstDay(iso: string): string {
  return new Date(new Date(iso).getTime() + JST_MS).toISOString().slice(0, 10);
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let y = Number(from.slice(0, 4));
  let m = Number(from.slice(5, 7));
  const ey = Number(to.slice(0, 4));
  const em = Number(to.slice(5, 7));
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

export function groupPhase(status: GroupStatus): GroupPhase {
  switch (status) {
    case "confirmed": case "in_progress": case "completed": return "confirmed";
    case "cancelled": case "replanned": return "cancelled";
    default: return "open";
  }
}

export function cancelReasonGroup(code: CancelReasonCode): CancelReasonGroup {
  switch (code) {
    case "min_not_reached": return "deadline_unmet";
    case "organizer_cancelled": case "organizer_left": return "organizer";
    default: return "other";
  }
}

export function addFunnelEvents(base: FunnelAggregate, events: readonly HistoryFunnelEvent[]): FunnelAggregate {
  // 本体は別タスク(スタブのまま)。
  void base; void events; throw new Error("not implemented");
}

const REASON_LABELS: Record<CancelReasonGroup, string> = {
  deadline_unmet: "締切までに最少人数に達しなかった",
  organizer: "幹事による中止・幹事の不在",
  other: "辞退で人数が下回った",
};
const SOURCE_NAMES: Record<string, string> = {
  "muni-site": "自治体サイト", "muni-pr": "自治体広報", sns: "SNS", search: "検索",
  "travel-media": "旅行メディア", transport: "交通機関", other: "その他", none: "流入元なし", unknown: "不明",
};
const TYPE_NAMES: Record<string, string> = {
  entry_landed: "入口Bへの着地", entry_params_ignored: "無視された条件", list_viewed: "一覧の閲覧",
  official_viewed: "公式枠の閲覧", official_requested: "公式枠の申請",
};
const AGE_LABELS = { under30: "29歳以下", "30to49": "30〜49歳", "50plus": "50歳以上" } as const;

function breakdown(items: { key: string; label: string; n: number }[], k: number): LabeledCell[] {
  const flags = suppressBreakdown(items.map((i) => i.n), k);
  return items.map((i, idx) => ({
    key: i.key, label: i.label,
    cell: flags[idx] ? { few: true } : toCountCell(i.n, k),
  }));
}
function column(counts: number[], k: number): CountCell[] {
  const flags = suppressBreakdown(counts, k);
  return counts.map((n, i) => (flags[i] ? { few: true } : toCountCell(n, k)));
}

export function computeStats(input: {
  groups: GroupFact[]; funnel: FunnelAggregate; query: StatsQuery; meta: Omit<StatsMeta, "query">; k?: number;
}): StatsResponse {
  const { funnel, query, meta } = input;
  const k = input.k ?? MIN_CELL_COUNT;
  const inPeriod = (iso: string | null): boolean => {
    if (!iso) return false;
    const d = jstDay(iso);
    return d >= query.from && d <= query.to;
  };
  const regionIds = query.region ? [query.region] : meta.regions.map((r) => r.id);
  const regionName = (id: string) => meta.regions.find((r) => r.id === id)?.name ?? id;
  const scoped = input.groups.filter(
    (g) => regionIds.includes(g.region) && (query.official === "all" || (query.official === "official") === g.official),
  );
  const months = monthsBetween(query.from, query.to);
  const monthOf = (iso: string) => jstDay(iso).slice(0, 7);

  // 集計の元になる抽出
  const created = scoped.filter((g) => inPeriod(g.createdAt));
  const requests = scoped.flatMap((g) => g.requests.map((r) => ({ r, region: g.region })));
  const reqIn = requests.filter((x) => inPeriod(x.r.at));
  const confirmed = scoped.filter((g) => groupPhase(g.status) === "confirmed" && inPeriod(g.confirmedAt));
  const cancelled = scoped.filter((g) => groupPhase(g.status) === "cancelled" && inPeriod(g.cancelledAt));
  const approved = requests.filter((x) => x.r.status === "approved" && inPeriod(x.r.decidedAt)).length;
  const rejected = requests.filter((x) => x.r.status === "rejected" && inPeriod(x.r.decidedAt)).length;
  const stamps = scoped.flatMap((g) => g.stamps.map((s) => ({ s, groupId: g.groupId })));
  const stampsIn = stamps.filter((x) => inPeriod(x.s.at));

  // M-11 再訪率
  const confirmedCount = new Map<string, number>();
  for (const g of scoped) {
    if (groupPhase(g.status) === "confirmed" && g.confirmedAt && jstDay(g.confirmedAt) <= query.to) {
      for (const key of new Set(g.participantKeys)) confirmedCount.set(key, (confirmedCount.get(key) ?? 0) + 1);
    }
  }
  const participants = new Set(confirmed.flatMap((g) => g.participantKeys));
  let repeat = 0;
  for (const key of participants) if ((confirmedCount.get(key) ?? 0) >= 2) repeat += 1;

  // M-12 年代帯
  const ageSeen = new Map<string, string>();
  for (const g of confirmed) {
    g.participantKeys.forEach((key, i) => {
      const band = g.ageBands[i];
      if (band && !ageSeen.has(key)) ageSeen.set(key, band);
    });
  }
  const ageCounts = (["under30", "30to49", "50plus"] as const).map((b) => ({
    key: b as string, label: AGE_LABELS[b], n: [...ageSeen.values()].filter((v) => v === b).length,
  }));

  // M-05 理由別
  const reasonCounts = (["deadline_unmet", "organizer", "other"] as const).map((r) => ({
    key: r as string, label: REASON_LABELS[r],
    n: cancelled.filter((g) => g.cancelReason && cancelReasonGroup(g.cancelReason) === r).length,
  }));

  // M-06 ファネル
  const replanned = cancelled.filter((g) => g.status === "replanned");
  const replanConfirmed = replanned.filter((g) =>
    input.groups.some((c) => c.replanOfGroupId === g.groupId && groupPhase(c.status) === "confirmed" && c.confirmedAt),
  ).length;

  // M-07 成立人数
  const dist = [2, 3, 4, 5, 6].map((n) => ({
    key: String(n), label: `${n}人`, n: confirmed.filter((g) => g.memberCount === n).length,
  }));

  // M-08 流入
  const landed = Object.values(funnel.landedBySource).reduce((a, b) => a + b, 0);
  const listViewed = funnel.listViewedByChannel.A + funnel.listViewedByChannel.B;
  const sourceKeys = [...ENTRY_SOURCES, "none", "unknown"] as const;
  const inflow = {
    byEntry: breakdown([
      { key: "A", label: "入口A(一覧)", n: funnel.listViewedByChannel.A },
      { key: "B", label: "入口B(外部リンク)", n: landed },
    ], k),
    bySource: breakdown(sourceKeys.map((s) => ({ key: s as string, label: SOURCE_NAMES[s], n: funnel.landedBySource[s] ?? 0 })), k),
    byType: breakdown([
      { key: "entry_landed", n: landed }, { key: "entry_params_ignored", n: funnel.ignoredCount },
      { key: "list_viewed", n: listViewed }, { key: "official_viewed", n: funnel.officialViewed },
      { key: "official_requested", n: funnel.officialRequested },
    ].map((x) => ({ ...x, label: TYPE_NAMES[x.key] })), k),
  };

  // M-09 スポット
  const spotGroups = new Map<number, Set<string>>();
  for (const x of stampsIn) {
    const set = spotGroups.get(x.s.spotId) ?? new Set<string>();
    set.add(x.groupId);
    spotGroups.set(x.s.spotId, set);
  }
  const top = [...spotGroups.entries()]
    .map(([spotId, set]) => ({ spotId, n: set.size }))
    .sort((a, b) => b.n - a.n || a.spotId - b.spotId)
    .slice(0, 5);
  const topCells = column(top.map((t) => t.n), k);
  const spots = seed.spots as unknown as { id: number; name: string }[];
  const topSpots = top
    .map((t, i) => ({ spotId: t.spotId, spotName: spots.find((s) => s.id === t.spotId)?.name ?? "", groups: topCells[i] }))
    .sort((a, b) => {
      if (a.groups.few !== b.groups.few) return a.groups.few ? 1 : -1;
      if (!a.groups.few) return 0; // 数値どうしは元の順(件数降順)
      return a.spotId - b.spotId;
    });

  // 時系列
  const per = (rows: string[]) => months.map((m) => rows.filter((r) => monthOf(r) === m).length);
  const tsCreated = column(per(created.map((g) => g.createdAt)), k);
  const tsReq = column(per(reqIn.map((x) => x.r.at)), k);
  const tsConf = column(per(confirmed.map((g) => g.confirmedAt as string)), k);
  const tsStamp = column(per(stampsIn.map((x) => x.s.at)), k);
  const timeSeries = months.map((month, i) => ({
    month, groupsCreated: tsCreated[i], joinRequests: tsReq[i], confirmedGroups: tsConf[i], stampsAcquired: tsStamp[i],
  }));

  // M-10 地方別
  const rc = regionIds.map((id) => ({
    id,
    created: created.filter((g) => g.region === id).length,
    req: reqIn.filter((x) => x.region === id).length,
    conf: confirmed.filter((g) => g.region === id).length,
    canc: cancelled.filter((g) => g.region === id).length,
  }));
  const cCreated = column(rc.map((r) => r.created), k);
  const cReq = column(rc.map((r) => r.req), k);
  const cConf = column(rc.map((r) => r.conf), k);
  const regionTable = rc
    .map((r, i) => ({
      row: {
        regionId: r.id, regionName: regionName(r.id),
        groupsCreated: cCreated[i], joinRequests: cReq[i], confirmedGroups: cConf[i],
        cancelRate: toRateCell(r.canc, r.conf + r.canc, k),
      },
      raw: r.created, idx: i,
    }))
    .sort((a, b) => {
      const af = a.row.groupsCreated.few, bf = b.row.groupsCreated.few;
      if (af !== bf) return af ? 1 : -1;
      if (!af) return b.raw - a.raw || a.idx - b.idx;
      return a.idx - b.idx; // 少数どうしは実数で並べない
    })
    .map((x) => x.row);

  const rate = (num: number, den: number): RateCell => toRateCell(num, den, k);
  return {
    meta: { ...meta, query },
    summary: {
      groupsCreated: toCountCell(created.length, k),
      joinRequests: toCountCell(reqIn.length, k),
      approvalRate: rate(approved, approved + rejected),
      confirmedGroups: toCountCell(confirmed.length, k),
      confirmRate: rate(confirmed.length, confirmed.length + cancelled.length),
      cancelRate: rate(cancelled.length, confirmed.length + cancelled.length),
      replanRate: rate(replanned.length, cancelled.length),
      stampsAcquired: toCountCell(stampsIn.length, k),
      repeatRate: rate(repeat, participants.size),
    },
    timeSeries,
    regionTable,
    funnel: [
      { key: "cancelled", label: "中止", cell: toCountCell(cancelled.length, k) },
      { key: "replanned", label: "再企画", cell: toCountCell(replanned.length, k) },
      { key: "replanConfirmed", label: "再企画後の確定", cell: toCountCell(replanConfirmed, k) },
    ],
    cancelReasons: breakdown(reasonCounts, k),
    memberCountDistribution: breakdown(dist, k),
    inflow,
    topSpots,
    ageBands: breakdown(ageCounts, k),
    survey: { responses: toCountCell(0, k), responseRate: { kind: "none" }, items: [] },
  };
}
