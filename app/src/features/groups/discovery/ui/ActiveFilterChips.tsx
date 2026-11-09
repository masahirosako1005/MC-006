"use client";
import { Button, Chip, Group, Text } from "@mantine/core";
import type { GroupListFilter, Region } from "../types";

export interface ActiveFilterChipsProps {
  filter: GroupListFilter; regions: Region[];
  onChange(next: Partial<GroupListFilter>): void; onClear(): void;
}

export function ActiveFilterChips({ filter: f, regions, onChange, onClear }: ActiveFilterChipsProps) {
  const chips: { key: string; label: string; clear: Partial<GroupListFilter> }[] = [];
  if (f.q) chips.push({ key: "q", label: `キーワード「${f.q}」`, clear: { q: undefined } });
  if (f.region) chips.push({ key: "region", label: `地方 ${regions.find((r) => r.id === f.region)?.name ?? f.region}`, clear: { region: undefined } });
  if (f.dateFrom || f.dateTo) chips.push({ key: "date", label: `日程 ${f.dateFrom ?? ""}〜${f.dateTo ?? ""}`, clear: { dateFrom: undefined, dateTo: undefined } });
  if (f.vacancy !== undefined) chips.push({ key: "vacancy", label: `空き ${f.vacancy}人以上`, clear: { vacancy: undefined } });
  f.tags.forEach((t) => chips.push({ key: `tag-${t}`, label: `タグ ${t}`, clear: { tags: f.tags.filter((x) => x !== t) } }));
  if (f.ageBuckets.length) chips.push({ key: "age", label: `年代 ${f.ageBuckets.length}件`, clear: { ageBuckets: [] } });
  if (f.official) chips.push({ key: "official", label: "自治体のおすすめプラン", clear: { official: false } });
  if (!chips.length) return null;
  return (
    <Group gap="xs" aria-label="適用中の条件">
      <Text size="xs" c="dimmed">適用中の条件:</Text>
      {chips.map((c) => (
        <Chip key={c.key} checked onChange={() => onChange(c.clear)} size="xs" variant="light" aria-label={`${c.label} を解除`}>{c.label} ×</Chip>
      ))}
      <Button variant="subtle" size="compact-sm" onClick={onClear}>条件をクリア</Button>
    </Group>
  );
}
