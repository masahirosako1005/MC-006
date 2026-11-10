"use client";
// 05 旅程タブ(PLN-UI)。集合場所・日程メモ・旅程項目の表示と編集。
import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Card, Group, NativeSelect, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { DummyJapanMap } from "@/components/DummyJapanMap";
import {
  conflictCurrent, deleteItem, fetchPlan, patchItem, postItem, putMeeting, putMemo,
} from "../client";
import { PLAN_MESSAGES } from "../messages";
import type { PlanItemView, PlanView, SpotRef } from "../types";

const ERR_CONFLICT = PLAN_MESSAGES.conflict;

type Run = (okMsg: string, fn: () => Promise<unknown>) => Promise<boolean>;
interface Common { plan: PlanView; ro: boolean; busy: boolean; run: Run; groupId: string }
type F = { date: string; time: string; title: string; note: string; spot: string };

function SpotSelect({ spots, value, onChange, label }: { spots: SpotRef[]; value: string; onChange: (v: string) => void; label: string }) {
  return (
    <NativeSelect
      label={label}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      data={[{ value: "", label: "指定しない" }, ...spots.map((s) => ({ value: String(s.id), label: `${s.name}(${s.area})` }))]}
    />
  );
}

export function PlanTab({ groupId }: { groupId: string }) {
  const [plan, setPlan] = useState<PlanView | null>(null);
  const [loadErr, setLoadErr] = useState<unknown>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    try { setPlan(await fetchPlan(groupId)); setLoadErr(null); } catch (e) { setLoadErr(e); }
  }, [groupId]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- 初回取得
  useEffect(() => { void reload(); }, [reload]);

  // 保存系の共通処理。409 は文言を出して最新を再取得する。
  const run: Run = async (okMsg, fn) => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      await fn();
      setMsg(okMsg);
      await reload();
      return true;
    } catch (e) {
      if (conflictCurrent(e)) { setMsg(ERR_CONFLICT); await reload(); } else setErr(e);
      return false;
    } finally { setBusy(false); }
  };

  if (loadErr) {
    return (
      <Stack>
        <ErrorNotice error={loadErr as Error} />
        <Button variant="default" onClick={() => void reload()}>再読み込み</Button>
      </Stack>
    );
  }
  if (!plan) return <Text size="sm" c="dimmed">読み込み中…</Text>;

  const ro = !plan.editable;
  const dates = Array.from(new Set(plan.items.map((i) => i.date))).sort();
  const common = { plan, ro, busy, run, groupId };

  return (
    <Stack gap="md" data-testid="plan-tab">
      <Group justify="space-between">
        <Text size="sm">{ro ? plan.readOnlyReason : "メンバー全員で編集できます。"}</Text>
        <Button variant="default" size="xs" onClick={() => void reload()}>再読み込み</Button>
      </Group>
      <div aria-live="polite">
        {msg && <Alert color={msg === ERR_CONFLICT ? "yellow" : "teal"} variant="light">{msg}</Alert>}
      </div>
      {err !== null && <ErrorNotice error={err as Error} />}

      <MeetingCard key={`m${plan.meeting.version}`} {...common} />

      <Card withBorder>
        <Title order={3} size="h4" mb="xs">日程メモ</Title>
        <MemoForm key={`s${plan.scheduleMemo.version}`} {...common} />
      </Card>

      <Card withBorder>
        <Title order={3} size="h4" mb="xs">旅程({plan.schedule.startDate}〜{plan.schedule.endDate})</Title>
        {dates.length === 0 && (
          <Text size="sm" c="dimmed">まだ予定がありません。{ro ? "" : "下のボタンから追加できます。"}</Text>
        )}
        <Stack gap="md">
          {dates.map((d) => (
            <div key={d}>
              <Text fw={700} size="sm" mb={4}>{d}</Text>
              <Stack gap="xs">
                {plan.items.filter((i) => i.date === d).map((it) => (
                  <ItemRow key={`${it.id}-${it.version}`} item={it} {...common} />
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
        {!ro && <AddItemForm {...common} />}
      </Card>
    </Stack>
  );
}

function MeetingCard({ plan, ro, busy, run, groupId }: Common) {
  const m = plan.meeting;
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(m.text);
  const [spot, setSpot] = useState(m.spot ? String(m.spot.id) : "");
  const [date, setDate] = useState(m.date ?? "");
  const [time, setTime] = useState(m.time ?? "");
  const empty = !m.text && !m.spot && !m.date;

  const save = async () => {
    const ok = await run("集合場所を保存しました", () => putMeeting(groupId, {
      baseVersion: m.version, text, spotId: spot ? Number(spot) : null, date: date || null, time: time || null,
    }));
    if (ok) setEditing(false);
  };

  return (
    <Card withBorder>
      <Group justify="space-between" mb="xs">
        <Title order={3} size="h4">集合場所</Title>
        {!ro && !editing && (
          <Button size="xs" variant="light" onClick={() => setEditing(true)}>{empty ? "設定する" : "編集"}</Button>
        )}
      </Group>
      {!editing ? (
        empty ? <Text size="sm" c="dimmed">集合場所はまだ決まっていません。</Text> : (
          <Stack gap={2}>
            {(m.date || m.time) && (
              <Text fw={700}>
                {m.date ?? ""} {m.time ?? ""}
                {m.outOfRange && <Badge ml="xs" color="yellow">日程の範囲外</Badge>}
              </Text>
            )}
            {m.spot && <Text size="sm">場所: {m.spot.name}({m.spot.area})</Text>}
            {m.spot && <DummyJapanMap height={200} markers={[{ label: m.spot.name }]} caption="集合場所のイメージ" />}
            {m.text && <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{m.text}</Text>}
            {m.updatedBy && <Text size="xs" c="dimmed">最終更新: {m.updatedBy.displayName}</Text>}
          </Stack>
        )
      ) : (
        <Stack>
          <SpotSelect label="場所" spots={plan.spotOptions} value={spot} onChange={setSpot} />
          <Group grow>
            <TextInput type="date" label="日付" value={date} min={plan.schedule.startDate} max={plan.schedule.endDate} onChange={(e) => setDate(e.currentTarget.value)} />
            <TextInput type="time" label="時刻" value={time} onChange={(e) => setTime(e.currentTarget.value)} />
          </Group>
          <Textarea label="説明" value={text} maxLength={plan.limits.meetingTextMax} autosize minRows={2} onChange={(e) => setText(e.currentTarget.value)} description={`${text.length}/${plan.limits.meetingTextMax}`} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setEditing(false)}>やめる</Button>
            <Button loading={busy} onClick={() => void save()}>保存</Button>
          </Group>
        </Stack>
      )}
    </Card>
  );
}

function MemoForm({ plan, ro, busy, run, groupId }: Common) {
  const memo = plan.scheduleMemo;
  const [text, setText] = useState(memo.text);
  return (
    <Stack>
      <Textarea
        aria-label="日程メモ" value={text} readOnly={ro} autosize minRows={3} maxLength={plan.limits.memoMax}
        placeholder="持ち物・移動の注意など、メンバーへのメモ"
        description={ro ? undefined : `${text.length}/${plan.limits.memoMax}`}
        onChange={(e) => setText(e.currentTarget.value)}
      />
      {memo.updatedBy && <Text size="xs" c="dimmed">最終更新: {memo.updatedBy.displayName}</Text>}
      {!ro && (
        <Group justify="flex-end">
          <Button loading={busy} disabled={text === memo.text}
            onClick={() => void run("日程メモを保存しました", () => putMemo(groupId, { baseVersion: memo.version, text }))}>保存</Button>
        </Group>
      )}
    </Stack>
  );
}

function ItemFields({ plan, f, setF }: { plan: PlanView; f: F; setF: (v: F) => void }) {
  return (
    <Stack gap="xs">
      <Group grow>
        <TextInput type="date" label="日付" required value={f.date} min={plan.schedule.startDate} max={plan.schedule.endDate} onChange={(e) => setF({ ...f, date: e.currentTarget.value })} />
        <TextInput type="time" label="時刻" value={f.time} onChange={(e) => setF({ ...f, time: e.currentTarget.value })} />
      </Group>
      <TextInput label="予定" required value={f.title} maxLength={plan.limits.titleMax} onChange={(e) => setF({ ...f, title: e.currentTarget.value })} />
      <SpotSelect label="場所" spots={plan.spotOptions} value={f.spot} onChange={(v) => setF({ ...f, spot: v })} />
      <Textarea label="メモ" value={f.note} maxLength={plan.limits.noteMax} autosize minRows={2} onChange={(e) => setF({ ...f, note: e.currentTarget.value })} />
    </Stack>
  );
}

function ItemRow({ item, plan, ro, busy, run, groupId }: Common & { item: PlanItemView }) {
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState<F>({ date: item.date, time: item.time ?? "", title: item.title, note: item.note, spot: item.spot ? String(item.spot.id) : "" });

  if (editing) {
    return (
      <Card withBorder padding="sm">
        <ItemFields plan={plan} f={f} setF={setF} />
        <Group justify="flex-end" mt="sm">
          <Button variant="default" onClick={() => setEditing(false)}>やめる</Button>
          <Button loading={busy} disabled={!f.title.trim()} onClick={async () => {
            const ok = await run(`『${f.title}』を保存しました`, () => patchItem(groupId, item.id, {
              baseVersion: item.version, date: f.date, time: f.time || null, title: f.title, note: f.note, spotId: f.spot ? Number(f.spot) : null,
            }));
            if (ok) setEditing(false);
          }}>保存</Button>
        </Group>
      </Card>
    );
  }
  return (
    <Card withBorder padding="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <div>
          <Text fw={700}>
            {item.time ? `${item.time} ` : ""}{item.title}
            {item.outOfRange && <Badge ml="xs" color="yellow">日程の範囲外</Badge>}
          </Text>
          {item.spot && <Text size="sm">場所: {item.spot.name}({item.spot.area})</Text>}
          {item.note && <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{item.note}</Text>}
          <Text size="xs" c="dimmed">最終更新: {item.updatedBy.displayName}</Text>
        </div>
        {!ro && (
          <Group gap="xs" wrap="nowrap">
            <Button size="xs" variant="light" onClick={() => setEditing(true)}>編集</Button>
            <Button size="xs" variant="light" color="red" loading={busy}
              onClick={() => void run(`『${item.title}』を削除しました`, () => deleteItem(groupId, item.id, item.version))}>削除</Button>
          </Group>
        )}
      </Group>
    </Card>
  );
}

function AddItemForm({ plan, busy, run, groupId }: Common) {
  const blank: F = { date: plan.schedule.startDate, time: "", title: "", note: "", spot: "" };
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<F>(blank);
  if (!open) return <Button mt="md" variant="light" onClick={() => setOpen(true)}>予定を追加</Button>;
  return (
    <Stack mt="md" gap="xs">
      <Title order={4} size="h5">予定の追加</Title>
      <ItemFields plan={plan} f={f} setF={setF} />
      <Group justify="flex-end">
        <Button variant="default" onClick={() => setOpen(false)}>やめる</Button>
        <Button loading={busy} disabled={!f.title.trim()} onClick={async () => {
          const ok = await run(`『${f.title}』を保存しました`, () => postItem(groupId, {
            date: f.date, time: f.time || null, title: f.title, note: f.note, spotId: f.spot ? Number(f.spot) : null,
          }));
          if (ok) { setF(blank); setOpen(false); }
        }}>追加</Button>
      </Group>
    </Stack>
  );
}
