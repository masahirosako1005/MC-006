// 07 決済・連絡先への誘導の検査(EXP 7.2)。
import { AppError } from "@/lib/errors";

const WORDS = [
  "paypay", "ペイペイ", "ペイ", "送金", "振込", "振り込", "口座", "銀行", "qr", "請求書", "立替払いアプリ",
  "line pay", "linepay", "楽天ペイ", "メルペイ", "d払い", "paypal", "venmo",
];
const PATTERNS: RegExp[] = [
  /https?:\/\//i,
  /www\./i,
  /[a-z0-9._%+-]+@[a-z0-9.-]+/i,
  /\d[\d\s-]{8,}\d/, // 10 桁以上の数字列(電話番号らしきもの)
];

const fold = (s: string) => s.normalize("NFKC").toLowerCase();

export function assertNoPaymentInducement(text: string, field: string): void {
  const t = fold(text);
  const hit = WORDS.some((w) => t.includes(w)) || PATTERNS.some((p) => p.test(t));
  if (!hit) return;
  const message = "決済・送金・連絡先に関する記載はできません。";
  throw new AppError("invalid_input", message, { reason: "payment_inducement", fields: { [field]: message } });
}
