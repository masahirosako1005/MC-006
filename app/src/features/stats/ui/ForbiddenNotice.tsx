// MUN-UI-13。
import { Alert } from "@mantine/core";

export interface ForbiddenNoticeProps { reason?: string }
export function ForbiddenNotice({ reason }: ForbiddenNoticeProps) {
  return (
    <Alert color="red" title="この画面は自治体の担当者のみ閲覧できます">
      自治体のデモユーザー(タナカ)に切り替えてください。{reason === "region_out_of_scope" ? "指定の地方は担当外です。" : ""}
    </Alert>
  );
}
