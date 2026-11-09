// 02 のハンドラ(DSC-FN-15)。検証とサービス呼び出しのみ。
import seed from "@/data/group-seed.json";
import { route } from "@/lib/api-route";
import { clock } from "@/lib/clock";
import { invalidInput } from "@/lib/errors";
import { v } from "@/lib/validation";
import { rejectProhibitedParams } from "@/features/safety/guards/input";
import { parseGroupListQuery } from "./query";
import { getCampaign, listRegions } from "./regions";
import { findByInviteCode, listGroups } from "./service";

const DEFAULT_CAMPAIGN = seed.meta.campaign;

export const listGroupsHandler = route(async (c) => {
  rejectProhibitedParams(c.url.searchParams);
  const parsed = parseGroupListQuery(c.url.searchParams, "strict", {
    campaigns: [DEFAULT_CAMPAIGN],
    defaultCampaign: DEFAULT_CAMPAIGN,
    regions: listRegions(DEFAULT_CAMPAIGN),
    today: clock.today(),
  });
  return listGroups(c.user, parsed.filter, parsed.page);
});

export const lookupInviteHandler = route(async (c) => {
  const { code } = await c.body(v.object({ code: v.string({ max: 32 }) }));
  return findByInviteCode(c.user, code);
});

export const listRegionsHandler = route(async (c) => {
  const { campaign } = c.query(v.object({ campaign: v.string({ default: DEFAULT_CAMPAIGN }) }));
  const info = getCampaign(campaign);
  if (!info) throw invalidInput({ campaign: "不明なキャンペーンです。" });
  const regions = listRegions(campaign).map((r) => ({ id: r.id, name: r.name, campaign: r.campaign }));
  return { campaign: info, regions };
});
