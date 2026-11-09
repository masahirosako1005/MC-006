// 07 の日本語文言(EXP 7.3)。
export const EXPENSE_MESSAGES = {
  tabNotice:
    "この画面は費用の記録用メモです。アプリは送金・決済・請求を行いません。お金のやりとりは、メンバー同士で直接ご相談のうえ、各自の責任で行ってください。",
  summaryNotice:
    "これは記録をもとにした目安の計算です。支払いの義務や金額を決めるものではありません。端数は 1 円単位で調整しています。",
  formNotice: "金額は円の整数で入力します。連絡先や支払い方法は書かないでください。",
  readOnlyBeforeConfirmed: "費用メモは、旅行の実行が確定してから記録できます。",
  readOnlyClosed: "このグループは中止されたため、費用メモは閲覧のみです。",
  transferLine: (from: string, to: string, yen: string) => `${from}さんは${to}さんに ${yen}円(目安)`,
  leftMember: "元メンバー",
} as const;
