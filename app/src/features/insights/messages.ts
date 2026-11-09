// 13 の文言(13 §6.5・§7.4)。
import type { CoarseAgeBand } from "@/features/stats/types";
import type { BusinessCategory, InsightRuleId, RequestTheme } from "./types";

export function fillTemplate(template: string, params: Record<string, string>): string {
  return template.replace(/\{([^{}]+)\}/g, (m, k: string) => (k in params ? params[k] : m));
}

export const AGE_LABELS: Record<CoarseAgeBand | "all", string> = {
  under30: "30 歳未満",
  "30to49": "30〜49 歳",
  "50plus": "50 歳以上",
  all: "全年代",
};
export const AGE_ORDER: CoarseAgeBand[] = ["under30", "30to49", "50plus"];

export const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  lodging: "宿泊", food: "飲食", activity: "体験", souvenir: "土産",
};

export const THEME_LABELS: Record<RequestTheme, string> = {
  guidance: "案内・道順", transport: "交通・移動", rest: "休憩場所", reward: "特典・景品",
  app: "アプリ操作", spot_info: "スポット情報", shops: "店舗情報", crowd: "混雑", none: "要望なし",
};

const ALL_CATS: BusinessCategory[] = ["lodging", "food", "activity", "souvenir"];
export const THEME_ACTIONS: Record<Exclude<RequestTheme, "none">, { text: string; categories: BusinessCategory[] }> = {
  guidance: { text: "店舗・施設までの道順と、近くのスポットへの行き方を店頭や予約の確認で案内してください。", categories: ALL_CATS },
  transport: { text: "最寄りの駅・バス停からの移動手段と所要時間を案内し、送迎や荷物の預かりを検討してください。", categories: ["lodging", "activity"] },
  rest: { text: "休憩できる席や場所を用意し、案内に明記してください。", categories: ["food", "souvenir"] },
  reward: { text: "ラリーの特典と組み合わせた割引や、景品の受け取り場所の案内を検討してください。", categories: ["souvenir", "food"] },
  app: { text: "スタンプの取得方法を店頭で案内できるようにしてください。", categories: ALL_CATS },
  spot_info: { text: "周辺スポットの見どころを紹介する資料を用意してください。", categories: ["activity", "lodging"] },
  shops: { text: "周辺の店舗の営業時間や品ぞろえの情報をまとめて案内してください。", categories: ["food", "souvenir"] },
  crowd: { text: "混み合う時間帯の予約枠や整理券を検討してください。", categories: ALL_CATS },
};

export const RULE_TITLES: Record<InsightRuleId, string> = {
  R01: "{年代}の来訪が増える見込み",
  R02: "グループ旅行が集中する週",
  R03: "週末に多い年代",
  R04: "夕方以降の来訪(参考)",
  R05: "満足度を上げる余地がある年代",
  R06: "要望の多いテーマ",
  R07: "不満につながりやすいテーマ",
  R08: "全スポットを巡る年代",
  R09: "交流を評価する年代",
};

export const RULE_TEMPLATES: Record<InsightRuleId, string> = {
  R01: "{期間}は{エリア}で{年代}の来訪が平常時より約 {増加率}% 多い見込みです。受付・案内の人員や、食材・備品の準備を増やしてください。",
  R02: "{期間}は{エリア}で {組数} 組のグループ旅行(参加予定 {人数} 人)が予定されています。2〜6 人で使える席・部屋・体験の枠を用意し、グループ単位の予約を受け付けてください。",
  R03: "{年代}は平日より週末に多く来訪する傾向があります。週末に{年代}向けの企画やメニューを用意してください。",
  R04: "{年代}の来訪は 17 時以降が {割合}% を占めます。夕方以降の営業や、夜の体験メニューを検討してください。",
  R05: "{年代}の満足の割合は {値}% で、全体より {差} ポイント低い状況です。",
  R06: "アンケート回答者の {割合}% が『{テーマ}』に関する要望を挙げています。{テーマの施策}",
  R07: "『{テーマ}』を挙げた方の不満の割合は {値}% で、全体({全体}%)の約 {倍率} 倍です。{テーマの施策}",
  R08: "{年代}は全スポットを巡る方が多い傾向です。休憩できる場所の案内や、ゆっくり巡るモデルコース、周辺の飲食・土産の情報を用意してください。",
  R09: "{年代}は旅の良かった点に『旅先の交流』を最も多く挙げています。地元の方と話せる体験や、交流の場を企画してください。",
};
/** R01・R05 の 2 文目(年代の上位テーマがあるときだけ付ける) */
export const THEME_FOLLOWUP = "{年代}の要望で多い『{テーマ}』には、{テーマの施策}";

export const CAMPAIGN_WIDE_NOTE = "過去の傾向(キャンペーン全体)";
export const NO_CARDS_MESSAGE = "表示中の条件では提案はありません";

export const LIMITATIONS: string[] = [
  "過去のデータは 2026 年 10 月 1 日〜20 日のスタンプラリー参加者の記録です。月・季節による違いは判断できないため、平常値は 10 月の週平均を全ての週に同じ値で使っています。",
  "10 月 16 日以降は記録が少なく(抽出の打ち切りとみられます)、平常値の計算に使っていません。",
  "来訪はスタンプの取得で数えています。スタンプを取得しない来訪者、ラリーに参加していない来訪者は含みません。",
  "参加予定は、本アプリのグループ旅行の参加中メンバーです。募集中のグループを含み、中止・人数の変更で変わります。",
  "デモ用の未来の旅行日程(ダミー 100 件)を含みます。",
  "時間帯の傾向は参考値です(深夜の記録が多く、時刻の記録に疑義があります)。",
  "アンケートの回答者はスタンプを 3 個以上取得した方だけで、途中でやめた方の声は含みません。",
  "個人が特定できないよう、5 人(件)未満の値は「少数」と表示しています。",
];
