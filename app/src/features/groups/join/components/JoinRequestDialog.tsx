"use client";
// JOIN-UI-02 参加申請ダイアログ(最少人数への同意)。
import { useState } from "react";
import { Alert, Button, Checkbox, Group, Modal, Stack, Text, Textarea } from "@mantine/core";
import { ApiError, gpost } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import type { Id } from "@/lib/groups-types";
import type { JoinRequestView, RequestJoinInput } from "../types";
import { joinPaths } from "../paths";

export interface JoinRequestDialogProps {
  opened: boolean;
  onClose: () => void;
  groupId: Id;
  consentText: string;
  consentedMinMembers: number;
  inviteCode?: string;
  onSubmitted: (r: JoinRequestView) => void;
}

export function JoinRequestDialog({ opened, onClose, groupId, consentText, consentedMinMembers, inviteCode, onSubmitted }: JoinRequestDialogProps) {
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const max = LIMITS.JOIN_NOTE.max;

  async function submit() {
    setTouched(true);
    if (!consent) return;
    setBusy(true);
    setError(null);
    try {
      const body: RequestJoinInput = { note, consentMinMembers: true, consentedMinMembers, inviteCode };
      const r = await gpost<JoinRequestView>(joinPaths.create(groupId), body);
      onSubmitted(r);
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("internal", 500, "問題が発生しました"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="参加を申請する" centered>
      <Stack gap="sm">
        <Textarea
          label="幹事へのひとこと(任意)"
          description="自己紹介や希望など。電話番号・メールアドレスは書かないでください。"
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
          autosize
          minRows={3}
          maxRows={5}
          error={note.length > max ? `${max}文字以内で入力してください` : error?.fields?.note}
        />
        <Text size="xs" c="dimmed" ta="right">{note.length} / {max}</Text>
        <div style={{ padding: 12, border: `1px solid ${touched && !consent ? "var(--mantine-color-red-8)" : "var(--mantine-color-gray-3)"}`, borderRadius: 8 }}>
          <Checkbox
            checked={consent}
            onChange={(e) => setConsent(e.currentTarget.checked)}
            label={<Text size="sm" fw={600}>最少人数({consentedMinMembers}人)でも参加します</Text>}
            description={consentText}
          />
          {touched && !consent && <Text size="xs" c="red" mt={4} role="alert">「最少人数でも参加する」への同意が必要です。</Text>}
        </div>
        {error && <Alert color="red" variant="light" role="alert">{error.message}</Alert>}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} style={{ minHeight: 44 }}>キャンセル</Button>
          <Button onClick={submit} loading={busy} disabled={note.length > max} style={{ minHeight: 44 }}>申請する</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
