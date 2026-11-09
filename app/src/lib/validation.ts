// 検証 DSL(00 第 5.10)。署名スタブ(P-1-2 で実装)。
import type { Id, DateStr, IsoDateTime } from "./groups-types";
import type { IdPrefix, SlugPrefix } from "./ids";

export const INVALID: unique symbol = Symbol("invalid");
export type Issues = Record<string, string>;
export interface Schema<T = unknown> { parse(input: unknown, path: string, issues: Issues): T | typeof INVALID; }
export type Infer<S extends Schema> = S extends Schema<infer T> ? T : never;

const ni = (): never => { throw new Error("not implemented"); };

export function parse<S extends Schema>(schema: S, input: unknown): Infer<S> { void schema; void input; return ni(); }
export function safeParse<S extends Schema>(
  schema: S,
  input: unknown,
): { ok: true; value: Infer<S> } | { ok: false; fields: Record<string, string> } { void schema; void input; return ni(); }

export const v = {
  string(o?: { min?: number; max?: number; maxLines?: number; multiline?: boolean; pattern?: RegExp; optional?: boolean; default?: string }): Schema<string> { void o; return ni(); },
  int(o?: { min?: number; max?: number; coerce?: boolean; optional?: boolean; default?: number }): Schema<number> { void o; return ni(); },
  boolean(o?: { coerce?: boolean; optional?: boolean; default?: boolean }): Schema<boolean> { void o; return ni(); },
  enum<T extends string>(values: readonly T[], o?: { optional?: boolean; default?: T }): Schema<T> { void values; void o; return ni(); },
  id(prefix: IdPrefix, o?: { optional?: boolean }): Schema<Id> { void prefix; void o; return ni(); },
  slugId(prefix: SlugPrefix, o?: { optional?: boolean }): Schema<Id> { void prefix; void o; return ni(); },
  date(o?: { optional?: boolean }): Schema<DateStr> { void o; return ni(); },
  datetime(o?: { optional?: boolean }): Schema<IsoDateTime> { void o; return ni(); },
  array<S extends Schema>(item: S, o?: { min?: number; max?: number; unique?: boolean; optional?: boolean }): Schema<Infer<S>[]> { void item; void o; return ni(); },
  object<Shape extends Record<string, Schema>>(shape: Shape, o?: { optional?: boolean }): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> { void shape; void o; return ni(); },
  csv<S extends Schema>(item: S, o?: { max?: number; optional?: boolean }): Schema<Infer<S>[]> { void item; void o; return ni(); },
  nullable<S extends Schema>(schema: S): Schema<Infer<S> | null> { void schema; return ni(); },
};

export function sanitizeText(s: string, o?: { multiline?: boolean }): string { void s; void o; return ni(); }
