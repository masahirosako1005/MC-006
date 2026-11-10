"use client";
// LCY-UI-04。状態ごとの案内・メーター・中止/再企画の表示。
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Anchor, Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useGroupsApi } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import type { LifecycleView } from "../types";
import { ORGANIZER_CANCEL_REASON_LABEL } from "../messages";
import { GroupStatusBadge } from "./GroupStatusBadge";
import { HeadcountMeter } from "./HeadcountMeter";
import { DeadlineCountdown } from "./DeadlineCountdown";
import { OrganizerActions } from "./OrganizerActions";

export interface LifecyclePanelProps { groupId: Id }

function guide(v: LifecycleView): { color: string; title: string; body: string } | null {
  switch (v.status) {
    case "recruiting": return { color: "blue", title: "参加者を募集しています", body: `締切までに最少人数(${v.minMembers} 人)に達すると、辞退期間に進みます。` };
    case "min_reached": return { color: "teal", title: "最少人数に達しました", body: "締切まで募集を続けます。締切の翌日から辞退期間に入ります。" };
    case "withdrawal_period": return { color: "orange", title: "辞退期間中です", body: "辞退する場合は期間内に操作してください。ペナルティはありません。期間が終わると、最少人数以上が残っていれば実行確定になります。" };
    case "confirmed": return { color: "green", title: "実行が確定しました", body: "旅程やチャットで準備を進めてください。" };
    case "in_progress": return { color: "cyan", title: "実施中です", body: "スタンプラリーや費用メモを活用してください。" };
    case "completed": return { color: "gray", title: "完了しました", body: "旅程・チャット・費用メモは閲覧のみで残ります。" };
    default: return null;
  }
}

export function LifecyclePanel({ groupId }: LifecyclePanelProps) {
  const { campaign } = useParams<{ campaign: string }>();
  const { data: v, error, loading, reload } = useGroupsApi<LifecycleView>(`/api/groups/${groupId}/lifecycle`);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNotice error={error} />;
  if (!v) return null;
  const base = `/${campaign}/groups`;
  const g = guide(v);
  const c = v.capabilities;
  const isOrg = c.canOrganizerCancel || c.canReplan || c.canChangeConditions;
  return (
    <Card withBorder component="section" aria-labelledby="lcy-title" data-testid="lifecycle-panel">
      <Stack gap="sm">
        <Group justify="space-between">
          <Title order={2} size="h4" id="lcy-title">グループの状態</Title>
          <GroupStatusBadge status={v.status} />
        </Group>
        {g && <Alert color={g.color} variant="light" title={g.title}>{g.body}</Alert>}
        {v.status === "cancelled" && (
          <Alert color="red" variant="light" title="このグループは中止になりました">
            <Stack gap={4}>
              <Text size="sm">理由: {v.cancelReasonLabel ?? "—"}{v.organizerCancelReason ? `(${ORGANIZER_CANCEL_REASON_LABEL[v.organizerCancelReason]})` : ""}</Text>
              <Text size="sm">幹事が日程などを見直して再企画すると、通知でお知らせします。旅程・チャット・費用メモは閲覧のみで残ります。</Text>
              <Anchor component={Link} href={base} size="sm">ほかのグループを探す</Anchor>
            </Stack>
          </Alert>
        )}
        {v.status === "replanned" && (
          <Alert color="grape" variant="light" title="再企画されました">
            <Stack gap={4}>
              <Text size="sm">このグループは中止の後、再企画されました。理由: {v.cancelReasonLabel ?? "—"}</Text>
              {v.replannedToGroupId && <Button component={Link} href={`${base}/${v.replannedToGroupId}`} size="xs" variant="light" w="fit-content">再企画先のグループを見る</Button>}
            </Stack>
          </Alert>
        )}
        {v.replanOfGroupId && <Text size="xs" c="dimmed">このグループは中止したグループの再企画です。</Text>}
        <HeadcountMeter minMembers={v.minMembers} capacity={v.capacity} currentCount={v.currentCount} />
        <DeadlineCountdown view={v} />
        {isOrg && <OrganizerActions groupId={groupId} view={v} onChanged={() => { void reload(); }} />}
      </Stack>
    </Card>
  );
}
