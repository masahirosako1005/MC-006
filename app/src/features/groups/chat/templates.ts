// 06 定型文(クライアント定数。API は設けない)。
import type { ChatTemplate } from "./types";

export const CHAT_TEMPLATES: readonly ChatTemplate[] = [
  { id: "tpl-01", label: "集合時間を相談したい", text: "集合時間を相談したいです" },
  { id: "tpl-02", label: "集合場所を確認したい", text: "集合場所を確認したいです" },
  { id: "tpl-03", label: "持ち物を確認したい", text: "持ち物を確認したいです" },
  { id: "tpl-04", label: "遅れそうです", text: "遅れそうです" },
  { id: "tpl-05", label: "了解です", text: "了解です" },
  { id: "tpl-06", label: "ありがとうございます", text: "ありがとうございます" },
];
