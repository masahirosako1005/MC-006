"use client";
import { Button, Checkbox, Chip, Fieldset, Group, Select, SimpleGrid, Stack, Switch, Text, TextInput, Title } from "@mantine/core";
import { CLOSED_INCLUDED_STATUSES, DEFAULT_LIST_STATUSES } from "../types";
import type { GroupListFilter, GroupListResponse, Region } from "../types";

export interface FilterPanelProps {
  filter: GroupListFilter; regions: Region[]; facets: GroupListResponse["facets"] | null;
  resultCount: number | null; onChange(next: Partial<GroupListFilter>): void; onClear(): void;
  onClose?: () => void;
}

const AGES = [["20s-", "20代以下"], ["30-40s", "30〜40代"], ["50-60s", "50〜60代"], ["70s+", "70代以上"]] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function FilterPanel({ filter: f, regions, facets, resultCount, onChange, onClear, onClose }: FilterPanelProps) {
  const includeClosed = f.statuses.length > DEFAULT_LIST_STATUSES.length;
  const tagChoices = [...new Set([...(facets?.tags.map((t) => t.tag) ?? []), ...f.tags])];
  const count = (tag: string) => facets?.tags.find((t) => t.tag === tag)?.count;
  const dateInput = (key: "dateFrom" | "dateTo", label: string) => (
    <TextInput type="date" label={label} value={f[key] ?? ""}
      onChange={(e) => { const v = e.currentTarget.value; onChange({ [key]: DATE_RE.test(v) ? v : undefined }); }} />
  );
  return (
    <form role="search" aria-label="グループの絞り込み" onSubmit={(e) => e.preventDefault()}>
      <Stack gap="sm">
        <Title order={2} size="h4" id="filter-title">絞り込み</Title>
        <Select label="地方" placeholder="すべての地方" clearable value={f.region ?? null}
          data={regions.map((r) => ({ value: r.id, label: r.name }))} onChange={(v) => onChange({ region: v ?? undefined })} />
        <Fieldset legend="日程">
          <SimpleGrid cols={2}>{dateInput("dateFrom", "開始日")}{dateInput("dateTo", "終了日")}</SimpleGrid>
          <Text size="xs" c="dimmed" mt={4}>この期間と重なる旅行を表示します。</Text>
        </Fieldset>
        <Fieldset legend="空き">
          <Checkbox label="空きのあるグループのみ" checked={f.vacancy !== undefined}
            onChange={(e) => onChange({ vacancy: e.currentTarget.checked ? 1 : undefined })} />
          {f.vacancy !== undefined && (
            <Select mt="xs" label="空きの人数(以上)" allowDeselect={false} value={String(f.vacancy)}
              data={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: `${n} 人以上` }))}
              onChange={(v) => onChange({ vacancy: v ? Number(v) : undefined })} />
          )}
        </Fieldset>
        <Fieldset legend="タグ・テーマ">
          {tagChoices.length === 0 ? <Text size="xs" c="dimmed">候補はありません。</Text> : (
            <Group gap={6}>
              {tagChoices.map((t) => (
                <Chip key={t} size="xs" checked={f.tags.includes(t)}
                  onChange={(on) => onChange({ tags: on ? [...f.tags, t] : f.tags.filter((x) => x !== t) })}>
                  {t}{count(t) !== undefined ? `(${count(t)})` : ""}
                </Chip>
              ))}
            </Group>
          )}
          <Text size="xs" c="dimmed" mt={4}>複数選ぶと、いずれかを含むグループを表示します。</Text>
        </Fieldset>
        <Fieldset legend="メンバーに含まれる年代">
          <Stack gap={4}>
            {AGES.map(([v, label]) => (
              <Checkbox key={v} label={label} checked={f.ageBuckets.includes(v)}
                onChange={(e) => onChange({ ageBuckets: e.currentTarget.checked ? [...f.ageBuckets, v] : f.ageBuckets.filter((x) => x !== v) })} />
            ))}
          </Stack>
          <Text size="xs" c="dimmed" mt={4}>参加中が 4 人以上のグループが対象です。</Text>
        </Fieldset>
        <Switch label="自治体のおすすめプランのみ" checked={f.official} onChange={(e) => onChange({ official: e.currentTarget.checked })} />
        <Switch label="受付が終わったグループも表示" checked={includeClosed}
          onChange={(e) => onChange({ statuses: e.currentTarget.checked ? [...CLOSED_INCLUDED_STATUSES] : [...DEFAULT_LIST_STATUSES] })} />
        <Group justify="space-between">
          <Button variant="subtle" onClick={onClear}>条件をクリア</Button>
          {onClose && <Button onClick={onClose}>結果を見る{resultCount !== null ? `(${resultCount} 件)` : ""}</Button>}
        </Group>
      </Stack>
    </form>
  );
}
