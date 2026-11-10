// INS-UI-11。
import { Alert, List } from "@mantine/core";

export interface InsightNoticeProps { limitations: string[]; minCount: number; includesDemoTrips: boolean }
export function InsightNotice({ limitations, minCount, includesDemoTrips }: InsightNoticeProps) {
  return (
    <Alert color="blue" title="デモ用のダミーデータです">
      見込みは、登録済みの旅行日程と過去の来訪の集計から求めた簡易な値です。実際の来訪数とは異なる場合があります。
      個人が特定できないよう、{minCount} 人未満の値は「少数」と表示しています。
      {includesDemoTrips ? " デモ用に生成した旅行日程を含みます。" : ""}
      {limitations.length > 0 && <List size="sm" mt="xs">{limitations.map((l, i) => <List.Item key={i}>{l}</List.Item>)}</List>}
    </Alert>
  );
}
