"use client";
import { useState } from "react";
import { Alert, Button, Stack, Text, TextInput } from "@mantine/core";
import { post } from "@/lib/api";

type Result = { spot: { name: string }; granted: { prize: string }[] };
const MESSAGES: Record<string, string> = {
  invalid_code: "合言葉が正しくありません。もう一度確認してください。",
  already_acquired: "このスポットのスタンプは獲得済みです。",
};

// 本番は QR・バーコード・キーワード・GPS で押印する。ローカル版は合言葉入力のみ（カメラ/GPS 不使用）。
export default function Qr() {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState<Result | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setOk(null); setErr(null);
    try {
      setOk(await post<Result>("/user/stamps", { keyword: code }));
      setCode("");
    } catch (x) {
      setErr(MESSAGES[(x as { code?: string }).code ?? ""] ?? "エラーが発生しました。時間をおいて再度お試しください。");
    } finally { setBusy(false); }
  }

  return (
    <Stack p="md" component="form" onSubmit={submit}>
      <Text size="sm">スポットに掲示された合言葉を入力してください。（デモ用: SPOT01〜SPOT07）</Text>
      <TextInput label="合言葉" value={code} onChange={(e) => setCode(e.currentTarget.value)} maxLength={64} required />
      <Button type="submit" loading={busy} color="var(--main-color)">スタンプを押す</Button>
      {ok && (
        <Alert color="green" title="スタンプを獲得しました" role="status">
          {ok.spot.name}
          {ok.granted.map((g) => <Text key={g.prize} size="sm" fw={700}>特典獲得：{g.prize}</Text>)}
        </Alert>
      )}
      {err && <Alert color="red" title="押印できませんでした" role="alert">{err}</Alert>}
    </Stack>
  );
}
