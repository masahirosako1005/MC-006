"use client";
import { Avatar, Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { useGroupsApi } from "@/lib/groups-api";
import type { Id } from "@/lib/groups-types";
import type { MemberView } from "@/features/groups/types";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";

const AGE: Record<string, string> = { "18-19": "10代後半", "20s": "20代", "30s": "30代", "40s": "40代", "50s": "50代", "60s": "60代", "70s+": "70代以上" };

export function MemberList({ groupId, compact }: { groupId: Id; compact?: boolean }) {
  const { data, error, loading } = useGroupsApi<MemberView[] | { members: MemberView[] }>(`/api/groups/${groupId}/members`);
  if (loading) return <LoadingBlock />;
  if (error) return <ErrorNotice error={error} />;
  const members = Array.isArray(data) ? data : (data?.members ?? []);
  return (
    <Stack gap="md">
      <Card withBorder component="section" aria-labelledby="m-title">
        <Stack gap="xs">
          <Title order={2} size="h4" id="m-title">メンバー({members.length}人)</Title>
          {!compact && <Text size="xs" c="dimmed">表示する項目は、各メンバーが公開範囲で公開している項目だけです。</Text>}
          {members.map((m) => (
            <Group key={m.userId} wrap="nowrap" data-testid="member-row">
              <Avatar radius="xl" size="sm">{m.displayName.slice(0, 1)}</Avatar>
              <div>
                <Text fw={700} size="sm">
                  {m.displayName}{m.isSelf ? "(あなた)" : ""}{" "}
                  {m.role === "organizer" && <Badge size="xs" color="blue" variant="light">幹事</Badge>}
                </Text>
                <Text size="xs" c="dimmed">{m.ageBand ? AGE[m.ageBand] ?? m.ageBand : "年代 非公開"}</Text>
              </div>
            </Group>
          ))}
        </Stack>
      </Card>
      {!compact && (
        <Card withBorder component="section" aria-labelledby="left-title" bg="gray.0">
          <Title order={2} size="h4" id="left-title">元メンバー</Title>
          <Text size="xs" c="dimmed" mt={4}>辞退・退会した人の表示名は「元メンバー」になります。チャットや費用メモの記録は残ります。</Text>
        </Card>
      )}
    </Stack>
  );
}
