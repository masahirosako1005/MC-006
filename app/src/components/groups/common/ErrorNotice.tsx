"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Anchor, Button, Group, List, Stack, Text } from "@mantine/core";
import { ApiError } from "@/lib/groups-api";

const ADVICE: Record<string, { title: string; next: string }> = {
  invalid_input: { title: "入力内容を確認してください", next: "項目ごとの指摘を直して、もう一度送信してください。" },
  forbidden: { title: "この操作はできません", next: "この操作に必要な権限がありません(幹事のみ・メンバーのみの操作など)。" },
  not_found: { title: "見つかりませんでした", next: "一覧へ戻って、もう一度探してください。" },
  conflict: { title: "状況が変わったため実行できません", next: "画面を更新して最新の状態を確認してください。" },
  unavailable_state: { title: "現在の状態では実行できません", next: "今の状態でできる操作を確認してください。" },
  rate_limited: { title: "操作の回数が上限に達しました", next: "時間をおいてもう一度お試しください。" },
  blocked: { title: "操作できません", next: "この操作は行えません。" },
  internal: { title: "問題が発生しました", next: "画面を再読み込みするか、デモを初期化してください。" },
  network: { title: "問題が発生しました", next: "画面を再読み込みするか、デモを初期化してください。" },
};

export function ErrorNotice({ error, onRetry, backHref, backLabel }: { error: ApiError | Error | null; onRetry?: () => void; backHref?: string; backLabel?: string }) {
  const params = useParams<{ campaign?: string }>();
  if (!error) return null;
  const api = error instanceof ApiError ? error : new ApiError("internal", 500, error.message);
  const adv = ADVICE[api.code] ?? ADVICE.internal;
  const fields = api.fields ? Object.entries(api.fields) : [];
  const allowed = Array.isArray(api.detail?.allowedActions) ? (api.detail.allowedActions as unknown[]).map(String) : [];
  const back = backHref ?? (params?.campaign ? `/${params.campaign}/groups` : "/");
  const showBack = api.code === "not_found" || api.code === "forbidden";
  return (
    <Alert color="red" variant="light" role="alert" title={api.message || adv.title}>
      <Stack gap={6}>
        <Text size="sm">{adv.next}</Text>
        {fields.length > 0 && <List size="sm">{fields.map(([k, v]) => <List.Item key={k}>{v}</List.Item>)}</List>}
        {allowed.length > 0 && <Text size="sm">できる操作: {allowed.join("、")}</Text>}
        <Group gap="sm">
          {onRetry && <Button size="xs" variant="light" onClick={onRetry} style={{ minHeight: 44 }}>もう一度試す</Button>}
          {showBack && <Anchor component={Link} href={back} size="sm">{backLabel ?? "一覧へ戻る"}</Anchor>}
        </Group>
      </Stack>
    </Alert>
  );
}
