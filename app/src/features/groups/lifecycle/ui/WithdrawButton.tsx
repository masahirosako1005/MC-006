"use client";
// LCY-UI-05。辞退・退会の確認ダイアログ(費用メモの差額を表示)。
import { useState } from "react";
import { Alert, Button, Group, Modal, Stack, Text } from "@mantine/core";
import { gapi, gpost, useCurrentUser } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { ExpenseSummary } from "@/features/groups/expense/types";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import type { GroupStatus } from "../types";

export interface WithdrawButtonProps { groupId: Id; phase: GroupStatus; onDone: () => void }

export function WithdrawButton({ groupId, phase, onDone }: WithdrawButtonProps) {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [net, setNet] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const after = phase === "confirmed";
  const noun = after ? "退会" : "辞退";

  const show = () => {
    setErr(null); setNet(null); setOpen(true);
    gapi<ExpenseSummary>(`/api/groups/${groupId}/expense-summary`)
      .then((s) => { const m = s.members.find((x) => x.userId === user?.id); setNet(m && m.net !== 0 ? m.net : null); })
      .catch(() => setNet(null));
  };
  const go = async () => {
    setBusy(true); setErr(null);
    try { await gpost(`/api/groups/${groupId}/withdraw`, {}); setOpen(false); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <>
      <Button variant="light" color="red" onClick={show} style={{ minHeight: 44 }}>{noun}する</Button>
      <Modal opened={open} onClose={() => setOpen(false)} title={after ? "退会しますか" : "辞退しますか"}>
        <Stack>
          <Text size="sm">{after ? "実行確定の後の退会です。" : "辞退してもペナルティはありません。"}理由の入力は不要です。</Text>
          {!after && <Text size="sm">辞退すると、このグループのチャットや旅程は見られなくなります。</Text>}
          {net !== null && (
            <Alert color="yellow" variant="light">費用メモに、あなたの差額({net.toLocaleString()} 円の目安)が残っています。{noun}する前にメンバーと確認してください。</Alert>
          )}
          {err !== null && <ErrorNotice error={err as Error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(false)}>やめる</Button>
            <Button color="red" loading={busy} onClick={() => void go()}>{noun}する</Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
