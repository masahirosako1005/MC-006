// 共通の利用者向け文言(検証メッセージの定型。00 第 5.4)。
export const MSG = {
  required: "入力してください",
  length: (min: number, max: number) => `${min}〜${max}字で入力してください`,
  range: (min: number, max: number) => `${min}〜${max}の整数で入力してください`,
  enum: "選択肢から選んでください",
  date: "YYYY-MM-DD 形式の日付で入力してください",
  maxItems: (max: number) => `${max}件までです`,
  maxLines: (max: number) => `${max}行までです`,
  controlChar: "使用できない文字が含まれています",
} as const;
