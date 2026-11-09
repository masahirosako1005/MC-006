// 時計(00 第 5.3)。署名スタブ(P-1-2 で実装)。
import type { ClockInfo, DateStr, IsoDateTime } from "./groups-types";

const ni = (): never => { throw new Error("not implemented"); };

export const clock = {
  now: (): Date => ni(),
  nowIso: (): IsoDateTime => ni(),
  today: (): DateStr => ni(),
  advanceDays: (days: number): ClockInfo => { void days; return ni(); },
  set: (iso: IsoDateTime): ClockInfo => { void iso; return ni(); },
  freeze: (iso?: IsoDateTime): ClockInfo => { void iso; return ni(); },
  unfreeze: (): ClockInfo => ni(),
  reset: (): ClockInfo => ni(),
  info: (): ClockInfo => ni(),
};
