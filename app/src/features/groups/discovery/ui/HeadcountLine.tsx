"use client";
import { Group, Progress, Text } from "@mantine/core";
import type { HeadcountView } from "../types";

export function HeadcountLine({ h }: { h: HeadcountView }) {
  const note = h.isFull ? "満員のため申請できません" : h.shortfall > 0 ? `あと${h.shortfall}人で実行` : h.reachedMin ? "最少人数に達しました(確定前)" : "";
  return (
    <div>
      <Group gap="xs" justify="space-between" wrap="wrap">
        <Text size="sm">最少{h.min}人 / 定員{h.capacity}人 / 現在{h.current}人 / 空き{h.vacancy}人</Text>
        {note && <Text size="sm">{note}</Text>}
      </Group>
      <Progress value={(h.current / h.capacity) * 100} color={h.reachedMin ? "teal" : "blue"} size="sm" mt={4}
        aria-label={`参加人数 定員${h.capacity}人中${h.current}人`} />
    </div>
  );
}
