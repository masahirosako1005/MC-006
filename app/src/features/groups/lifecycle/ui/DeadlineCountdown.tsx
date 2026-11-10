"use client";
// LCY-UI-03。締切までの日数・辞退期間の表示。
import { Text } from "@mantine/core";
import type { LifecycleView } from "../types";

export interface DeadlineCountdownProps {
  view: Pick<LifecycleView, "status" | "deadlineDate" | "withdrawalEndsAt" | "daysToDeadline" | "now">;
}

export function DeadlineCountdown({ view }: DeadlineCountdownProps) {
  if (view.status === "withdrawal_period" && view.withdrawalEndsAt) {
    return <Text size="sm">辞退期間: {view.withdrawalEndsAt.slice(5, 10)} まで</Text>;
  }
  if (view.daysToDeadline !== null) {
    return <Text size="sm">締切 {view.deadlineDate}({view.daysToDeadline === 0 ? "今日" : `あと ${view.daysToDeadline} 日`})</Text>;
  }
  return <Text size="sm">締切 {view.deadlineDate}</Text>;
}
