// seed の読み込み・検証(00 第 4.4)。署名スタブ(P-1-1 で実装)。
import type { Id, IsoDateTime } from "./groups-types";

export type GroupSeed = {
  schemaVersion: 2;
  meta: { demoNow: IsoDateTime; defaultUserId: Id; campaign: string; tagCatalog: string[] };
} & Record<string, unknown>;

export function parseSeed(raw: unknown): GroupSeed { void raw; throw new Error("not implemented"); }
