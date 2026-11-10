"use client";
// 09: 本人確認(モック)の画面本体(SAF-UI-04)。GET/POST /api/me/verification。
import { useState } from "react";
import { Alert, Badge, Button, Card, Divider, Group, Radio, Stack, Table, Text, Title } from "@mantine/core";
import { gpost, useGroupsApi } from "@/lib/groups-api";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { LoadingBlock } from "@/components/groups/common/LoadingBlock";
import type { Verification } from "../types";

const STATE: Record<Verification["status"], { label: string; color: string; note: string }> = {
  unverified: { label: "○ 未確認", color: "gray", note: "グループの作成と参加申請には、確認が必要です。" },
  verified: { label: "✔ 確認済み", color: "green", note: "グループの作成と参加申請ができます。" },
  underage: { label: "✕ 18歳未満と申告", color: "red", note: "このサービスは18歳以上の方が対象です。" },
};

export function VerificationPanel() {
  const { data, error, loading, reload } = useGroupsApi<Verification>("/api/me/verification");
  const [declare, setDeclare] = useState<"adult" | "minor">("adult");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  if (loading) return <LoadingBlock />;
  if (error || !data) return <Stack p="md"><ErrorNotice error={error} /></Stack>;
  const st = STATE[data.status];

  const send = async (d: "adult" | "minor" | "reset") => {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await gpost("/api/me/verification", { declare: d });
      await reload();
      setMsg(d === "adult" ? "確認済みになりました" : d === "minor" ? "18歳未満と申告しました" : "未確認に戻しました");
    } catch (e) {
      setErr(e as Error);
    } finally {
      setBusy(false);
    }
  };
  const OK = <Text span c="green">✔ 可</Text>;
  const NG = <Text span c="red">✕ 不可</Text>;
  const ok = data.status === "verified";

  return (
    <Stack p="md" gap="md">
      <Title order={2}>本人確認(モック)</Title>
      <Alert color="blue" variant="light" title="デモ用のモックです">
        実際の本人確認は行いません。選んだ結果(18歳以上か、18歳未満か)だけを保存します。生年月日・書類・氏名は入力しません。
      </Alert>
      {data.status === "underage" && (
        <Alert color="red" variant="light" title="このサービスは18歳以上の方が対象です">グループの作成と参加申請はできません。</Alert>
      )}
      <Card withBorder padding="md">
        <Stack gap="sm">
          <Title order={3} size="h4">現在の状態</Title>
          <div><Badge size="lg" color={st.color} variant="light">{st.label}</Badge></div>
          <Text size="sm">{st.note}</Text>
          <Radio.Group label="年齢の確認(自己申告)" required value={declare} onChange={(x) => setDeclare(x === "minor" ? "minor" : "adult")}
            description="デモのため、選んだ内容をそのまま結果として保存します。">
            <Stack gap={4} mt={6}>
              <Radio value="adult" label="18歳以上です" />
              <Radio value="minor" label="18歳未満です" />
            </Stack>
          </Radio.Group>
          <Group><Button loading={busy} onClick={() => void send(declare)} style={{ minHeight: 44 }}>確認する(モック)</Button></Group>
          <ErrorNotice error={err} />
          {msg && <Alert color="green" variant="light" role="status" title={msg}>{data.status === "verified" ? "グループの作成と参加申請ができます。" : undefined}</Alert>}
          <Divider />
          <Group justify="space-between">
            <Text size="xs" c="dimmed">デモ用: 状態を「未確認」に戻せます。</Text>
            <Button variant="subtle" size="xs" disabled={busy} onClick={() => void send("reset")}>状態をリセット(デモ用)</Button>
          </Group>
        </Stack>
      </Card>
      <Card withBorder padding="md">
        <Title order={3} size="h4" mb="xs">確認が必要な操作</Title>
        <Table.ScrollContainer minWidth={420}>
          <Table>
            <Table.Thead><Table.Tr><Table.Th>操作</Table.Th><Table.Th>未確認</Table.Th><Table.Th>確認済み</Table.Th><Table.Th>18歳未満と申告</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              <Table.Tr><Table.Th>グループの作成(再企画を含む)</Table.Th><Table.Td>{NG}</Table.Td><Table.Td>{OK}</Table.Td><Table.Td>{NG}</Table.Td></Table.Tr>
              <Table.Tr><Table.Th>参加申請(招待コード経由を含む)</Table.Th><Table.Td>{NG}</Table.Td><Table.Td>{OK}</Table.Td><Table.Td>{NG}</Table.Td></Table.Tr>
              <Table.Tr><Table.Th>一覧・詳細の閲覧、招待コードの照合</Table.Th><Table.Td>{OK}</Table.Td><Table.Td>{OK}</Table.Td><Table.Td>{OK}</Table.Td></Table.Tr>
              <Table.Tr><Table.Th>プロフィール編集、通報、ブロック、退会</Table.Th><Table.Td>{OK}</Table.Td><Table.Td>{OK}</Table.Td><Table.Td>{OK}</Table.Td></Table.Tr>
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
        <Text size="xs" c="dimmed" mt="xs">すでに参加しているグループでのチャット・メモなどは、状態を戻しても続けて使えます。{ok ? "" : ""}</Text>
      </Card>
    </Stack>
  );
}
