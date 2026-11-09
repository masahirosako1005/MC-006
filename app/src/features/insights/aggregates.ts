// 13 集計済みデータの読み込み(INS-FN-03)。初回だけ形を検証して保持する。
import raw from "@/data/insight-aggregates.json";
import type { InsightAggregates } from "./types";

let cached: InsightAggregates | null = null;

export function getAggregates(): InsightAggregates {
  if (cached) return cached;
  const a = raw as unknown as InsightAggregates;
  const ok = a && a.schemaVersion === 1 && a.meta && Array.isArray(a.meta.weeks) && Array.isArray(a.meta.areas)
    && Array.isArray(a.visitVolume) && Array.isArray(a.weekdayProfile) && Array.isArray(a.hourProfile)
    && Array.isArray(a.participation) && Array.isArray(a.satisfaction) && Array.isArray(a.goodPoints)
    && Array.isArray(a.requestThemes);
  if (!ok) throw new Error("insight-aggregates.json の形が正しくありません。");
  cached = a;
  return cached;
}
