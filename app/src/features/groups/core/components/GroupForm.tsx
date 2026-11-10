"use client";
import { useMemo, useState } from "react";
import { Alert, Badge, Button, Card, Group as MGroup, NumberInput, Radio, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import type { Id } from "@/lib/groups-types";
import { ApiError, gpatch, gpost, useGroupsApi } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import { useFormErrors } from "@/components/groups/common/useFormErrors";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { TextRejectNotice } from "@/features/safety/components/TextRejectNotice";
import type { GroupFormValues } from "./formValues";
import { toCreateGroupRequest, toUpdateGroupPatch } from "./formValues";

export interface GroupFormProps {
  mode: "create" | "edit" | "replan";
  campaign: string;
  groupId?: Id;
  initial?: GroupFormValues;
  onSubmit?: (values: GroupFormValues) => Promise<{ groupId: Id }>;
  onDone: (groupId: Id) => void;
}

const EMPTY: GroupFormValues = {
  name: "", region: "", destination: "", startDate: null, endDate: null, dateNote: "",
  capacity: 4, minMembers: 2, deadlineDate: null, visibility: "public", tags: [], description: "",
};

const TITLES = { create: "グループを作る", edit: "グループを編集する", replan: "グループを再企画する" } as const;

export function GroupForm({ mode, campaign, groupId, initial, onSubmit, onDone }: GroupFormProps) {
  const [v, setV] = useState<GroupFormValues>(initial ?? EMPTY);
  const [tagInput, setTagInput] = useState("");
  const [err, setErr] = useState<unknown>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { data: regionData } = useGroupsApi<{ regions: { id: string; name: string }[] }>(`/api/regions?campaign=${encodeURIComponent(campaign)}`);
  const regions = useMemo(() => (regionData?.regions ?? []).map((r) => ({ value: r.id, label: r.name })), [regionData]);
  const { fields, general } = useFormErrors(err);
  const set = <K extends keyof GroupFormValues>(k: K, val: GroupFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const isEdit = mode === "edit";

  const addTag = () => {
    const t = tagInput.trim();
    if (!t || v.tags.includes(t) || v.tags.length >= LIMITS.TAG.maxItems) return;
    set("tags", [...v.tags, t]);
    setTagInput("");
  };

  const submit = async (ackReview: boolean) => {
    setBusy(true);
    setErr(null);
    setReviewMsg(null);
    try {
      let id: Id;
      if (onSubmit) {
        id = (await onSubmit(v)).groupId;
      } else if (isEdit && groupId) {
        if (!initial) throw new Error("初期値がありません");
        const patch = toUpdateGroupPatch(initial, v);
        await gpatch(`/api/groups/${groupId}`, { ...patch, ...(ackReview ? { ackReview: true } : {}) });
        id = groupId;
      } else {
        if (!v.startDate || !v.endDate || !v.deadlineDate) {
          throw new ApiError("invalid_input", 400, "入力内容を確認してください", {
            fields: {
              ...(v.startDate ? {} : { "trip.startDate": "開始日を入力してください。" }),
              ...(v.endDate ? {} : { "trip.endDate": "終了日を入力してください。" }),
              ...(v.deadlineDate ? {} : { deadlineDate: "締切日を入力してください。" }),
            },
          });
        }
        const res = await gpost<{ group: { id: Id } }>("/api/groups", { ...toCreateGroupRequest(v, campaign), ...(ackReview ? { ackReview: true } : {}) });
        id = res.group.id;
      }
      onDone(id);
    } catch (e) {
      if (e instanceof ApiError && e.reason === "text_review_required") setReviewMsg(e.message);
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const fe = (k: string) => fields[k];
  const reviewNeeded = reviewMsg !== null;
  const deniedMsg = err instanceof ApiError && err.reason === "text_denied" ? err.message : undefined;

  return (
    <form noValidate onSubmit={(e) => { e.preventDefault(); void submit(false); }} aria-labelledby="form-title">
      <Stack gap="lg" p="md">
        <Title order={2} id="form-title">{TITLES[mode]}</Title>
        {mode === "create" && (
          <Alert color="blue" variant="light">作成すると、あなたが幹事になります。参加の申請を承認するのは幹事です。氏名や連絡先を入力する欄はありません。</Alert>
        )}
        {general && !reviewNeeded && !deniedMsg && <ErrorNotice error={err as Error} />}
        <TextRejectNotice result={null} serverError={reviewMsg ?? deniedMsg} serverKind={reviewNeeded ? "review" : "deny"} onAckReview={() => void submit(true)} busy={busy} />
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={3} size="h4">基本</Title>
            <TextInput label="名称" required maxLength={LIMITS.GROUP_NAME.max} description={`${LIMITS.GROUP_NAME.max} 文字まで(${[...v.name].length} / ${LIMITS.GROUP_NAME.max})`}
              value={v.name} onChange={(e) => set("name", e.currentTarget.value)} error={fe("name")} />
            <Select label="地方" required data={regions} value={v.region || null} onChange={(x) => set("region", x ?? "")} error={fe("region")} allowDeselect={false} />
            <TextInput label="行き先" required maxLength={LIMITS.DESTINATION.max} description={`${LIMITS.DESTINATION.max} 文字まで。スポットや地区の名前など。`}
              value={v.destination} onChange={(e) => set("destination", e.currentTarget.value)} error={fe("trip.destination")} />
          </Stack>
        </Card>
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={3} size="h4">日程</Title>
            <TextInput type="date" label="開始日" required value={v.startDate ?? ""} onChange={(e) => set("startDate", e.currentTarget.value || null)} error={fe("trip.startDate")} />
            <TextInput type="date" label="終了日" required value={v.endDate ?? ""} onChange={(e) => set("endDate", e.currentTarget.value || null)} error={fe("trip.endDate")} />
            <TextInput label="日程のメモ" maxLength={LIMITS.DATE_NOTE.max} description={`${LIMITS.DATE_NOTE.max} 文字まで(任意)`}
              value={v.dateNote} onChange={(e) => set("dateNote", e.currentTarget.value)} error={fe("trip.dateNote")} />
          </Stack>
        </Card>
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={3} size="h4">人数と締切</Title>
            <NumberInput label="定員" required min={LIMITS.CAPACITY.min} max={LIMITS.CAPACITY.max} allowDecimal={false}
              description={`${LIMITS.CAPACITY.min} 〜 ${LIMITS.CAPACITY.max} 人(幹事を含む)`}
              value={v.capacity} onChange={(x) => set("capacity", Number(x) || 0)} error={fe("capacity")} />
            <NumberInput label="最少人数" min={LIMITS.MIN_MEMBERS.min} max={LIMITS.MIN_MEMBERS.max} allowDecimal={false} disabled={isEdit}
              value={v.minMembers} onChange={(x) => set("minMembers", Number(x) || 0)} error={fe("minMembers")} />
            <TextInput type="date" label="締切日" required disabled={isEdit} value={v.deadlineDate ?? ""} onChange={(e) => set("deadlineDate", e.currentTarget.value || null)} error={fe("deadlineDate")} />
            {isEdit && <Text size="xs" c="dimmed">最少人数と締切は、グループ詳細の「条件の変更」から変更します。</Text>}
          </Stack>
        </Card>
        <Card withBorder padding="md">
          <Stack gap="sm">
            <Title order={3} size="h4">公開範囲とタグ</Title>
            <Radio.Group label="公開範囲" value={v.visibility} onChange={(x) => set("visibility", x === "private" ? "private" : "public")} error={fe("visibility")}>
              <Stack gap={4} mt={4}>
                <Radio value="public" label="公開(一覧に表示され、誰でも参加を申請できます)" />
                <Radio value="private" label="非公開(招待コードを知っている人だけが参加できます)" />
              </Stack>
            </Radio.Group>
            <div>
              <MGroup gap="xs" align="flex-end">
                <TextInput style={{ flex: 1 }} label="タグ" maxLength={LIMITS.TAG.max} description={`${LIMITS.TAG.maxItems} 個まで・各 ${LIMITS.TAG.max} 文字まで(任意)`}
                  value={tagInput} onChange={(e) => setTagInput(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }} />
                <Button variant="light" onClick={addTag} style={{ minHeight: 36 }}>追加</Button>
              </MGroup>
              <MGroup gap={6} mt={6}>
                {v.tags.map((t, i) => (
                  <Badge key={t} variant="light" size="lg" style={{ cursor: "pointer", textTransform: "none" }}
                    onClick={() => set("tags", v.tags.filter((_, j) => j !== i))} title="クリックで削除">{t} ×</Badge>
                ))}
              </MGroup>
              {Object.entries(fields).filter(([k]) => k === "tags" || k.startsWith("tags.")).map(([k, m]) => <Text key={k} size="xs" c="red">{m}</Text>)}
            </div>
            <Textarea label="説明" autosize minRows={3} maxLength={LIMITS.DESCRIPTION.max} description={`${LIMITS.DESCRIPTION.max} 文字まで(${[...v.description].length} / ${LIMITS.DESCRIPTION.max})`}
              value={v.description} onChange={(e) => set("description", e.currentTarget.value)} error={fe("description")} />
          </Stack>
        </Card>
        <Button type="submit" loading={busy} size="md" style={{ minHeight: 44 }}>
          {mode === "edit" ? "保存する" : mode === "replan" ? "再企画して作成する" : "グループを作る"}
        </Button>
      </Stack>
    </form>
  );
}
