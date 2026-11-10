"use client";
import { useState } from "react";
import { Alert, Button, Card, Code, Group, Modal, Stack, Text, Title } from "@mantine/core";
import { gpost, useGroupsApi, ApiError } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { InviteCodeView } from "@/features/groups/types";

export function InviteCodePanel({ groupId }: { groupId: Id }) {
  const path = `/api/groups/${groupId}/invite-code`;
  const { data, error, loading, reload } = useGroupsApi<InviteCodeView | null>(path);
  const [confirm, setConfirm] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function act(p: string) {
    setBusy(true);
    setErr(null);
    try {
      await gpost(p);
      await reload();
      setConfirm(false);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "失敗しました");
    } finally {
      setBusy(false);
    }
  }
  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("コピーできませんでした");
    }
  }

  return (
    <Card withBorder component="section" aria-labelledby="invite-title">
      <Stack gap="xs">
        <Title order={2} size="h4" id="invite-title">招待コード</Title>
        {loading && <Text size="sm">読み込み中…</Text>}
        {error && <Alert color="red">{error.message}</Alert>}
        {err && <Alert color="red">{err}</Alert>}
        {!loading && !error && !data && (
          <>
            <Text size="sm">招待コードはまだ発行されていません。</Text>
            <Button onClick={() => act(path)} loading={busy} w="fit-content">招待コードを発行する</Button>
          </>
        )}
        {data && (
          <>
            <Group>
              <Code fz="lg" data-testid="invite-code">{data.code}</Code>
              <Button size="xs" variant="light" onClick={copy}>{copied ? "コピーしました" : "コピー"}</Button>
            </Group>
            <Text size="xs" c="dimmed">有効期限: {data.expiresAt.slice(0, 10)}{data.expired ? "(期限切れ)" : ""}</Text>
            <Button variant="outline" size="xs" w="fit-content" onClick={() => setConfirm(true)}>再発行する</Button>
          </>
        )}
      </Stack>
      <Modal opened={confirm} onClose={() => setConfirm(false)} title="招待コードを再発行しますか" centered>
        <Stack>
          <Text size="sm">再発行すると、今のコードは使えなくなります。すでにコードを渡した人は、新しいコードで申請し直してください。</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setConfirm(false)}>やめる</Button>
            <Button color="red" loading={busy} onClick={() => act(`${path}/reissue`)}>再発行する</Button>
          </Group>
        </Stack>
      </Modal>
    </Card>
  );
}
