"use client";
import { useParams, useRouter } from "next/navigation";
import { GroupForm } from "@/features/groups/core/components/GroupForm";

export default function NewGroupPage() {
  const { campaign } = useParams<{ campaign: string }>();
  const router = useRouter();
  return <GroupForm mode="create" campaign={campaign} onDone={(id) => router.push(`/${campaign}/groups/${id}`)} />;
}
