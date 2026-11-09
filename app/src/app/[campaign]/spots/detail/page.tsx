"use client";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Badge, Button, Card, Stack, Text, Title } from "@mantine/core";
import { Spot, useApi } from "@/lib/api";

function Detail() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const id = useSearchParams().get("id");
  const valid = !!id && /^\d+$/.test(id);
  const { data: s, loading, error } = useApi<Spot>(valid ? `/spots/${id}` : null);

  if (!valid || error) return <Text p="md" c="red">スポットが見つかりません</Text>;
  if (loading || !s) return <Text p="md" c="dimmed">読み込み中…</Text>;
  return (
    <>
      <div className="hero" style={{ background: `linear-gradient(135deg, hsl(${s.hue} 55% 40%), hsl(${s.hue} 55% 65%))` }} role="img" aria-label={`${s.stampName}のイメージ`}>
        {s.stampName}
      </div>
      <Stack p="md" gap="sm">
        <Title order={2} size="h4">{s.name}</Title>
        <Badge color={s.acquired ? "green" : "gray"} w="fit-content">{s.acquired ? "スタンプ獲得済み" : "スタンプ未獲得"}</Badge>
        <Text>{s.description}</Text>
        <Card withBorder radius="md">
          <Text fw={700} size="sm">獲得できるスタンプ</Text>
          <Text size="sm">{s.stampName}（現地の合言葉・QR で獲得）</Text>
        </Card>
        {!s.acquired && <Button component={Link} href={`/${slug}/qr`} color="var(--main-color)">スタンプを押す</Button>}
      </Stack>
    </>
  );
}

export default function Page() {
  return <Suspense fallback={<Text p="md" c="dimmed">読み込み中…</Text>}><Detail /></Suspense>;
}
