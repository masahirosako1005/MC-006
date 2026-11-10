"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Box } from "@mantine/core";
import { useGroupsApi } from "@/lib/groups-api";
import type { GroupDetailView } from "@/features/groups/types";
import type { PublicGroupDetail } from "@/features/groups/discovery/types";
import { PublicGroupDetailScreen } from "@/features/groups/discovery/ui/PublicGroupDetailScreen";
import { DemoBar } from "@/components/groups/common/DemoBar";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";

// 参加前詳細(P-3-4)。関係者(kind: "member")の表示は参加後ハブ(別タスク)で置き換える。
export default function GroupDetailPage() {
  const { campaign, groupId } = useParams<{ campaign: string; groupId: string }>();
  const { data, error, loading, reload } = useGroupsApi<PublicGroupDetail | GroupDetailView>(`/api/groups/${groupId}`);
  return (
    <>
      <DemoBar />
      <Box maw={1100} mx="auto" p="md">
        {loading && !data ? <LoadingBlock /> : error ? <ErrorNotice error={error} /> : data && data.kind === "public" ? (
          <PublicGroupDetailScreen campaign={campaign} group={data} onApply={() => { void reload(); }} />
        ) : data ? (
          <Alert color="blue">参加中のグループです。<Link href={`/${campaign}/groups`}>一覧へ戻る</Link></Alert>
        ) : null}
      </Box>
    </>
  );
}
