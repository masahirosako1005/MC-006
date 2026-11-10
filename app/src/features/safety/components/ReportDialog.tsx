"use client";
// 09: 通報ダイアログ(user / message / group の 3 種)。SAF-UI-02。
import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Alert, Button, Checkbox, Group, Modal, Radio, Stack, Text, Textarea } from "@mantine/core";
import type { Id } from "@/lib/groups-types";
import { ApiError, gpost } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import { ErrorNotice } from "@/components/groups/common/ErrorNotice";
import { REPORT_REASON_LABELS } from "../messages";
import type { ReportReason, ReportTargetType } from "../types";

export interface ReportDialogProps {
  opened: boolean;
  onClose(): void;
  target: { type: ReportTargetType; id: string; label: string; groupId?: Id };
  allowBlock?: boolean;
}

const TITLES: Record<ReportTargetType, string> = { user: "ユーザーを通報する", message: "メッセージを通報する", group: "グループを通報する" };
const TARGET_LABEL: Record<ReportTargetType, string> = { user: "通報する相手", message: "通報するメッセージ", group: "通報するグループ" };

export function ReportDialog({ opened, onClose, target, allowBlock }: ReportDialogProps) {
  const { campaign } = useParams<{ campaign?: string }>();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [body, setBody] = useState("");
  const [alsoBlock, setAlsoBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<Error | null>(null);
  const [done, setDone] = useState<{ blocked: boolean } | null>(null);
  const reasonErr = err instanceof ApiError && err.fields?.reason ? err.fields.reason : null;

  const close = () => { setDone(null); setErr(null); setReason(null); setBody(""); setAlsoBlock(false); onClose(); };
  const submit = async () => {
    if (!reason) {
      setErr(new ApiError("invalid_input", 400, "入力内容を確認してください", { fields: { reason: "通報の理由を選んでください。" } }));
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await gpost("/api/reports", {
        targetType: target.type, targetId: target.id, reason,
        ...(body ? { body } : {}), ...(target.groupId ? { groupId: target.groupId } : {}),
        ...(allowBlock && target.type === "user" && alsoBlock ? { alsoBlock: true } : {}),
      });
      setDone({ blocked: allowBlock === true && target.type === "user" && alsoBlock });
    } catch (e) {
      setErr(e instanceof Error ? e : new ApiError("internal", 500, "問題が発生しました"));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <Modal opened={opened} onClose={close} title="通報を受け付けました">
        <Stack gap="sm">
          <Alert color="green" variant="light" title="受け付けました(モック)">
            相手やグループの他のメンバーには通知されません。デモのため、運営の対応は行われません。
          </Alert>
          {done.blocked && <Text size="sm">あわせて、{target.label}さんをブロックしました。解除はブロック一覧から行えます。</Text>}
          <Group justify="flex-end">
            {done.blocked && campaign && <Button component={Link} href={`/${campaign}/mypage/blocks`} variant="default">ブロック一覧を見る</Button>}
            <Button onClick={close}>閉じる</Button>
          </Group>
        </Stack>
      </Modal>
    );
  }
  return (
    <Modal opened={opened} onClose={close} title={TITLES[target.type]}>
      <Stack gap="sm">
        <div style={{ padding: "8px 12px", borderLeft: "4px solid var(--mantine-color-gray-4)", background: "var(--mantine-color-gray-0)" }}>
          <Text size="xs" c="dimmed">{TARGET_LABEL[target.type]}</Text>
          <Text fw={700} size="sm">{target.label}</Text>
        </div>
        {target.type === "message" && <Text size="xs" c="dimmed">通報した時点の本文を記録します。後で編集・削除されても確認できます。</Text>}
        {target.type === "group" && <Text size="xs" c="dimmed">申請前・承認前でも、グループと幹事を通報できます。</Text>}
        <Radio.Group label="通報の理由" required value={reason} onChange={(x) => setReason(x as ReportReason)} error={reasonErr}>
          <Stack gap={6} mt={4}>
            {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((r) => <Radio key={r} value={r} label={REPORT_REASON_LABELS[r]} />)}
          </Stack>
        </Radio.Group>
        <Textarea label="補足(任意)" autosize minRows={2} maxLength={LIMITS.REPORT_BODY.max}
          description={`${LIMITS.REPORT_BODY.max} 文字以内。状況を具体的に書いてください。${[...body].length} / ${LIMITS.REPORT_BODY.max}`}
          value={body} onChange={(e) => setBody(e.currentTarget.value)} />
        {allowBlock && target.type === "user" && (
          <Checkbox label="この人をブロックする" description="あなたの画面でこの人の投稿を隠し、この人のいるグループは一覧に出なくなります。"
            checked={alsoBlock} onChange={(e) => setAlsoBlock(e.currentTarget.checked)} />
        )}
        <Alert color="blue" variant="light">通報は、相手やグループの他のメンバーには通知されません。デモのため、運営の対応は行われません。</Alert>
        {err && !reasonErr && <ErrorNotice error={err} />}
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>やめる</Button>
          <Button color="red" loading={busy} onClick={() => void submit()}>通報する</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
