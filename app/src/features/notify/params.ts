// 10: params の検証スキーマ(00 の v)。スタブ(P-2-13)。
import type { Schema } from "@/lib/validation";
import type { NotificationKind } from "./types";

export function paramsSchema(kind: NotificationKind): Schema {
  void kind;
  throw new Error("not implemented");
}
