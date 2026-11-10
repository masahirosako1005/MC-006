"use client";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Alert, Anchor, Badge, Button, Card, Group, Stack, Tabs, Text, Title } from "@mantine/core";
import { useGroupsApi } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { GroupDetailView, MemberView } from "@/features/groups/types";
import type { PublicGroupDetail } from "@/features/groups/discovery/types";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { NotificationBell } from "@/features/notify/ui/NotificationBell";
import { PublicGroupDetailScreen } from "@/features/groups/discovery/ui/PublicGroupDetailScreen";
import { LifecyclePanel } from "@/features/groups/lifecycle/ui/LifecyclePanel";
import { WithdrawButton } from "@/features/groups/lifecycle/ui/WithdrawButton";
import { statusLabel } from "@/features/groups/lifecycle/messages";
import { PlanTab } from "@/features/groups/plan/ui/PlanTab";
import { ChatPanel } from "@/features/groups/chat/ui/ChatPanel";
import { ExpenseTab } from "@/features/groups/expense/ui/ExpenseTab";
import { RallyTab } from "@/features/groups/rally/ui/RallyTab";
import { GroupTripMap } from "@/features/groups/discovery/ui/GroupTripMap";
import type { PlanView } from "@/features/groups/plan/types";
import { MemberList } from "./MemberList";
import { InviteCodePanel } from "./InviteCodePanel";

const TABS = [
  { v: "overview", label: "概要" },
  { v: "plan", label: "旅程・集合場所" },
  { v: "chat", label: "チャット" },
  { v: "expense", label: "費用メモ" },
  { v: "rally", label: "スタンプラリー" },
  { v: "members", label: "メンバー" },
] as const;

export function GroupDetailShell({ groupId, fixedTab }: { groupId: Id; fixedTab?: string }) {
  const { campaign } = useParams<{ campaign: string }>();
  const router = useRouter();
  const sp = useSearchParams();
  const { data, error, loading, reload } = useGroupsApi<GroupDetailView | PublicGroupDetail>(`/api/groups/${groupId}`);
  const members = useGroupsApi<MemberView[] | { members: MemberView[] }>(data?.kind === "member" ? `/api/groups/${groupId}/members` : null);
  const base = `/${campaign}/groups/${groupId}`;

  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNotice error={error} />;
  if (!data) return null;
  if (data.kind === "public") {
    return <PublicGroupDetailScreen campaign={campaign} group={data} onApply={() => { void reload(); }} />;
  }

  const g = data.group;
  const qTab = sp.get("tab");
  const tab = fixedTab ?? (TABS.some((t) => t.v === qTab) ? qTab! : "overview");
  const isOrganizer = data.role === "organizer";
  const status = g.lifecycle.status;
  const memberList = Array.isArray(members.data) ? members.data : members.data?.members ?? [];
  const organizer = memberList.find((m) => m.role === "organizer");
  const canWithdraw = !isOrganizer && ["recruiting", "min_reached", "withdrawal_period", "confirmed"].includes(status);

  const go = (v: string | null) => {
    if (!v) return;
    router.push(v === "members" ? `${base}/members` : v === "overview" ? base : `${base}?tab=${v}`);
  };

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Anchor component={Link} href={`/${campaign}/groups`} size="sm">グループ一覧</Anchor>
        <NotificationBell base={`/${campaign}`} />
      </Group>
      <Card withBorder>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <div>
            <Title order={1} size="h3">{g.name}</Title>
            <Text size="sm" c="dimmed">
              {g.trip.destination} / {g.trip.startDate}〜{g.trip.endDate}
              {isOrganizer ? " / 幹事: あなた" : organizer ? ` / 幹事: ${organizer.displayName}` : ""}
            </Text>
          </div>
          <Badge variant="light" data-testid="status-badge">{statusLabel(status)}</Badge>
        </Group>
      </Card>

      <Tabs value={tab} onChange={go} keepMounted={false}>
        <Tabs.List style={{ flexWrap: "wrap" }}>
          {TABS.map((t) => <Tabs.Tab key={t.v} value={t.v}>{t.label}</Tabs.Tab>)}
        </Tabs.List>
      </Tabs>

      {tab === "overview" && (
        <Stack gap="md">
          <LifecyclePanel groupId={groupId} />
          {isOrganizer ? (
            <Card withBorder component="section" aria-labelledby="org-title">
              <Stack gap="xs">
                <Title order={2} size="h4" id="org-title">幹事の操作</Title>
                <Group>
                  <Button component={Link} href={`${base}/requests`} variant="filled">参加申請を確認する</Button>
                  {data.canEdit && <Button component={Link} href={`${base}/edit`} variant="light">グループ情報を編集</Button>}
                </Group>
              </Stack>
            </Card>
          ) : canWithdraw ? (
            <WithdrawButton groupId={groupId} phase={status} onDone={() => { void reload(); }} />
          ) : null}
          {isOrganizer && g.visibility === "private" && <InviteCodePanel groupId={groupId} />}
          <Card withBorder component="section" aria-labelledby="info-title">
            <Title order={2} size="h4" id="info-title" mb="xs">グループの情報</Title>
            <Stack gap={4}>
              <Text size="sm">行き先: {g.trip.destination}{g.trip.dateNote ? `(${g.trip.dateNote})` : ""}</Text>
              <Text size="sm">日程: {g.trip.startDate}〜{g.trip.endDate}</Text>
              <Text size="sm">締切: {g.lifecycle.deadlineDate}</Text>
              <Text size="sm">人数: 定員 {g.capacity} 人・最少 {g.lifecycle.minMembers} 人(現在 {data.activeCount} 人)</Text>
              <Text size="sm">公開範囲: {g.visibility === "public" ? "公開(一覧に表示)" : "非公開(招待コードで参加)"}</Text>
              <Text size="sm">タグ: {g.tags.length ? g.tags.join("、") : "なし"}</Text>
              <Text size="sm">説明: {g.description || "なし"}</Text>
            </Stack>
          </Card>
          <TripMapCard groupId={groupId} regionId={g.region} destination={g.trip.destination} />
          <MemberList groupId={groupId} compact />
          <Anchor component={Link} href={`${base}/members`} size="sm">メンバー一覧へ</Anchor>
        </Stack>
      )}
      {tab === "plan" && <PlanTab groupId={groupId} />}
      {tab === "chat" && <ChatPanel groupId={groupId} />}
      {tab === "expense" && <ExpenseTab groupId={groupId} />}
      {tab === "rally" && <RallyTab campaign={campaign} groupId={groupId} />}
      {tab === "members" && (
        <Stack>
          {canWithdraw && (
            <Alert color="yellow" title="抜ける操作">
              <WithdrawButton groupId={groupId} phase={status} onDone={() => { void reload(); }} />
            </Alert>
          )}
          <MemberList groupId={groupId} />
        </Stack>
      )}
    </Stack>
  );
}

/** 概要タブの旅行先地図。旅程(訪問先スポット・集合場所)があれば、それもピンにする。旅程の取得に失敗しても行き先のピンは出す。 */
function TripMapCard({ groupId, regionId, destination }: { groupId: Id; regionId: Id; destination: string }) {
  const plan = useGroupsApi<PlanView>(`/api/groups/${encodeURIComponent(groupId)}/plan`);
  const ids = [...(plan.data?.items ?? []).map((i) => i.spot?.id), plan.data?.meeting.spot?.id].filter((x): x is number => typeof x === "number");
  return <GroupTripMap groupId={groupId} regionId={regionId} destination={destination} visitSpotIds={[...new Set(ids)]} />;
}
