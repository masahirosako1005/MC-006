"use client";
// MUN-UI-11 グラフ/表の切替。スタブ。
import type { ReactNode } from "react";

export interface ChartTableToggleProps { chart: ReactNode; table: ReactNode; label?: string }

export function ChartTableToggle(props: ChartTableToggleProps) {
  void props;
  return <div />;
}
