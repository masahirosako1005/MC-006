"use client";
// グループ詳細の旅行先地図: 行き先(と旅程の訪問先)を日本地図上にプロット。ズーム・パン可。位置はデモ用のダミー。
import { useMemo, useState } from "react";
import { Card, Stack, Text, Title } from "@mantine/core";
import { JapanZoomMap, type MapPin } from "@/components/JapanZoomMap";
import { destinationPoint, spotPoint, type DestPoint } from "@/lib/group-geo";

export interface GroupTripMapProps { groupId: string; regionId: string; destination: string; visitSpotIds?: number[] }

export function GroupTripMap({ groupId, regionId, destination, visitSpotIds = [] }: GroupTripMapProps) {
  const [sel, setSel] = useState<string | null>(null);
  const spotKey = visitSpotIds.join(",");
  const points = useMemo(() => {
    const main = destinationPoint({ groupId, destination, regionId });
    const map = new Map<string, { p: DestPoint; main: boolean }>([[main.key, { p: main, main: true }]]);
    for (const id of spotKey ? spotKey.split(",").map(Number) : []) {
      const p = spotPoint(id);
      if (p && !map.has(p.key)) map.set(p.key, { p, main: false });
    }
    return [...map.values()];
  }, [groupId, regionId, destination, spotKey]);
  const pins: MapPin[] = points.map(({ p, main }) => ({
    key: p.key, x: p.x, y: p.y, label: p.label, ariaLabel: `${main ? "旅行先" : "訪問先"}: ${p.label}`,
    color: main ? "#e8590c" : "#1971c2", variant: main ? "circle" : "diamond",
  }));
  const shown = points.find((x) => x.p.key === sel) ?? points[0];
  return (
    <Card withBorder component="section" aria-labelledby="sec-map" data-testid="group-trip-map">
      <Stack gap="xs">
        <Title order={3} id="sec-map" size="h4">旅行先の地図</Title>
        <JapanZoomMap pins={pins} selectedKey={sel} onSelect={setSel} ariaLabel="旅行先の地図" testId="group-map"
          legend={<><span style={{ color: "#e8590c" }}>●</span> 旅行先{points.length > 1 && <>　<span style={{ color: "#1971c2" }}>◆</span> 旅程の訪問先</>}</>}
          note="旅行先の位置はデモ用のダミーです(外部地図 API 未使用)。" />
        {shown && (
          <Card withBorder padding="xs" radius="md" data-testid="group-map-card">
            <Text fw={700} size="sm">{shown.p.label}{shown.main ? "(旅行先)" : "(旅程の訪問先)"}</Text>
            {shown.p.description && <Text size="sm">{shown.p.description}</Text>}
          </Card>
        )}
      </Stack>
    </Card>
  );
}
