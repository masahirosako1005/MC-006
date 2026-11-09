// 13 週の算出(INS-FN-04)。月曜始まり(JST の日付文字列をそのまま扱う)。
import type { DateStr } from "@/lib/groups-types";

function parse(d: DateStr): number {
  const [y, m, day] = d.split("-").map(Number);
  return Date.UTC(y, m - 1, day);
}
function fmt(ms: number): DateStr {
  return new Date(ms).toISOString().slice(0, 10) as DateStr;
}
export function shiftDate(d: DateStr, days: number): DateStr {
  return fmt(parse(d) + days * 86400000);
}
/** "M月D日" */
export function formatMD(d: DateStr): string {
  const [, m, day] = d.split("-").map(Number);
  return `${m}月${day}日`;
}
export function weekLabel(weekStart: DateStr, weekEnd: DateStr): string {
  return `${formatMD(weekStart)}〜${formatMD(weekEnd)}`;
}

export function forecastWeeks(today: DateStr, count: number): { weekStart: DateStr; weekEnd: DateStr }[] {
  const dow = new Date(parse(today)).getUTCDay(); // 0=日
  const monday = shiftDate(today, -((dow + 6) % 7));
  const out: { weekStart: DateStr; weekEnd: DateStr }[] = [];
  for (let i = 0; i < count; i++) {
    const weekStart = shiftDate(monday, i * 7);
    out.push({ weekStart, weekEnd: shiftDate(weekStart, 6) });
  }
  return out;
}
