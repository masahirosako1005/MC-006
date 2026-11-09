// 08: 入力スキーマ(00 の v と、合言葉用の自前 Schema)。
import { INVALID, v, type Schema } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";

const CODE_MSG = "合言葉が正しくありません。もう一度確認してください。";
// eslint-disable-next-line no-control-regex
const CTRL = /[\u0000-\u001f\u007f]/;

/** 合言葉: 文字列・制御文字なし・trim 後 1〜64 文字。sanitizeText は通さず拒否する。 */
const keyword: Schema<string> = {
  parse(input, path, issues) {
    const bad = (): typeof INVALID => {
      if (!(path in issues)) issues[path] = CODE_MSG;
      return INVALID;
    };
    if (typeof input !== "string" || CTRL.test(input)) return bad();
    const t = input.trim();
    const len = Array.from(t).length;
    if (len < 1 || len > 64) return bad();
    return t;
  },
};

export const keywordSchema: Schema = keyword;
export const stampBodySchema: Schema = v.object({ keyword });
export const memoBodySchema: Schema = v.object({
  body: v.string({ min: LIMITS.RALLY_MEMO.min, max: LIMITS.RALLY_MEMO.max, multiline: true }),
  ackReview: v.boolean({ optional: true }),
});
export const surveyBodySchema: Schema = v.object({
  satisfaction: v.int({ min: 1, max: 5 }),
  planClarity: v.int({ min: 1, max: 5 }),
  wantAgain: v.enum(["yes", "maybe", "no"] as const),
  localInteraction: v.int({ min: 1, max: 5 }),
  localExploration: v.int({ min: 1, max: 5 }),
});
export const photoBodySchema: Schema = v.object({
  spotId: v.nullable(v.int({ optional: true })),
  caption: v.string({ min: LIMITS.PHOTO_CAPTION.min, max: LIMITS.PHOTO_CAPTION.max, optional: true, default: "" }),
  ackReview: v.boolean({ optional: true }),
});
