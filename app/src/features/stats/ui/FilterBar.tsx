"use client";
// MUN-UI-04。スタブ。
import type { Id } from "@/lib/groups-types";
import type { StatsQuery } from "../types";

export interface FilterBarProps {
  regions: { id: Id; name: string }[]; value: StatsQuery;
  onChange(next: StatsQuery): void; disabled?: boolean; errors?: Record<string, string>;
}
export function FilterBar(props: FilterBarProps) { void props; return <div />; }
