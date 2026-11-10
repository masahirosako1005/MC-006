// デモ用ダミー日本地図。外部通信ゼロのインライン SVG(外部地図 API・タイル・CDN 未使用)。
// 架空の地方 ID(seed の r-xxx)は、下の DEMO_REGION_MAP で実在地方の形に対応づける。
import type { CSSProperties } from "react";

type RegionKey = "hokkaido" | "tohoku" | "kanto" | "chubu" | "kinki" | "chugoku" | "shikoku" | "kyushu" | "okinawa";

const SHAPES: { key: RegionKey; name: string; d: string; c: [number, number] }[] = [
  { key: "hokkaido", name: "北海道", d: "M205,70 L195,48 L215,22 L238,12 L258,30 L272,55 L250,72 L226,62 Z", c: [236, 42] },
  { key: "tohoku", name: "東北", d: "M205,122 L216,80 L242,80 L247,120 L236,152 L214,152 Z", c: [228, 118] },
  { key: "kanto", name: "関東", d: "M214,152 L236,152 L248,182 L226,198 L204,186 Z", c: [226, 175] },
  { key: "chubu", name: "中部", d: "M150,140 L205,122 L214,152 L204,186 L226,198 L196,212 L164,202 L140,176 Z", c: [180, 170] },
  { key: "kinki", name: "近畿", d: "M104,190 L140,176 L164,202 L150,228 L114,228 Z", c: [133, 205] },
  { key: "chugoku", name: "中国", d: "M40,200 L104,190 L114,228 L94,238 L40,226 Z", c: [78, 214] },
  { key: "shikoku", name: "四国", d: "M70,246 L116,242 L122,260 L86,270 L64,262 Z", c: [94, 255] },
  { key: "kyushu", name: "九州", d: "M20,252 L50,246 L62,282 L50,322 L30,332 L14,300 Z", c: [38, 288] },
  { key: "okinawa", name: "沖縄", d: "M28,350 L92,340 L96,356 L34,364 Z", c: [62, 352] },
];

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
  /** x,y は viewBox(300x370)上の座標。region 指定なら地方の中心付近に置く。 */
  markers?: DummyMapMarker[];
  onSelectRegion?: (regionId: string) => void;
  height?: number | string;
  caption?: string;
}

function resolve(v: string | undefined): RegionKey | undefined {
  if (!v) return undefined;
  if (DEMO_REGION_MAP[v]) return DEMO_REGION_MAP[v];
  return SHAPES.find((s) => s.key === v || s.name === v)?.key;
}

export function DummyJapanMap({ highlightRegions = [], markers = [], onSelectRegion, height = 260, caption }: DummyJapanMapProps) {
  const hl = new Set(highlightRegions.map(resolve).filter(Boolean) as RegionKey[]);
  const wrap: CSSProperties = { width: "100%", maxWidth: 420, margin: "0 auto" };
  const reverse = (k: RegionKey) => Object.entries(DEMO_REGION_MAP).find(([, v]) => v === k)?.[0] ?? k;
  return (
    <figure style={{ margin: 0 }} data-testid="dummy-japan-map">
      <div style={wrap}>
        <svg viewBox="0 0 300 370" role="img" aria-label={caption ?? "日本地図(ダミー)"} style={{ width: "100%", height, display: "block", background: "#e6f1fa", borderRadius: 12 }}>
          {SHAPES.map((s) => {
            const on = hl.has(s.key);
            return (
              <g key={s.key} onClick={onSelectRegion ? () => onSelectRegion(reverse(s.key)) : undefined} style={{ cursor: onSelectRegion ? "pointer" : "default" }}>
                <path d={s.d} fill={on ? "#f4a340" : "#dfe9d2"} stroke="#fff" strokeWidth={2} strokeLinejoin="round" />
                <text x={s.c[0]} y={s.c[1]} textAnchor="middle" fontSize={11} fill="#33443a" style={{ pointerEvents: "none" }}>{s.name}</text>
              </g>
            );
          })}
          {markers.map((m, i) => {
            const c = SHAPES.find((s) => s.key === resolve(m.region))?.c;
            const x = m.x ?? (c ? c[0] : 150);
            const y = m.y ?? (c ? c[1] + 14 : 150);
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={6} fill="#d9363e" stroke="#fff" strokeWidth={2} />
                <text x={x} y={y - 10} textAnchor="middle" fontSize={11} fontWeight={700} fill="#222" stroke="#fff" strokeWidth={3} paintOrder="stroke">{m.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <figcaption style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 4 }}>
        ダミー地図(デモ用・外部地図 API 未使用){caption ? ` / ${caption}` : ""}
      </figcaption>
    </figure>
  );
}
