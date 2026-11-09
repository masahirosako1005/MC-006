"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Badge, Stack, Text, Title } from "@mantine/core";
import { Reward, UserReward, useApi } from "@/lib/api";

function Detail() {
  const id = useSearchParams().get("id");
  const valid = !!id && /^\d+$/.test(id);
  const { data: r, loading, error } = useApi<Reward>(valid ? `/rewards/${id}` : null);
  const { data: mine } = useApi<UserReward[]>("/user/rewards");
  if (!valid || error) return <Text p="md" c="red">特典が見つかりません</Text>;
  if (loading || !r) return <Text p="md" c="dimmed">読み込み中…</Text>;
  const got = mine?.find((x) => x.rewardId === r.id);
  return (
    <Stack p="md" gap="sm">
      <Title order={2} size="h4">{r.name}</Title>
      <Text>{r.prize}</Text>
      <Badge w="fit-content" variant="outline">{r.method}</Badge>
      <Text size="sm">{r.description}</Text>
      <Text fw={700} c={got ? "green" : undefined}>{got ? `獲得日時：${got.at}` : "まだ獲得していません"}</Text>
    </Stack>
  );
}

export default function Page() {
  return <Suspense fallback={<Text p="md" c="dimmed">読み込み中…</Text>}><Detail /></Suspense>;
}
