"use client";
// INS-UI-04。
import { Select } from "@mantine/core";
import type { Id } from "@/lib/groups-types";

export interface AreaSelectProps { regions: { id: Id; name: string }[]; value: Id | null; onChange(next: Id | null): void; disabled?: boolean }
export function AreaSelect({ regions, value, onChange, disabled }: AreaSelectProps) {
  return (
    <Select
      label="担当エリア"
      description="登録した事業所のあるエリアを選べます。"
      data={regions.map((r) => ({ value: r.id, label: r.name }))}
      value={value}
      onChange={(v) => onChange(v)}
      placeholder="すべての担当エリア"
      clearable
      disabled={disabled}
    />
  );
}
