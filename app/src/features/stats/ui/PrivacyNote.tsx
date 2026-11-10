// MUN-UI-12。
import { Alert } from "@mantine/core";
import { privacyNote } from "../messages";

export interface PrivacyNoteProps { minCount: number; includesDemoHistory: boolean }
export function PrivacyNote({ minCount, includesDemoHistory }: PrivacyNoteProps) {
  return (
    <Alert color="blue" title="担当地方のみを集計しています">
      担当外の地方は選択肢に表示されません。{privacyNote(minCount)}。{includesDemoHistory ? "デモ用の過去実績(合成データ)を含みます。" : ""}
    </Alert>
  );
}
