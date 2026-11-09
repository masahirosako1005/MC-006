// 06 の日本語文言(CHT)。
export const CHAT_MESSAGES = {
  formerMember: "元メンバー",
  memberFallback: "メンバー",
  systemSender: "お知らせ",
  readonly: "このグループのチャットは読み取り専用です。",
  notMember: "グループのメンバーだけが利用できます。",
  bodyRequired: "メッセージを入力してください。",
  bodyNotString: "メッセージは文字列で指定してください。",
  bodyTooLong: (max: number) => `メッセージは${max}文字以内で入力してください。`,
  bodyTooManyLines: (max: number) => `メッセージは${max}行以内で入力してください。`,
  freeInputDisabled: "自由入力は現在利用できません。定型文を使ってください。",
  templateUnknown: "定型文が見つかりません。",
  cannotReportOwn: "自分の投稿は通報できません。",
  cannotReportSystem: "お知らせは通報できません。",
  sinceBeforeBoth: "sinceId と before は同時に指定できません。",
} as const;
