"use client";
// LCY-UI-04(スタブ)。
import type { Id } from "@/lib/groups-types";

export interface LifecyclePanelProps { groupId: Id }

export function LifecyclePanel({ groupId }: LifecyclePanelProps) {
  return <div data-group-id={groupId} />;
}
