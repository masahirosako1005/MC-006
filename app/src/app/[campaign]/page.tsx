"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { IconBook, IconKey, IconUser } from "@tabler/icons-react";
import { Activity, Spot, useApi } from "@/lib/api";

type Campaign = { name: string; sheetSize: number; lap: number };
type Popup = { id: number; title: string; body: string };

export default function Home() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const base = `/${slug}`;
  const { data: c } = useApi<Campaign>("/campaign");
  const { data: spots } = useApi<Spot[]>("/spots");
  const { data: popups } = useApi<Popup[]>("/popups");
  const { data: acts } = useApi<Activity[]>("/user/activities");
  const [closed, setClosed] = useState(false);
  const got = spots?.filter((s) => s.acquired).length ?? 0;
  const size = c?.sheetSize ?? 7;
  const popup = popups?.[0];

  return (
    <>
      <div className="hero" role="img" aria-label="キャンペーン画像">{c?.name ?? "読み込み中…"}</div>
      <Stack gap="md" p="md">
        <Group justify="flex-end" gap="lg">
          {[{ href: "qr", icon: <IconKey />, l: "スタンプ" }, { href: "mypage", icon: <IconUser />, l: "マイページ" }, { href: "rule", icon: <IconBook />, l: "ルール" }].map((a) => (
            <Link key={a.href} href={`${base}/${a.href}`} style={{ textAlign: "center", fontSize: 11, color: "inherit", textDecoration: "none" }}>
              <div>{a.icon}</div>{a.l}
            </Link>
          ))}
        </Group>
        <Card withBorder radius="md">
          <Group justify="space-between" mb="xs">
            <Text fw={700}>スタンプカード（{c?.lap ?? 1}周目）</Text>
            <Text size="sm" aria-live="polite">{got} / {size}</Text>
          </Group>
          <Progress value={(got / size) * 100} mb="sm" aria-label="獲得進捗" />
          <div className="stamp-grid">
            {(spots ?? []).map((s) => (
              <Link key={s.id} href={`${base}/spots/detail?id=${s.id}`} className="stamp" data-on={s.acquired} style={{ textDecoration: "none" }}>
                {s.acquired ? "✔ " : ""}{s.stampName}
              </Link>
            ))}
          </div>
          <Button component={Link} href={`${base}/qr`} fullWidth mt="md" color="var(--main-color)">スタンプを押す</Button>
        </Card>
        <Card withBorder radius="md">
          <Text fw={700} mb="xs">最近のできごと</Text>
          {(acts ?? []).slice(0, 4).map((a, i) => (
            <Text key={i} size="sm">{a.at.slice(5, 16)}　{a.type === "stamp" ? "スタンプ" : "特典"}：{a.label}</Text>
          ))}
          {acts?.length === 0 && <Text size="sm" c="dimmed">まだありません</Text>}
        </Card>
        <Button component={Link} href={`${base}/rewards`} variant="light">特典を見る</Button>
      </Stack>
      <Modal opened={!!popup && !closed} onClose={() => setClosed(true)} title={popup?.title} centered>
        <Text size="sm">{popup?.body}</Text>
      </Modal>
    </>
  );
}
