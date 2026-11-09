"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Stack, Text } from "@mantine/core";
import { Activity, useApi } from "@/lib/api";

type User = { id: string; name: string; ageGroup: string; region: string; lap: number };

export default function MyPage() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const { data: u } = useApi<User>("/user");
  const { data: acts } = useApi<Activity[]>("/user/activities");
  return (
    <Stack p="md" gap="sm">
      <Card withBorder radius="md">
        <Text fw={700}>{u?.name ?? "…"}</Text>
        <Text size="sm" c="dimmed">{u ? `${u.lap}周目 ／ ${u.region} ／ ${u.ageGroup}` : ""}</Text>
        <Text size="xs" c="dimmed">デモ用のダミーユーザーです</Text>
      </Card>
      <Text fw={700}>獲得履歴</Text>
      {acts?.map((a, i) => <Text key={i} size="sm">{a.at}　{a.type === "stamp" ? "スタンプ" : "特典"}：{a.label}</Text>)}
      {acts?.length === 0 && <Text size="sm" c="dimmed">履歴はありません</Text>}
      <Button component={Link} href={`/${slug}/reset`} variant="light" color="red">リセットして最初から</Button>
      <Button component={Link} href={`/${slug}/inquiries`} variant="subtle">お問い合わせ</Button>
    </Stack>
  );
}
