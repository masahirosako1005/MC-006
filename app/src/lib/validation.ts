// 検証 DSL(00 第 5.10)。自前実装、依存なし。
import type { Id, DateStr, IsoDateTime } from "./groups-types";
import { isId, isSlugId, type IdPrefix, type SlugPrefix } from "./ids";
import { invalidInput } from "./errors";
import { isDateStr, parseIso, toJstIso } from "./datetime";
import { MSG } from "./messages";

export const INVALID: unique symbol = Symbol("invalid");
export type Issues = Record<string, string>;
export interface Schema<T = unknown> { parse(input: unknown, path: string, issues: Issues): T | typeof INVALID; }
export type Infer<S extends Schema> = S extends Schema<infer T> ? T : never;

const fail = (issues: Issues, path: string, msg: string): typeof INVALID => {
  if (!(path in issues)) issues[path] = msg;
  return INVALID;
};
const key = (path: string, k: string | number) => (path ? `${path}.${k}` : String(k));
const absent = (input: unknown) => input === undefined;

// eslint-disable-next-line no-control-regex
const CTRL_KEEP_WS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g;
// eslint-disable-next-line no-control-regex
const CTRL_ALL = /[\u0000-\u001F\u007F-\u009F]/g;
const INVIS = /[​-‏‪-‮⁦-⁩﻿]/g;

/** 内部用。multiline:false で改行を含む場合は null(拒否)。 */
function sanitizeOrNull(s: string, o?: { multiline?: boolean }): string | null {
  const multiline = o?.multiline === true;
  let t = s.normalize("NFC").replace(/\r\n?/g, "\n");
  if (!multiline && t.includes("\n")) return null;
  t = t.replace(multiline ? CTRL_KEEP_WS : CTRL_ALL, "").replace(INVIS, "");
  return t.trim();
}

export function sanitizeText(s: string, o?: { multiline?: boolean }): string {
  const r = sanitizeOrNull(s, o);
  if (r === null) throw invalidInput({ "": MSG.controlChar });
  return r;
}

export function safeParse<S extends Schema>(
  schema: S,
  input: unknown,
): { ok: true; value: Infer<S> } | { ok: false; fields: Record<string, string> } {
  const issues: Issues = {};
  const value = schema.parse(input, "", issues);
  if (value === INVALID || Object.keys(issues).length > 0) return { ok: false, fields: issues };
  return { ok: true, value: value as Infer<S> };
}

export function parse<S extends Schema>(schema: S, input: unknown): Infer<S> {
  const r = safeParse(schema, input);
  if (!r.ok) throw invalidInput(r.fields);
  return r.value;
}

const codepoints = (s: string) => Array.from(s).length;
const omitted = <T>() => undefined as unknown as T;

