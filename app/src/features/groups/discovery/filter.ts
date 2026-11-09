// 絞り込み・並び順・提案(02 DSC-FN-07・09・10)。
import type { DemoUser } from "@/lib/groups-types";
import type { GroupView } from "./internal";
import type { GroupListFilter, GroupSummary, Region, RelaxSuggestion, SortOption } from "./types";
import { normalizeSearchText } from "./text";

export function matchesFilter(view: GroupView, f: GroupListFilter, region: Region | undefined): boolean {
  void region;
  const s = view.summary;
  if (s.campaign !== f.campaign) return false;
  if (!f.statuses.includes(s.status)) return false;
  if (f.region && s.region.id !== f.region) return false;
  if (f.dateFrom && s.trip.endDate < f.dateFrom) return false;
  if (f.dateTo && s.trip.startDate > f.dateTo) return false;
  if (f.vacancy !== undefined && s.headcount.vacancy < f.vacancy) return false;
  if (f.official && !view.group.official) return false;
  if (f.ageBuckets.length) {
    const b = s.memberSummary.buckets;
    if (!b || !f.ageBuckets.some((x) => b.includes(x))) return false;
  }
  if (f.tags.length) {
    const have = new Set(view.searchTextTags.map(normalizeSearchText));
    if (!f.tags.some((t) => have.has(normalizeSearchText(t)))) return false;
  }
  if (f.q) {
    const text = normalizeSearchText(view.searchText);
    const words = normalizeSearchText(f.q).split(" ").filter(Boolean);
    if (!words.every((w) => text.includes(w))) return false;
  }
  return true;
}

const ACCEPTING = new Set(["recruiting", "min_reached"]);
const cmp = (a: string | number, b: string | number) => (a < b ? -1 : a > b ? 1 : 0);

export function compareGroups(sort: SortOption): (a: GroupSummary, b: GroupSummary) => number {
  return (a, b) => {
    const open = Number(ACCEPTING.has(b.status)) - Number(ACCEPTING.has(a.status));
    if (open) return open;
    let c = 0;
    switch (sort) {
      case "deadline:asc": c = cmp(a.deadlineAt, b.deadlineAt); break;
      case "start:asc": c = cmp(a.trip.startDate, b.trip.startDate) || cmp(a.deadlineAt, b.deadlineAt); break;
      case "created:desc": c = 0; break; // GroupSummary に createdAt が無いため id 降順で代用(FollowUp)
      case "vacancy:desc": c = cmp(b.headcount.vacancy, a.headcount.vacancy) || cmp(a.deadlineAt, b.deadlineAt); break;
    }
    if (sort === "created:desc" && !c) return cmp(b.id, a.id);
    return c || cmp(a.id, b.id);
  };
}

export function computeSuggestions(viewer: DemoUser, filter: GroupListFilter, all: GroupView[]): RelaxSuggestion[] {
  void viewer; void filter; void all;
  throw new Error("not implemented");
}
