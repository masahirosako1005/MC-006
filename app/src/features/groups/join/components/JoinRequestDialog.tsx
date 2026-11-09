"use client";
// JOIN-UI-02(スタブ)。
import type { Id } from "@/lib/groups-types";
import type { JoinRequestView } from "../types";

export interface JoinRequestDialogProps {
  opened: boolean;
  onClose: () => void;
  groupId: Id;
  consentText: string;
  consentedMinMembers: number;
  inviteCode?: string;
  onSubmitted: (r: JoinRequestView) => void;
}

export function JoinRequestDialog({ groupId }: JoinRequestDialogProps) {
  return <div data-group-id={groupId} />;
}
