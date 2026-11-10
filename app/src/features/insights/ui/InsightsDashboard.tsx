"use client";
// INS-UI-02。
import { useState } from "react";
import { Badge, Card, SimpleGrid, Stack, Table, Text, Title } from "@mantine/core";
import type { Id } from "@/lib/groups-types";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { AreaSelect } from "./AreaSelect";
import { InsightForbidden } from "./InsightForbidden";
import { InsightNotice } from "./InsightNotice";
import { SuggestionList } from "./SuggestionList";
import { cellNum, cellText } from "./cell";
import { useInsightForecast, useInsightSuggestions } from "./use-insights";

export function InsightsDashboard() {
  const [region, setRegion] = useState<Id | null>(null);
  const f = useInsightForecast(region);
  const s = useInsightSuggestions(region);

  if (f.error?.status === 403) return <InsightForbidden reason={f.error.reason} />;
  if (f.error) return <ErrorNotice error={f.error} onRetry={() => void f.reload()} />;
  if (!f.data) return <LoadingBlock />;
  const { meta, weeks, limitations } = f.data;

  const val = (c: { few: boolean; value?: number }) => (c.few ? -1 : (c.value ?? 0));
  const total = weeks.reduce((n, w) => n + Math.max(0, val(w.total.expected)), 0);
  const peak = weeks.reduce<(typeof weeks)[number] | null>((b, w) => (!b || val(w.total.expected) > val(b.total.expected) ? w : b), null);

  return (
    <Stack gap="lg">
      <Title order={2}>来訪の見込みと提案</Title>
      <Text size="sm" c="dimmed">{meta.business.displayName}({meta.business.categoryLabel})</Text>
      <InsightNotice limitations={limitations} minCount={meta.minCellCount} includesDemoTrips={meta.includesDemoTrips} />

      <Card withBorder>
        <Title order={4} mb="sm">表示の条件</Title>
        <AreaSelect regions={meta.regions} value={region} onChange={setRegion} />
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">見込みの概要</Title>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <div><Text size="xs" c="dimmed">表示期間の来訪見込み(少数の週を除く)</Text><Text fw={700} size="xl">{total} 人</Text></div>
          <div><Text size="xs" c="dimmed">ピークの週</Text><Text fw={700} size="xl">{peak ? peak.label : "-"}</Text><Text size="sm">{peak ? cellText(peak.total.expected) : ""}</Text></div>
          <div><Text size="xs" c="dimmed">見込みの確度</Text><Badge color="gray" variant="light">参考値</Badge></div>
        </SimpleGrid>
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">提案</Title>
        {s.error ? <ErrorNotice error={s.error} onRetry={() => void s.reload()} />
          : !s.data ? <LoadingBlock />
          : <SuggestionList cards={s.data.cards} ownCategory={meta.business.category} minCount={meta.minCellCount} />}
      </Card>

      <Card withBorder>
        <Title order={4} mb="sm">週別・年代帯別の来訪見込み(人)</Title>
        <Table.ScrollContainer minWidth={560}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>週</Table.Th>
                {weeks[0]?.byAge.map((a) => <Table.Th key={a.age}>{a.label}</Table.Th>)}
                <Table.Th>合計</Table.Th>
                <Table.Th>確定</Table.Th>
                <Table.Th>募集中</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {weeks.map((w) => (
                <Table.Tr key={w.weekStart}>
                  <Table.Td>{w.label}{w.total.partial ? "(期間末)" : ""}</Table.Td>
                  {w.byAge.map((a) => <Table.Td key={a.age}>{cellNum(a.cell.expected)}</Table.Td>)}
                  <Table.Td fw={700}>{cellNum(w.total.expected)}</Table.Td>
                  <Table.Td>{cellNum(w.plannedByCertainty.confirmed)}</Table.Td>
                  <Table.Td>{cellNum(w.plannedByCertainty.tentative)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
