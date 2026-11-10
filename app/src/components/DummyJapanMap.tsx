// デモ用の日本地図。国土地理院「地球地図日本」由来の都道府県境データを japan-map-data.ts にローカル同梱(外部通信ゼロ)。
// 架空の地方 ID(seed の r-xxx)は、下の DEMO_REGION_MAP で実在地方に対応づける。強調・クリックは地方単位。
import type { CSSProperties } from "react";
import { JAPAN_MAP_VIEWBOX, JAPAN_PREFECTURES, JAPAN_REGION_CENTERS } from "./japan-map-data";

type RegionKey = "hokkaido" | "tohoku" | "kanto" | "chubu" | "kinki" | "chugoku" | "shikoku" | "kyushu" | "okinawa";

const REGION_NAMES: Record<RegionKey, string> = {
  hokkaido: "北海道", tohoku: "東北", kanto: "関東", chubu: "中部", kinki: "近畿", chugoku: "中国", shikoku: "四国", kyushu: "九州", okinawa: "沖縄",
};
const REGION_KEYS = Object.keys(REGION_NAMES) as RegionKey[];

/** 架空の地方 ID → 地図上の地方(デモ用の対応表)。 */
export const DEMO_REGION_MAP: Record<string, RegionKey> = {
  "r-mizukoto": "kinki",
  "r-suzukaze": "chubu",
  "r-hoshinagi": "okinawa",
  "r-nijiho": "kyushu",
};

export interface DummyMapMarker { label: string; x?: number; y?: number; region?: string }

export interface DummyJapanMapProps {
  /** 強調する地方(seed の地方 ID / 地方名 / 実在地方キー)。 */
  highlightRegions?: string[];
  /** x,y は viewBox(JAPAN_MAP_VIEWBOX)上の座標。region 指定なら地方の中心付近に置く。 */
  markers?: DummyMapMarker[];
  onSelectRegion?: (regionId: string) => void;
  height?: number | string;
  caption?: string;
}

function resolve(v: string | undefined): RegionKey | undefined {
  if (!v) return undefined;
  if (DEMO_REGION_MAP[v]) return DEMO_REGION_MAP[v];
  return REGION_KEYS.find((k) => k === v || REGION_NAMES[k] === v);
}

export function DummyJapanMap({ highlightRegions = [], markers = [], onSelectRegion, height = 260, caption }: DummyJapanMapProps) {
  const hl = new Set(highlightRegions.map(resolve).filter(Boolean) as RegionKey[]);
  const wrap: CSSProperties = { width: "100%", maxWidth: 420, margin: "0 auto" };
  const reverse = (k: RegionKey) => Object.entries(DEMO_REGION_MAP).find(([, v]) => v === k)?.[0] ?? k;
  const { w, h } = JAPAN_MAP_VIEWBOX;
  return (
    <figure style={{ margin: 0 }} data-testid="dummy-japan-map">
      <div style={wrap}>
        <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={caption ?? "日本地図"} style={{ width: "100%", height, display: "block", background: "#e6f1fa", borderRadius: 12 }}>
          {JAPAN_PREFECTURES.map((p) => {
            const key = p.region as RegionKey;
            const on = hl.has(key);
            return (
              <path
                key={p.code}
                data-pref={p.code}
                data-region={key}
                d={p.d}
                fill={on ? "#f4a340" : "#dfe9d2"}
                stroke="#fff"
                strokeWidth={0.8}
                strokeLinejoin="round"
                onClick={onSelectRegion ? () => onSelectRegion(reverse(key)) : undefined}
                style={{ cursor: onSelectRegion ? "pointer" : "default" }}
              >
                <title>{`${REGION_NAMES[key]}(${p.name})`}</title>
              </path>
            );
          })}
          {markers.map((m, i) => {
            const c = JAPAN_REGION_CENTERS[resolve(m.region) ?? ""];
            const x = m.x ?? (c ? c[0] : w / 2);
            const y = m.y ?? (c ? c[1] : h / 2);
            return (
              <g key={i} style={{ pointerEvents: "none" }}>
                <circle cx={x} cy={y} r={9} fill="#d9363e" stroke="#fff" strokeWidth={3} />
                <text x={x} y={y - 14} textAnchor="middle" fontSize={20} fontWeight={700} fill="#222" stroke="#fff" strokeWidth={5} paintOrder="stroke">{m.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 4 }}>
        デモ用(外部地図 API 未使用){caption ? ` / ${caption}` : ""}
        <br />
        地図: 国土地理院「地球地図日本」(公共データ利用規約 第1.0版・CC BY 4.0 互換)をもとに加工
      </figcaption>
    </figure>
  );
}
