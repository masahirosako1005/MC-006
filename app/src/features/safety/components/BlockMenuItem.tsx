"use client";
// 09: ブロックの導線(確認ダイアログ付き)。SAF-UI-03。
import { useState } from "react";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { ApiError, gpost } from "@/lib/groups-api";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";

export interface BlockMenuItemProps {
  userId: string;
  displayName: string;
  groupId?: string;
  onBlocked?(): void;
}

export function BlockMenuItem({ userId, displayName, groupId, onBlocked }: BlockMenuItemProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await gpost("/api/me/blocks", { targetUserId: userId, ...(groupId ? { sourceGroupId: groupId } : {}) });
      setOpen(false);
      onBlocked?.();
    } catch (e) {
      setErr(e instanceof Error ? e : new ApiError("internal", 500, "問題が発生しました"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button variant="subtle" color="red" size="xs" onClick={() => setOpen(true)} style={{ minHeight: 36 }}>ブロック</Button>
      <Modal opened={open} onClose={() => setOpen(false)} title={`${displayName}さんをブロックしますか`}>
        <Stack gap="sm">
          <Text size="sm">ブロックすると、あなたの画面でこの人の投稿を隠し、この人のグループは一覧に出なくなります。相手には通知されません。</Text>
          <Text size="xs" c="dimmed">ブロックはブロック一覧からいつでも解除できます。</Text>
          <ErrorNotice error={err} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>やめる</Button>
            <Button color="red" loading={busy} onClick={() => void run()}>ブロックする</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
