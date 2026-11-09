"use client";
import { Button, Stack, Text } from "@mantine/core";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import type { ApiError } from "@/lib/groups-api";

export function ListErrorState({ error, onRetry }: { error: ApiError; onRetry(): void }) {
  return (
    <Stack gap="sm" align="flex-start">
      <Text fw={700}>読み込めませんでした</Text>
      <ErrorNotice error={error} />
      <Button variant="default" onClick={onRetry}>もう一度試す</Button>
    </Stack>
  );
}
