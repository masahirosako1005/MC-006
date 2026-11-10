// 地図のズーム・パン計算(viewBox を state で持つ。純関数)。view の縦横比は常に full と同じ。
export interface MapView { x: number; y: number; w: number; h: number }
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 8;

export function zoomOf(view: MapView, full: { w: number; h: number }): number {
  return full.w / view.w;
}

/** 倍率を [min,max] に、位置を地図内に収める。 */
export function clampView(view: MapView, full: { w: number; h: number }, minZoom = MIN_ZOOM, maxZoom = MAX_ZOOM): MapView {
  const z = Math.min(maxZoom, Math.max(minZoom, full.w / view.w));
  const w = full.w / z;
  const h = full.h / z;
  return { w, h, x: Math.min(full.w - w, Math.max(0, view.x)), y: Math.min(full.h - h, Math.max(0, view.y)) };
}

/** (fx,fy)=表示領域内の相対位置(0〜1)を中心に factor 倍する。 */
export function zoomAt(view: MapView, full: { w: number; h: number }, factor: number, fx = 0.5, fy = 0.5): MapView {
  const w = view.w / factor;
  const h = view.h / factor;
  const px = view.x + view.w * fx;
  const py = view.y + view.h * fy;
  return clampView({ w, h, x: px - w * fx, y: py - h * fy }, full);
}

/** viewBox 座標 (px,py) を表示領域の中央へ(倍率はそのまま)。 */
export function centerOn(view: MapView, full: { w: number; h: number }, px: number, py: number): MapView {
  return clampView({ ...view, x: px - view.w / 2, y: py - view.h / 2 }, full);
}
