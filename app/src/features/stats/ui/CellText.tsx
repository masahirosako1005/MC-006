// MUN-UI-10 CountCell/RateCell の表示。スタブ。
import type { CountCell, RateCell } from "../types";

export interface CellTextProps { cell: CountCell | RateCell; unit?: string; minCount: number }

export function CellText(props: CellTextProps) {
  void props;
  return <span />;
}
