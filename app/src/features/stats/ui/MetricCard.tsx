// MUN-UI-05。スタブ。
import type { CountCell, RateCell } from "../types";

export interface MetricCardProps {
  title: string; cell: CountCell | RateCell; unit?: string; hint: string; minCount: number; loading?: boolean;
}
export function MetricCard(props: MetricCardProps) { void props; return <div />; }
