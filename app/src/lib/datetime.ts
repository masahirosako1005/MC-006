// 日時ヘルパー(00 第 5.11)。署名スタブ(P-1-2 で実装)。
import type { DateStr, IsoDateTime } from "./groups-types";

const ni = (): never => { throw new Error("not implemented"); };

export const toJstIso = (d: Date): IsoDateTime => { void d; return ni(); };
export const jstDate = (d: Date | IsoDateTime): DateStr => { void d; return ni(); };
export const addDays = (date: DateStr, days: number): DateStr => { void date; void days; return ni(); };
export const daysBetween = (from: DateStr, to: DateStr): number => { void from; void to; return ni(); };
export const isDateStr = (v: unknown): v is DateStr => { void v; return ni(); };
export const parseIso = (s: string): Date | null => { void s; return ni(); };
export const formatJst = (value: IsoDateTime | DateStr, pattern?: string): string => { void value; void pattern; return ni(); };
export const startOfNextJstDay = (date: DateStr): IsoDateTime => { void date; return ni(); };
