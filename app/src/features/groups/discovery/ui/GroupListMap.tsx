"use client";
// グループ一覧の地図モード: 一覧中のグループの旅行先をすべてプロット。同じ旅行先は1つのピンにまとめて件数を表示。
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, Card, Group, Stack, Text } from "@mantine/core";
import { JapanZoomMap, type MapPin } from "@/components/JapanZoomMap";
import { destinationPoint, type DestPoint } from "@/lib/group-geo";
import type { GroupSummary } from "../types";
import { fmtRange } from "./format";

export function GroupListMap({ groups, campaign }: { groups: GroupSummary[]; campaign: string }) {
  const [sel, setSel] = useState<string | null>(null);
  const clusters = useMemo(() => {
    const m = new Map<string, { p: DestPoint; groups: GroupSummary[] }>();
    for (const g of groups) {
      const p = destinationPoint({ groupId: g.id, destination: g.trip.destination, regionId: g.region.id });
      const c = m.get(p.key);
      if (c) c.groups.push(g); else m.set(p.key, { p, groups: [g] });
    }
    return [...m.values()];
  }, [groups]);
  const pins: MapPin[] = clusters.map(({ p, groups: gs }) => ({
    key: p.key, x: p.x, y: p.y, label: p.label, count: gs.length, color: "#e8590c",
    ariaLabel: `${p.label}(${gs.length} 件のグループ)`,
  }));
  const cur = clusters.find((c) => c.p.key === sel);
  return (
    <Stack gap="xs" data-testid="group-list-map">
      <JapanZoomMap pins={pins} selectedKey={sel} onSelect={setSel} ariaLabel="グループの旅行先の地図" testId="group-list-map-canvas"
        legend={<><span style={{ color: "#e8590c" }}>●</span> 旅行先(数字は件数)</>}
        note="旅行先の位置はデモ用のダミーです(外部地図 API 未使用)。" />
      {cur ? (
        <Stack gap="xs" data-testid="group-map-popover">
          <Text fw={700} size="sm">{cur.p.label}({cur.groups.length} 件)</Text>
          {cur.groups.map((g) => (
            <Card key={g.id} withBorder padding="xs" radius="md">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div>
                  <Text fw={700} size="sm">{g.name}</Text>
                  <Text size="xs" c="dimmed">{fmtRange(g.trip.startDate, g.trip.endDate)} / {g.region.name}</Text>
                  <Text size="xs">{g.headcount.isFull ? "満員" : `空き ${g.headcount.vacancy} 人`}(定員 {g.headcount.capacity} 人)</Text>
                </div>
                <Button component={Link} href={`/${campaign}/groups/${g.id}`} size="xs" variant="light">詳細を見る</Button>
              </Group>
            </Card>
          ))}
        </Stack>
      ) : (
        <Text size="xs" c="dimmed">{groups.length === 0 ? "表示するグループがありません。" : "ピンを選ぶと、グループの情報が表示されます。"}</Text>
      )}
    </Stack>
  );
}
