"use client";
// JOIN-UI-01(スタブ。P-3-5 で本体に置き換える)。
import type { Id } from "@/lib/groups-types";

export interface JoinRequestPanelProps {
  groupId: Id;
  groupName: string;
  minMembers: number;
  applyState: { canApply: boolean; reason?: string };
  inviteCode?: string;
  onJoined?: () => void;
}

export function JoinRequestPanel({ groupId }: JoinRequestPanelProps) {
  return <div data-group-id={groupId} />;
}
