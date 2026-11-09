"use client";
import Link from "next/link";
import { Badge, Card, Group, Stack, Text } from "@mantine/core";
import { fmtDate, fmtRange } from "./format";
import { GroupBadges } from "./GroupBadges";
import { HeadcountLine } from "./HeadcountLine";
import { MemberSummaryLabel } from "./MemberSummaryLabel";
import type { GroupSummary } from "../types";

export interface GroupCardProps { group: GroupSummary; campaign: string }

export function GroupCard({ group: g, campaign }: GroupCardProps) {
  const shown = g.tags.slice(0, 4);
  return (
    <Card withBorder padding="md" radius="md" component="article" aria-labelledby={`c-${g.id}`} pos="relative">
      <Stack gap={6}>
        <GroupBadges group={g} />
        <h3 id={`c-${g.id}`} style={{ margin: 0, fontSize: "1rem" }}>
          <Link href={`/${campaign}/groups/${g.id}`} style={{ color: "inherit", textDecoration: "none" }}>
            <span style={{ position: "absolute", inset: 0 }} aria-hidden="true" />
            {g.name}
          </Link>
        </h3>
        <Text size="sm" c="dimmed">{g.trip.destination}({g.region.name})/ {fmtRange(g.trip.startDate, g.trip.endDate)}</Text>
        <HeadcountLine h={g.headcount} />
        <Text size="xs" c="dimmed">
          締切 {fmtDate(g.deadlineDate)} / 幹事: {g.organizerName} / <MemberSummaryLabel summary={g.memberSummary} />
        </Text>
        {shown.length > 0 && (
          <Group gap={4} aria-label="タグ">
            {shown.map((t) => <Badge key={t} color="gray" variant="light" size="sm">{t}</Badge>)}
            {g.tags.length > shown.length && <Badge color="gray" variant="light" size="sm">+{g.tags.length - shown.length}</Badge>}
          </Group>
        )}
      </Stack>
    </Card>
  );
}
