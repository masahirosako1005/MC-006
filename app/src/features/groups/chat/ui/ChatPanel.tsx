"use client";
// 06 チャットタブ(CHT-UI-01)。一覧・投稿・定型文・システムメッセージ・通報・読み取り専用。
import { useEffect, useRef, useState } from "react";
import { Alert, Anchor, Badge, Button, Card, Group, Loader, Paper, Stack, Text, Textarea } from "@mantine/core";
import { ApiError } from "@/lib/groups-api";
import { LIMITS } from "@/lib/limits";
import { ReportDialog } from "@/features/safety/components/ReportDialog";
import { CHAT_TEMPLATES } from "../templates";
import type { MessageDto } from "../types";
import { useChat } from "./useChat";

function hhmm(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function ChatPanel({ groupId }: { groupId: string }) {
  const { messages, access, error, loading, hasMore, loadOlder, post } = useChat(groupId);
  const [text, setText] = useState("");
  const [fieldErr, setFieldErr] = useState<string | null>(null);
  const [review, setReview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [report, setReport] = useState<MessageDto | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastId = messages[messages.length - 1]?.id;

  useEffect(() => { endRef.current?.scrollIntoView?.({ block: "end" }); }, [lastId]);

  const canPost = access?.canPost ?? false;

  async function send(fn: () => Promise<void>) {
    setSending(true); setFieldErr(null); setReview(null); setSendErr(null);
    try { await fn(); setText(""); }
    catch (e) {
      if (e instanceof ApiError) {
        const f = e.fields?.body;
        if (e.reason === "text_review_required") setReview(f ?? e.message);
        else if (f) setFieldErr(f);
        else setSendErr(e.message);
      } else setSendErr("送信に失敗しました。");
    } finally { setSending(false); }
  }
  const sendText = (ack?: boolean) => send(() => post({ kind: "normal", body: text, ackReview: ack }));

  if (loading && !access) return <Group justify="center" p="md"><Loader size="sm" /></Group>;
  if (error && !access) return <Alert color="red" role="alert">{error.message}</Alert>;
  if (access && !access.canRead) return <Alert color="gray" role="status">チャットはグループの参加メンバーだけが見られます。</Alert>;

  return (
    <Card withBorder component="section" aria-labelledby="chat-title">
      <Stack>
        <h2 id="chat-title" style={{ position: "absolute", left: -9999 }}>メッセージ</h2>
        {error && <Alert color="yellow" role="status">更新に失敗しました。自動で再試行します。</Alert>}
        {hasMore && <Button variant="subtle" size="xs" onClick={() => { void loadOlder(); }}>以前のメッセージを読み込む</Button>}
        <Stack component="ol" aria-label="メッセージ" gap="xs" style={{ listStyle: "none", margin: 0, padding: 0, maxHeight: 480, overflowY: "auto" }}>
          {messages.length === 0 && <Text size="sm" c="dimmed">まだメッセージはありません。</Text>}
          {messages.map((m) => m.kind === "system" ? (
            <li key={m.id} style={{ textAlign: "center" }}>
              <Badge variant="light" color="gray" size="lg" tt="none" fw={400}>{m.text}</Badge>
            </li>
          ) : (
            <li key={m.id} style={{ display: "flex", flexDirection: "column", alignItems: m.isMine ? "flex-end" : "flex-start" }}>
              <Text size="xs" c="dimmed">{m.isMine ? "自分" : m.senderName} <time dateTime={m.createdAt}>{hhmm(m.createdAt)}</time></Text>
              <Paper withBorder px="sm" py={6} radius="md" bg={m.isMine ? "blue.0" : undefined} style={{ maxWidth: "85%", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {m.text}
              </Paper>
              {!m.isMine && (m.reportedByMe
                ? <Text size="xs" c="dimmed">通報済み</Text>
                : <Anchor component="button" type="button" size="xs" c="dimmed" onClick={() => setReport(m)}>
                    通報<span style={{ position: "absolute", left: -9999 }}>: {m.senderName}の投稿</span>
                  </Anchor>)}
            </li>
          ))}
          <div ref={endRef} />
        </Stack>

        {!canPost && (
          <Alert color="blue" role="status">
            {access?.reason === "state_readonly" ? "このグループの状態では新しい投稿はできません。履歴は読めます。" : "投稿できません。"}
          </Alert>
        )}
        <Stack gap="xs">
          <Group gap="xs" component="ul" aria-label="定型文" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {CHAT_TEMPLATES.map((t) => (
              <li key={t.id}>
                <Button size="compact-sm" radius="xl" variant="default" disabled={!canPost || sending}
                  onClick={() => { void send(() => post({ kind: "template", templateId: t.id })); }}>{t.label}</Button>
              </li>
            ))}
          </Group>
          <Group align="flex-end" wrap="nowrap">
            <Textarea style={{ flex: 1 }} aria-label="メッセージ" placeholder="メッセージを入力" autosize minRows={1} maxRows={5}
              value={text} disabled={!canPost} error={fieldErr} maxLength={LIMITS.CHAT.max}
              onChange={(e) => { setText(e.currentTarget.value); setFieldErr(null); setReview(null); }} />
            <Button disabled={!canPost || !text.trim()} loading={sending} onClick={() => { void sendText(); }}>送信</Button>
          </Group>
          <Text size="xs" c="dimmed">{LIMITS.CHAT.max} 文字・10 行以内。連絡先や外部サービスへの誘導は書けません。</Text>
          {review && (
            <Alert color="yellow" title="入力内容の確認">
              <Text size="sm">{review}</Text>
              <Group mt="xs">
                <Button size="compact-sm" variant="light" onClick={() => { void sendText(true); }}>このまま送信</Button>
                <Button size="compact-sm" variant="subtle" onClick={() => setReview(null)}>修正する</Button>
              </Group>
            </Alert>
          )}
          {sendErr && <Alert color="red" role="alert">{sendErr}</Alert>}
        </Stack>
      </Stack>
      {report && (
        <ReportDialog opened onClose={() => setReport(null)}
          target={{ type: "message", id: report.id, label: `${report.senderName}の投稿`, groupId }} allowBlock />
      )}
    </Card>
  );
}
