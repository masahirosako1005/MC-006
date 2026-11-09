// 地方マスタ・キャンペーン(02 DSC-FN-05)。00 だけに依存。
import { db } from "@/lib/groups-store";
import groupSeedJson from "@/data/group-seed.json";
import type { CampaignInfo, Region } from "./types";

const SEED_CAMPAIGN: string = (groupSeedJson as { meta: { campaign: string } }).meta.campaign;
const CAMPAIGN_NAMES: Record<string, string> = { "nttw-demo": "NTTW デモキャンペーン" };

export function listRegions(campaign: string): Region[] {
  return db().regions.filter((r) => r.campaign === campaign).map((r) => ({ ...r, spotAreas: [...r.spotAreas] }));
}

export function getCampaign(slug: string): CampaignInfo | null {
  if (slug !== SEED_CAMPAIGN) return null;
  return { slug, name: CAMPAIGN_NAMES[slug] ?? slug };
}
