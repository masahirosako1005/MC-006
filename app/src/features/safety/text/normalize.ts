// 09: 禁止表現検査用の正規化(SAF-FN-18)。NFKC・小文字・カタカナ統一・漢数字→算用数字。
// plain は区切りを残し、squeezed は空白・記号・ゼロ幅を除く。Map は各文字の原文位置(UTF-16)。
import type { Normalized } from "../types";

const KANJI_DIGITS: Record<string, string> = {
  "〇": "0", "零": "0", "一": "1", "二": "2", "三": "3", "四": "4", "五": "5", "六": "6", "七": "7", "八": "8", "九": "9",
};

function foldKana(ch: string): string {
  const c = ch.codePointAt(0)!;
  // ひらがな(ぁ-ゖ)→カタカナ
  if (c >= 0x3041 && c <= 0x3096) return String.fromCodePoint(c + 0x60);
  return ch;
}

export function normalizeForCheck(text: string): Normalized {
  let plain = "";
  let squeezed = "";
  const plainMap: number[] = [];
  const squeezedMap: number[] = [];
  let i = 0;
  for (const orig of text) {
    const start = i;
    i += orig.length;
    const nf = orig.normalize("NFKC").toLowerCase();
    for (const raw of nf) {
      const ch = foldKana(KANJI_DIGITS[raw] ?? raw);
      if (/\p{Cf}/u.test(ch)) continue; // ゼロ幅など
      for (let k = 0; k < ch.length; k++) {
        plain += ch[k];
        plainMap.push(start);
      }
      if (/[\p{L}\p{N}]/u.test(ch)) {
        for (let k = 0; k < ch.length; k++) {
          squeezed += ch[k];
          squeezedMap.push(start);
        }
      }
    }
  }
  return { plain, squeezed, plainMap, squeezedMap };
}
