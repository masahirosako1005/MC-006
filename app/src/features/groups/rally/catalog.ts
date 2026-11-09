// 08: seed のスポット・特典の読み取り(サーバー側専用)。スタブ(P-2-20)。
import type { SpotCatalogItem } from "./types";

export function findSpotByKeyword(keyword: string): SpotCatalogItem | undefined {
  void keyword;
  throw new Error("not implemented");
}
