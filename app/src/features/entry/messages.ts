import type { EntryIgnoredReason, IgnoredParam } from "./types";

export const ENTRY_KEY_LABEL: Record<IgnoredParam["key"], string> = {
  region: "地方",
  dateFrom: "開始日",
  dateTo: "終了日",
  vacancy: "空き人数",
  official: "公式枠",
  src: "流入元",
  _unknown: "その他の項目",
  _query: "条件全体",
};

export const ENTRY_IGNORED_REASON_LABEL: Record<EntryIgnoredReason, string> = {
  too_long: "長すぎます",
  duplicate: "重複しています",
  unknown_value: "該当する選択肢がありません",
  invalid_value: "受け付けられない値です",
};
