"use client";
// LCY-UI-06。幹事の中止・条件変更・再企画。
import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button, Group, Modal, NumberInput, Radio, Stack, Text, TextInput } from "@mantine/core";
import { gpatch, gpost } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import type { LifecycleView, OrganizerCancelReason } from "../types";
import { ORGANIZER_CANCEL_REASON_LABEL } from "../messages";

export interface OrganizerActionsProps { groupId: Id; view: LifecycleView; onChanged?: () => void }

export function OrganizerActions({ groupId, view, onChanged }: OrganizerActionsProps) {
  const { campaign } = useParams<{ campaign: string }>();
  const router = useRouter();
  const cap = view.capabilities;
  const [open, setOpen] = useState<"cancel" | "cond" | null>(null);
  const [reason, setReason] = useState<OrganizerCancelReason>("schedule_conflict");
  const [minM, setMinM] = useState<number>(view.minMembers);
  const [dl, setDl] = useState<string>(view.deadlineDate);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null);
    try { await fn(); setOpen(null); onChanged?.(); router.refresh(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <Stack gap="xs" data-testid="organizer-actions">
      <Group>
        {cap.canChangeConditions && <Button variant="light" onClick={() => { setErr(null); setOpen("cond"); }}>条件を変更する</Button>}
        {cap.canOrganizerCancel && <Button variant="light" color="red" onClick={() => { setErr(null); setOpen("cancel"); }}>グループを中止する</Button>}
        {cap.canReplan && <Button component={Link} href={`/${campaign}/groups/${groupId}/replan`}>再企画する</Button>}
      </Group>
      <Modal opened={open === "cancel"} onClose={() => setOpen(null)} title="グループを中止しますか">
        <Stack>
          <Text size="sm">中止すると参加者に通知されます。取り消しはできません。</Text>
          <Radio.Group label="理由" value={reason} onChange={(x) => setReason(x as OrganizerCancelReason)}>
            <Stack gap={4} mt={4}>
              {(Object.keys(ORGANIZER_CANCEL_REASON_LABEL) as OrganizerCancelReason[]).map((k) => <Radio key={k} value={k} label={ORGANIZER_CANCEL_REASON_LABEL[k]} />)}
            </Stack>
          </Radio.Group>
          {err !== null && open === "cancel" && <ErrorNotice error={err as Error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(null)}>やめる</Button>
            <Button color="red" loading={busy} onClick={() => void run(() => gpost(`/api/groups/${groupId}/cancel`, { reason }))}>中止する</Button>
          </Group>
        </Stack>
      </Modal>
      <Modal opened={open === "cond"} onClose={() => setOpen(null)} title="条件を変更する">
        <Stack>
          <NumberInput label="最少人数" min={2} max={view.capacity} allowDecimal={false} value={minM} onChange={(x) => setMinM(Number(x) || 0)} />
          <TextInput type="date" label="締切日" value={dl} onChange={(e) => setDl(e.currentTarget.value)} description="延長は 1 回までです。" />
          {err !== null && open === "cond" && <ErrorNotice error={err as Error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setOpen(null)}>やめる</Button>
            <Button loading={busy} onClick={() => void run(() => gpatch(`/api/groups/${groupId}/conditions`, {
              ...(minM !== view.minMembers ? { minMembers: minM } : {}),
              ...(dl !== view.deadlineDate ? { deadlineDate: dl } : {}),
            }))}>変更する</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
