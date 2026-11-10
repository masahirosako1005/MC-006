"use client";
// 09: ブロック一覧(SAF-UI-03)。GET /api/me/blocks、DELETE /api/me/blocks/[userId]。
import { useState } from "react";
import { Alert, Avatar, Button, Card, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { gdelete, useGroupsApi } from "@/lib/groups-api";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import type { BlockView } from "../types";

const EFFECTS = [
  "お互いに、相手が幹事またはメンバーのグループは、一覧・検索に表示されません。",
  "お互いに、相手のグループへ参加を申請できません。",
  "チャットでは、あなたの画面で相手の投稿を表示しません(相手の画面は変わりません)。",
  "お互いに、相手のプロフィールを開けません。",
  "すでに同じグループにいる場合は、そのまま参加を続けられます。",
  "ブロックしたこと・解除したことは、相手に通知されません。",
];

export function BlockList() {
  const { data, error, loading, reload } = useGroupsApi<{ items: BlockView[]; total?: number }>("/api/me/blocks");
  const [target, setTarget] = useState<BlockView | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const unblock = async () => {
    if (!target) return;
    setBusy(true);
    setErr(null);
    try {
      await gdelete(`/api/me/blocks/${target.userId}`);
      setMsg(`${target.displayName}さんのブロックを解除しました。`);
      setTarget(null);
      await reload();
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack p="md" gap="md">
      <Title order={2}>ブロック一覧</Title>
      <Card withBorder padding="md" bg="gray.0">
        <Title order={3} size="h4">ブロックするとどうなるか</Title>
        <Stack component="ul" gap={4} mt="xs" pl="md">{EFFECTS.map((t) => <Text component="li" size="sm" key={t}>{t}</Text>)}</Stack>
      </Card>
      {msg && <Alert color="green" variant="light" role="status">{msg}</Alert>}
      <Title order={3} size="h4">ブロック中のユーザー{data ? `(${data.items.length} 人)` : ""}</Title>
      {loading && <LoadingBlock />}
      <ErrorNotice error={error} />
      {data && data.items.length === 0 && <Text size="sm" c="dimmed">ブロックしている人はいません。</Text>}
      {data && data.items.length > 0 && (
        <Stack gap="xs" component="ul" p={0} style={{ listStyle: "none" }} aria-label="ブロック中のユーザー">
          {data.items.map((b) => (
            <Card key={b.userId} component="li" withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap">
                <Group gap="sm" wrap="nowrap">
                  <Avatar radius="xl" aria-hidden>{b.displayName.slice(0, 1)}</Avatar>
                  <div>
                    <Text fw={700}>{b.displayName}</Text>
                    <Text size="xs" c="dimmed">{b.createdAt.slice(0, 10)} にブロック</Text>
                  </div>
                </Group>
                <Button variant="outline" size="xs" aria-label={`${b.displayName}さんのブロックを解除`} onClick={() => { setMsg(null); setTarget(b); }} style={{ minHeight: 36 }}>解除</Button>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Text size="xs" c="dimmed">新しくブロックするときは、メンバー一覧・承認画面・チャットのメニューから行います。解除すると、上の効果はなくなり、相手のグループに再び申請できます。</Text>
      <Modal opened={target !== null} onClose={() => setTarget(null)} title={`${target?.displayName ?? ""}さんのブロックを解除しますか`}>
        <Stack gap="sm">
          <Text size="sm">解除すると、相手のグループが一覧に表示され、参加を申請できるようになります。相手には通知されません。</Text>
          <ErrorNotice error={err} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setTarget(null)}>やめる</Button>
            <Button loading={busy} onClick={() => void unblock()}>解除する</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
