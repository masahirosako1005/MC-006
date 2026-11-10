"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge, Card, Group, SegmentedControl, Stack, Switch, Text } from "@mantine/core";
import { Spot, useApi } from "@/lib/api";
import { SpotMap } from "@/components/SpotMap";

const WANT_KEY = "raund-mirror-want-";

export default function Spots() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const { data: spots, loading, error } = useApi<Spot[]>("/spots");
  const [view, setView] = useState("list");
  const [onlyWant, setOnlyWant] = useState(false);
  const [want, setWant] = useState<number[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const sel = (spots ?? []).find((s) => s.id === selId);

  // localStorage は使えない環境（プライベートモード等）もあるので try で囲む。
  // SSR 時は localStorage が無く、初期値で読むと hydration が食い違うため、マウント後に読む。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setWant(JSON.parse(localStorage.getItem(WANT_KEY + slug) ?? "[]")); } catch { /* 無視 */ }
  }, [slug]);
  const toggle = (id: number) => {
    const next = want.includes(id) ? want.filter((x) => x !== id) : [...want, id];
    setWant(next);
    try { localStorage.setItem(WANT_KEY + slug, JSON.stringify(next)); } catch { /* 無視 */ }
  };
  const list = (spots ?? []).filter((s) => !onlyWant || want.includes(s.id));

  return (
    <Stack p="md" gap="sm">
      <SegmentedControl fullWidth value={view} onChange={setView} data={[{ label: "リスト", value: "list" }, { label: "地図", value: "map" }]} />
      <Switch label="行きたいスポットのみ" checked={onlyWant} onChange={(e) => setOnlyWant(e.currentTarget.checked)} />
      {loading && <Text c="dimmed">読み込み中…</Text>}
      {error && <Text c="red">読み込みに失敗しました</Text>}
      {view === "map" ? (
        <>
        <SpotMap spots={list} selectedId={selId} onSelect={setSelId} />
        {sel && (
          <Card withBorder radius="md" padding="sm" data-testid="spot-popover">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div>
                <Text fw={700}>{sel.name}</Text>
                <Text size="sm" c="dimmed">{sel.description}</Text>
                <Link href={`/${slug}/spots/detail?id=${sel.id}`}>詳細を見る</Link>
              </div>
              <Badge color={sel.acquired ? "green" : "gray"}>{sel.acquired ? "獲得済み" : "未獲得"}</Badge>
            </Group>
          </Card>
        )}
        <Group gap={6}>
          {list.map((s) => (
            <Badge key={s.id} component="button" type="button" variant={s.id === selId ? "filled" : "light"} color={s.acquired ? "green" : "orange"} style={{ cursor: "pointer" }} onClick={() => setSelId(s.id)}>{s.stampName}</Badge>
          ))}
        </Group>
        </>
      ) : (
        list.map((s) => (
          <Card key={s.id} withBorder radius="md" padding="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <Link href={`/${slug}/spots/detail?id=${s.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                <Text fw={700}>{s.name}</Text>
                <Text size="sm" c="dimmed" lineClamp={2}>{s.description}</Text>
              </Link>
              <Stack gap={4} align="flex-end">
                <Badge color={s.acquired ? "green" : "gray"}>{s.acquired ? "獲得済み" : "未獲得"}</Badge>
                <Switch size="sm" label="行きたい" checked={want.includes(s.id)} onChange={() => toggle(s.id)} />
              </Stack>
            </Group>
          </Card>
        ))
      )}
      {!loading && list.length === 0 && <Text c="dimmed">該当するスポットがありません</Text>}
    </Stack>
  );
}
