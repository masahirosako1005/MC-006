// INS-UI-07。スタブ。
import type { AreaWeekRow, WeekForecast } from "../types";

export interface AreaForecastTableProps { rows: AreaWeekRow[]; weeks: WeekForecast[]; minCount: number }
export function AreaForecastTable(props: AreaForecastTableProps) { void props; return <div />; }
