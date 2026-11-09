// 09: 画面文言(拒否理由、通報理由ラベル)。本体は P-2 以降で拡充する。
import type { ReportReason } from "./types";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  contact_solicitation: "外部連絡先・別アプリへの誘導",
  harassment: "嫌がらせ・迷惑行為",
  inappropriate_content: "不適切な内容",
  money_solicitation: "金銭・勧誘",
  off_purpose: "旅の目的以外の言動",
  impersonation: "なりすまし",
  minor_suspected: "18歳未満の疑い",
  other: "その他",
};
