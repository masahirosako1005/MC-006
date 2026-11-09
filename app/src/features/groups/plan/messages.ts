// 05 の日本語文言(PLN-FILE-02)。
export const PLAN_MESSAGES = {
  itemNotFound: "この項目は削除されました。",
  conflict: "他のメンバーが先に更新しました。最新の内容を確認して、もう一度保存してください。",
  readOnly: (statusLabel: string) => `${statusLabel}のため編集できません。閲覧のみです。`,
  formerMember: "元メンバー",
  dateOutOfRange: (start: string, end: string) => `日程(${start}〜${end})の範囲で選んでください。`,
  spotNotFound: "選んだ場所が見つかりません。",
  itemsTotalMax: (n: number) => `旅程項目は ${n} 件までです。`,
  itemsPerDateMax: (n: number) => `同じ日の項目は ${n} 件までです。`,
  meetingNeedsPlace: "日時を指定する場合は、場所か説明を入力してください。",
  nothingToChange: "変更する項目がありません。",
  orderMismatch: "並び替える項目がその日の項目と一致しません。",
} as const;
