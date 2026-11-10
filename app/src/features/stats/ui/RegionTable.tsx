// MUN-UI-07。
import { Table, Text } from "@mantine/core";
import type { RegionRow } from "../types";
import { CellText } from "./CellText";

export interface RegionTableProps { rows: RegionRow[]; minCount: number }

export function RegionTable({ rows, minCount }: RegionTableProps) {
  if (rows.length === 0) return <Text size="sm" c="dimmed">データがありません</Text>;
  return (
    <Table.ScrollContainer minWidth={420}>
      <Table withTableBorder>
        <Table.Thead>
          <Table.Tr><Table.Th>地方</Table.Th><Table.Th ta="right">作成</Table.Th><Table.Th ta="right">申請</Table.Th><Table.Th ta="right">実行確定</Table.Th><Table.Th ta="right">中止率</Table.Th></Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr key={r.regionId}>
              <Table.Td>{r.regionName}</Table.Td>
              <Table.Td ta="right"><CellText cell={r.groupsCreated} minCount={minCount} /></Table.Td>
              <Table.Td ta="right"><CellText cell={r.joinRequests} minCount={minCount} /></Table.Td>
              <Table.Td ta="right"><CellText cell={r.confirmedGroups} minCount={minCount} /></Table.Td>
              <Table.Td ta="right"><CellText cell={r.cancelRate} minCount={minCount} /></Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
