"use client";
import { Badge, Group, Text } from "@mantine/core";
import { GroupStatusBadge } from "@/features/groups/lifecycle/ui/GroupStatusBadge";
import type { GroupSummary } from "../types";

const REL: Record<string, string> = { organizer: "幹事", member: "参加中", requested: "申請中" };

export function GroupBadges({ group }: { group: GroupSummary }) {
  return (
    <Group gap={6} wrap="wrap">
      <GroupStatusBadge status={group.status} full={group.flags.full} size="sm" />
      {group.flags.full && <Badge color="yellow" variant="light" size="sm">満員</Badge>}
      {group.badge && (
        <>
          <Badge color="grape" variant="light" size="sm">{group.badge.badgeLabel}</Badge>
          <Text size="xs" c="dimmed">提供: {group.badge.sponsorName}</Text>
        </>
      )}
      {REL[group.viewerRelation] && <Badge color="blue" variant="outline" size="sm">{REL[group.viewerRelation]}</Badge>}
    </Group>
  );
}
