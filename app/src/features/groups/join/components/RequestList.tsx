"use client";
// JOIN-UI-03(スタブ)。幹事の承認画面。
import type { Id } from "@/lib/groups-types";

export interface RequestListProps { groupId: Id }

export function RequestList({ groupId }: RequestListProps) {
  return <div data-group-id={groupId} />;
}
