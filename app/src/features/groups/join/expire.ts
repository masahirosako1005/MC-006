// status_changed の購読処理(JOIN-FN-09)。署名スタブ(P-2-8 で実装)。
import type { DomainEvent } from "@/lib/events";

export function expireOnStatusChanged(e: Extract<DomainEvent, { type: "status_changed" }>): number {
  void e;
  throw new Error("not implemented");
}
