"use client";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { Alert, Card, Stack, Text } from "@mantine/core";
import { gpost, useGroupsApi } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { ReplanDraft, ReplanResult } from "@/features/groups/lifecycle/types";
import { GroupForm } from "@/features/groups/core/components/GroupForm";
import type { GroupFormValues } from "@/features/groups/core/components/formValues";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

export default function ReplanPage() {
  const { campaign, groupId } = useParams<{ campaign: string; groupId: string }>();
  const router = useRouter();
  const { data: d, error, loading } = useGroupsApi<ReplanDraft>(`/api/groups/${groupId}/replan-draft`);
  const initial = useMemo<GroupFormValues | undefined>(() => d ? ({
    name: d.carried.name, region: d.carried.region, destination: d.carried.destination,
    startDate: null, endDate: null, dateNote: "", capacity: d.carried.capacity, minMembers: d.carried.minMembers,
    deadlineDate: null, visibility: d.carried.visibility, tags: d.carried.tags, description: "",
  }) : undefined, [d]);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNotice error={error} />;
  if (!d || !initial) return null;

  const submit = async (v: GroupFormValues): Promise<{ groupId: Id }> => {
    const r = await gpost<ReplanResult>(`/api/groups/${groupId}/replan`, {
      name: v.name.trim(), destination: v.destination.trim(), minMembers: v.minMembers,
      startDate: v.startDate ?? "", endDate: v.endDate ?? "", deadlineDate: v.deadlineDate ?? "",
    });
    return { groupId: r.groupId };
  };

  return (
    <Stack gap="md" p="md">
      <Alert color="blue" variant="light" title="中止したグループの内容を引き継いで、新しいグループを作ります">
        日程と締切は新しく入力してください。作成すると、前回の参加者 {d.recipientCount} 人に案内します。旅程・チャット・費用メモは引き継ぎません。
      </Alert>
      <Card withBorder>
        <Text fw={600} size="sm">前回の内容(参考)</Text>
        <Text size="sm">日程 {d.originalTrip.startDate}〜{d.originalTrip.endDate} / 締切 {d.originalTrip.deadlineDate}</Text>
        <Text size="sm">人数 定員 {d.carried.capacity}・最少 {d.carried.minMembers}</Text>
      </Card>
      <GroupForm mode="replan" campaign={campaign} groupId={groupId} initial={initial} onSubmit={submit}
        onDone={(id) => router.push(`/${campaign}/groups/${id}`)} />
    </Stack>
  );
}
