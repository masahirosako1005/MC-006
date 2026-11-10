"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Button, Card, Group, Modal, Progress, Stack, Text } from "@mantine/core";
import { IconBookmark, IconHelp, IconKey, IconUser } from "@tabler/icons-react";
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/top/mv.webp" alt={c?.name ?? "キャンペーンメインビジュアル"} style={{ width: "100%", height: "auto", display: "block" }} />
      <Stack gap="md" p="md">
        <div style={{ border: "1px solid #ccc", borderRadius: 8, background: "#fff", textAlign: "center", padding: "8px 12px", fontSize: 14 }}>
          開催期間：2026年09月16日〜2027年03月31日
        </div>
        <Group justify="flex-end" gap="lg">
          {[{ href: "service", icon: <IconBookmark />, l: "概要" }, { href: "rule", icon: <IconHelp />, l: "遊び方" }, { href: "qr", icon: <IconKey />, l: "スタンプ" }, { href: "mypage", icon: <IconUser />, l: "マイページ" }].map((a) => (
            <Link key={a.href} href={`${base}/${a.href}`} style={{ textAlign: "center", fontSize: 11, color: "inherit", textDecoration: "none" }}>
              <div>{a.icon}</div>{a.l}
            </Link>
          ))}
        </Group>
        <Button component={Link} href={`${base}/groups`} size="lg" fullWidth color="var(--main-color)">参加する</Button>
        <Card withBorder radius="md">
          <Group justify="space-between" mb="xs">
            <Text fw={700}>スタンプカード（{c?.lap ?? 1}周目）</Text>
            <Text size="sm" aria-live="polite">{got} / {size}</Text>
          </Group>
          <Progress value={(got / size) * 100} mb="sm" aria-label="獲得進捗" />
          <div className="stamp-grid">
            {(spots ?? []).map((s) => (
              <Link key={s.id} href={`${base}/spots/detail?id=${s.id}`} className="stamp" data-on={s.acquired} style={{ textDecoration: "none" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {!s.acquired && <img src="/top/non-stamp.webp" alt="" width={32} height={32} />}
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
