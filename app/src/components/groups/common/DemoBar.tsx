"use client";
import { useState } from "react";
import { Button, Group, Modal, Select, Text } from "@mantine/core";
import { gpost, useGroupsApi, ApiError } from "@/lib/groups-api";
import type { DemoUserSummary, MeResponse } from "@/lib/groups-types";
import { ErrorNotice } from "./ErrorNotice";
import { MockBadge } from "./MockBadge";

const ROLE_LABEL: Record<string, string> = { traveler: "旅行者", municipal: "自治体担当", host: "地元の担い手", business_owner: "観光事業オーナー" };

export function DemoBar() {
  const { data: me } = useGroupsApi<MeResponse>("/api/demo/me");
  const tools = me?.tools ?? false;
  const { data: users } = useGroupsApi<{ items: DemoUserSummary[] }>(tools ? "/api/demo/users" : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [confirm, setConfirm] = useState(false);

  const run = async (path: string, body: unknown) => {
    setBusy(true);
    setError(null);
    try {
      await gpost(path, body);
      window.location.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError("internal", 500, (e as Error).message));
      setBusy(false);
    }
  };

  return (
    <div className="demo-bar" style={{ background: "#fff7e6", borderBottom: "1px solid #ffd8a8", padding: "6px 12px" }}>
      <Group gap="xs" justify="space-between" wrap="wrap">
        <Group gap="xs">
          <MockBadge />
          {me && <Text size="xs">{me.user.displayName}({ROLE_LABEL[me.user.role] ?? me.user.role})</Text>}
        </Group>
        {me && <Text size="xs">日付: {me.clock.today}</Text>}
      </Group>
      {tools && me && (
        <Group gap="xs" mt={6} wrap="wrap">
          <Select
            aria-label="デモユーザー切替" size="xs" w={170} allowDeselect={false} disabled={busy}
            value={me.user.id}
            data={(users?.items ?? [me.user]).map((u) => ({ value: u.id, label: `${u.displayName}(${ROLE_LABEL[u.role] ?? u.role})` }))}
            onChange={(v) => { if (v && v !== me.user.id) void run("/api/demo/me", { userId: v }); }}
          />
          {[1, 3, 7].map((d) => (
            <Button key={d} size="xs" variant="default" disabled={busy} style={{ minHeight: 44 }} onClick={() => void run("/api/demo/clock", { action: "advanceDays", days: d })}>+{d}日</Button>
          ))}
          <Button size="xs" variant="default" color="red" disabled={busy} style={{ minHeight: 44 }} onClick={() => setConfirm(true)}>デモを初期化</Button>
        </Group>
      )}
      {error && <div style={{ marginTop: 6 }}><ErrorNotice error={error} /></div>}
      <Modal opened={confirm} onClose={() => setConfirm(false)} title="デモを初期化しますか?" centered>
        <Text size="sm" mb="md">データと日付が初期状態に戻ります。</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirm(false)}>やめる</Button>
          <Button color="red" onClick={() => { setConfirm(false); void run("/api/demo/reset", {}); }}>初期化する</Button>
        </Group>
      </Modal>
    </div>
  );
}
