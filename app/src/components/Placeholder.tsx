import { Stack, Text } from "@mantine/core";

/** 本番に存在するが、ローカル版では未実装（または本文が未確認）の画面。 */
export function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <Stack p="md" gap="xs">
      <Text fw={700}>{title}</Text>
      <Text size="sm" c="dimmed">{note}</Text>
    </Stack>
  );
}
