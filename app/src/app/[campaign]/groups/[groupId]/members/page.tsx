import { Suspense } from "react";
import { GroupDetailShell } from "@/features/groups/core/components/GroupDetailShell";

export default async function GroupMembersPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <GroupDetailShell groupId={groupId} fixedTab="members" />
    </Suspense>
  );
}
