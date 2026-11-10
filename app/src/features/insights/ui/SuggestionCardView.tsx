// INS-UI-10。
import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import type { BusinessCategory, SuggestionCard } from "../types";
import { cellText } from "./cell";

export interface SuggestionCardViewProps { card: SuggestionCard; index: number; ownCategory: BusinessCategory; minCount: number }
export function SuggestionCardView({ card, index }: SuggestionCardViewProps) {
  return (
    <Card withBorder padding="md" data-testid="suggestion-card">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text fw={700}>提案 {index + 1}: {card.title}</Text>
          {card.reference && <Badge color="gray" variant="light">参考値</Badge>}
        </Group>
        <Group gap="xs">
          <Badge variant="light">{card.period.label}</Badge>
          <Badge variant="light" color="teal">{card.ageLabel}</Badge>
          <Badge variant="light" color="grape">{card.regionName}</Badge>
          <Text size="sm">見込み {cellText(card.expected)}</Text>
        </Group>
        <Stack gap={2}>
          {card.evidence.map((e, i) => (
            <Text size="sm" key={i}><Text span c="dimmed">{e.label}: </Text>{e.value}</Text>
          ))}
        </Stack>
        <Text size="sm" fw={600}>おすすめの対応: <Text span fw={400}>{card.action}</Text></Text>
      </Stack>
    </Card>
  );
}
