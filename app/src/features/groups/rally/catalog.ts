// 08: seed のスポット・特典の読み取り(サーバー側専用)。keyword は公開 DTO に含めない。
import seed from "@/data/seed.json";
import type { SpotCatalogItem } from "./types";

interface SeedSpot extends SpotCatalogItem { keyword: string }
export interface RewardCatalogItem { id: number; name: string; prize: string; requiredStamps: number }

const SPOTS = seed.spots as unknown as SeedSpot[];

export const CAMPAIGN_NAME: string = seed.campaign.name;
export const CAMPAIGN_SLUG: string = seed.campaign.slug;

function toItem(s: SeedSpot): SpotCatalogItem {
  return { id: s.id, name: s.name, stampName: s.stampName, area: s.area, description: s.description, map: s.map, hue: s.hue };
}

export function listSpots(): SpotCatalogItem[] {
  return SPOTS.map(toItem);
}

export function listRewards(): RewardCatalogItem[] {
  return (seed.rewards as RewardCatalogItem[])
    .map((r) => ({ id: r.id, name: r.name, prize: r.prize, requiredStamps: r.requiredStamps }))
    .sort((a, b) => a.requiredStamps - b.requiredStamps);
}

export function findSpotByKeyword(keyword: string): SpotCatalogItem | undefined {
  const k = keyword.trim().toLowerCase();
  if (!k) return undefined;
  const s = SPOTS.find((x) => x.keyword.trim().toLowerCase() === k);
  return s ? toItem(s) : undefined;
}
