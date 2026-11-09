// MUN-UI-09。スタブ。
import type { LabeledCell } from "../types";

export interface BarListProps { title: string; items: LabeledCell[]; unit: string; minCount: number; note?: string }
export function BarList(props: BarListProps) { void props; return <div />; }
