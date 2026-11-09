// 09: 禁止表現検査用の正規化。スタブ(P-1-5)。
import type { Normalized } from "../types";

export function normalizeForCheck(text: string): Normalized {
  void text;
  throw new Error("not implemented");
}
