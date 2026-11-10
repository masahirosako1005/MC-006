"use client";
// 09: 禁止表現の拒否・要確認メッセージ(SAF-UI-05)。禁止語そのものは表示しない。
import { Alert, Button, Group, Text } from "@mantine/core";
import type { TextCheckResult } from "../types";

export interface TextRejectNoticeProps {
  result: TextCheckResult | null;
  serverError?: string;
  /** serverError の種別。省略時は拒否。 */
  serverKind?: "deny" | "review";
  onAckReview?(): void;
  busy?: boolean;
}

export function TextRejectNotice({ result, serverError, serverKind = "deny", onAckReview, busy }: TextRejectNoticeProps) {
  if (serverError) {
    if (serverKind === "review") {
      return (
        <Alert color="yellow" variant="light" title="送信する前に確認してください" role="status">
          <Text size="sm">{serverError}</Text>
          {onAckReview && (
            <Group mt="xs"><Button size="xs" variant="light" loading={busy} onClick={onAckReview} style={{ minHeight: 44 }}>このまま送信する</Button></Group>
          )}
        </Alert>
      );
    }
    return (
      <Alert color="red" variant="light" title="この表現は使えません" role="alert">
        <Text size="sm">{serverError}</Text>
        <Text size="xs" mt={4}>連絡は参加成立後に、グループ内のチャットを使ってください。</Text>
      </Alert>
    );
  }
  if (!result || result.verdict === "ok") return null;
  if (result.verdict === "deny") {
    return (
      <Alert color="red" variant="light" title="この表現は使えません" role="alert">
        <Text size="sm">{result.reason ?? "該当する部分を削除してください。"}</Text>
        {result.suggestion && <Text size="xs" mt={4}>{result.suggestion}</Text>}
      </Alert>
    );
  }
  return (
    <Text size="xs" c="orange.8" aria-live="polite">
      ! 確認が必要な表現が含まれている可能性があります。保存するときに確認します。
    </Text>
  );
}
