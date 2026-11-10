"use client";
// MUN-UI-02 全体レイアウト。
import { useState } from "react";
import { Alert, Button, SimpleGrid, Stack, Text } from "@mantine/core";
import type { RateCell, StatsQuery } from "../types";
import { useStats } from "./use-stats";
import { FilterBar } from "./FilterBar";
import { MetricCard } from "./MetricCard";
import { RegionTable } from "./RegionTable";
import { BarList } from "./BarList";
import { PrivacyNote } from "./PrivacyNote";
import { ForbiddenNotice } from "./ForbiddenNotice";

function rateText(c: RateCell): string {
  if (c.kind === "value") return `${c.percent}%`;
  if (c.kind === "below") return `${c.percent}% 未満`;
  return c.kind === "few" ? "少数" : "―";
}

export function StatsDashboard() {
  const [query, setQuery] = useState<StatsQuery | null>(null);
  const { data, error, loading, reload } = useStats(query);
  if (error?.status === 403) return <ForbiddenNotice reason={error.reason} />;
  const fieldErrors = error?.status === 400 || error?.code === "invalid_input" ? error.fields : undefined;
  const k = data?.meta.minCellCount ?? 5;
  const s = data?.summary;
  return (
    <Stack p="md" gap="md">
      <Text fw={700} fz="xl">集計ダッシュボード</Text>
      {data && <PrivacyNote minCount={k} includesDemoHistory={data.meta.includesDemoHistory} />}
      {data && <FilterBar regions={data.meta.regions} value={data.meta.query} errors={fieldErrors} onChange={setQuery} />}
      {error && !fieldErrors && (
        <Alert color="red" title="集計を取得できませんでした">
          {error.message} <Button size="xs" variant="light" onClick={() => void reload()}>再試行</Button>
        </Alert>
      )}
      {loading && !data && <Text c="dimmed">読み込み中…</Text>}
      {data && s && (
        <>
          <Text fw={700}>主な指標({data.meta.query.from.slice(0, 7)}〜{data.meta.query.to.slice(0, 7)})</Text>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <MetricCard title="グループ作成数" cell={s.groupsCreated} minCount={k} hint="再企画のグループを含む" loading={loading} />
            <MetricCard title="参加申請数" cell={s.joinRequests} minCount={k} hint="申請中・取り下げ・失効を含む" loading={loading} />
            <MetricCard title="承認率" cell={s.approvalRate} minCount={k} hint="承認 /(承認+見送り)" loading={loading} />
            <MetricCard title="実行確定率" cell={s.confirmRate} minCount={k} hint="確定 /(確定+中止)" loading={loading} />
            <MetricCard title="中止率" cell={s.cancelRate} minCount={k} hint={`再企画率 ${rateText(s.replanRate)}`} loading={loading} />
            <MetricCard title="再訪率" cell={s.repeatRate} minCount={k} hint="参加者のうち 2 回以上" loading={loading} />
          </SimpleGrid>
          <Text fw={700}>地方別</Text>
          <RegionTable rows={data.regionTable} minCount={k} />
          <BarList title="流入元" items={data.inflow.bySource} unit="件" minCount={k} note="公式枠の絞り込みは適用しません" />
        </>
      )}
    </Stack>
  );
}
