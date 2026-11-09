// 12 活動中データのアダプタ(MUN-FN-03)と合成履歴の流入加算(MUN-FN-14)。
import { aggregateFunnel } from "@/features/entry/funnel";
import { db } from "@/lib/groups-store";
import { buildDemoHistory } from "./demo-history";
import { coarseAgeBand } from "./privacy";
import type {
  FunnelAggregate, GroupFact, HistoryFunnelEvent, MunicipalScope, StatsQuery,
} from "./types";

/** 合成履歴の流入イベントを base の期間・キャンペーンで絞って加算した新しい値を返す(base は変更しない)。 */
export function addFunnelEvents(base: FunnelAggregate, events: readonly HistoryFunnelEvent[]): FunnelAggregate {
  const out: FunnelAggregate = {
    ...base,
    landedBySource: { ...base.landedBySource },
    landedByRegion: { ...base.landedByRegion },
    listViewedByChannel: { ...base.listViewedByChannel },
    byListingKind: Object.fromEntries(
      Object.entries(base.byListingKind).map(([k, x]) => [k, { ...x }]),
    ) as FunnelAggregate["byListingKind"],
  };
  for (const e of events) {
    if (e.campaign !== base.campaign || e.day < base.fromDay || e.day > base.toDay) continue;
    switch (e.type) {
      case "entry_landed": out.landedBySource[e.source] = (out.landedBySource[e.source] ?? 0) + 1; break;
      case "entry_params_ignored": out.ignoredCount += 1; break;
      case "list_viewed": out.listViewedByChannel[e.channel] += 1; break;
      case "official_viewed": out.officialViewed += 1; break;
      case "official_requested": out.officialRequested += 1; break;
    }
  }
  return out;
}

function liveFacts(scope: MunicipalScope): GroupFact[] {
  const store = db();
  const regionIds = new Set(scope.regions.map((r) => r.id));
  return store.groups
    .filter((g) => g.campaign === scope.municipality.campaign && regionIds.has(g.region))
    .map((g): GroupFact => {
      const members = store.members.filter((m) => m.groupId === g.id && m.status === "active");
      const keys = members.map((m) => m.userId);
      return {
        groupId: g.id,
        campaign: g.campaign,
        region: g.region,
        official: g.official,
        status: g.lifecycle.status,
        createdAt: g.createdAt,
        confirmedAt: g.lifecycle.confirmedAt,
        completedAt: g.lifecycle.completedAt,
        cancelledAt: g.lifecycle.cancelledAt,
        cancelReason: g.lifecycle.cancelReason,
        replanOfGroupId: g.lifecycle.replanOfGroupId,
        memberCount: keys.length,
        participantKeys: keys,
        ageBands: keys.map((u) => coarseAgeBand(store.profiles.get(u)?.ageBand)),
        requests: store.joinRequests
          .filter((r) => r.groupId === g.id)
          .map((r) => ({ at: r.createdAt, status: r.status, decidedAt: r.decidedAt })),
        stamps: store.groupStamps.filter((s) => s.groupId === g.id).map((s) => ({ spotId: s.spotId, at: s.at })),
        surveys: g.lifecycle.status === "completed"
          ? store.rallySurveys.filter((s) => s.groupId === g.id).map((s) => ({
              satisfaction: s.satisfaction, wantAgain: s.wantAgain,
              localInteraction: s.localInteraction, localExploration: s.localExploration,
            }))
          : [],
        origin: "live",
      };
    });
}

export function collectFacts(
  scope: MunicipalScope, query: StatsQuery, now: Date, opts?: { includeHistory?: boolean },
): { groups: GroupFact[]; funnel: FunnelAggregate } {
  const campaign = scope.municipality.campaign;
  const regionIds = new Set(scope.regions.map((r) => r.id));
  let groups = liveFacts(scope);
  let funnel = aggregateFunnel({ campaign, fromDay: query.from, toDay: query.to });
  if (opts?.includeHistory !== false) {
    const hist = buildDemoHistory(db().municipalities.list());
    const nowMs = now.getTime();
    const past = (iso: string | null) => iso === null || new Date(iso).getTime() <= nowMs;
    groups = groups.concat(
      hist.groups.filter((g) => g.campaign === campaign && regionIds.has(g.region) && past(g.createdAt)),
    );
    const today = new Date(nowMs + 9 * 3600 * 1000).toISOString().slice(0, 10);
    funnel = addFunnelEvents(funnel, hist.funnelEvents.filter((e) => e.day <= today));
  }
  return { groups, funnel };
}
