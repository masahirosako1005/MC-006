// MUN-UI-10 CountCell/RateCell の表示。
import type { CountCell, RateCell } from "../types";

export interface CellTextProps { cell: CountCell | RateCell; unit?: string; minCount: number }

const dim = { color: "var(--mantine-color-dimmed)", fontWeight: 700 } as const;

export function CellText({ cell, unit = "件", minCount }: CellTextProps) {
  if ("few" in cell) {
    return cell.few
      ? <span style={dim} title={`${minCount} 件未満`}>少数</span>
      : <span>{cell.value.toLocaleString()} {unit}</span>;
  }
  switch (cell.kind) {
    case "value": return <span>{cell.percent}%</span>;
    case "below": return <span>{cell.percent}% 未満</span>;
    case "few": return <span style={dim}>少数</span>;
    default: return <span style={{ color: "var(--mantine-color-dimmed)" }}>―</span>;
  }
}
