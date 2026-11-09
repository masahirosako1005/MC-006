// ビュー生成(02 DSC-FN-08・11・13・14)。
import type { DemoUser } from "@/lib/groups-types";
import type { Group, GroupMember } from "../core/types";
import type { ViewContext } from "./internal";
import type { ApplyState, GroupSummary, HeadcountView, ViewerRelation } from "./types";

export function toHeadcount(g: Group, activeCount: number): HeadcountView {
  void g; void activeCount;
  throw new Error("not implemented");
}

export function toGroupSummary(viewer: DemoUser, g: Group, ctx: ViewContext): GroupSummary {
  void viewer; void g; void ctx;
  throw new Error("not implemented");
}

export function buildApplyState(g: Group, h: HeadcountView, rel: ViewerRelation): ApplyState {
  void g; void h; void rel;
  throw new Error("not implemented");
}

export function isListVisible(viewer: DemoUser, g: Group, members: readonly GroupMember[]): boolean {
  void viewer; void g; void members;
  throw new Error("not implemented");
}
