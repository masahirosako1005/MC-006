// MUN-UI-09。
import { Card, Stack, Text } from "@mantine/core";
import type { LabeledCell } from "../types";
import { CellText } from "./CellText";

export interface BarListProps { title: string; items: LabeledCell[]; unit: string; minCount: number; note?: string }

export function BarList({ title, items, unit, minCount, note }: BarListProps) {
  const max = Math.max(1, ...items.map((i) => (i.cell.few ? 0 : i.cell.value)));
  return (
    <Card withBorder radius="md" p="sm">
      <Text fw={700} mb={6}>{title}</Text>
      <Stack gap={6}>
        {items.map((i) => (
          <div key={i.key} style={{ display: "grid", gridTemplateColumns: "8em 1fr 5em", gap: 8, alignItems: "center" }}>
            <Text size="sm">{i.label}</Text>
            <div style={{ background: "var(--mantine-color-gray-2)", height: 12, borderRadius: 4 }}>
              <div style={{ width: i.cell.few ? "8%" : `${(i.cell.value / max) * 100}%`, height: "100%", borderRadius: 4,
                background: i.cell.few ? "repeating-linear-gradient(45deg,#adb5bd 0 2px,#f1f3f5 2px 6px)" : "var(--mantine-color-blue-6)" }} />
            </div>
            <Text size="sm" ta="right"><CellText cell={i.cell} unit={unit} minCount={minCount} /></Text>
          </div>
        ))}
        {items.length === 0 && <Text size="sm" c="dimmed">データがありません</Text>}
      </Stack>
      {note && <Text size="xs" c="dimmed" mt={6}>{note}</Text>}
    </Card>
  );
}
