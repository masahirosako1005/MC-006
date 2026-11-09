// JST の日付演算(設計 04 §4.5)。署名スタブ(P-2-9 で実装)。
import type { DateStr, IsoDateTime } from "@/lib/groups-types";

export function jstDate(date: Date): DateStr { void date; throw new Error("not implemented"); }
export function addDays(iso: IsoDateTime, n: number): IsoDateTime { void iso; void n; throw new Error("not implemented"); }
