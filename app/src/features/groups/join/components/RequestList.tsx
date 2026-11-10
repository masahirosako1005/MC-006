"use client";
// JOIN-UI-03 幹事の承認画面(申請一覧・承認・見送り)。
import { useState } from "react";
import { Alert, Avatar, Badge, Button, Card, Group, Modal, Radio, SegmentedControl, Stack, Text } from "@mantine/core";
import { ApiError, gpost } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import { REJECT_REASONS, REJECT_REASON_IDS } from "../constants";
import { useOrganizerRequests } from "../hooks";
import { JOIN_ERRORS } from "../messages";
import { joinPaths } from "../paths";
import type { JoinRequestStatus, OrganizerRequestView, RejectReasonId } from "../types";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

export interface RequestListProps { groupId: Id }

const LABEL: Record<JoinRequestStatus, string> = { pending: "申請中", approved: "承認済み", rejected: "見送り", withdrawn: "取り下げ", expired: "受付終了" };
const DONE: JoinRequestStatus[] = ["approved", "rejected", "withdrawn", "expired"];

export function RequestList({ groupId }: RequestListProps) {
  const [tab, setTab] = useState<"pending" | "done">("pending");
  const list = useOrganizerRequests(groupId, tab === "pending" ? ["pending"] : DONE);
  const [busyId, setBusyId] = useState<Id | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [rejecting, setRejecting] = useState<OrganizerRequestView | null>(null);
  const [reason, setReason] = useState<RejectReasonId>("not_specified");

  async function act(id: Id, kind: "approve" | "reject", body?: unknown) {
    setBusyId(id);
    setMsg(null);
    try {
      await gpost(joinPaths[kind](groupId, id), body);
      setMsg({ ok: true, text: kind === "approve" ? "承認しました。" : "見送りました。" });
      setRejecting(null);
      list.reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "操作できませんでした" });
    } finally {
      setBusyId(null);
    }
  }

  if (list.loading && !list.data) return <LoadingBlock />;
  if (list.error) return <ErrorNotice error={list.error} onRetry={list.reload} />;
  const d = list.data;
  if (!d) return null;
  const cap = d.capacity;

  return (
    <Stack gap="md">
      <Card withBorder padding="sm">
        <Text size="sm">現在 {cap.current} 人 / 定員 {cap.max} 人(最少 {cap.min} 人)</Text>
        {cap.current < cap.min && <Text size="sm" c="dimmed">あと {cap.min - cap.current} 人で実行できます</Text>}
      </Card>
      <Alert color="blue" variant="light">申請は申請日時の古い順に並びます。表示するプロフィールは、申請者が公開範囲で公開している項目だけです。</Alert>
      <SegmentedControl
        value={tab}
        onChange={(v) => setTab(v as "pending" | "done")}
        data={[{ value: "pending", label: `申請中${tab === "pending" ? `(${d.pendingCount})` : ""}` }, { value: "done", label: "処理済み" }]}
      />
      {msg && <Alert color={msg.ok ? "green" : "red"} variant="light" role={msg.ok ? "status" : "alert"}>{msg.text}</Alert>}
      {d.items.length === 0 && <Text c="dimmed">{tab === "pending" ? "申請中の申請はありません。" : "処理済みの申請はありません。"}</Text>}
      {d.items.map((it) => {
        const r = it.request;
        const p = it.applicant;
        return (
          <Card key={r.id} withBorder padding="md" aria-label={`${p.displayName}さんの申請`}>
            <Stack gap="xs">
              <Group justify="space-between">
                <Group gap="sm">
                  <Avatar color="blue" radius="xl">{p.displayName.slice(0, 1)}</Avatar>
                  <div>
                    <Text fw={700}>{p.displayName}</Text>
                    <Text size="xs" c="dimmed">申請日時 {r.createdAt.slice(0, 16).replace("T", " ")}</Text>
                  </div>
                </Group>
                <Badge color={r.status === "pending" ? "blue" : "gray"}>{LABEL[r.status]}</Badge>
              </Group>
              {p.ageBand && <Text size="sm">年代: {p.ageBand}</Text>}
              {p.travelPurposes && p.travelPurposes.length > 0 && <Text size="sm">旅の目的: {p.travelPurposes.join("、")}</Text>}
              {p.bio && <Text size="sm">一言: {p.bio}</Text>}
              {r.note && <Text size="sm">ひとこと(申請): {r.note}</Text>}
              {r.consentedMinMembers != null && <Text size="sm">最少人数への同意: {r.consentedMinMembers} 人でも参加してよい</Text>}
              {r.rejectReasonLabel && <Text size="sm">見送り理由: {r.rejectReasonLabel}</Text>}
              {r.status === "pending" && (
                <>
                  {!it.canApprove && it.cannotApproveReason && (
                    <Text size="sm" c="red">{(JOIN_ERRORS as Record<string, string>)[it.cannotApproveReason] ?? "現在は承認できません。"}</Text>
                  )}
                  <Group>
                    <Button onClick={() => act(r.id, "approve")} disabled={!it.canApprove} loading={busyId === r.id} style={{ minHeight: 44 }}>承認する</Button>
                    <Button variant="default" onClick={() => { setReason("not_specified"); setRejecting(it); }} style={{ minHeight: 44 }}>見送る</Button>
                  </Group>
                </>
              )}
            </Stack>
          </Card>
        );
      })}
      <Modal opened={!!rejecting} onClose={() => setRejecting(null)} title={`${rejecting?.applicant.displayName ?? ""}さんの申請を見送る`} centered>
        <Stack gap="sm">
          <Radio.Group value={reason} onChange={(v) => setReason(v as RejectReasonId)} label="申請者に伝える理由">
            <Stack gap={6} mt={6}>{REJECT_REASON_IDS.map((id) => <Radio key={id} value={id} label={REJECT_REASONS[id]} />)}</Stack>
          </Radio.Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRejecting(null)} style={{ minHeight: 44 }}>キャンセル</Button>
            <Button color="red" loading={busyId === rejecting?.request.id} onClick={() => rejecting && act(rejecting.request.id, "reject", { reasonId: reason })} style={{ minHeight: 44 }}>見送る</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
