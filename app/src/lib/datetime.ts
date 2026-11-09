// 日時ヘルパー(00 第 5.11)。JST は +09:00 固定。依存なしの Date 演算。
import type { DateStr, IsoDateTime } from "./groups-types";

const JST_MS = 9 * 3600 * 1000;
const DAY_MS = 86400000;
const p2 = (n: number) => String(n).padStart(2, "0");

/** JST の壁時計を UTC フィールドに載せた Date。 */
const shifted = (d: Date) => new Date(d.getTime() + JST_MS);

export const toJstIso = (d: Date): IsoDateTime => {
  const s = shifted(d);
  return `${s.getUTCFullYear()}-${p2(s.getUTCMonth() + 1)}-${p2(s.getUTCDate())}T${p2(s.getUTCHours())}:${p2(s.getUTCMinutes())}:${p2(s.getUTCSeconds())}+09:00`;
};

const dateUtc = (date: DateStr): number => Date.parse(`${date}T00:00:00Z`);
const fmtUtc = (ms: number): DateStr => {
  const s = new Date(ms);
  return `${String(s.getUTCFullYear()).padStart(4, "0")}-${p2(s.getUTCMonth() + 1)}-${p2(s.getUTCDate())}`;
};

export const isDateStr = (v: unknown): v is DateStr => {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const ms = dateUtc(v);
  return !Number.isNaN(ms) && fmtUtc(ms) === v;
};

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
export const parseIso = (s: string): Date | null => {
  if (typeof s !== "string" || !ISO_RE.test(s)) return null;
  if (!isDateStr(s.slice(0, 10))) return null;
  const ms = Date.parse(s);
  return Number.isNaN(ms) ? null : new Date(ms);
};

export const jstDate = (d: Date | IsoDateTime): DateStr => {
  const date = typeof d === "string" ? parseIso(d) : d;
  if (!date) throw new Error(`invalid datetime: ${String(d)}`);
  return toJstIso(date).slice(0, 10);
};

export const addDays = (date: DateStr, days: number): DateStr => fmtUtc(dateUtc(date) + days * DAY_MS);

export const daysBetween = (from: DateStr, to: DateStr): number => Math.round((dateUtc(to) - dateUtc(from)) / DAY_MS);

export const formatJst = (value: IsoDateTime | DateStr, pattern?: string): string => {
  let y: number, mo: number, d: number, h = 0, mi = 0;
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (isDateOnly) {
    [y, mo, d] = value.split("-").map(Number);
  } else {
    const date = parseIso(value);
    if (!date) throw new Error(`invalid datetime: ${value}`);
    const s = shifted(date);
    y = s.getUTCFullYear(); mo = s.getUTCMonth() + 1; d = s.getUTCDate(); h = s.getUTCHours(); mi = s.getUTCMinutes();
  }
  const pat = pattern ?? (isDateOnly ? "M月D日" : "M月D日 H:mm");
  const map: Record<string, string> = {
    YYYY: String(y).padStart(4, "0"), MM: p2(mo), M: String(mo), DD: p2(d), D: String(d), HH: p2(h), H: String(h), mm: p2(mi),
  };
  return pat.replace(/YYYY|MM|M|DD|D|HH|H|mm/g, (t) => map[t]);
};

export const startOfNextJstDay = (date: DateStr): IsoDateTime => `${addDays(date, 1)}T00:00:00+09:00`;
