"use client";
// MUN-UI-11 グラフ/表の切替。
import { useState, type ReactNode } from "react";
import { SegmentedControl, Stack } from "@mantine/core";

export interface ChartTableToggleProps { chart: ReactNode; table: ReactNode; label?: string }

export function ChartTableToggle({ chart, table, label = "表示形式" }: ChartTableToggleProps) {
  const [mode, setMode] = useState("table");
  return (
    <Stack gap="xs">
      <SegmentedControl size="xs" aria-label={label} value={mode} onChange={setMode}
        data={[{ value: "table", label: "表" }, { value: "chart", label: "グラフ" }]} />
      {mode === "chart" ? chart : table}
    </Stack>
  );
}
