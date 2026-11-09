"use client";
// LCY-UI-05(スタブ)。
import type { Id } from "@/lib/groups-types";
import type { GroupStatus } from "../types";

export interface WithdrawButtonProps { groupId: Id; phase: GroupStatus; onDone: () => void }

export function WithdrawButton({ groupId }: WithdrawButtonProps) {
  return <div data-group-id={groupId} />;
}
