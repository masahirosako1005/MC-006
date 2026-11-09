// 条件の解釈(02 DSC-FN-01・12)。純粋関数。
import type { GroupListFilter, PageRequest, Region } from "./types";
import type { DateStr } from "@/lib/groups-types";

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

export function parseGroupListQuery(
  params: URLSearchParams,
  mode: "strict" | "lenient",
  ctx: QueryContext,
): ParsedListQuery {
  void params; void mode; void ctx;
  throw new Error("not implemented");
}

export function serializeFilter(f: GroupListFilter): URLSearchParams {
  void f;
  throw new Error("not implemented");
}
