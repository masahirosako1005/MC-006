"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Drawer, Group, Select, SimpleGrid, Skeleton, Stack, Text, TextInput, Title } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useGroupsApi } from "@/lib/groups-api";
import { DummyJapanMap } from "@/components/DummyJapanMap";
import type { MeResponse } from "@/lib/groups-types";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { DemoBar } from "@/components/groups/common/DemoBar";
import type { QueryContext } from "../query";
import { SORT_OPTIONS } from "../types";
import type { GroupListFilter, Region, RelaxSuggestion, SortOption } from "../types";
import { ActiveFilterChips } from "./ActiveFilterChips";
import { FilterPanel } from "./FilterPanel";
import { GroupCard } from "./GroupCard";
import { ListEmptyState } from "./ListEmptyState";
import { ListErrorState } from "./ListErrorState";
import { useFilterUrlState } from "./hooks/useFilterUrlState";
import { useGroupList } from "./hooks/useGroupList";

export interface GroupListScreenProps { campaign: string }

const SORT_LABEL: Record<SortOption, string> = {
  "deadline:asc": "締切が近い順", "start:asc": "出発日が近い順", "created:desc": "新着順", "vacancy:desc": "空きが多い順",
};
const IGNORED_LABEL: Record<string, string> = {
  region: "地方", dateFrom: "開始日", dateTo: "終了日", from: "開始日", to: "終了日", vacancy: "空き", tags: "タグ", q: "キーワード",
  ageBuckets: "年代", official: "公式", status: "状態", sort: "並び順", page: "ページ", campaign: "キャンペーン",
};

function suggestionPatch(s: RelaxSuggestion): Partial<GroupListFilter> {
  switch (s.kind) {
    case "clear_dates": return { dateFrom: undefined, dateTo: undefined };
    case "clear_region": return { region: undefined };
    case "clear_tags": return { tags: [] };
    case "clear_age": return { ageBuckets: [] };
    case "clear_query": return { q: undefined };
    case "clear_vacancy": return { vacancy: undefined };
    case "clear_official": return { official: false };
    case "include_closed": return { statuses: ["recruiting", "min_reached", "withdrawal_period", "confirmed", "in_progress", "completed"] };
  }
}

export function GroupListScreen({ campaign }: GroupListScreenProps) {
  const regionsRes = useGroupsApi<{ regions: Region[] }>(`/api/regions?campaign=${encodeURIComponent(campaign)}`);
  const me = useGroupsApi<MeResponse>("/api/demo/me");
  const regions = regionsRes.data?.regions;
  const today = me.data?.clock.today;
  const ctx: QueryContext | null = useMemo(
    () => (regions && today ? { campaigns: [campaign], defaultCampaign: campaign, regions, today } : null),
    [regions, today, campaign],
  );

  const { filter, page, ignored, update, clear } = useFilterUrlState(ctx);
  const { data, loading, error, reload } = useGroupList(filter, page);
  const wide = useMediaQuery("(min-width: 48em)");
  const [drawer, setDrawer] = useState(false);
  const [qDraft, setQDraft] = useState<string | null>(null);

  const urlQ = filter?.q ?? "";
  const draft = qDraft ?? urlQ;
  useEffect(() => {
    if (qDraft === null || qDraft === urlQ) return;
    const t = setTimeout(() => { update({ q: qDraft.trim() || undefined }); setQDraft(null); }, 300);
    return () => clearTimeout(t);
  }, [qDraft, urlQ, update]);

  const setupError = regionsRes.error ?? me.error;
  const onClear = () => { setQDraft(null); clear(); };
  const panelProps = filter && regions ? {
    filter, regions, facets: data?.facets ?? null, resultCount: data?.total ?? null, onChange: update, onClear,
  } : null;

  return (
    <div>
      <DemoBar />
      <Box maw={1100} mx="auto" p="md">
        <Stack gap="md">
          <Group justify="space-between" wrap="wrap">
            <Title order={1} size="h2">グループを探す</Title>
            <Group gap="xs">
              <Button component={Link} href={`/${campaign}/invite`} variant="default" size="sm">招待コードを入力</Button>
              <Button component={Link} href={`/${campaign}/new-group`} size="sm">グループを作る</Button>
            </Group>
          </Group>

          {setupError && <ErrorNotice error={setupError} />}
          {!setupError && !filter && <LoadingBlock />}

          {filter && panelProps && (
            <>
              <Group align="flex-end" wrap="nowrap">
                <TextInput style={{ flex: 1 }} type="search" label="キーワード" placeholder="行き先・名称・タグ" description="部分一致で探します。"
                  value={draft} onChange={(e) => setQDraft(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { update({ q: draft.trim() || undefined }); setQDraft(null); } }} />
                {!wide && <Button variant="default" onClick={() => setDrawer(true)} style={{ minHeight: 44 }}>絞り込み</Button>}
              </Group>

              {ignored.length > 0 && (
                <Alert color="yellow" role="status">
                  一部の条件が無効なため無視しました: {ignored.map((i) => IGNORED_LABEL[i.key] ?? i.key).join("、")}
                </Alert>
              )}

              <ActiveFilterChips filter={filter} regions={regions!} onChange={update} onClear={onClear} />

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md" style={{ gridTemplateColumns: wide ? "280px 1fr" : undefined }}>
                {wide && <Box component="section" aria-labelledby="filter-title"><FilterPanel {...panelProps} /></Box>}
                <Stack component="section" aria-labelledby="result-title" gap="sm" aria-busy={loading}>
                  <Group justify="space-between">
                    <Title order={2} size="h4" id="result-title">結果</Title>
                    <Select aria-label="並び順" w={190} allowDeselect={false} value={filter.sort}
                      data={SORT_OPTIONS.map((o) => ({ value: o, label: SORT_LABEL[o] }))}
                      onChange={(v) => v && update({ sort: v as SortOption })} />
                  </Group>
                  <DummyJapanMap height={180} highlightRegions={filter.region ? [filter.region] : (regions ?? []).map((r) => r.id)} onSelectRegion={(id) => update({ region: id })} caption="地方で絞り込み" />
                  <Text size="sm" role="status" aria-live="polite">
                    {loading ? "検索中" : data ? `${data.total} 件のグループが見つかりました` : ""}
                  </Text>
                  {error ? <ListErrorState error={error} onRetry={reload} />
                    : loading && !data ? (
                      <Stack>{[0, 1, 2].map((i) => <Skeleton key={i} h={140} radius="md" />)}</Stack>
                    ) : data && data.items.length === 0 ? (
                      <ListEmptyState filter={filter} suggestions={data.suggestions} campaign={campaign}
                        onApplySuggestion={(s) => update(suggestionPatch(s))} />
                    ) : (
                      <Stack component="ul" gap="sm" p={0} m={0} style={{ listStyle: "none", opacity: loading ? 0.6 : 1 }}>
                        {data?.items.map((g) => <li key={g.id}><GroupCard group={g} campaign={campaign} /></li>)}
                      </Stack>
                    )}
                </Stack>
              </SimpleGrid>

              <Drawer opened={!wide && drawer} onClose={() => setDrawer(false)} title="絞り込み" position="left" size="100%">
                <FilterPanel {...panelProps} onClose={() => setDrawer(false)} />
              </Drawer>
            </>
          )}
        </Stack>
      </Box>
    </div>
  );
}

