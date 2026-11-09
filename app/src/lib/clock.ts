// 時計(00 第 5.3)。live(offset 付き実時間)と frozen(固定時刻)。
import type { ClockInfo, DateStr, IsoDateTime } from "./groups-types";
import seed from "@/data/group-seed.json";
import { invalidInput } from "./errors";

type State = { mode: "live" | "frozen"; offsetMs: number; frozenMs: number };
const g = globalThis as unknown as { __groupsClock?: State };

const demoNowMs = () => Date.parse(seed.meta.demoNow);
const JST = 9 * 3600_000;
const DAY = 86400_000;

const st = (): State => (g.__groupsClock ??= { mode: "live", offsetMs: demoNowMs() - Date.now(), frozenMs: 0 });
const nowMs = (): number => { const s = st(); return s.mode === "frozen" ? s.frozenMs : Date.now() + s.offsetMs; };

const jstShift = (ms: number) => new Date(ms + JST).toISOString(); // 値は JST の壁時計
const toIso = (ms: number): IsoDateTime => `${jstShift(ms).slice(0, 19)}+09:00`;
const toDate = (ms: number): DateStr => jstShift(ms).slice(0, 10);

function parse(iso: unknown): number {
  const ok = typeof iso === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(iso);
  const ms = ok ? Date.parse(iso as string) : NaN;
  if (Number.isNaN(ms)) throw invalidInput({ at: "日時の形式が正しくありません。" });
  return ms;
}

function info(): ClockInfo {
  const n = nowMs();
  const d0 = Math.floor((demoNowMs() + JST) / DAY);
  const d1 = Math.floor((n + JST) / DAY);
  return { nowIso: toIso(n), today: toDate(n), mode: st().mode, shiftedDays: d1 - d0 };
}

export const clock = {
  now: (): Date => new Date(nowMs()),
  nowIso: (): IsoDateTime => toIso(nowMs()),
  today: (): DateStr => toDate(nowMs()),
  advanceDays: (days: number): ClockInfo => {
    if (!Number.isInteger(days) || days < 1 || days > 365) throw invalidInput({ days: "1〜365 の整数で指定してください。" });
    const s = st();
    if (s.mode === "frozen") s.frozenMs += days * DAY; else s.offsetMs += days * DAY;
    return info();
  },
  set: (iso: IsoDateTime): ClockInfo => {
    const ms = parse(iso);
    const s = st();
    s.mode = "live";
    s.offsetMs = ms - Date.now();
    return info();
  },
  freeze: (iso?: IsoDateTime): ClockInfo => {
    const ms = iso === undefined ? nowMs() : parse(iso);
    const s = st();
    s.mode = "frozen";
    s.frozenMs = ms;
    return info();
  },
  unfreeze: (): ClockInfo => {
    const s = st();
    if (s.mode === "frozen") { s.offsetMs = s.frozenMs - Date.now(); s.mode = "live"; }
    return info();
  },
  reset: (): ClockInfo => {
    const s = st();
    s.mode = "live";
    s.offsetMs = demoNowMs() - Date.now();
    return info();
  },
  info,
};
