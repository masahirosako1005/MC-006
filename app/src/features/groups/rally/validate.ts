// 08: 入力スキーマ(00 の v と、合言葉用の自前 Schema)。スタブ(P-2-20)。
import type { Schema } from "@/lib/validation";

const stub = (): Schema => ({
  parse() { throw new Error("not implemented"); },
});

export const keywordSchema: Schema = stub();
export const stampBodySchema: Schema = stub();
export const memoBodySchema: Schema = stub();
export const surveyBodySchema: Schema = stub();
export const photoBodySchema: Schema = stub();
