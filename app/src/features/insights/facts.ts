// 13 参加予定の収集(INS-FN-05)。
import { db } from "@/lib/groups-store";
import { coarseAgeBand } from "@/features/stats/privacy";
import type { CoarseAgeBand } from "@/features/stats/types";
import { PLANNED_STATUSES } from "./config";
import type { BusinessScope, InsightQuery, PlannedFact } from "./types";

export function collectPlanned(scope: BusinessScope, query: InsightQuery): PlannedFact[] {
  const regionIds = query.region ? [query.region] : scope.regions.map((r) => r.id);
  const conf: readonly string[] = PLANNED_STATUSES.confirmed;
  const tent: readonly string[] = PLANNED_STATUSES.tentative;
  const out: PlannedFact[] = [];
  for (const g of db().groups.list()) {
    if (g.campaign !== scope.business.campaign || !regionIds.includes(g.region)) continue;
    const st = g.lifecycle.status;
    const certainty = conf.includes(st) ? "confirmed" : tent.includes(st) ? "tentative" : null;
    if (!certainty) continue;
    const ages: CoarseAgeBand[] = [];
    for (const m of db().members.list()) {
      if (m.groupId !== g.id || m.status !== "active") continue;
      const band = coarseAgeBand(db().profiles.get(m.userId)?.ageBand);
      if (band) ages.push(band);
    }
    out.push({ regionId: g.region, startDate: g.trip.startDate, endDate: g.trip.endDate, certainty, ages });
  }
  return out;
}
