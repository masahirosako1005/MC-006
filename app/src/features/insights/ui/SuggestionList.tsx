// INS-UI-09。
import { Stack, Text } from "@mantine/core";
import type { BusinessCategory, SuggestionCard } from "../types";
import { SuggestionCardView } from "./SuggestionCardView";

export interface SuggestionListProps { cards: SuggestionCard[]; ownCategory: BusinessCategory; minCount: number }
export function SuggestionList({ cards, ownCategory, minCount }: SuggestionListProps) {
  if (cards.length === 0) return <Text c="dimmed" size="sm">現在、提案できる内容はありません。</Text>;
  return (
    <Stack gap="sm">
      {cards.map((c, i) => <SuggestionCardView key={`${c.ruleId}-${i}`} card={c} index={i} ownCategory={ownCategory} minCount={minCount} />)}
    </Stack>
  );
}
