export const JOIN_ERRORS = {
  group_not_found: "グループが見つかりません。",
  request_not_found: "申請が見つかりません。",
  not_organizer: "この操作は幹事のみ行えます。",
  not_applicant: "この操作は申請した本人のみ行えます。",
  already_member: "すでにこのグループのメンバーです。",
  duplicate_request: "すでに申請中です。",
  already_rejected: "このグループへの申請は見送られているため、再申請できません。",
  request_limit: "このグループへの申請回数の上限に達しました。",
  group_full: "定員に達しています。",
  condition_changed: "グループの最少人数が変わりました。内容を確認して、もう一度同意してください。",
  request_not_pending: "この申請はすでに処理されています。",
  closed: "このグループは現在、参加申請を受け付けていません。",
  consent_required: "「最少人数でも参加する」への同意が必要です。",
  note_lines: "ひとことの行数が多すぎます。",
  reentry_mismatch: "再参加の元グループが正しくありません。",
  reason_invalid: "却下理由が正しくありません。",
} as const;

// 03 の画面文言(設計 03 §7.3)。
export function consentText(minMembers: number): string {
  return `このグループは、最少人数(${minMembers}人)でも実行されます。${minMembers}人になっても参加します。実行が確定する前なら、辞退できます(不利益はありません)。`;
}
