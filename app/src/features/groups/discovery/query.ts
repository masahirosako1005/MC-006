// 条件の解釈(02 DSC-FN-01・12)。純粋関数。
import { AppError, invalidInput } from "@/lib/errors";
import { isSlugId } from "@/lib/ids";
import { isDateStr, daysBetween } from "@/lib/datetime";
import { LIMITS } from "@/lib/limits";
import { parsePage } from "@/lib/query";
import type { AgeBucket } from "@/features/safety/types";
import type { GroupStatus } from "../lifecycle/types";
import type { DateStr } from "@/lib/groups-types";
import { DISCOVERY_MESSAGES as M } from "./messages";
import { normalizeSearchText } from "./text";
import {
  DEFAULT_LIST_STATUSES, DEFAULT_SORT, LISTABLE_STATUSES, LIST_PAGE_SIZE, SORT_KEYS, SORT_OPTIONS,
} from "./types";
import type { GroupListFilter, PageRequest, Region, SortOption } from "./types";

export type IgnoredReason = "unknown_key" | "invalid_value";
export interface QueryContext {
  campaigns: string[];
  defaultCampaign: string;
  regions: Region[];
  today: DateStr;
}
export interface ParsedListQuery {
  filter: GroupListFilter;
  page: PageRequest;
  ignored: { key: string; reason: IgnoredReason }[];
}

const AGE_BUCKETS: AgeBucket[] = ["20s-", "30-40s", "50-60s", "70s+"];
const MAX_DATE = "2100-12-31";
const CTRL = /[\x00-\x1f\x7f]/;  
const FILTER_KEYS = ["campaign", "region", "dateFrom", "dateTo", "vacancy", "tags", "q", "ageBuckets", "official", "status", "sort"];

type Res<T> = { ok: true; value: T | undefined } | { ok: false; message: string };
const ok = <T,>(value: T | undefined): Res<T> => ({ ok: true, value });
const ng = (message: string): Res<never> => ({ ok: false, message });
const csv = (raw: string) => raw.split(",").map((s) => s.trim());

function parseKey(key: string, raw: string, ctx: QueryContext): Res<unknown> {
  switch (key) {
    case "campaign":
      return ctx.campaigns.includes(raw) ? ok(raw) : ng(M.invalidCampaign);
    case "region":
      return isSlugId("r", raw) && ctx.regions.some((r) => r.id === raw) ? ok(raw) : ng(M.invalidRegion);
    case "dateFrom":
    case "dateTo":
      if (!isDateStr(raw)) return ng(M.invalidDate);
      if (raw < ctx.today) return ng(M.pastDate);
      if (raw > MAX_DATE) return ng(M.invalidDate);
      return ok(raw);
    case "vacancy": {
      if (!/^\d+$/.test(raw)) return ng(M.invalidVacancy);
      const n = Number(raw);
      return n >= 1 && n <= 5 ? ok(n) : ng(M.invalidVacancy);
    }
    case "tags": {
      if (CTRL.test(raw)) return ng(M.invalidTags);
      const out: string[] = [];
      const seen = new Set<string>();
      for (const t of csv(raw)) {
        const n = normalizeSearchText(t);
        if (n.length < LIMITS.TAG.min || n.length > LIMITS.TAG.max) return ng(M.invalidTags);
        if (!seen.has(n)) { seen.add(n); out.push(t); }
      }
      return out.length > LIMITS.TAG.maxItems ? ng(M.invalidTags) : ok(out);
    }
    case "q": {
      if (CTRL.test(raw)) return ng(M.invalidQuery);
      const n = normalizeSearchText(raw);
      if (n === "") return ok(undefined);
      const words = n.split(" ");
      if (n.length > 60 || words.length > 5 || words.some((w) => w.length > 30)) return ng(M.invalidQuery);
      return ok(raw.trim());
    }
    case "ageBuckets": {
      const vals = [...new Set(csv(raw))];
      return vals.length >= 1 && vals.length <= 4 && vals.every((x) => AGE_BUCKETS.includes(x as AgeBucket))
        ? ok(vals as AgeBucket[]) : ng(M.invalidAge);
    }
    case "official":
      return raw === "1" ? ok(true) : ng(M.invalidOfficial);
    case "status": {
      const vals = [...new Set(csv(raw))];
      return vals.length >= 1 && vals.length <= 8 && vals.every((x) => LISTABLE_STATUSES.includes(x as GroupStatus))
        ? ok(vals as GroupStatus[]) : ng(M.invalidStatus);
    }
    case "sort": {
      const [k, d = "asc", ...rest] = raw.split(":");
      return !rest.length && (SORT_KEYS as readonly string[]).includes(k) && (SORT_OPTIONS as readonly string[]).includes(`${k}:${d}`)
        ? ok(`${k}:${d}` as SortOption) : ng(M.invalidSort);
    }
  }
  return ng(M.unknownKey);
}

