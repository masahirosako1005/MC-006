"use client";
import Link from "next/link";
import { Alert, Badge, Box, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { JoinRequestPanel } from "@/features/groups/join/components/JoinRequestPanel";
import type { PublicGroupDetail } from "../types";
import { fmtDate, fmtRange } from "./format";
import { GroupBadges } from "./GroupBadges";
import { HeadcountLine } from "./HeadcountLine";
import { MemberSummaryLabel } from "./MemberSummaryLabel";

export interface PublicGroupDetailScreenProps { campaign: string; group: PublicGroupDetail; onApply(): void }

const BLOCK_REASON: Record<string, string> = {
  full: "満員です。ほかのグループを探してください。",
  closed: "受付は終了しました。",
  cancelled: "このグループは中止されました。",
  finished: "このグループは終了しました。",
  already_member: "すでに参加しています。",
  already_requested: "申請中です。幹事の承認を待っています。",
};

export function PublicGroupDetailScreen({ campaign, group: g, onApply }: PublicGroupDetailScreenProps) {
  const h = g.headcount;
  const reason = g.applyState.reason;
  const panel = (
    <JoinRequestPanel groupId={g.id} groupName={g.name} minMembers={h.min} applyState={g.applyState} onJoined={onApply} />
  );
  return (
    <Stack gap="md">
      <Stack gap={6} component="section" aria-labelledby="g-name">
        <GroupBadges group={g} />
        <Title order={2} id="g-name">{g.name}</Title>
        <Text size="sm" c="dimmed">{g.trip.destination}({g.region.name})/ {fmtRange(g.trip.startDate, g.trip.endDate)}</Text>
      </Stack>
      <Card withBorder padding="sm" role="status">
        <Group justify="space-between">
          <Text fw={700}>{h.shortfall > 0 ? `最少${h.min}人まであと${h.shortfall}人` : h.isFull ? "満員です" : "最少人数に達しました"}</Text>
          <Text size="sm">締切 {fmtDate(g.deadlineDate)}</Text>
        </Group>
        <Text size="xs" mt={4}>締切までに最少人数に達すると、辞退期間を経て実行が確定します。達しない場合は自動で中止になります。</Text>
      </Card>
      {g.status === "cancelled" && <Alert color="gray">{g.cancelKind === "organizer" ? "幹事により中止されました。" : "最少人数に達しなかったため中止されました。"}</Alert>}
      {g.replannedToGroupId && (
        <Alert color="blue">このグループは再企画されました。<Link href={`/${campaign}/groups/${g.replannedToGroupId}`}>新しいグループへ</Link></Alert>
      )}
      <Box style={{ display: "grid", gap: "var(--mantine-spacing-md)", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", alignItems: "start" }}>
        <Stack gap="md">
          <Card withBorder component="section" aria-labelledby="sec-plan">
            <Stack gap="xs">
              <Title order={3} id="sec-plan" size="h4">プラン</Title>
              <Text size="sm">行き先: {g.trip.destination}</Text>
              <Text size="sm">地方: {g.region.name}</Text>
              <Text size="sm">日程: {fmtRange(g.trip.startDate, g.trip.endDate)}</Text>
              <Group gap={4} aria-label="タグ">
                {g.tags.map((t) => <Badge key={t} color="gray" variant="light" size="sm">{t}</Badge>)}
              </Group>
              <Title order={4} size="sm">説明</Title>
              <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>{g.description}</Text>
            </Stack>
          </Card>
          <Card withBorder component="section" aria-labelledby="sec-count">
            <Stack gap="xs">
              <Title order={3} id="sec-count" size="h4">人数</Title>
              <HeadcountLine h={h} />
            </Stack>
          </Card>
          <Card withBorder component="section" aria-labelledby="sec-members">
            <Stack gap="xs">
              <Title order={3} id="sec-members" size="h4">メンバー</Title>
              <Text size="sm"><b>{g.organizer.displayName}</b>(幹事){g.organizer.ageBand ? ` / ${g.organizer.ageBand}` : ""}</Text>
              <Text size="sm"><MemberSummaryLabel summary={g.memberSummary} /></Text>
              <Alert color="blue" variant="light">参加が成立するまで、メンバーの詳細や連絡先は表示されません。</Alert>
            </Stack>
          </Card>
        </Stack>
        <Card withBorder component="aside" aria-labelledby="sec-apply">
          <Stack gap="sm">
            <Title order={3} id="sec-apply" size="h4">参加の申請</Title>
            {g.applyState.canApply ? panel : (
              <>
                <Button disabled fullWidth>参加を申請する</Button>
                <Text size="sm">{reason ? BLOCK_REASON[reason] : "現在は申請できません。"}</Text>
                {reason === "already_requested" && panel}
              </>
            )}
            <Group justify="space-between">
              <Button component={Link} href={`/${campaign}/groups`} variant="subtle" size="xs">一覧へ戻る</Button>
            </Group>
          </Stack>
        </Card>
      </Box>
    </Stack>
  );
}
