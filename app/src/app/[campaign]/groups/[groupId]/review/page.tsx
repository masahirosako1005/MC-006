"use client";
import { useParams } from "next/navigation";
import { ReviewView } from "@/features/groups/rally/ui/ReviewView";

export default function ReviewPage() {
  const { campaign, groupId } = useParams<{ campaign: string; groupId: string }>();
  return <ReviewView campaign={campaign} groupId={groupId} />;
}
