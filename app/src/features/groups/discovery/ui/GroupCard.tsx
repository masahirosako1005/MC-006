"use client";
import Link from "next/link";
import { Card, Group, Progress, Stack, Text } from "@mantine/core";
import { GroupStatusBadge } from "@/features/groups/lifecycle/ui/GroupStatusBadge";
import { fmtRange } from "./format";
import type { GroupSummary } from "../types";

export interface GroupCardProps { group: GroupSummary; campaign: string }

export function GroupCard({ group: g, campaign }: GroupCardProps) {
  const h = g.headcount;
  return (
    <Card withBorder padding="sm" radius="md" component="article" aria-labelledby={`c-${g.id}`} pos="relative">
      <Stack gap={4}>
        <Group gap="xs" wrap="nowrap" justify="space-between" align="flex-start">
          <h3 id={`c-${g.id}`} style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.3, minWidth: 0 }}>
            <Link href={`/${campaign}/groups/${g.id}`} style={{ color: "inherit", textDecoration: "none" }}>
              <span style={{ position: "absolute", inset: 0 }} aria-hidden="true" />
              {g.name}
            </Link>
          </h3>
          <GroupStatusBadge status={g.status} full={g.flags.full} size="sm" />
        </Group>
        <Text size="xs" c="dimmed" lineClamp={2}>{g.description}</Text>
        <Progress value={(h.current / h.capacity) * 100} color={h.reachedMin ? "teal" : "blue"} size={6}
          aria-label={`参加人数 定員${h.capacity}人中${h.current}人`} />
        <Text size="xs">{h.current}/{h.capacity} 人(最少 {h.min} 人)</Text>
        <Text size="xs" c="dimmed">{fmtRange(g.trip.startDate, g.trip.endDate)}</Text>
      </Stack>
    </Card>
  );
}
