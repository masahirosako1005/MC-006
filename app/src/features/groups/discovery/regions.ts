// 地方マスタ・キャンペーン(02 DSC-FN-05)。00 だけに依存。
import type { CampaignInfo, Region } from "./types";

export function listRegions(campaign: string): Region[] {
  void campaign;
  throw new Error("not implemented");
}

export function getCampaign(slug: string): CampaignInfo | null {
  void slug;
  throw new Error("not implemented");
}
