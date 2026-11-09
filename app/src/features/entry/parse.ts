// 入口B の解釈(11 ENT-FN-01〜04、13)。
import type { GroupListFilter, Region } from "@/features/groups/discovery/types";
import type { QueryContext } from "@/features/groups/discovery/query";
import { parseGroupListQuery, serializeFilter } from "@/features/groups/discovery/query";
import { getCampaign, listRegions } from "@/features/groups/discovery/regions";
import { clock } from "@/lib/clock";
import { notFound } from "@/lib/errors";
import { ENTRY_SOURCES } from "./types";
import type {
  AcceptedConditionView, EntryResolution, HandoffKey, IgnoredParam, ParsedEntry, RawQuery, SourceLabel,
} from "./types";

const MAX_VALUE_LEN = 100;
const CAMPAIGN_RE = /^[a-z0-9-]{1,40}$/;
// 受け取るキー(別名を含む)→ 02 へ渡すキー
const KEY_MAP: Record<string, HandoffKey> = {
  region: "region", dateFrom: "dateFrom", from: "dateFrom", dateTo: "dateTo", to: "dateTo",
  vacancy: "vacancy", official: "official",
};
const HANDOFF = new Set<string>(["region", "dateFrom", "dateTo", "vacancy", "official"]);

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k);

export function parseEntryParams(query: RawQuery, ctx: QueryContext): ParsedEntry {
  const ignored: IgnoredParam[] = [];
  const params = new URLSearchParams();
  let unknownCount = 0;
  let source: SourceLabel = "none";
  const picked = new Map<HandoffKey, string>();
  const rawSrc: string[] = [];

  for (const key of Object.keys(query)) {
    const raw = query[key];
    if (raw === undefined) continue;
    const isSrc = key === "src";
    if (!isSrc && !has(KEY_MAP, key)) { unknownCount++; continue; }
    const list = Array.isArray(raw) ? raw : [raw];
    if (list.length === 0) continue;
    const canon: IgnoredParam["key"] = isSrc ? "src" : KEY_MAP[key];
    if (list.length > 1) ignored.push({ key: canon, reason: "duplicate" });
    const value = String(list[0]);
    if (value.length > MAX_VALUE_LEN) { ignored.push({ key: canon, reason: "too_long" }); continue; }
    if (isSrc) { rawSrc.push(value); continue; }
    const hk = KEY_MAP[key];
    // 別名より正規キーを優先する
    if (picked.has(hk) && key !== hk) continue;
    picked.set(hk, value);
  }
  for (const [k, val] of picked) params.set(k, val);

  if (rawSrc.length > 0) {
    if ((ENTRY_SOURCES as readonly string[]).includes(rawSrc[0])) source = rawSrc[0] as SourceLabel;
    else { source = "unknown"; ignored.push({ key: "src", reason: "unknown_value" }); }
  }

  let filter: GroupListFilter;
  try {
    const r = parseGroupListQuery(params, "lenient", ctx);
    filter = { ...r.filter, campaign: ctx.defaultCampaign };
    for (const ig of r.ignored) {
      const k = ig.key === "from" ? "dateFrom" : ig.key === "to" ? "dateTo" : ig.key;
      if (ig.reason === "unknown_key" || !HANDOFF.has(k)) { unknownCount++; continue; }
      ignored.push({ key: k as HandoffKey, reason: "invalid_value" });
    }
  } catch {
    filter = { campaign: ctx.defaultCampaign } as GroupListFilter;
    ignored.push({ key: "_query", reason: "invalid_value" });
  }
  if (unknownCount > 0) ignored.push({ key: "_unknown", reason: "unknown_value", count: unknownCount });
  return { filter, source, ignored };
}

export function buildGroupsPath(campaign: string, filter: GroupListFilter): string {
  if (!CAMPAIGN_RE.test(campaign)) throw new Error("invalid campaign");
  const qs = serializeFilter({ ...filter, campaign }).toString();
  const path = `/${campaign}/groups${qs ? `?${qs}` : ""}`;
  if (!path.startsWith("/") || path[1] === "/" || path.includes("\\") || path.split("?")[0].includes(":")) {
    throw new Error("invalid groups path");
  }
  return path;
}

export function resolveEntry(campaign: string, query: RawQuery): EntryResolution {
  if (typeof campaign !== "string" || !CAMPAIGN_RE.test(campaign) || !getCampaign(campaign)) throw notFound("キャンペーン");
  const ctx: QueryContext = {
    campaigns: [campaign], defaultCampaign: campaign, regions: listRegions(campaign), today: clock.today(),
  };
  const parsed = parseEntryParams(query, ctx);
  const filter = { ...parsed.filter, campaign };
  const showLanding = parsed.ignored.some((i) => HANDOFF.has(i.key) || i.key === "_query");
  return { ...parsed, filter, campaign, groupsPath: buildGroupsPath(campaign, filter), showLanding };
}

export function buildEntryUrl(campaign: string, params: Record<string, string>): string {
  if (!CAMPAIGN_RE.test(campaign)) throw new Error("invalid campaign");
  const sp = new URLSearchParams();
  for (const [k, val] of Object.entries(params)) sp.set(k, val);
  const qs = sp.toString();
  return `/${campaign}/entry${qs ? `?${qs}` : ""}`;
}

export function describeFilter(filter: GroupListFilter, regions: Region[]): AcceptedConditionView[] {
  const out: AcceptedConditionView[] = [];
  if (filter.region) {
    out.push({ key: "region", label: "地方", value: regions.find((r) => r.id === filter.region)?.name ?? filter.region });
  }
  if (filter.dateFrom) out.push({ key: "dateFrom", label: "開始日", value: filter.dateFrom });
  if (filter.dateTo) out.push({ key: "dateTo", label: "終了日", value: filter.dateTo });
  if (filter.vacancy !== undefined) out.push({ key: "vacancy", label: "空き人数", value: `${filter.vacancy}人` });
  if (filter.official) out.push({ key: "official", label: "公式枠", value: "のみ" });
  return out;
}
