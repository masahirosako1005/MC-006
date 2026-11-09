"use client";
// LCY-UI-06(スタブ)。
import type { Id } from "@/lib/groups-types";
import type { LifecycleView } from "../types";

export interface OrganizerActionsProps { groupId: Id; view: LifecycleView }

export function OrganizerActions({ groupId }: OrganizerActionsProps) {
  return <div data-group-id={groupId} />;
}
