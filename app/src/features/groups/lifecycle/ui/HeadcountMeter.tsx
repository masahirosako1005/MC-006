"use client";
// LCY-UI-02。人数メーター。
import { Progress, Text } from "@mantine/core";

export interface HeadcountMeterProps { minMembers: number; capacity: number; currentCount: number }

export function HeadcountMeter({ minMembers, capacity, currentCount }: HeadcountMeterProps) {
  const pct = capacity > 0 ? Math.min(100, (currentCount / capacity) * 100) : 0;
  const reached = currentCount >= minMembers;
  return (
    <div>
      <Text size="sm">現在 {currentCount} 人 / 最少 {minMembers} 人 / 定員 {capacity} 人</Text>
      <Progress value={pct} color={reached ? "green" : "blue"} mt={4} aria-label={`参加 ${currentCount} 人(最少 ${minMembers} 人、定員 ${capacity} 人)`} />
      <Text size="xs" c="dimmed" mt={2}>{reached ? "最少人数に達しています" : `あと ${minMembers - currentCount} 人で最少人数`}</Text>
    </div>
  );
}
