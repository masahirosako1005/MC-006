// MUN-UI-06。スタブ。
import type { TimePoint } from "../types";

export interface TimeSeriesChartProps { points: TimePoint[]; series: { key: keyof Omit<TimePoint, "month">; label: string }[] }
export function TimeSeriesChart(props: TimeSeriesChartProps) { void props; return <div />; }
