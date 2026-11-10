// スポットのダミー座標(地図 viewBox 上)。所属エリア → 地方の代表位置 + ID ハッシュによる決定的な小オフセット。
import { JAPAN_MAP_VIEWBOX, JAPAN_REGION_CENTERS } from "@/components/japan-map-data";

/** seed のエリア名 → 地図上の地方(デモ用の対応)。未知のエリアは ID から決定的に割り当てる。 */
const AREA_REGION: Record<string, string> = {
  "鈴風高原": "chubu", "星凪諸島": "okinawa", "虹帆町": "kyushu", "星綴港": "kinki",
  "月灯集落": "tohoku", "雫森谷": "chugoku", "白波離島": "hokkaido",
};
const REGIONS = Object.keys(JAPAN_REGION_CENTERS);

function hash(n: number): number {
  let h = Math.imul(n, 2654435761) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  return h >>> 0;
}

export function spotPosition(spot: { id: number; area: string }): { x: number; y: number; region: string } {
  const region = AREA_REGION[spot.area] ?? REGIONS[hash(spot.id) % REGIONS.length];
  const [cx, cy] = JAPAN_REGION_CENTERS[region];
  const h = hash(spot.id * 31 + 7);
  const dx = ((h & 0xff) / 255 - 0.5) * 30;
  const dy = (((h >>> 8) & 0xff) / 255 - 0.5) * 30;
  const { w, h: vh } = JAPAN_MAP_VIEWBOX;
  return { region, x: Math.min(w - 8, Math.max(8, cx + dx)), y: Math.min(vh - 8, Math.max(8, cy + dy)) };
}
