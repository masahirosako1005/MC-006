"use client";
import { useState } from "react";
import { Alert, Button, Stack, Textarea, TextInput } from "@mantine/core";
import { post } from "@/lib/api";

export default function Inquiries() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("busy");
    try { await post("/inquiries", { email, message }); setState("done"); setMessage(""); } catch { setState("error"); }
  }
  return (
    <Stack p="md" component="form" onSubmit={submit}>
      <TextInput label="メールアドレス" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} required />
      <Textarea label="お問い合わせ内容" minRows={5} maxLength={2000} value={message} onChange={(e) => setMessage(e.currentTarget.value)} required />
      <Button type="submit" loading={state === "busy"}>送信</Button>
      {state === "done" && <Alert color="green" role="status">送信しました（ローカル保存のみ・外部には送信されません）。</Alert>}
      {state === "error" && <Alert color="red" role="alert">入力内容を確認してください。</Alert>}
    </Stack>
  );
}
