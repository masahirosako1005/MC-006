"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Anchor, Stack, Title } from "@mantine/core";
import { RequestList } from "@/features/groups/join/components/RequestList";

export default function RequestsPage() {
  const { campaign, groupId } = useParams<{ campaign: string; groupId: string }>();
  return (
    <Stack gap="md">
      <Anchor component={Link} href={`/${campaign}/groups/${groupId}`} size="sm">グループ詳細へ戻る</Anchor>
      <Title order={2}>参加申請の承認</Title>
      <RequestList groupId={groupId} />
    </Stack>
  );
}
