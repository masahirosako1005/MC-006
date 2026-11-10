// MUN-UI-05。
import { Card, Skeleton, Text } from "@mantine/core";
import type { CountCell, RateCell } from "../types";
import { CellText } from "./CellText";

export interface MetricCardProps {
  title: string; cell: CountCell | RateCell; unit?: string; hint: string; minCount: number; loading?: boolean;
}

export function MetricCard({ title, cell, unit, hint, minCount, loading }: MetricCardProps) {
  return (
    <Card withBorder radius="md" p="sm">
      <Text size="xs" c="dimmed">{title}</Text>
      {loading ? <Skeleton h={28} mt={4} /> : <Text fw={700} fz="xl"><CellText cell={cell} unit={unit} minCount={minCount} /></Text>}
      <Text size="xs" c="dimmed">{hint}</Text>
    </Card>
  );
}
