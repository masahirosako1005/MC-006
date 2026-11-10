// INS-UI-12。
import { Alert } from "@mantine/core";

export interface InsightForbiddenProps { reason?: string }
export function InsightForbidden({ reason }: InsightForbiddenProps) {
  const msg = reason === "region_out_of_scope" ? "指定のエリアは担当外です。" : "この画面は観光事業者のみ利用できます。観光事業オーナーのユーザーに切り替えてください。";
  return <Alert color="yellow" title="この画面は利用できません">{msg}</Alert>;
}
