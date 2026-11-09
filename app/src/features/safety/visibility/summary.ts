// 09: メンバー概要。スタブ(P-2-1)。
import type { Id } from "@/lib/groups-types";
import type { AgeBand, MemberSummary } from "../types";

export function memberSummary(members: ReadonlyArray<{ ageBand: AgeBand }>): MemberSummary {
  void members;
  throw new Error("not implemented");
}

export function formatMemberSummary(s: MemberSummary): string {
  void s;
  throw new Error("not implemented");
}

export function ageBandsOf(userIds: readonly Id[]): { ageBand: AgeBand }[] {
  void userIds;
  throw new Error("not implemented");
}
