// 入口B の解釈(11 ENT-FN-01〜04、13)。署名スタブ。
import type { GroupListFilter, Region } from "@/features/groups/discovery/types";
import type { QueryContext } from "@/features/groups/discovery/query";
import type { AcceptedConditionView, EntryResolution, ParsedEntry, RawQuery } from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function parseEntryParams(query: RawQuery, ctx: QueryContext): ParsedEntry {
  void query; void ctx;
  return ni();
}

export function resolveEntry(campaign: string, query: RawQuery): EntryResolution {
  void campaign; void query;
  return ni();
}

export function buildGroupsPath(campaign: string, filter: GroupListFilter): string {
  void campaign; void filter;
  return ni();
}

export function buildEntryUrl(campaign: string, params: Record<string, string>): string {
  void campaign; void params;
  return ni();
}

export function describeFilter(filter: GroupListFilter, regions: Region[]): AcceptedConditionView[] {
  void filter; void regions;
  return ni();
}
