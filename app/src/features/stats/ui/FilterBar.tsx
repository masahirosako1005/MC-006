"use client";
// MUN-UI-04。
import { Card, Group, SegmentedControl, Select, Stack, Text, TextInput } from "@mantine/core";
import type { Id } from "@/lib/groups-types";
import type { OfficialFilter, StatsQuery } from "../types";

export interface FilterBarProps {
  regions: { id: Id; name: string }[]; value: StatsQuery;
  onChange(next: StatsQuery): void; disabled?: boolean; errors?: Record<string, string>;
}

const ALL = "__all";
const ym = (d: string) => d.slice(0, 7);
const monthEnd = (m: string) => {
  const [y, mo] = m.split("-").map(Number);
  return `${m}-${String(new Date(Date.UTC(y, mo, 0)).getUTCDate()).padStart(2, "0")}`;
};

export function FilterBar({ regions, value, onChange, disabled, errors }: FilterBarProps) {
  return (
    <Card withBorder radius="md" p="sm">
      <Stack gap="xs">
        <Text fw={700}>集計の条件</Text>
        <Group grow align="flex-start">
          <TextInput type="month" label="開始月" disabled={disabled} value={ym(value.from)} error={errors?.from}
            onChange={(e) => e.currentTarget.value && onChange({ ...value, from: `${e.currentTarget.value}-01` })} />
          <TextInput type="month" label="終了月" disabled={disabled} value={ym(value.to)} error={errors?.to}
            onChange={(e) => e.currentTarget.value && onChange({ ...value, to: monthEnd(e.currentTarget.value) })} />
        </Group>
        <Select label="地方" disabled={disabled} allowDeselect={false} value={value.region ?? ALL} error={errors?.region}
          data={[{ value: ALL, label: "担当地方すべて" }, ...regions.map((r) => ({ value: r.id, label: r.name }))]}
          onChange={(v) => onChange({ ...value, region: !v || v === ALL ? null : v })} />
        <div>
          <Text size="sm" fw={500}>公式枠</Text>
          <SegmentedControl size="xs" disabled={disabled} value={value.official}
            onChange={(v) => onChange({ ...value, official: v as OfficialFilter })}
            data={[{ value: "all", label: "すべて" }, { value: "official", label: "公式枠" }, { value: "general", label: "一般" }]} />
        </div>
      </Stack>
    </Card>
  );
}
