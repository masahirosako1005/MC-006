"use client";
import Link from "next/link";
import { Badge, Card, Group, Progress, Stack, Text } from "@mantine/core";
import { GroupStatusBadge } from "@/features/groups/lifecycle/ui/GroupStatusBadge";
import { fmtRange } from "./format";
import type { GroupSummary } from "../types";

export interface GroupCardProps { group: GroupSummary; campaign: string }

export function GroupCard({ group: g, campaign }: GroupCardProps) {
  const h = g.headcount;
  return (
    <Card withBorder padding="sm" radius="md" component="article" aria-labelledby={`c-${g.id}`} pos="relative">
      <Stack gap={4}>
        <Group gap={4} wrap="wrap" style={{ whiteSpace: "nowrap" }}>
          <span style={{ flexShrink: 0 }}><GroupStatusBadge status={g.status} full={g.flags.full} size="sm" /></span>
          {g.flags.full && <Badge color="red" variant="outline" size="sm" style={{ flexShrink: 0 }}>満員</Badge>}
        </Group>
        <h3 id={`c-${g.id}`} style={{ margin: 0, fontSize: "0.95rem", lineHeight: 1.3 }}>
          <Link href={`/${campaign}/groups/${g.id}`} style={{ color: "inherit", textDecoration: "none", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            <span style={{ position: "absolute", inset: 0 }} aria-hidden="true" />
            {g.name}
          </Link>
        </h3>
        <Text size="xs" c="dimmed" lineClamp={3}>{g.description}</Text>
        <Progress value={(h.current / h.capacity) * 100} color={h.reachedMin ? "teal" : "blue"} size={6}
          aria-label={`参加人数 定員${h.capacity}人中${h.current}人`} />
        <Text size="xs">{h.current}/{h.capacity} 人<br />(最少 {h.min} 人)</Text>
        <Text size="xs" c="dimmed">{fmtRange(g.trip.startDate, g.trip.endDate)}</Text>
      </Stack>
    </Card>
  );
}
