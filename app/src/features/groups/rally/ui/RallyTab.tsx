"use client";
// 08: ラリータブ(RLY-UI)。合言葉入力 → グループ進捗・個人特典。
import { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, Group, List, Progress, Stack, Text, TextInput, Title } from "@mantine/core";
import { ApiError, gpost, useGroupsApi } from "@/lib/groups-api";
import type { AcquireResultDto, RallyProgressDto } from "../types";
import { UNAVAILABLE_MESSAGES } from "../messages";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

export function RallyTab({ campaign, groupId }: { campaign: string; groupId: string }) {
  const r = useGroupsApi<RallyProgressDto>(`/api/groups/${groupId}/rally`);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (r.loading && !r.data) return <LoadingBlock />;
  if (r.error) return <ErrorNotice error={r.error} onRetry={() => void r.reload()} />;
  const d = r.data;
  if (!d) return null;
  const { access } = d;

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await gpost<AcquireResultDto>(`/api/groups/${groupId}/stamps`, { keyword: code.trim() });
      const extra = res.newlyReached.length ? ` 特典「${res.newlyReached.map((x) => x.name).join("・")}」に到達しました。` : "";
      setMsg({ ok: true, text: `「${res.spot.name}」のスタンプを取得しました(${res.acquiredCount}/${d!.totalSpots})。${extra}` });
      setCode("");
      await r.reload();
    } catch (e) {
      setMsg({ ok: false, text: e instanceof ApiError ? e.message : "取得できませんでした" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Stack gap="md" data-testid="rally-tab">
      <Card withBorder>
        <Group justify="space-between" mb="xs">
          <Title order={4}>グループの進捗</Title>
          <Badge>{d.acquiredCount} / {d.totalSpots} 取得({d.achievementRate}%)</Badge>
        </Group>
        <Progress value={d.achievementRate} aria-label="達成率" />
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">合言葉を入力してスタンプを取得</Title>
        {access.canCollectStamps ? (
          <Group align="flex-end">
            <TextInput label="スポットの合言葉" value={code} onChange={(e) => setCode(e.currentTarget.value)} style={{ flex: 1 }} />
            <Button onClick={submit} loading={busy} disabled={code.trim() === ""}>スタンプを押す</Button>
          </Group>
        ) : (
          <Alert color="gray">{access.stampReason ? UNAVAILABLE_MESSAGES[access.stampReason] : "現在はスタンプを押せません。"}</Alert>
        )}
        {msg && <Alert mt="sm" color={msg.ok ? "green" : "red"} role="status">{msg.text}</Alert>}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">スポット</Title>
        <List spacing="xs" listStyleType="none">
          {d.spots.map((s) => (
            <List.Item key={s.spotId}>
              <Group gap="xs" wrap="nowrap">
                <Badge color={s.acquired ? "green" : "gray"} variant={s.acquired ? "filled" : "light"}>{s.acquired ? "取得済み" : "未取得"}</Badge>
                <div>
                  <Text fw={600} size="sm">{s.name}({s.stampName})</Text>
                  <Text size="xs" c="dimmed">
                    {s.area}{s.acquired && s.acquiredBy ? ` / ${s.acquiredBy.displayName}${s.acquiredBy.isMe ? "(自分)" : ""}が取得` : ""}
                  </Text>
                </div>
              </Group>
            </List.Item>
          ))}
        </List>
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">グループの特典の到達状況</Title>
        <List spacing="xs" listStyleType="none">
          {d.rewards.map((w) => (
            <List.Item key={w.rewardId}>
              <Group gap="xs">
                <Badge color={w.reached ? "green" : "gray"}>{w.reached ? "到達" : `あと ${Math.max(0, w.requiredStamps - d.acquiredCount)} 個`}</Badge>
                <Text size="sm">{w.name}({w.requiredStamps} 個)- {w.prize}</Text>
              </Group>
            </List.Item>
          ))}
        </List>
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">自分の獲得特典</Title>
        {d.myRewards.length === 0 ? <Text size="sm" c="dimmed">まだ獲得した特典はありません。</Text> : (
          <List spacing="xs">
            {d.myRewards.map((m) => <List.Item key={m.rewardId}>{m.name} - {m.prize}{m.fromThisGroup ? "" : `(${m.groupName})`}</List.Item>)}
          </List>
        )}
      </Card>

      <Card withBorder>
        <Title order={4} mb="xs">メンバー別の取得数</Title>
        <List spacing="xs">
          {d.members.map((m, i) => <List.Item key={i}>{m.displayName}{m.isMe ? "(自分)" : ""}: {m.count} 個</List.Item>)}
        </List>
      </Card>

      {access.canReviewRead && (
        <Button component={Link} href={`/${campaign}/groups/${groupId}/review`} variant="light">振り返りへ</Button>
      )}
    </Stack>
  );
}
