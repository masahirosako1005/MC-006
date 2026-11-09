// LCY-UI-01(スタブ。P-3-6 で StatusBadge kind="group" に置き換える)。
import type { GroupStatus } from "../types";
import { statusLabel } from "../messages";

export interface GroupStatusBadgeProps { status: GroupStatus; full?: boolean; size?: "sm" | "md" }

export function GroupStatusBadge({ status, full }: GroupStatusBadgeProps) {
  return <span>{statusLabel(status)}{full ? "(満員)" : ""}</span>;
}