export function parseGroupListQuery(
  params: URLSearchParams,
  mode: "strict" | "lenient",
  ctx: QueryContext,
): ParsedListQuery {
  const strict = mode === "strict";
  const fields: Record<string, string> = {};
  const ignored: { key: string; reason: IgnoredReason }[] = [];
  const filter: GroupListFilter = {
    campaign: ctx.defaultCampaign, tags: [], ageBuckets: [], official: false,
    statuses: [...DEFAULT_LIST_STATUSES], sort: DEFAULT_SORT,
  };
  const bad = (key: string, reason: IgnoredReason, message: string) => {
    if (strict) fields[key] = message; else ignored.push({ key, reason });
  };

  const allowed = strict ? [...FILTER_KEYS, "limit", "offset"] : [...FILTER_KEYS, "page", "from", "to"];
  const keys = [...new Set(params.keys())];
  let pageNo: number | undefined;

  for (const key of keys) {
    if (!allowed.includes(key)) { bad(key, "unknown_key", M.unknownKey); continue; }
    if (strict && params.getAll(key).length > 1) { fields[key] = M.duplicateKey; continue; }
    const raw = params.get(key) as string;
    if (key === "limit" || key === "offset") continue; // 下で parsePage が読む
    if (key === "page") {
      const n = /^\d{1,4}$/.test(raw) ? Number(raw) : 0;
      if (n >= 1 && n <= 1000) pageNo = n; else bad(key, "invalid_value", M.invalidPage);
      continue;
    }
    if (key === "from" || key === "to") {
      const real = key === "from" ? "dateFrom" : "dateTo";
      if (params.has(real)) continue; // 本名が優先
      const r = parseKey(real, raw, ctx);
      if (!r.ok) bad(key, "invalid_value", r.message);
      else (filter as unknown as Record<string, unknown>)[real] = r.value;
      continue;
    }
    const r = parseKey(key, raw, ctx);
    if (!r.ok) { bad(key, "invalid_value", r.message); continue; }
    if (r.value === undefined) continue;
    (filter as unknown as Record<string, unknown>)[key === "status" ? "statuses" : key] = r.value;
  }

  // 日付の相互検査
  if (filter.dateFrom && filter.dateTo) {
    const span = daysBetween(filter.dateFrom, filter.dateTo);
    if (span < 0) {
      bad("dateTo", "invalid_value", M.dateOrder); filter.dateTo = undefined;
    } else if (span > 366) {
      bad("dateTo", "invalid_value", M.dateSpan); filter.dateTo = undefined;
    }
  }

  let page: PageRequest = { limit: LIST_PAGE_SIZE, offset: 0 };
  if (strict) {
    try {
      page = parsePage(params, { defaultLimit: LIST_PAGE_SIZE });
    } catch (e) {
      if (e instanceof AppError && e.fields) Object.assign(fields, e.fields); else throw e;
    }
    if (Object.keys(fields).length) throw invalidInput(fields);
  } else if (pageNo !== undefined) {
    page = { limit: LIST_PAGE_SIZE, offset: (pageNo - 1) * LIST_PAGE_SIZE };
  }
  return { filter, page, ignored };
}

export function serializeFilter(f: GroupListFilter): URLSearchParams {
  const p = new URLSearchParams();
  if (f.region) p.set("region", f.region);
  if (f.dateFrom) p.set("dateFrom", f.dateFrom);
  if (f.dateTo) p.set("dateTo", f.dateTo);
  if (f.vacancy !== undefined) p.set("vacancy", String(f.vacancy));
  if (f.tags.length) p.set("tags", f.tags.join(","));
  if (f.q) p.set("q", f.q);
  if (f.ageBuckets.length) p.set("ageBuckets", f.ageBuckets.join(","));
  if (f.official) p.set("official", "1");
  const sameStatus = f.statuses.length === DEFAULT_LIST_STATUSES.length
    && DEFAULT_LIST_STATUSES.every((s) => f.statuses.includes(s));
  if (!sameStatus) p.set("status", f.statuses.join(","));
  if (f.sort !== DEFAULT_SORT) p.set("sort", f.sort);
  return p;
}
