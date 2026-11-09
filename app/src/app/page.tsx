import { redirect } from "next/navigation";

// 本番は /{campaign} 配下にのみ画面がある。ルートはデモ用キャンペーンへ送る。
export default function Root() {
  redirect("/nttw-demo");
}
