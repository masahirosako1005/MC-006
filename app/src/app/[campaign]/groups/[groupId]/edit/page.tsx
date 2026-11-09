"use client";
import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGroupsApi } from "@/lib/groups-api";
import type { GroupDetailView } from "@/features/groups/types";
import { GroupForm } from "@/features/groups/core/components/GroupForm";
import { groupToFormValues } from "@/features/groups/core/components/formValues";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

export default function EditGroupPage() {
  const { campaign, groupId } = useParams<{ campaign: string; groupId: string }>();
  const router = useRouter();
  const { data, error, loading } = useGroupsApi<GroupDetailView>(`/api/groups/${groupId}`);
  const initial = useMemo(() => (data && data.kind === "member" ? groupToFormValues(data.group) : undefined), [data]);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNotice error={error} />;
  if (!initial) return <ErrorNotice error={new Error("編集できるグループが見つかりません")} />;
  return <GroupForm mode="edit" campaign={campaign} groupId={groupId} initial={initial} onDone={(id) => router.push(`/${campaign}/groups/${id}`)} />;
}
