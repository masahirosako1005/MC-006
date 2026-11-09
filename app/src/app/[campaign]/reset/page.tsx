"use client";
import { useRouter, useParams } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Stack, Text } from "@mantine/core";
import { post } from "@/lib/api";

export default function Reset() {
  const { campaign: slug } = useParams<{ campaign: string }>();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  async function run() {
    setBusy(true); setErr(false);
    try { await post("/user/reset"); router.push(`/${slug}/resetfinish`); } catch { setErr(true); setBusy(false); }
  }
  return (
    <Stack p="md">
      <Text>スタンプを0個に戻して、次の周回を始めます。獲得済みの特典履歴は残ります。</Text>
      <Button color="red" loading={busy} onClick={run}>リセットする</Button>
      {err && <Alert color="red" role="alert">リセットに失敗しました。</Alert>}
    </Stack>
  );
}
