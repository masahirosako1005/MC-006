// 09: TextContext と適用表(設計 8.5)。levels は 7 文字(D=deny, R=review, -=対象外)で、順に
// romance_hint / contact_exchange / contact_pattern(メール・電話) / contact_url / money_solicit / gender_filter / age_filter。
import type { TextContext } from "../types";

export interface TextContextSpec {
  multiline: boolean;
  levels: string;
}

export const RULE_GROUPS = [
  "romance_hint", "contact_exchange", "contact_pattern", "contact_url", "money_solicit", "gender_filter", "age_filter",
] as const;

const ALL = "DDDDDDD";
const PLAN = "DRDRDRR";
const CHAT = "DDDRDRR";

export const TEXT_CONTEXTS: Partial<Record<TextContext, TextContextSpec>> = {
  group_name: { multiline: false, levels: ALL },
  group_destination: { multiline: false, levels: ALL },
  group_date_note: { multiline: false, levels: ALL },
  group_description: { multiline: true, levels: ALL },
  group_tag: { multiline: false, levels: ALL },
  join_note: { multiline: true, levels: ALL },
  reject_reason_free: { multiline: true, levels: ALL },
  plan_item_title: { multiline: false, levels: PLAN },
  plan_note: { multiline: true, levels: PLAN },
  chat_message: { multiline: true, levels: CHAT },
  expense_item: { multiline: false, levels: CHAT },
  expense_memo: { multiline: true, levels: CHAT },
  rally_memo: { multiline: true, levels: CHAT },
  rally_photo_caption: { multiline: false, levels: CHAT },
  official_summary: { multiline: true, levels: ALL },
  official_highlight: { multiline: false, levels: ALL },
  profile_display_name: { multiline: false, levels: ALL },
  profile_bio: { multiline: true, levels: ALL },
  report_body: { multiline: true, levels: "-------" },
};
