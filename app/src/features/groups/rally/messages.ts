// 08: 画面文言・アンケートの設問と尺度(設計 4.7)。
import type { RallyUnavailableReason } from "./types";

export const SURVEY_QUESTIONS = {
  satisfaction: { label: "今回の旅行全体の満足度を選んでください。", scale: ["不満", "やや不満", "どちらともいえない", "やや満足", "満足"] },
  planClarity: { label: "旅程や集合場所の情報はわかりやすかったですか。", scale: ["わかりにくかった", "ややわかりにくかった", "どちらともいえない", "ややわかりやすかった", "わかりやすかった"] },
  wantAgain: { label: "この地域にまた旅行したいと思いますか。", options: { yes: "はい", maybe: "どちらともいえない", no: "いいえ" } },
  localInteraction: { label: "旅行先で地元の人と交流する機会はありましたか。", scale: ["まったくなかった", "あまりなかった", "どちらともいえない", "ややあった", "十分にあった"] },
  localExploration: { label: "滞在中に、いろいろな場所を回ることができましたか。", scale: ["ほとんど回れなかった", "あまり回れなかった", "どちらともいえない", "やや回れた", "十分に回れた"] },
} as const;

export const UNAVAILABLE_MESSAGES: Record<RallyUnavailableReason, string> = {
  recruiting: "募集中のためスタンプはまだ押せません。",
  not_started: "旅行が始まるとスタンプや振り返りが使えます。",
  finished: "旅行は完了しました。スタンプは押せません。",
  cancelled: "このグループは中止になりました。",
  replanned: "このグループは再企画されました。",
};
