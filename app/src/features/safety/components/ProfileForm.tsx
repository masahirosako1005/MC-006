"use client";
// 09: プロフィール編集と公開範囲(SAF-UI-01)。GET/PUT /api/me/profile。
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, Card, Checkbox, Group, Select, SimpleGrid, Stack, Text, TextInput, Textarea, Title, Tabs } from "@mantine/core";
import { ApiError, gput, useGroupsApi } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { TextRejectNotice } from "./TextRejectNotice";
import { useTextCheck } from "./useTextCheck";
import type { AgeBand, MyProfileDto, Profile, ProfileFieldKey, TravelPurpose, Visibility } from "../types";

const AGE_OPTIONS: { value: AgeBand; label: string }[] = [
  { value: "18-19", label: "18〜19歳" }, { value: "20s", label: "20代" }, { value: "30s", label: "30代" },
  { value: "40s", label: "40代" }, { value: "50s", label: "50代" }, { value: "60s", label: "60代" }, { value: "70s+", label: "70代以上" },
];
const PURPOSES: { value: TravelPurpose; label: string }[] = [
  { value: "sightseeing", label: "観光" }, { value: "food", label: "食べ歩き" }, { value: "nature", label: "自然" },
  { value: "history", label: "歴史" }, { value: "photo", label: "写真" }, { value: "relax", label: "のんびり" }, { value: "stamp_rally", label: "スタンプラリー" },
];
const VIS_LABEL: Record<Visibility, string> = { public: "全員", reviewer: "申請を確認する幹事", members: "参加が成立したメンバー", self: "自分のみ" };
const FIELD_LABEL: Record<ProfileFieldKey, string> = {
  displayName: "表示名", ageBand: "年代", bio: "ひとこと", travelPurposes: "旅の目的", realName: "実名", contact: "連絡先",
};
const ORDER: ProfileFieldKey[] = ["displayName", "ageBand", "bio", "travelPurposes", "realName", "contact"];

type Audience = "public" | "reviewer" | "members";
const AUD: { key: Audience; label: string }[] = [
  { key: "public", label: "一覧・詳細を見る人(全員)" }, { key: "reviewer", label: "申請を確認する幹事(承認前)" }, { key: "members", label: "参加が成立したメンバー" },
];
const RANK: Record<Visibility, number> = { public: 0, reviewer: 1, members: 2, self: 3 };
const AUD_RANK: Record<Audience, number> = { public: 0, reviewer: 1, members: 2 };

function Preview({ p }: { p: Profile }) {
  const valueOf = (k: ProfileFieldKey): string => {
    switch (k) {
      case "displayName": return p.displayName;
      case "ageBand": return AGE_OPTIONS.find((a) => a.value === p.ageBand)?.label ?? "";
      case "bio": return p.bio;
      case "travelPurposes": return p.travelPurposes.map((t) => PURPOSES.find((x) => x.value === t)?.label ?? t).join("、");
      case "realName": return p.realName ?? "(未登録)";
      case "contact": return p.contact ?? "(未登録)";
    }
  };
  return (
    <Tabs defaultValue="public">
      <Tabs.List>{AUD.map((a) => <Tabs.Tab key={a.key} value={a.key}>{a.label}</Tabs.Tab>)}</Tabs.List>
      {AUD.map((a) => {
        const shown = ORDER.filter((k) => k === "displayName" || (p.visibility[k] !== "self" && RANK[p.visibility[k]] <= AUD_RANK[a.key]));
        const hidden = ORDER.filter((k) => !shown.includes(k));
        return (
          <Tabs.Panel key={a.key} value={a.key} pt="sm">
            <Stack gap={4}>
              {shown.map((k) => <Text key={k} size="sm"><b>{FIELD_LABEL[k]}</b>: {valueOf(k) || "(未入力)"}</Text>)}
              {hidden.length > 0 && <Text size="xs" c="dimmed">表示しない: {hidden.map((k) => FIELD_LABEL[k]).join("、")}</Text>}
            </Stack>
          </Tabs.Panel>
        );
      })}
    </Tabs>
  );
}

