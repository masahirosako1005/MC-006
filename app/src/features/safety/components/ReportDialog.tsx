"use client";
// 09: 通報ダイアログ。スタブ(P-3-11 で本体に置き換える)。
import type { Id } from "@/lib/groups-types";
import type { ReportTargetType } from "../types";

export interface ReportDialogProps {
  opened: boolean;
  onClose(): void;
  target: { type: ReportTargetType; id: string; label: string; groupId?: Id };
  allowBlock?: boolean;
}

export function ReportDialog(props: ReportDialogProps) {
  void props;
  return null;
}
