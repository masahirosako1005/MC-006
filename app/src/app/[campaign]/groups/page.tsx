import { Suspense } from "react";
import { GroupListScreen } from "@/features/groups/discovery/ui/GroupListScreen";

export default async function GroupsPage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  return (
    <Suspense fallback={<div aria-busy="true" />}>
      <GroupListScreen campaign={campaign} />
    </Suspense>
  );
}
