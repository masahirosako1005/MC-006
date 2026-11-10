"use client";
// 07 費用タブ(EXP-UI-01〜06)。一覧・追加・編集・削除・分担の目安。
import { useState } from "react";
import { Alert, Button, Card, Checkbox, Group, Modal, MultiSelect, NumberInput, Select, SimpleGrid, Stack, Table, Text, TextInput, Textarea, Title } from "@mantine/core";
import { gdelete, gpost, gput, useGroupsApi } from "@/lib/groups-api";
import type { ApiError } from "@/lib/groups-api";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { EXPENSE_MESSAGES } from "../messages";
import type { ExpenseListResult, ExpenseNoteView, ExpenseSummary } from "../types";

const yen = (n: number) => `${n.toLocaleString("ja-JP")} 円`;
const shortTime = (iso: string) => iso.slice(5, 16).replace("T", " ");

interface FormState { title: string; amount: number | string; payerId: string; targetIds: string[]; spentOn: string; memo: string }

export function ExpenseTab({ groupId }: { groupId: string }) {
  const list = useGroupsApi<ExpenseListResult>(`/api/groups/${groupId}/expenses`);
  const sum = useGroupsApi<ExpenseSummary>(`/api/groups/${groupId}/expense-summary`);
  const [editing, setEditing] = useState<ExpenseNoteView | "new" | null>(null);
  const [form, setForm] = useState<FormState>({ title: "", amount: "", payerId: "", targetIds: [], spentOn: "", memo: "" });
  const [ackReview, setAckReview] = useState(false);
  const [needAck, setNeedAck] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [delTarget, setDelTarget] = useState<ExpenseNoteView | null>(null);

  const reloadAll = async () => { await Promise.all([list.reload(), sum.reload()]); };

  if (list.loading) return <LoadingBlock />;
  if (list.error || !list.data) return <ErrorNotice error={list.error} onRetry={() => void list.reload()} />;
  const d = list.data;

  const openForm = (n: ExpenseNoteView | "new") => {
    setErr(null); setNeedAck(false); setAckReview(false);
    if (n === "new") {
      setForm({ title: "", amount: "", payerId: d.members[0]?.userId ?? "", targetIds: d.members.map((m) => m.userId), spentOn: new Date().toISOString().slice(0, 10), memo: "" });
    } else {
      setForm({ title: n.title, amount: n.amount, payerId: n.payerId, targetIds: n.targetIds, spentOn: n.spentOn, memo: n.memo });
    }
    setEditing(n);
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    const body = { title: form.title, amount: Number(form.amount), payerId: form.payerId, targetIds: form.targetIds, spentOn: form.spentOn, memo: form.memo, ...(ackReview ? { ackReview: true } : {}) };
    try {
      if (editing === "new") await gpost(`/api/groups/${groupId}/expenses`, body);
      else if (editing) await gput(`/api/groups/${groupId}/expenses/${editing.id}`, { ...body, baseVersion: editing.version });
      setEditing(null);
      await reloadAll();
    } catch (e) {
      setErr(e);
      const a = e as ApiError;
      if (a.reason === "text_review_required") setNeedAck(true);
      if (a.reason === "version_mismatch") void reloadAll();
    } finally { setBusy(false); }
  };

  const remove = async () => {
    if (!delTarget) return;
    setBusy(true); setErr(null);
    try {
      await gdelete(`/api/groups/${groupId}/expenses/${delTarget.id}?baseVersion=${delTarget.version}`);
      setDelTarget(null);
      await reloadAll();
    } catch (e) { setErr(e); void reloadAll(); } finally { setBusy(false); }
  };

  const s = sum.data;
  const nameOf = (id: string) => s?.members.find((m) => m.userId === id)?.displayName ?? "元メンバー";

  return (
    <Stack gap="md" data-testid="expense-tab">
      <Alert color="yellow" variant="light" role="note" title="記録のみ。決済・送金はしません">{EXPENSE_MESSAGES.tabNotice}</Alert>
      {d.readOnlyReason && <Alert color="gray" variant="light" role="note">{d.readOnlyReason}</Alert>}
      <Group justify="space-between">
        <Title order={3} size="h4">費用({d.total} 件・合計 {yen(d.totalAmount)})</Title>
        {d.canEdit && <Button size="xs" onClick={() => openForm("new")}>費用を追加</Button>}
      </Group>
      {err !== null && editing === null && <ErrorNotice error={err as Error} />}
      {d.items.length === 0 ? (
        <Text size="sm" c="dimmed">まだ費用メモはありません。</Text>
      ) : (
        <Table.ScrollContainer minWidth={640}>
          <Table striped aria-label="費用の一覧">
            <Table.Thead>
              <Table.Tr><Table.Th>日付</Table.Th><Table.Th>項目</Table.Th><Table.Th ta="right">金額</Table.Th><Table.Th>立て替えた人</Table.Th><Table.Th>対象</Table.Th><Table.Th>更新</Table.Th><Table.Th>操作</Table.Th></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {d.items.map((n) => (
                <Table.Tr key={n.id} data-testid="expense-row">
                  <Table.Td>{n.spentOn.slice(5)}</Table.Td>
                  <Table.Td>{n.title}{n.memo && <Text size="xs" c="dimmed">{n.memo}</Text>}</Table.Td>
                  <Table.Td ta="right">{yen(n.amount)}</Table.Td>
                  <Table.Td>{n.payerName}</Table.Td>
                  <Table.Td>{n.targets.map((t) => t.displayName).join("、")}({n.targets.length} 人)</Table.Td>
                  <Table.Td><Text size="xs">{n.updatedByName} {shortTime(n.updatedAt)}</Text></Table.Td>
                  <Table.Td>
                    {d.canEdit && (
                      <Group gap={4} wrap="nowrap">
                        <Button size="compact-xs" variant="subtle" onClick={() => openForm(n)} aria-label={`編集: ${n.title}`}>編集</Button>
                        <Button size="compact-xs" variant="subtle" color="red" onClick={() => { setErr(null); setDelTarget(n); }} aria-label={`削除: ${n.title}`}>削除</Button>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      <Card withBorder padding="md" aria-labelledby="exp-sum-title">
        <Stack gap="sm">
          <Title order={3} size="h4" id="exp-sum-title">分担の目安</Title>
          <Text size="xs" c="dimmed">{EXPENSE_MESSAGES.summaryNotice}</Text>
          {s ? (
            <>
              <SimpleGrid cols={2}>
                <div><Text size="xs" c="dimmed">合計</Text><Text fw={700}>{yen(s.totalAmount)}</Text><Text size="xs" c="dimmed">{s.count} 件</Text></div>
                <div><Text size="xs" c="dimmed">一人あたりの目安</Text><Text fw={700}>{yen(s.members.length ? Math.round(s.totalAmount / s.members.length) : 0)}</Text><Text size="xs" c="dimmed">メンバー {s.members.length} 人</Text></div>
              </SimpleGrid>
              <Table.ScrollContainer minWidth={420}>
                <Table aria-label="メンバー別の目安">
                  <Table.Thead><Table.Tr><Table.Th>メンバー</Table.Th><Table.Th ta="right">立て替え</Table.Th><Table.Th ta="right">負担の目安</Table.Th><Table.Th ta="right">差額</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {s.members.map((m) => (
                      <Table.Tr key={m.userId}>
                        <Table.Td>{m.displayName}</Table.Td>
                        <Table.Td ta="right">{yen(m.paid)}</Table.Td>
                        <Table.Td ta="right">{yen(m.owed)}</Table.Td>
                        <Table.Td ta="right">{m.net > 0 ? "+" : ""}{m.net.toLocaleString("ja-JP")} 円</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
              {s.transfers.length > 0 && (
                <Stack gap={2} aria-label="精算の目安">
                  {s.transfers.map((t, i) => <Text size="sm" key={i}>{EXPENSE_MESSAGES.transferLine(nameOf(t.fromUserId), nameOf(t.toUserId), t.amount.toLocaleString("ja-JP"))}</Text>)}
                </Stack>
              )}
            </>
          ) : sum.error ? <ErrorNotice error={sum.error} /> : <LoadingBlock />}
        </Stack>
      </Card>

      <Modal opened={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "費用を追加" : "費用を編集"}>
        <Stack>
          <Text size="xs" c="dimmed">{EXPENSE_MESSAGES.formNotice}</Text>
          <TextInput label="項目" required value={form.title} onChange={(e) => setForm({ ...form, title: e.currentTarget.value })} error={(err as ApiError | null)?.fields?.title} />
          <NumberInput label="金額(円)" required min={1} allowDecimal={false} thousandSeparator="," value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} error={(err as ApiError | null)?.fields?.amount} />
          <TextInput label="日付" type="date" required value={form.spentOn} onChange={(e) => setForm({ ...form, spentOn: e.currentTarget.value })} error={(err as ApiError | null)?.fields?.spentOn} />
          <Select label="立て替えた人" required allowDeselect={false} data={memberOptions(d, editing, form.payerId)} value={form.payerId} onChange={(v) => setForm({ ...form, payerId: v ?? "" })} error={(err as ApiError | null)?.fields?.payerId} />
          <MultiSelect label="対象メンバー" required data={memberOptions(d, editing, ...form.targetIds)} value={form.targetIds} onChange={(v) => setForm({ ...form, targetIds: v })} error={(err as ApiError | null)?.fields?.targetIds} />
          <Textarea label="メモ(任意)" autosize minRows={2} value={form.memo} onChange={(e) => setForm({ ...form, memo: e.currentTarget.value })} error={(err as ApiError | null)?.fields?.memo} />
          {needAck && <Checkbox label="内容を確認しました(そのまま保存する)" checked={ackReview} onChange={(e) => setAckReview(e.currentTarget.checked)} />}
          {err !== null && editing !== null && <ErrorNotice error={err as Error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditing(null)}>キャンセル</Button>
            <Button loading={busy} onClick={() => void submit()}>保存する</Button>
          </Group>
        </Stack>
      </Modal>

      <Modal opened={delTarget !== null} onClose={() => setDelTarget(null)} title="費用を削除しますか">
        <Stack>
          <Text size="sm">「{delTarget?.title}」({delTarget ? yen(delTarget.amount) : ""})を削除します。</Text>
          {err !== null && delTarget !== null && <ErrorNotice error={err as Error} />}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setDelTarget(null)}>やめる</Button>
            <Button color="red" loading={busy} onClick={() => void remove()}>削除する</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

// 現メンバー + 編集中の記録に含まれる元メンバー(「元メンバー」表示)を選択肢にする。
function memberOptions(d: ExpenseListResult, editing: ExpenseNoteView | "new" | null, ...selected: string[]) {
  const opts = d.members.map((m) => ({ value: m.userId, label: m.displayName }));
  if (editing && editing !== "new") {
    const known = new Set(opts.map((o) => o.value));
    const legacy = [{ id: editing.payerId, name: editing.payerName }, ...editing.targets.map((t) => ({ id: t.userId, name: t.displayName }))];
    for (const l of legacy) if (!known.has(l.id) && selected.includes(l.id)) { known.add(l.id); opts.push({ value: l.id, label: l.name }); }
  }
  return opts;
}
