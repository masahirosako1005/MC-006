"use client";
import { Card, Stack, Text } from "@mantine/core";
import { UserReward, useApi } from "@/lib/api";

export default function History() {
  const { data, loading } = useApi<UserReward[]>("/user/rewards");
  const rows = [...(data ?? [])].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Stack p="md" gap="sm">
      {loading && <Text c="dimmed">読み込み中…</Text>}
      {rows.map((r) => (
        <Card key={r.rewardId} withBorder radius="md">
          <Text fw={700}>{r.name}</Text>
          <Text size="sm">{r.prize}</Text>
          <Text size="xs" c="dimmed">{r.at}</Text>
        </Card>
      ))}
      {!loading && rows.length === 0 && <Text c="dimmed">獲得した特典はまだありません</Text>}
    </Stack>
  );
}
