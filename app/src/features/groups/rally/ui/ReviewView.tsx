"use client";
// 08: 振り返り(メモ・アンケート 5 項目・ダミー写真)。RLY-UI。
import { useState } from "react";
import Link from "next/link";
import { Alert, Anchor, Badge, Button, Card, Group, Radio, Select, Stack, Text, TextInput, Textarea, Title } from "@mantine/core";
import { ApiError, gdelete, gpost, gput, useGroupsApi } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import type { ReviewDto, SurveyInput, WantAgain } from "../types";
import { SURVEY_QUESTIONS, UNAVAILABLE_MESSAGES } from "../messages";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

type Msg = { ok: boolean; text: string } | null;
const SCALE_KEYS = ["satisfaction", "planClarity", "localInteraction", "localExploration"] as const;

export function ReviewView({ campaign, groupId }: { campaign: string; groupId: string }) {
  const r = useGroupsApi<ReviewDto>(`/api/groups/${groupId}/review`);
  const [memo, setMemo] = useState<string | null>(null);
  const [memoMsg, setMemoMsg] = useState<Msg>(null);
  const [needAck, setNeedAck] = useState<null | "memo" | "photo">(null);
  const [survey, setSurvey] = useState<Partial<Record<keyof SurveyInput, string>>>({});
  const [surveyMsg, setSurveyMsg] = useState<Msg>(null);
  const [caption, setCaption] = useState("");
  const [spotId, setSpotId] = useState<string | null>(null);
  const [photoMsg, setPhotoMsg] = useState<Msg>(null);

  const back = <Anchor component={Link} href={`/${campaign}/groups/${groupId}?tab=rally`} size="sm">グループ詳細(ラリー)へ戻る</Anchor>;
  if (r.loading && !r.data) return <LoadingBlock />;
  if (r.error) return <Stack>{back}<ErrorNotice error={r.error} onRetry={() => void r.reload()} /></Stack>;
  const d = r.data;
  if (!d) return null;
  const canWrite = d.access.canReviewWrite;
  const mine = d.memos.find((m) => m.mine);
  const memoValue = memo ?? mine?.body ?? "";
  const sv = { ...(d.mySurvey ?? {}), ...survey } as Partial<Record<keyof SurveyInput, string | number>>;

  const errText = (e: unknown) => (e instanceof ApiError ? e.message : "保存できませんでした");

  async function saveMemo(ack = false) {
    setMemoMsg(null);
    try {
      await gput(`/api/groups/${groupId}/review/memo`, { body: memoValue, ackReview: ack || undefined });
      setNeedAck(null); setMemo(null); setMemoMsg({ ok: true, text: "メモを保存しました。" });
      await r.reload();
    } catch (e) {
      if (e instanceof ApiError && e.reason === "text_review_required") setNeedAck("memo");
      else setMemoMsg({ ok: false, text: errText(e) });
    }
  }
  async function saveSurvey() {
    setSurveyMsg(null);
    try {
      await gput(`/api/groups/${groupId}/review/survey`, {
        satisfaction: Number(sv.satisfaction), planClarity: Number(sv.planClarity), wantAgain: sv.wantAgain,
        localInteraction: Number(sv.localInteraction), localExploration: Number(sv.localExploration),
      });
      setSurveyMsg({ ok: true, text: "アンケートを保存しました。" });
      await r.reload();
    } catch (e) { setSurveyMsg({ ok: false, text: errText(e) }); }
  }
  async function addPhoto(ack = false) {
    setPhotoMsg(null);
    try {
      await gpost(`/api/groups/${groupId}/review/photos`, { spotId: spotId ? Number(spotId) : null, caption, ackReview: ack || undefined });
      setNeedAck(null); setCaption(""); setPhotoMsg({ ok: true, text: "写真(ダミー)を投稿しました。" });
      await r.reload();
    } catch (e) {
      if (e instanceof ApiError && e.reason === "text_review_required") setNeedAck("photo");
      else setPhotoMsg({ ok: false, text: errText(e) });
    }
  }
  async function removePhoto(id: string) {
    try { await gdelete(`/api/groups/${groupId}/review/photos/${id}`); await r.reload(); }
    catch (e) { setPhotoMsg({ ok: false, text: errText(e) }); }
  }

  const surveyReady = SCALE_KEYS.every((k) => sv[k]) && !!sv.wantAgain;
  const ackAlert = (kind: "memo" | "photo", go: () => void) => needAck === kind && (
    <Alert color="yellow" mt="xs" title="内容の確認">
      <Text size="sm" mb="xs">確認が必要な表現が含まれている可能性があります。このまま保存しますか。</Text>
      <Button size="xs" onClick={go}>このまま保存する</Button>
    </Alert>
  );

  return (
    <Stack gap="md" data-testid="review-view">
      {back}
      <Title order={2}>振り返り</Title>
      <Text size="sm" c="dimmed">{d.groupName}({d.period.start} 〜 {d.period.end})</Text>
      {!canWrite && d.access.reviewReason && <Alert color="gray">{UNAVAILABLE_MESSAGES[d.access.reviewReason]}</Alert>}

      <Card withBorder>
        <Title order={4} mb="xs">ラリーの結果</Title>
        <Badge mb="xs">{d.progress.acquiredCount} / {d.progress.totalSpots} 取得({d.progress.achievementRate}%)</Badge>
        {d.progress.rewards.map((w) => <Text size="sm" key={w.rewardId}>{w.reached ? "到達" : "未到達"}: {w.name}({w.requiredStamps} 個)</Text>)}
        <Text size="sm" mt="xs" fw={600}>自分の獲得特典</Text>
        {d.myRewards.length === 0 ? <Text size="sm" c="dimmed">なし</Text> : d.myRewards.map((m) => <Text size="sm" key={m.rewardId}>{m.name} - {m.prize}</Text>)}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">メモ</Title>
        <Textarea label="自分のメモ" value={memoValue} onChange={(e) => setMemo(e.currentTarget.value)} disabled={!canWrite}
          description={`${LIMITS.RALLY_MEMO.min}〜${LIMITS.RALLY_MEMO.max} 文字`} autosize minRows={3} />
        {canWrite && <Button mt="xs" onClick={() => void saveMemo()} disabled={memoValue.trim() === ""}>メモを保存</Button>}
        {ackAlert("memo", () => void saveMemo(true))}
        {memoMsg && <Alert mt="xs" color={memoMsg.ok ? "green" : "red"} role="status">{memoMsg.text}</Alert>}
        <Stack gap={4} mt="md">
          {d.memos.filter((m) => !m.mine).map((m) => (
            <div key={m.id}><Text size="sm" fw={600}>{m.author.displayName}</Text><Text size="sm">{m.body}</Text></div>
          ))}
        </Stack>
      </Card>

      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={4}>アンケート</Title>
          <Text size="xs" c="dimmed">回答済み {d.surveyAnswered} / {d.memberCount} 人</Text>
        </Group>
        <Stack gap="md">
          {SCALE_KEYS.map((k) => (
            <Radio.Group key={k} label={SURVEY_QUESTIONS[k].label} value={sv[k] ? String(sv[k]) : ""}
              onChange={(v) => setSurvey((s) => ({ ...s, [k]: v }))}>
              <Group mt="xs" gap="md">
                {SURVEY_QUESTIONS[k].scale.map((lab, i) => <Radio key={i} value={String(i + 1)} label={lab} disabled={!canWrite} />)}
              </Group>
            </Radio.Group>
          ))}
          <Radio.Group label={SURVEY_QUESTIONS.wantAgain.label} value={(sv.wantAgain as string) ?? ""}
            onChange={(v) => setSurvey((s) => ({ ...s, wantAgain: v as WantAgain }))}>
            <Group mt="xs" gap="md">
              {(Object.keys(SURVEY_QUESTIONS.wantAgain.options) as WantAgain[]).map((o) => (
                <Radio key={o} value={o} label={SURVEY_QUESTIONS.wantAgain.options[o]} disabled={!canWrite} />
              ))}
            </Group>
          </Radio.Group>
        </Stack>
        {canWrite && <Button mt="md" onClick={() => void saveSurvey()} disabled={!surveyReady}>{d.mySurvey ? "回答を更新" : "回答を保存"}</Button>}
        {surveyMsg && <Alert mt="xs" color={surveyMsg.ok ? "green" : "red"} role="status">{surveyMsg.text}</Alert>}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">写真(ダミー)</Title>
        <Text size="xs" c="dimmed" mb="xs">実際の画像はアップロードされません。1 人 {LIMITS.PHOTOS.maxPerUser} 枚まで。</Text>
        {canWrite && (
          <Stack gap="xs" mb="md">
            <Select label="スポット(任意)" clearable value={spotId} onChange={setSpotId}
              data={d.progress.spots.map((s) => ({ value: String(s.spotId), label: s.name }))} />
            <TextInput label="キャプション(任意)" value={caption} maxLength={LIMITS.PHOTO_CAPTION.max} onChange={(e) => setCaption(e.currentTarget.value)} />
            <div><Button onClick={() => void addPhoto()}>写真を投稿</Button></div>
            {ackAlert("photo", () => void addPhoto(true))}
          </Stack>
        )}
        {photoMsg && <Alert mb="xs" color={photoMsg.ok ? "green" : "red"} role="status">{photoMsg.text}</Alert>}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
          {d.photos.map((p) => (
            <div key={p.id}>
              <div style={{ aspectRatio: "4 / 3", borderRadius: 8, background: `hsl(${p.hue} 60% 80%)` }} aria-hidden />
              <Text size="xs">{p.caption || "(キャプションなし)"}</Text>
              <Text size="xs" c="dimmed">{p.author.displayName}{p.mine ? "(自分)" : ""}</Text>
              {p.mine && canWrite && <Button size="compact-xs" color="red" variant="subtle" onClick={() => void removePhoto(p.id)}>削除</Button>}
            </div>
          ))}
        </div>
      </Card>
    </Stack>
  );
}
