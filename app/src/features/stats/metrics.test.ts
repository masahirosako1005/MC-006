import { describe, expect, it, vi } from "vitest";

vi.mock("./privacy", () => ({
  toCountCell: (n: number, k: number) => (n > 0 && n < k ? { few: true } : { few: false, value: n }),
  toRateCell: (num: number, den: number, k: number) => {
    if (den === 0) return { kind: "none" };
    if (den < k) return { kind: "few" };
    if (num > 0 && num < k) return { kind: "below", percent: Math.ceil((k / den) * 100) };
    return { kind: "value", percent: Math.round((num / den) * 100) };
  },
  suppressBreakdown: (counts: number[], k: number) => {
    const few = counts.map((n) => n > 0 && n < k);
    if (few.filter(Boolean).length === 1) {
      let best = -1;
      counts.forEach((n, i) => { if (n >= k && (best < 0 || n < counts[best])) best = i; });
      if (best >= 0) few[best] = true;
    }
    return few;
  },
  coarseAgeBand: () => null,
}));

import { cancelReasonGroup, computeStats, groupPhase } from "./metrics";
import type { GroupFact } from "./types";

const base: GroupFact = {
  groupId: "g", campaign: "c", region: "r-a", official: false, status: "recruiting",
  createdAt: "2026-10-05T00:00:00+09:00", confirmedAt: null, completedAt: null, cancelledAt: null,
  cancelReason: null, replanOfGroupId: null, memberCount: 3, participantKeys: [], ageBands: [],
  requests: [], stamps: [], surveys: [], origin: "live",
};
const funnel = {
  campaign: "c", fromDay: "2026-09-01", toDay: "2026-11-30",
  landedBySource: { "muni-site": 12, "muni-pr": 7, sns: 3, search: 0, "travel-media": 0, transport: 0, other: 0, none: 0, unknown: 0 },
  landedByRegion: {}, ignoredCount: 2, listViewedByChannel: { A: 40, B: 0 }, officialViewed: 9, officialRequested: 0, byListingKind: {},
} as never;
const query = { from: "2026-09-01", to: "2026-11-30", region: null, official: "all" } as const;
const meta = {
  municipalityName: "m", campaign: "c", regions: [{ id: "r-a", name: "A" }], minCellCount: 5,
  includesDemoHistory: false, generatedAt: "2026-11-09T00:00:00+09:00",
};
const mk = (n: number, o: Partial<GroupFact>): GroupFact[] =>
  Array.from({ length: n }, (_, i) => ({ ...base, groupId: `g${i}${o.status}${o.confirmedAt}`, ...o }));

describe("metrics", () => {
  it("groupPhase / cancelReasonGroup", () => {
    expect(groupPhase("withdrawal_period")).toBe("open");
    expect(groupPhase("completed")).toBe("confirmed");
    expect(groupPhase("replanned")).toBe("cancelled");
    expect(cancelReasonGroup("below_floor")).toBe("other");
    expect(cancelReasonGroup("organizer_left")).toBe("organizer");
    expect(cancelReasonGroup("min_not_reached")).toBe("deadline_unmet");
  });

  it("MUN-T-18/21/22/32 作成数・確定率・中止率・不整合", () => {
    const groups = [
      ...mk(7, { status: "confirmed", confirmedAt: "2026-10-10T00:00:00+09:00", memberCount: 3 }),
      ...mk(4, { status: "cancelled", cancelledAt: "2026-10-12T00:00:00+09:00", cancelReason: "min_not_reached" }),
      ...mk(1, { status: "confirmed", confirmedAt: null }),
      ...mk(1, { status: "withdrawal_period" }),
    ];
    const r = computeStats({ groups, funnel, query, meta });
    expect(r.summary.groupsCreated).toEqual({ few: false, value: 13 });
    expect(r.summary.confirmedGroups).toEqual({ few: false, value: 7 });
    expect(r.summary.confirmRate).toEqual({ kind: "value", percent: 64 });
    expect(r.summary.cancelRate).toEqual({ kind: "below", percent: 46 });
    expect(r.cancelReasons.map((c) => c.cell)).toEqual([{ few: true }, { few: false, value: 0 }, { few: false, value: 0 }]);
  });

  it("MUN-T-30 期間境界は JST", () => {
    const groups = [
      ...mk(5, { status: "confirmed", confirmedAt: "2026-09-30T23:59:59+09:00" }),
      ...mk(6, { status: "confirmed", confirmedAt: "2026-10-01T00:00:00+09:00" }),
    ];
    const r = computeStats({ groups, funnel, query, meta });
    expect(r.timeSeries.map((t) => t.confirmedGroups)).toEqual([
      { few: false, value: 5 }, { few: false, value: 6 }, { few: false, value: 0 },
    ]);
  });

  it("MUN-T-26 流入の補完秘匿", () => {
    const r = computeStats({ groups: [], funnel, query, meta });
    expect(r.inflow.byType.map((c) => c.cell)).toEqual([
      { few: false, value: 22 }, { few: true }, { few: false, value: 40 }, { few: true }, { few: false, value: 0 },
    ]);
  });
});
