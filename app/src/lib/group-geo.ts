// グループの旅行先のダミー座標(地図 viewBox 上)。決定的(同じ入力なら同じ座標)。
// 行き先名がスポット名(stampName)に一致すればそのスポットの座標。無ければ地方(架空地方 ID → DEMO_REGION_MAP)の代表位置 + ID ハッシュの小オフセット。
import seed from "@/data/seed.json";
import { DEMO_REGION_MAP } from "@/components/DummyJapanMap";
import { JAPAN_MAP_VIEWBOX, JAPAN_REGION_CENTERS } from "@/components/japan-map-data";
import { spotPosition } from "@/lib/spot-geo";

export interface GeoSpot { id: number; stampName: string; name: string; area: string; description: string }
const SPOTS = (seed as unknown as { spots: GeoSpot[] }).spots;
const REGIONS = Object.keys(JAPAN_REGION_CENTERS);

export function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
}

export function findSpotByName(name: string): GeoSpot | undefined {
  return SPOTS.find((s) => s.stampName === name || s.name === name);
}
export function findSpotById(id: number): GeoSpot | undefined { return SPOTS.find((s) => s.id === id); }

export interface DestPoint { key: string; label: string; description: string; x: number; y: number; region: string; spotId: number | null }

/** 行き先名・地方 ID・グループ ID から座標を求める。 */
export function destinationPoint(d: { groupId: string; destination: string; regionId: string }): DestPoint {
  const spot = findSpotByName(d.destination);
  if (spot) {
    const p = spotPosition(spot);
    return { key: `spot-${spot.id}`, label: spot.stampName, description: spot.description, x: p.x, y: p.y, region: p.region, spotId: spot.id };
  }
  const region = DEMO_REGION_MAP[d.regionId] ?? REGIONS[strHash(d.regionId) % REGIONS.length];
  const [cx, cy] = JAPAN_REGION_CENTERS[region];
  const h = strHash(d.groupId + "|" + d.destination);
  const { w, h: vh } = JAPAN_MAP_VIEWBOX;
  const x = Math.min(w - 8, Math.max(8, cx + ((h & 0xff) / 255 - 0.5) * 30));
  const y = Math.min(vh - 8, Math.max(8, cy + (((h >>> 8) & 0xff) / 255 - 0.5) * 30));
  return { key: `grp-${d.groupId}`, label: d.destination, description: "", x, y, region, spotId: null };
}

/** スポット ID から座標(旅程の訪問先用)。 */
export function spotPoint(spotId: number): DestPoint | null {
  const s = findSpotById(spotId);
  if (!s) return null;
  const p = spotPosition(s);
  return { key: `spot-${s.id}`, label: s.stampName, description: s.description, x: p.x, y: p.y, region: p.region, spotId: s.id };
}
