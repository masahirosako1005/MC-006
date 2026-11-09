// 絞り込み・並び順・提案(02 DSC-FN-07・09・10)。
import type { DemoUser } from "@/lib/groups-types";
import type { GroupView } from "./internal";
import type { GroupListFilter, GroupSummary, Region, RelaxSuggestion, SortOption } from "./types";

export function matchesFilter(view: GroupView, f: GroupListFilter, region: Region | undefined): boolean {
  void view; void f; void region;
  throw new Error("not implemented");
}

export function compareGroups(sort: SortOption): (a: GroupSummary, b: GroupSummary) => number {
  void sort;
  throw new Error("not implemented");
}

export function computeSuggestions(viewer: DemoUser, filter: GroupListFilter, all: GroupView[]): RelaxSuggestion[] {
  void viewer; void filter; void all;
  throw new Error("not implemented");
}
