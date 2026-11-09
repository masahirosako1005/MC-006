"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { Reward, UserReward, useApi } from "@/lib/api";

export default function Rewards() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const { data: rewards, loading } = useApi<Reward[]>("/rewards");
  const { data: mine } = useApi<UserReward[]>("/user/rewards");
  const owned = new Set(mine?.map((r) => r.rewardId));
  return (
    <Stack p="md" gap="sm">
      {loading && <Text c="dimmed">読み込み中…</Text>}
      {rewards?.map((r) => (
        <Card key={r.id} withBorder radius="md" component={Link} href={`/${slug}/rewards/detail?id=${r.id}`} style={{ textDecoration: "none", color: "inherit" }}>
          <Group justify="space-between">
            <Text fw={700}>{r.name}</Text>
            <Badge color={owned.has(r.id) ? "green" : "gray"}>{owned.has(r.id) ? "獲得済み" : `${r.requiredStamps}個で獲得`}</Badge>
          </Group>
          <Text size="sm" c="dimmed">{r.prize}</Text>
        </Card>
      ))}
    </Stack>
  );
}
