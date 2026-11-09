"use client";
import { Card, Stack, Text } from "@mantine/core";
import { useApi } from "@/lib/api";

type News = { id: number; title: string; body: string; at: string };

export default function News() {
  const { data, loading } = useApi<News[]>("/notifications");
  return (
    <Stack p="md" gap="sm">
      {loading && <Text c="dimmed">読み込み中…</Text>}
      {data?.map((n) => (
        <Card key={n.id} withBorder radius="md">
          <Text size="xs" c="dimmed">{n.at}</Text>
          <Text fw={700}>{n.title}</Text>
          <Text size="sm">{n.body}</Text>
        </Card>
      ))}
    </Stack>
  );
}
