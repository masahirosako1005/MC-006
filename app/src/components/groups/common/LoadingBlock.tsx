"use client";
import { Skeleton, Stack } from "@mantine/core";

export function LoadingBlock({ lines = 3, label = "読み込み中" }: { lines?: number; label?: string }) {
  return (
    <Stack gap="xs" aria-busy="true" aria-label={label} role="status">
      {Array.from({ length: lines }, (_, i) => <Skeleton key={i} height={16} width={i === lines - 1 ? "60%" : "100%"} />)}
    </Stack>
  );
}
