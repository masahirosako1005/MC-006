// 12 権限(MUN-FN-01)。
import { AppError } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import type { DemoUser } from "@/lib/groups-types";
import type { MunicipalScope } from "./types";

const notMunicipal = () =>
  new AppError("forbidden", "自治体の担当者のみ利用できます。", { reason: "not_municipal" });

export function resolveScope(user: DemoUser): MunicipalScope {
  if (user.role !== "municipal" || !user.municipalityId) throw notMunicipal();
  const m = db().municipalities.get(user.municipalityId);
  if (!m) throw notMunicipal();
  return {
    municipality: { id: m.id, campaign: m.campaign, displayName: m.displayName },
    regions: m.regionIds.map((id) => ({ id, name: db().regions.get(id)?.name ?? id })),
  };
}