export const v = {
  string(o: { min?: number; max?: number; maxLines?: number; multiline?: boolean; pattern?: RegExp; optional?: boolean; default?: string } = {}): Schema<string> {
    return {
      parse(input, path, issues) {
        if (absent(input)) {
          if (o.default !== undefined) return o.default;
          return o.optional ? "" : fail(issues, path, MSG.required);
        }
        if (typeof input !== "string") return fail(issues, path, MSG.required);
        const s = sanitizeOrNull(input, { multiline: o.multiline });
        if (s === null) return fail(issues, path, MSG.controlChar);
        if (s === "") {
          if (o.optional) return o.default ?? "";
          if ((o.min ?? 1) > 0) return fail(issues, path, MSG.required);
        }
        const min = o.min ?? (o.optional ? 0 : 1);
        const max = o.max ?? Infinity;
        const len = codepoints(s);
        if (len < min || len > max) return fail(issues, path, o.max !== undefined ? MSG.length(min, max) : MSG.required);
        if (o.maxLines !== undefined && s.split("\n").length > o.maxLines) return fail(issues, path, MSG.maxLines(o.maxLines));
        if (o.pattern && !o.pattern.test(s)) return fail(issues, path, MSG.controlChar);
        return s;
      },
    };
  },
  int(o: { min?: number; max?: number; coerce?: boolean; optional?: boolean; default?: number } = {}): Schema<number> {
    return {
      parse(input, path, issues) {
        if (absent(input)) {
          if (o.default !== undefined) return o.default;
          return o.optional ? omitted<number>() : fail(issues, path, MSG.required);
        }
        let n: unknown = input;
        if (o.coerce && typeof input === "string" && /^-?\d+$/.test(input.trim())) n = Number(input.trim());
        const min = o.min ?? Number.MIN_SAFE_INTEGER;
        const max = o.max ?? Number.MAX_SAFE_INTEGER;
        if (typeof n !== "number" || !Number.isSafeInteger(n) || n < min || n > max) return fail(issues, path, MSG.range(min, max));
        return n;
      },
    };
  },
  boolean(o: { coerce?: boolean; optional?: boolean; default?: boolean } = {}): Schema<boolean> {
    return {
      parse(input, path, issues) {
        if (absent(input)) {
          if (o.default !== undefined) return o.default;
          return o.optional ? omitted<boolean>() : fail(issues, path, MSG.required);
        }
        if (typeof input === "boolean") return input;
        if (o.coerce && input === "true") return true;
        if (o.coerce && input === "false") return false;
        return fail(issues, path, MSG.enum);
      },
    };
  },
  enum<T extends string>(values: readonly T[], o: { optional?: boolean; default?: T } = {}): Schema<T> {
    return {
      parse(input, path, issues) {
        if (absent(input)) {
          if (o.default !== undefined) return o.default;
          return o.optional ? omitted<T>() : fail(issues, path, MSG.required);
        }
        if (typeof input === "string" && (values as readonly string[]).includes(input)) return input as T;
        return fail(issues, path, MSG.enum);
      },
    };
  },
  id(prefix: IdPrefix, o: { optional?: boolean } = {}): Schema<Id> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<Id>() : fail(issues, path, MSG.required);
        return isId(prefix, input) ? input : fail(issues, path, MSG.controlChar);
      },
    };
  },
  slugId(prefix: SlugPrefix, o: { optional?: boolean } = {}): Schema<Id> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<Id>() : fail(issues, path, MSG.required);
        return isSlugId(prefix, input) ? input : fail(issues, path, MSG.controlChar);
      },
    };
  },
  date(o: { optional?: boolean } = {}): Schema<DateStr> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<DateStr>() : fail(issues, path, MSG.required);
        return isDateStr(input) ? input : fail(issues, path, MSG.date);
      },
    };
  },
  datetime(o: { optional?: boolean } = {}): Schema<IsoDateTime> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<IsoDateTime>() : fail(issues, path, MSG.required);
        const d = typeof input === "string" ? parseIso(input) : null;
        return d ? toJstIso(d) : fail(issues, path, MSG.date);
      },
    };
  },
  array<S extends Schema>(item: S, o: { min?: number; max?: number; unique?: boolean; optional?: boolean } = {}): Schema<Infer<S>[]> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<Infer<S>[]>() : fail(issues, path, MSG.required);
        if (!Array.isArray(input)) return fail(issues, path, MSG.required);
        let bad = false;
        if (o.max !== undefined && input.length > o.max) bad = fail(issues, path, MSG.maxItems(o.max)) === INVALID;
        if (o.min !== undefined && input.length < o.min) bad = fail(issues, path, MSG.required) === INVALID;
        const out: Infer<S>[] = [];
        input.forEach((el, i) => {
          const r = item.parse(el, key(path, i), issues);
          if (r === INVALID) bad = true;
          else out.push(r as Infer<S>);
        });
        if (o.unique && !bad && new Set(out.map((x) => JSON.stringify(x))).size !== out.length) {
          bad = fail(issues, path, MSG.enum) === INVALID;
        }
        return bad ? INVALID : out;
      },
    };
  },
  object<Shape extends Record<string, Schema>>(shape: Shape, o: { optional?: boolean } = {}): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }> {
    type Out = { [K in keyof Shape]: Infer<Shape[K]> };
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<Out>() : fail(issues, path, MSG.required);
        if (typeof input !== "object" || input === null || Array.isArray(input)) return fail(issues, path, MSG.required);
        const src = input as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        let bad = false;
        for (const k of Object.keys(shape)) {
          const raw = Object.prototype.hasOwnProperty.call(src, k) ? src[k] : undefined;
          const r = shape[k].parse(raw, key(path, k), issues);
          if (r === INVALID) bad = true;
          else if (r !== undefined) out[k] = r;
        }
        return bad ? INVALID : (out as Out);
      },
    };
  },
  csv<S extends Schema>(item: S, o: { max?: number; optional?: boolean } = {}): Schema<Infer<S>[]> {
    return {
      parse(input, path, issues) {
        if (absent(input)) return o.optional ? omitted<Infer<S>[]>() : fail(issues, path, MSG.required);
        if (typeof input !== "string") return fail(issues, path, MSG.required);
        const parts = input === "" ? [] : input.split(",");
        return v.array(item, { max: o.max }).parse(parts, path, issues) as Infer<S>[] | typeof INVALID;
      },
    };
  },
  nullable<S extends Schema>(schema: S): Schema<Infer<S> | null> {
    return {
      parse(input, path, issues) {
        if (input === null) return null;
        return schema.parse(input, path, issues) as Infer<S> | null | typeof INVALID;
      },
    };
  },
};
