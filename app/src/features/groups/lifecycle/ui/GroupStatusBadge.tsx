"use client";
// LCY-UI-01。状態の色分けバッジ(満員は GroupBadges 側で別バッジ表示)。
import { Badge } from "@mantine/core";
import type { GroupStatus } from "../types";
import { statusLabel } from "../messages";

export interface GroupStatusBadgeProps { status: GroupStatus; full?: boolean; size?: "sm" | "md" }

const COLOR: Record<GroupStatus, string> = {
  recruiting: "blue", min_reached: "teal", withdrawal_period: "orange", confirmed: "green",
  in_progress: "cyan", completed: "gray", cancelled: "red", replanned: "grape",
};

export function GroupStatusBadge({ status, size }: GroupStatusBadgeProps) {
  return <Badge color={COLOR[status]} variant="light" size={size ?? "md"} data-status={status}>{statusLabel(status)}</Badge>;
}
