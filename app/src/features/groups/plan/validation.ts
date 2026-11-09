// 05 の本文・クエリのスキーマ(PLN-FILE-03)。スキーマ(MeetingBody ほか)は P-2-15 で追加する。
import type { DateStr } from "@/lib/groups-types";

export function isWithinSchedule(_d: DateStr, _trip: { startDate: DateStr; endDate: DateStr }): boolean {
  throw new Error("not implemented");
}
export function countLines(_s: string): number {
  throw new Error("not implemented");
}
