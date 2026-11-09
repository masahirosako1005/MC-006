// JST の日付演算(設計 04 §4.5)。
import type { DateStr, IsoDateTime } from "@/lib/groups-types";
import { jstDate as jstDateOf, parseIso, toJstIso } from "@/lib/datetime";

export function jstDate(date: Date): DateStr { return jstDateOf(date); }

/** +09:00 付き ISO に n 日(負も可)を足す。結果も +09:00 形式。 */
export function addDays(iso: IsoDateTime, n: number): IsoDateTime {
  const d = parseIso(iso);
  if (!d) throw new Error(`invalid datetime: ${iso}`);
  return toJstIso(new Date(d.getTime() + n * 86400000));
}
