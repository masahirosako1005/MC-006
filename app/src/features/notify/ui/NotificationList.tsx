"use client";
// 10: 通知一覧。項目を開くと既読にして関連画面へ移動する。
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, Group, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { NTF_REFRESH_EVENT } from "@/lib/groups-api";
import { useNotifications } from "../client";
import type { NotificationDto } from "../types";

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function hrefOf(base: string, n: NotificationDto): string {
  const g = `${base}/groups/${n.link.groupId}`;
  switch (n.link.view) {
    case "requests": return `${g}/requests`;
    case "members": return `${g}/members`;
    case "chat": return `${g}?tab=chat`;
    case "list": return `${base}/groups`;
    default: return g;
  }
}

export function NotificationList({ campaign }: { campaign: string }) {
  const base = `/${campaign}`;
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { items, nextCursor, loadMore, markRead } = useNotifications({ filter });
  const unread = items.filter((n) => !n.read).length;

  const open = (n: NotificationDto) => {
    if (!n.read) {
      markRead(n.id);
      window.dispatchEvent(new Event(NTF_REFRESH_EVENT));
    }
    router.push(hrefOf(base, n));
  };

  return (
    <Stack gap="md" p="md">
      <Title order={1} size="h3">グループの通知</Title>
      <Alert color="blue" variant="light">
        <Badge mr="xs" variant="outline">モック(ローカル)</Badge>
        この通知はデモ用のローカルのお知らせです(外部には送信されません)。運営からの「お知らせ」とは別の画面です。
      </Alert>
      <Group justify="space-between">
        <Title order={2} size="h4">通知({items.length} 件{filter === "all" ? `、未読 ${unread} 件` : ""})</Title>
        <SegmentedControl
          value={filter}
          onChange={(v) => setFilter(v as "all" | "unread")}
          data={[{ label: "すべて", value: "all" }, { label: "未読のみ", value: "unread" }]}
        />
      </Group>
      <Text size="xs" c="dimmed">項目を開くと既読になり、関連する画面へ移動します。新しい順に表示します。</Text>
      {items.length === 0 ? (
        <Text c="dimmed">通知はありません。</Text>
      ) : (
        <Stack gap="xs" component="ul" style={{ listStyle: "none", padding: 0, margin: 0 }} aria-label="通知の一覧">
          {items.map((n) => (
            <li key={n.id}>
              <Card
                withBorder
                component="button"
                type="button"
                onClick={() => open(n)}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", borderLeft: n.read ? undefined : "4px solid var(--mantine-color-blue-6)" }}
              >
                <Group gap="xs" justify="space-between" wrap="nowrap">
                  <Text fw={n.read ? 400 : 700}>{n.title}</Text>
                  {!n.read && <Badge size="sm">未読</Badge>}
                </Group>
                <Text size="xs" c="dimmed">{fmt(n.createdAt)}</Text>
                <Text size="sm">{n.body}</Text>
              </Card>
            </li>
          ))}
        </Stack>
      )}
      {nextCursor && <Button variant="default" onClick={loadMore}>もっと見る</Button>}
    </Stack>
  );
}
