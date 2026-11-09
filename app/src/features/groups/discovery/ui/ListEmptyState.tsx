"use client";
import Link from "next/link";
import { Button, Group, Stack, Text } from "@mantine/core";
import type { GroupListFilter, RelaxSuggestion } from "../types";

export interface ListEmptyStateProps {
  filter: GroupListFilter; suggestions: RelaxSuggestion[]; onApplySuggestion(s: RelaxSuggestion): void; campaign: string;
}

export function hasConditions(f: GroupListFilter): boolean {
  return !!(f.region || f.dateFrom || f.dateTo || f.vacancy !== undefined || f.tags.length || f.q || f.ageBuckets.length || f.official);
}

export function ListEmptyState({ filter, suggestions, onApplySuggestion, campaign }: ListEmptyStateProps) {
  const cond = hasConditions(filter);
  return (
    <Stack gap="sm" align="flex-start">
      <Text fw={700}>{cond ? "条件に合うグループが見つかりませんでした" : "公開中のグループはまだありません"}</Text>
      {cond && suggestions.length > 0 && (
        <Group gap="xs">
          {suggestions.map((s) => (
            <Button key={s.kind} variant="default" size="sm" onClick={() => onApplySuggestion(s)}>{s.label}({s.resultCount}件)</Button>
          ))}
        </Group>
      )}
      <Button component={Link} href={`/${campaign}/new-group`} size="sm">{cond ? "自分でグループを作る" : "グループを作る"}</Button>
    </Stack>
  );
}
