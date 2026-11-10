"use client";
// JOIN-UI-01 参加申請パネル(申請ボタン・申請状況・取り下げ)。
import { useState } from "react";
import { Alert, Badge, Button, Card, Group, Stack, Text } from "@mantine/core";
import { ApiError, gpost } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import { useMyJoinRequest } from "../hooks";
import { consentText } from "../messages";
import { joinPaths } from "../paths";
import type { JoinRequestStatus } from "../types";
import { JoinRequestDialog } from "./JoinRequestDialog";

export interface JoinRequestPanelProps {
  groupId: Id;
  groupName: string;
  minMembers: number;
  applyState: { canApply: boolean; reason?: string };
  inviteCode?: string;
  onJoined?: () => void;
}

const STATUS_LABEL: Record<JoinRequestStatus, { label: string; color: string; help: string }> = {
  pending: { label: "申請中", color: "blue", help: "幹事の承認をお待ちください。承認されるまでは取り下げできます。" },
  approved: { label: "承認済み", color: "green", help: "参加が承認されました。" },
  rejected: { label: "見送り", color: "gray", help: "今回は見送りとなりました。" },
  withdrawn: { label: "取り下げ済み", color: "gray", help: "申請を取り下げました。" },
  expired: { label: "受付終了", color: "gray", help: "締切を過ぎたため受付を終了しました。" },
};

export function JoinRequestPanel({ groupId, groupName, minMembers, applyState, inviteCode, onJoined }: JoinRequestPanelProps) {
  const mine = useMyJoinRequest(groupId);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const req = mine.data?.request ?? null;
  const st = req ? STATUS_LABEL[req.status] : null;
  const canReapply = !req || req.status === "withdrawn" || req.status === "expired";

  async function withdraw() {
    if (!req) return;
    setBusy(true);
    setErr(null);
    try {
      await gpost(joinPaths.withdraw(groupId, req.id));
      mine.reload();
      onJoined?.();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "取り下げできませんでした");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card withBorder padding="md" aria-label="参加申請">
      <Stack gap="sm">
        <Text fw={700}>{groupName} に参加する</Text>
        {req && st && (
          <Stack gap={4}>
            <Group gap="xs"><Badge color={st.color}>{st.label}</Badge><Text size="sm" c="dimmed">{req.createdAt.slice(0, 10)} に申請</Text></Group>
            <Text size="sm">{st.help}</Text>
            {req.rejectReasonLabel && <Text size="sm">理由: {req.rejectReasonLabel}</Text>}
            {req.note && <Text size="sm" c="dimmed">ひとこと: {req.note}</Text>}
          </Stack>
        )}
        {err && <Alert color="red" variant="light" role="alert">{err}</Alert>}
        <Group>
          {req?.status === "pending" && <Button variant="default" onClick={withdraw} loading={busy} style={{ minHeight: 44 }}>申請を取り下げる</Button>}
          {canReapply && (
            <Button onClick={() => setOpen(true)} disabled={!applyState.canApply} style={{ minHeight: 44 }}>参加を申請する</Button>
          )}
        </Group>
        {canReapply && !applyState.canApply && applyState.reason && <Text size="sm" c="dimmed">{applyState.reason}</Text>}
      </Stack>
      <JoinRequestDialog
        opened={open}
        onClose={() => setOpen(false)}
        groupId={groupId}
        consentText={consentText(minMembers)}
        consentedMinMembers={minMembers}
        inviteCode={inviteCode}
        onSubmitted={() => { mine.reload(); onJoined?.(); }}
      />
    </Card>
  );
}
