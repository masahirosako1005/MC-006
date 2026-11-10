"use client";
import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Button, Card, Group, Stack, Text, TextInput, Title } from "@mantine/core";
import { ApiError, gpost } from "@/lib/groups-api";
import { JoinRequestPanel } from "@/features/groups/join/components/JoinRequestPanel";
import type { PrivateGroupPreview } from "../types";
import { fmtRange } from "./format";
import { HeadcountLine } from "./HeadcountLine";

export interface InviteCodeScreenProps { campaign: string }

const NOT_FOUND = "コードが見つかりません。入力を確認してください。";
const BLOCK: Record<string, string> = { full: "満員です。", already_member: "すでに参加しています。", already_requested: "申請中です。" };

// コードは state のみで保持する(URL・履歴・ストレージに残さない。契約 7.2)。
export function InviteCodeScreen({ campaign }: InviteCodeScreenProps) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PrivateGroupPreview | null>(null);
  const [verified, setVerified] = useState("");
  const [done, setDone] = useState(false);

  const lookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(null); setPreview(null); setDone(false);
    try {
      const p = await gpost<PrivateGroupPreview>("/api/invites/lookup", { code });
      setPreview(p); setVerified(code);
    } catch (err) {
      setError(err instanceof ApiError && (err.code === "network" || err.code === "internal") ? err.message : NOT_FOUND);
    } finally { setBusy(false); }
  };

  const reset = () => { setPreview(null); setCode(""); setVerified(""); setError(null); setDone(false); };

  return (
    <Stack gap="md" maw={560} mx="auto">
      <Title order={2}>招待コードで参加</Title>
      <Card withBorder component="section" aria-labelledby="sec-input">
        <Stack gap="sm">
          <Title order={3} size="h4" id="sec-input">1 コードを入力</Title>
          <Text size="sm">非公開のグループは一覧に載りません。幹事から受け取った招待コードを入力すると、グループの概要を確認して参加を申請できます。</Text>
          <form onSubmit={lookup} autoComplete="off">
            <Stack gap="sm">
              <TextInput label="招待コード" required value={code} onChange={(e) => setCode(e.currentTarget.value)}
                maxLength={16} placeholder="ABCDE-FGHJK" autoCapitalize="characters" spellCheck={false}
                description="10 文字(英大文字と数字)。小文字、ハイフン、空白を含めて入力してもかまいません。"
                error={error ?? undefined} styles={{ input: { fontFamily: "monospace", letterSpacing: ".12em", textTransform: "uppercase" } }} />
              <Group justify="flex-end">
                <Button component={Link} href={`/${campaign}/groups`} variant="subtle">一覧へ戻る</Button>
                <Button type="submit" loading={busy} disabled={code.trim() === ""}>照合する</Button>
              </Group>
            </Stack>
          </form>
          <Text size="xs" c="dimmed">コードは画面の中だけで保持し、URL・履歴・ブラウザの保存領域には残しません。この画面を離れると、もう一度入力が必要です。</Text>
        </Stack>
      </Card>
      {preview && (
        <Stack gap="md" component="section" aria-labelledby="sec-preview-t">
          <Title order={3} size="h4" id="sec-preview-t">2 グループを確認して申請</Title>
          <Alert color="green" role="status">コードを確認しました。</Alert>
          <Card withBorder component="article" aria-labelledby="pv-name">
            <Stack gap="xs">
              <Group gap={6}><Badge variant="light">{preview.statusLabel}</Badge><Badge color="gray" variant="light">非公開</Badge></Group>
              <Title order={4} id="pv-name">{preview.name}</Title>
              <Text size="sm">行き先: {preview.trip.destination}({preview.region.name})</Text>
              <Text size="sm">日程: {fmtRange(preview.trip.startDate, preview.trip.endDate)}</Text>
              <Text size="sm">幹事: {preview.organizerName}</Text>
              <HeadcountLine h={preview.headcount} />
              <Text size="xs" c="dimmed">非公開グループの確認では、タグ・説明・メンバー概要は表示しません。参加が成立するまで、メンバーの詳細や連絡先は表示されません。</Text>
            </Stack>
          </Card>
          <Card withBorder component="section" aria-labelledby="pv-apply">
            <Stack gap="sm">
              <Title order={4} id="pv-apply">参加の申請</Title>
              {done ? (
                <Alert color="green" role="status">{preview.name} に申請しました。幹事が承認すると、通知でお知らせします。</Alert>
              ) : preview.applyState.canApply ? (
                <>
                  <Text size="xs" c="dimmed">招待コードがあっても、幹事の承認で参加が成立します。実行が確定する前なら、辞退できます(不利益はありません)。</Text>
                  <JoinRequestPanel groupId={preview.id} groupName={preview.name} minMembers={preview.headcount.min}
                    applyState={preview.applyState} inviteCode={verified} onJoined={() => setDone(true)} />
                </>
              ) : (
                <Text size="sm">{(preview.applyState.reason && BLOCK[preview.applyState.reason]) ?? "現在は申請できません。"}</Text>
              )}
              <Group>
                <Button variant="default" size="xs" onClick={reset}>別のコードを入力</Button>
                <Button component={Link} href={`/${campaign}/groups`} variant="subtle" size="xs">一覧へ戻る</Button>
              </Group>
            </Stack>
          </Card>
        </Stack>
      )}
    </Stack>
  );
}
