"use client";
// スポット地図: 日本地図(国土地理院由来、ローカル同梱)上にスポットをプロットし、ズーム・パン可能。
// viewBox を state で制御(新規依存なし)。ピン・線幅は拡大しても見た目一定。
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { ActionIcon, Group } from "@mantine/core";
import { JAPAN_MAP_VIEWBOX, JAPAN_PREFECTURES, JAPAN_REGION_CENTERS } from "./japan-map-data";
import { centerOn, clampView, zoomAt, zoomOf, type MapView } from "@/lib/map-view";
import { spotPosition } from "@/lib/spot-geo";

export interface SpotMapSpot { id: number; stampName: string; name: string; area: string; acquired: boolean }

const FULL = JAPAN_MAP_VIEWBOX;
const FULL_VIEW: MapView = { x: 0, y: 0, w: FULL.w, h: FULL.h };
const REGION_LABEL: Record<string, string> = { hokkaido: "北海道", tohoku: "東北", kanto: "関東", chubu: "中部", kinki: "近畿", chugoku: "中国", shikoku: "四国", kyushu: "九州", okinawa: "沖縄" };

export function SpotMap({ spots, selectedId, onSelect }: { spots: SpotMapSpot[]; selectedId: number | null; onSelect: (id: number | null) => void }) {
  const [view, setView] = useState<MapView>(FULL_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; dist: number } | null>(null);

  const zoom = zoomOf(view, FULL);
  const k = view.w / FULL.w; // 1画面px相当の逆スケール(ピンを一定サイズに保つ)
  const pins = spots.map((s) => ({ s, ...spotPosition(s) }));

  const rel = (cx: number, cy: number) => {
    const r = svgRef.current!.getBoundingClientRect();
    return { fx: (cx - r.left) / r.width, fy: (cy - r.top) / r.height, r };
  };

  // ホイールはカーソルが地図上にあるときだけ(passive:false が必要なためネイティブ登録)。
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { fx, fy } = rel(e.clientX, e.clientY);
      setView((v) => zoomAt(v, FULL, Math.exp(-e.deltaY * 0.0015), fx, fy));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // 選択されたスポットへ移動(倍率が低ければ 3 倍まで寄せる)。
  useEffect(() => {
    if (selectedId == null) return;
    const p = pins.find((x) => x.s.id === selectedId);
    if (!p) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setView((v) => { const z = zoomOf(v, FULL) < 3 ? zoomAt(v, FULL, 3 / zoomOf(v, FULL)) : v; return centerOn(z, FULL, p.x, p.y); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const down = (e: PointerEvent<SVGSVGElement>) => {
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesture.current = { moved: false, dist: 0 };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current.dist = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const move = (e: PointerEvent<SVGSVGElement>) => {
    const prev = ptrs.current.get(e.pointerId);
    if (!prev || !gesture.current) return;
    const cur = { x: e.clientX, y: e.clientY };
    if (ptrs.current.size === 1) {
      if (!gesture.current.moved && Math.hypot(cur.x - prev.x, cur.y - prev.y) < 1 && e.buttons === 0) return;
      const r = svgRef.current!.getBoundingClientRect();
      const dx = cur.x - prev.x, dy = cur.y - prev.y;
      if (!gesture.current.moved) {
        // 小さな揺れはクリック扱い。累積が小さい間は prev を更新しない。
        if (Math.hypot(dx, dy) < 4) return;
        gesture.current.moved = true;
        try { svgRef.current!.setPointerCapture(e.pointerId); } catch { /* 無視 */ }
      }
      ptrs.current.set(e.pointerId, cur);
      setView((v) => clampView({ ...v, x: v.x - (dx / r.width) * v.w, y: v.y - (dy / r.height) * v.h }, FULL));
    } else if (ptrs.current.size === 2) {
      ptrs.current.set(e.pointerId, cur);
      const [a, b] = [...ptrs.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.moved = true;
      if (gesture.current.dist > 0 && dist > 0) {
        const { fx, fy } = rel((a.x + b.x) / 2, (a.y + b.y) / 2);
        const f = dist / gesture.current.dist;
        setView((v) => zoomAt(v, FULL, f, fx, fy));
      }
      gesture.current.dist = dist;
    }
  };
  const up = (e: PointerEvent<SVGSVGElement>) => {
    ptrs.current.delete(e.pointerId);
    if (ptrs.current.size === 0) setTimeout(() => { gesture.current = null; }, 0);
  };
  const click = (e: React.MouseEvent) => {
    // ドラッグ後のクリックは無視(ピン選択にしない)
    if (gesture.current?.moved) { e.stopPropagation(); return; }
  };
  const key = (e: KeyboardEvent) => {
    const step = view.w * 0.15;
    const pan = (dx: number, dy: number) => setView((v) => clampView({ ...v, x: v.x + dx, y: v.y + dy }, FULL));
    if (e.key === "+" || e.key === "=") setView((v) => zoomAt(v, FULL, 1.5));
    else if (e.key === "-" || e.key === "_") setView((v) => zoomAt(v, FULL, 1 / 1.5));
    else if (e.key === "ArrowLeft") pan(-step, 0);
    else if (e.key === "ArrowRight") pan(step, 0);
    else if (e.key === "ArrowUp") pan(0, -step);
    else if (e.key === "ArrowDown") pan(0, step);
    else return;
    e.preventDefault();
  };

  return (
    <div data-testid="spot-map" style={{ width: "100%", maxWidth: 520, margin: "0 auto", position: "relative" }}>
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        role="application"
        aria-label="スポット地図(+/-で拡大縮小、矢印キーで移動)"
        tabIndex={0}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onClickCapture={click}
        onKeyDown={key}
        style={{ width: "100%", height: "auto", aspectRatio: `${FULL.w} / ${FULL.h}`, maxHeight: "70vh", display: "block", background: "#e6f1fa", borderRadius: 12, touchAction: "none", cursor: "grab", userSelect: "none" }}
      >
        {JAPAN_PREFECTURES.map((p) => (
          <path key={p.code} data-pref={p.code} data-region={p.region} d={p.d} fill="#dfe9d2" stroke="#fff" strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" onClick={() => onSelect(null)} />
        ))}
        {zoom >= 2 && Object.entries(JAPAN_REGION_CENTERS).map(([r, [x, y]]) => (
          <text key={r} x={x} y={y} textAnchor="middle" fontSize={12 * k} fill="#6b7a5a" stroke="#fff" strokeWidth={3 * k} paintOrder="stroke" style={{ pointerEvents: "none" }}>{REGION_LABEL[r]}</text>
        ))}
        {pins.map(({ s, x, y }) => {
          const sel = s.id === selectedId;
          const color = s.acquired ? "#2f9e44" : "#e8590c";
          return (
            <g
              key={s.id}
              data-spot={s.id}
              transform={`translate(${x} ${y}) scale(${k})`}
              tabIndex={0}
              role="button"
              aria-label={`${s.name}(${s.acquired ? "獲得済み" : "未獲得"})`}
              aria-pressed={sel}
              style={{ cursor: "pointer", outline: "none" }}
              onClick={(e) => { e.stopPropagation(); onSelect(sel ? null : s.id); }}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect(sel ? null : s.id); } }}
            >
              {sel && <circle r={14} fill="none" stroke="#1971c2" strokeWidth={3} />}
              {s.acquired ? <circle r={8} fill={color} stroke="#fff" strokeWidth={2} /> : <rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" fill={color} stroke="#fff" strokeWidth={2} />}
              {zoom >= 2.5 && <text y={-14} textAnchor="middle" fontSize={11} fontWeight={700} fill="#222" stroke="#fff" strokeWidth={3} paintOrder="stroke" style={{ pointerEvents: "none" }}>{s.stampName}</text>}
            </g>
          );
        })}
      </svg>
      <Group gap={4} style={{ position: "absolute", top: 8, right: 8, flexDirection: "column" }}>
        <ActionIcon variant="white" size="lg" aria-label="拡大" onClick={() => setView((v) => zoomAt(v, FULL, 1.5))}>＋</ActionIcon>
        <ActionIcon variant="white" size="lg" aria-label="縮小" onClick={() => setView((v) => zoomAt(v, FULL, 1 / 1.5))}>－</ActionIcon>
        <ActionIcon variant="white" size="lg" aria-label="リセット" onClick={() => setView(FULL_VIEW)}>⟲</ActionIcon>
      </Group>
      <div style={{ position: "absolute", left: 8, bottom: 8, background: "rgba(255,255,255,.9)", borderRadius: 8, padding: "2px 8px", fontSize: 11 }} aria-label="凡例">
        <span style={{ color: "#2f9e44" }}>●</span> 獲得済み　<span style={{ color: "#e8590c" }}>◆</span> 未獲得　<span style={{ color: "#666" }}>{zoom.toFixed(1)}倍</span>
      </div>
      <div style={{ fontSize: 11, color: "#666", textAlign: "center", marginTop: 4 }}>
        スポット位置はデモ用のダミーです。
        <br />
        地図: 国土地理院「地球地図日本」(公共データ利用規約 第1.0版・CC BY 4.0 互換)をもとに加工
      </div>
    </div>
  );
}
