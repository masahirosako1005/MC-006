// 11 入口B のハンドラ(ENT-API-01・02)。
import { route, ok, noContent } from "@/lib/api-route";
import { invalidInput, notFound } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import { v } from "@/lib/validation";
import { getCampaign } from "@/features/groups/discovery/regions";
import { recordFunnelEvent } from "./funnel";
import { resolveEntry } from "./parse";
import { CHANNELS, CLIENT_EVENT_TYPES, SOURCE_LABELS } from "./types";
import type { RawQuery } from "./types";

// クエリは strict にせず searchParams を直接解釈する(契約 3.4 の lenient の例外)。
export const resolveEntryHandler = route(async (c) => {
  const q: RawQuery = {};
  let campaign: string | undefined;
  for (const key of new Set(c.url.searchParams.keys())) {
    const all = c.url.searchParams.getAll(key);
    if (key === "campaign") { campaign = all[0]; continue; }
    q[key] = all.length > 1 ? all : all[0];
  }
  if (!campaign) throw notFound("キャンペーン");
  return ok(resolveEntry(campaign, q));
});

const eventSchema = v.object({
  type: v.enum(CLIENT_EVENT_TYPES),
  campaign: v.string({ max: 40 }),
  channel: v.enum(CHANNELS),
  source: v.enum(SOURCE_LABELS),
  groupId: v.id("g", { optional: true }),
});

export const postEntryEventHandler = route(async (c) => {
  const b = await c.body(eventSchema);
  if (!getCampaign(b.campaign)) throw invalidInput({ campaign: "指定できない値です。" });
  if (b.channel !== "A" || b.source !== "none") throw invalidInput({ channel: "組み合わせが正しくありません。" });
  if (b.type === "official_viewed") {
    const g = b.groupId ? db().groups.get(b.groupId) : undefined;
    if (!g || g.visibility !== "public" || !db().listings.get(g.id)) throw invalidInput({ groupId: "指定できないグループです。" });
  } else if (b.groupId) {
    throw invalidInput({ groupId: "指定できません。" });
  }
  recordFunnelEvent({ type: b.type, campaign: b.campaign, channel: b.channel, source: b.source, groupId: b.groupId || undefined });
  return noContent();
});
