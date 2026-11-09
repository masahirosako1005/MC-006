// 流入計測(11 ENT-FN-05・06)。
import { clock } from "@/lib/clock";
import { daysBetween, isDateStr } from "@/lib/datetime";
import { invalidInput } from "@/lib/errors";
import { db, newId } from "@/lib/groups-store";
import type { DateStr } from "@/lib/groups-types";
import type { ListingKind } from "@/features/official/types";
import { CHANNELS, FUNNEL_EVENT_TYPES, SOURCE_LABELS } from "./types";
import type { Channel, FunnelAggregate, FunnelEventInput, FunnelQuery, SourceLabel } from "./types";

const KINDS: ListingKind[] = ["official_plan", "gathering_event", "host_slot"];

/** 検証に失敗した入力は例外を投げずに破棄する。 */
export function recordFunnelEvent(input: FunnelEventInput): void {
  try {
    const { type, campaign, channel, source, region, groupId } = input;
    if (!(FUNNEL_EVENT_TYPES as readonly string[]).includes(type)) return;
    if (!(CHANNELS as readonly string[]).includes(channel)) return;
    if (!(SOURCE_LABELS as readonly string[]).includes(source)) return;
    if (typeof campaign !== "string" || !/^[a-z0-9-]{1,40}$/.test(campaign)) return;
    let regionId: string | null = null;
    let listingKind: ListingKind | null = null;
    let gid: string | null = null;
    if (type === "entry_landed" || type === "entry_params_ignored") {
      if (channel !== "B" || groupId !== undefined) return;
      if (type === "entry_landed" && region !== undefined) {
        if (typeof region !== "string" || !db().regions.get(region)) return;
        regionId = region;
      } else if (region !== undefined) return;
    } else {
      if (channel !== "A" || source !== "none" || region !== undefined) return;
      if (type === "official_viewed" || type === "official_requested") {
        if (typeof groupId !== "string") return;
        const listing = db().listings.get(groupId);
        const g = db().groups.get(groupId);
        if (!listing || !g || g.visibility !== "public") return;
        listingKind = listing.kind;
        gid = groupId;
      } else if (groupId !== undefined) return;
    }
    db().funnelEvents.insert({
      id: newId("fe"), type, day: clock.today(), campaign, channel, source,
      region: regionId, listingKind, groupId: gid,
    });
  } catch {
    // 計測の失敗で本処理を止めない
  }
}

function windowStart(today: DateStr): DateStr {
  const [y, m] = today.split("-").map(Number);
  let yy = y, mm = m - 2;
  if (mm < 1) { mm += 12; yy -= 1; }
  return `${yy}-${String(mm).padStart(2, "0")}-01` as DateStr;
}

export function aggregateFunnel(q: FunnelQuery): FunnelAggregate {
  const toDay = q.toDay ?? clock.today();
  if (!isDateStr(toDay)) throw invalidInput({ period: "日付の形式が正しくありません。" });
  const fromDay = q.fromDay ?? windowStart(toDay);
  if (!isDateStr(fromDay)) throw invalidInput({ period: "日付の形式が正しくありません。" });
  if (fromDay > toDay) throw invalidInput({ period: "開始日は終了日以前にしてください。" });
  if (daysBetween(fromDay, toDay) > 366) throw invalidInput({ period: "期間は366日以内にしてください。" });
  const landedBySource = Object.fromEntries(SOURCE_LABELS.map((s) => [s, 0])) as Record<SourceLabel, number>;
  const landedByRegion: Record<string, number> = {};
  const listViewedByChannel = Object.fromEntries(CHANNELS.map((c) => [c, 0])) as Record<Channel, number>;
  const byListingKind = Object.fromEntries(KINDS.map((k) => [k, { viewed: 0, requested: 0 }])) as FunnelAggregate["byListingKind"];
  let ignoredCount = 0, officialViewed = 0, officialRequested = 0;
  for (const e of db().funnelEvents.list()) {
    if (e.campaign !== q.campaign || e.day < fromDay || e.day > toDay) continue;
    switch (e.type) {
      case "entry_landed":
        landedBySource[e.source]++;
        if (e.region) landedByRegion[e.region] = (landedByRegion[e.region] ?? 0) + 1;
        break;
      case "entry_params_ignored": ignoredCount++; break;
      case "list_viewed": listViewedByChannel[e.channel]++; break;
      case "official_viewed":
        officialViewed++;
        if (e.listingKind) byListingKind[e.listingKind].viewed++;
        break;
      case "official_requested":
        officialRequested++;
        if (e.listingKind) byListingKind[e.listingKind].requested++;
        break;
    }
  }
  return { campaign: q.campaign, fromDay, toDay, landedBySource, landedByRegion, ignoredCount,
    listViewedByChannel, officialViewed, officialRequested, byListingKind };
}