export function ProfileForm() {
  const { campaign } = useParams<{ campaign: string }>();
  const { data, error, loading } = useGroupsApi<MyProfileDto>("/api/me/profile");
  const [p, setP] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<unknown>(null);
  const [reviewMsg, setReviewMsg] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const nameCheck = useTextCheck("profile_display_name");
  const bioCheck = useTextCheck("profile_bio");

  // eslint-disable-next-line react-hooks/set-state-in-effect -- 取得結果をフォームに反映
  useEffect(() => { if (data) setP(data.profile); }, [data]);

  if (loading) return <LoadingBlock />;
  if (error || !data || !p) return <Stack p="md"><ErrorNotice error={error} /></Stack>;

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => { setP((x) => (x ? { ...x, [k]: v } : x)); setSaved(false); };
  const setVis = (k: ProfileFieldKey, v: Visibility) => { setP((x) => (x ? { ...x, visibility: { ...x.visibility, [k]: v } } : x)); setSaved(false); };
  const fields = err instanceof ApiError && err.fields ? err.fields : {};
  const deniedMsg = err instanceof ApiError && err.reason === "text_denied" ? err.message : undefined;

  const save = async (ackReview: boolean) => {
    setBusy(true);
    setErr(null);
    setReviewMsg(null);
    setSaved(false);
    try {
      await gput("/api/me/profile", {
        displayName: p.displayName, ageBand: p.ageBand, bio: p.bio, travelPurposes: p.travelPurposes, visibility: p.visibility,
        ...(ackReview ? { ackReview: true } : {}),
      });
      setSaved(true);
    } catch (e) {
      if (e instanceof ApiError && e.reason === "text_review_required") setReviewMsg(e.message);
      setErr(e);
    } finally {
      setBusy(false);
    }
  };

  const visSelect = (k: ProfileFieldKey) => {
    const opts = data.allowed[k];
    if (opts.length <= 1 || !data.editable[k]) return <Text size="sm">{VIS_LABEL[p.visibility[k]]}(変更できません)</Text>;
    return (
      <Select label="誰に見える?" aria-label={`誰に見える?(${FIELD_LABEL[k]})`} allowDeselect={false}
        data={opts.map((o) => ({ value: o, label: VIS_LABEL[o] }))} value={p.visibility[k]} onChange={(x) => x && setVis(k, x as Visibility)} />
    );
  };
  const row = (k: ProfileFieldKey, input: React.ReactNode) => (
    <SimpleGrid cols={{ base: 1, sm: 2 }} py="sm" style={{ borderBottom: "1px solid var(--mantine-color-gray-3)" }}>
      <div>{input}</div>
      <div style={{ padding: "8px 10px", background: "var(--mantine-color-gray-0)", borderRadius: 8 }}>{visSelect(k)}</div>
    </SimpleGrid>
  );

  return (
    <Stack p="md" gap="md">
      <Title order={2}>プロフィールと公開範囲</Title>
      <Group gap="xs">
        <Button component={Link} href={`/${campaign}/mypage/verification`} variant="default" size="xs">本人確認(モック)</Button>
        <Button component={Link} href={`/${campaign}/mypage/blocks`} variant="default" size="xs">ブロック一覧</Button>
      </Group>
      <Card withBorder padding="md">
        <Title order={3} size="h4">プロフィール</Title>
        <Text size="xs" c="dimmed">項目ごとに「誰に見えるか」を選べます。参加が成立するまでは、見せる項目を少なくしておくことをおすすめします。</Text>
        {err !== null && !deniedMsg && !reviewMsg && !Object.keys(fields).length && <ErrorNotice error={err as Error} />}
        <TextRejectNotice result={null} serverError={reviewMsg ?? deniedMsg} serverKind={reviewMsg ? "review" : "deny"} onAckReview={() => void save(true)} busy={busy} />
        {row("displayName", <>
          <TextInput label="表示名" required maxLength={LIMITS.DISPLAY_NAME.max} description={`${LIMITS.DISPLAY_NAME.max} 文字以内。本名・連絡先は書かないでください。`}
            value={p.displayName} onChange={(e) => { set("displayName", e.currentTarget.value); nameCheck.onChange(e.currentTarget.value); }} error={fields.displayName} />
          <TextRejectNotice result={nameCheck.result} />
        </>)}
        {row("ageBand", <Select label="年代" required allowDeselect={false} data={AGE_OPTIONS} value={p.ageBand} onChange={(x) => x && set("ageBand", x as AgeBand)}
          description="年代の帯だけを扱います。生年月日や細かい年齢は登録しません。" error={fields.ageBand} />)}
        {row("bio", <>
          <Textarea label="ひとこと" autosize minRows={3} maxLength={LIMITS.PROFILE_BIO.max}
            description={`${LIMITS.PROFILE_BIO.max} 文字以内・${LIMITS.PROFILE_BIO.maxLines} 行まで。${[...p.bio].length} / ${LIMITS.PROFILE_BIO.max}`}
            value={p.bio} onChange={(e) => { set("bio", e.currentTarget.value); bioCheck.onChange(e.currentTarget.value); }} error={fields.bio} />
          <TextRejectNotice result={bioCheck.result} />
        </>)}
        {row("travelPurposes", <Checkbox.Group label={`旅の目的(${LIMITS.TRAVEL_PURPOSES.maxItems} つまで)`} value={p.travelPurposes}
          onChange={(x) => set("travelPurposes", x.slice(0, LIMITS.TRAVEL_PURPOSES.maxItems) as TravelPurpose[])}
          description={`${p.travelPurposes.length} つ選んでいます。`} error={fields.travelPurposes}>
          <SimpleGrid cols={2} mt={6}>{PURPOSES.map((o) => <Checkbox key={o.value} value={o.value} label={o.label}
            disabled={!p.travelPurposes.includes(o.value) && p.travelPurposes.length >= LIMITS.TRAVEL_PURPOSES.maxItems} />)}</SimpleGrid>
        </Checkbox.Group>)}
        {row("realName", <TextInput label="実名" value={p.realName ?? ""} disabled description="デモ用のダミーです。値は編集できません。" />)}
        {row("contact", <TextInput label="連絡先" value={p.contact ?? ""} disabled description="デモ用のダミーです。値は編集できません。参加が成立する前の人には表示しません。" />)}
        <Alert color="blue" variant="light" mt="sm">性別の項目はありません。グループの一覧でも、性別での表示・絞り込みは行いません。年齢は年代の帯だけを扱います。</Alert>
        <Group justify="flex-end" mt="md">
          <Button variant="subtle" onClick={() => { setP(data.profile); setErr(null); setReviewMsg(null); setSaved(false); }}>元に戻す</Button>
          <Button loading={busy} onClick={() => void save(false)} style={{ minHeight: 44 }}>保存する</Button>
        </Group>
        {saved && <Alert color="green" variant="light" role="status" mt="sm">プロフィールを保存しました。</Alert>}
      </Card>
      <Card withBorder padding="md">
        <Title order={3} size="h4">他の人からの見え方</Title>
        <Text size="xs" c="dimmed" mb="xs">いまの設定で、相手ごとに表示される項目です。</Text>
        <Preview p={p} />
      </Card>
    </Stack>
  );
}
