"use client";
import { Badge } from "@mantine/core";

const COLORS: Record<string, Record<string, string>> = {
  group: { recruiting: "blue", min_reached: "teal", withdrawal_period: "yellow", confirmed: "green", in_progress: "cyan", completed: "gray", cancelled: "red", replanned: "grape" },
  joinRequest: { pending: "blue", approved: "green", rejected: "gray", withdrawn: "gray", expired: "gray" },
};

export function StatusBadge({ kind, value, label, size = "md" }: { kind: "group" | "joinRequest"; value: string; label: string; size?: "sm" | "md" }) {
  return <Badge color={COLORS[kind]?.[value] ?? "gray"} variant="light" size={size}>{label}</Badge>;
}
