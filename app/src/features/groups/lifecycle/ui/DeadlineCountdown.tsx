// LCY-UI-03(スタブ)。
import type { LifecycleView } from "../types";

export interface DeadlineCountdownProps {
  view: Pick<LifecycleView, "status" | "deadlineDate" | "withdrawalEndsAt" | "daysToDeadline" | "now">;
}

export function DeadlineCountdown({ view }: DeadlineCountdownProps) {
  return <span>{view.deadlineDate}</span>;
}
