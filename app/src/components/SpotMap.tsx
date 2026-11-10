"use client";
// スポット地図: 共通の JapanZoomMap にスポットのピンを渡す薄いラッパー。
import { JapanZoomMap, type MapPin } from "./JapanZoomMap";
import { spotPosition } from "@/lib/spot-geo";

export interface SpotMapSpot { id: number; stampName: string; name: string; area: string; acquired: boolean }

export function SpotMap({ spots, selectedId, onSelect }: { spots: SpotMapSpot[]; selectedId: number | null; onSelect: (id: number | null) => void }) {
  const pins: MapPin[] = spots.map((s) => ({
    key: String(s.id), ...spotPosition(s), label: s.stampName,
    ariaLabel: `${s.name}(${s.acquired ? "獲得済み" : "未獲得"})`,
    color: s.acquired ? "#2f9e44" : "#e8590c", variant: s.acquired ? "circle" : "diamond",
  }));
  return (
    <JapanZoomMap
      pins={pins}
      selectedKey={selectedId == null ? null : String(selectedId)}
      onSelect={(k) => onSelect(k == null ? null : Number(k))}
      ariaLabel="スポット地図"
      testId="spot-map"
      note="スポット位置はデモ用のダミーです。"
      legend={<><span style={{ color: "#2f9e44" }}>●</span> 獲得済み　<span style={{ color: "#e8590c" }}>◆</span> 未獲得</>}
    />
  );
}
