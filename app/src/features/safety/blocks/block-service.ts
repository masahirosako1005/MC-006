// 09: ブロック。スタブ(P-2-1)。
import type { DemoUser, Id, Page } from "@/lib/groups-types";
import type { Block, BlockView } from "../types";

export function blockUser(user: Readonly<DemoUser>, targetUserId: Id, sourceGroupId?: Id): { block: Block; created: boolean } {
  void user; void targetUserId; void sourceGroupId;
  throw new Error("not implemented");
}

export function unblockUser(user: Readonly<DemoUser>, targetUserId: Id): void {
  void user; void targetUserId;
  throw new Error("not implemented");
}

export function listBlocks(user: Readonly<DemoUser>, page: { limit: number; offset: number }): Page<BlockView> {
  void user; void page;
  throw new Error("not implemented");
}

export function isBlocked(a: Id, b: Id): boolean {
  void a; void b;
  throw new Error("not implemented");
}

export function isBlockedByMe(viewerId: Id, otherId: Id): boolean {
  void viewerId; void otherId;
  throw new Error("not implemented");
}

export function hasBlockAmong(viewerId: Id, userIds: readonly Id[]): boolean {
  void viewerId; void userIds;
  throw new Error("not implemented");
}

export function assertNotBlocked(a: Id, b: Id): void {
  void a; void b;
  throw new Error("not implemented");
}

export function filterVisibleMessages<T extends { senderId: Id | null }>(viewerId: Id, msgs: T[]): T[] {
  void viewerId; void msgs;
  throw new Error("not implemented");
}
