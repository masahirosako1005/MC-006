// 09: ブロック。
import { clock } from "@/lib/clock";
import { blocked, invalidInput, notFound } from "@/lib/errors";
import { db, newId } from "@/lib/groups-store";
import type { DemoUser, Id, Page } from "@/lib/groups-types";
import { paginate } from "@/lib/query";
import { checkRate } from "../guards/rate-limit";
import type { Block, BlockView } from "../types";

function active(blockerId: Id, blockedId: Id): Readonly<Block> | undefined {
  return db().blocks.find((b) => b.blockerId === blockerId && b.blockedId === blockedId && b.releasedAt === null);
}

export function blockUser(user: Readonly<DemoUser>, targetUserId: Id, sourceGroupId?: Id): { block: Block; created: boolean } {
  if (user.id === targetUserId) throw invalidInput({ userId: "自分自身はブロックできません。" });
  if (!db().users.get(targetUserId)) throw notFound("利用者");
  const existing = active(user.id, targetUserId);
  if (existing) return { block: existing, created: false };
  checkRate("block", user.id);
  const block = db().blocks.insert({
    id: newId("bl"),
    blockerId: user.id,
    blockedId: targetUserId,
    createdAt: clock.nowIso(),
    releasedAt: null,
    sourceGroupId: sourceGroupId ?? null,
  });
  return { block, created: true };
}

export function unblockUser(user: Readonly<DemoUser>, targetUserId: Id): void {
  const b = active(user.id, targetUserId);
  if (!b) throw notFound("ブロック");
  db().blocks.update(b.id, { releasedAt: clock.nowIso() });
}

export function listBlocks(user: Readonly<DemoUser>, page: { limit: number; offset: number }): Page<BlockView> {
  const rows = db().blocks
    .filter((b) => b.blockerId === user.id && b.releasedAt === null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
    .map((b) => ({
      userId: b.blockedId,
      displayName: db().users.get(b.blockedId)?.displayName ?? "",
      createdAt: b.createdAt,
    }));
  return paginate(rows, page);
}

export function isBlocked(a: Id, b: Id): boolean {
  return db().blocks.count((x) => x.releasedAt === null && ((x.blockerId === a && x.blockedId === b) || (x.blockerId === b && x.blockedId === a))) > 0;
}

export function isBlockedByMe(viewerId: Id, otherId: Id): boolean {
  return active(viewerId, otherId) !== undefined;
}

export function hasBlockAmong(viewerId: Id, userIds: readonly Id[]): boolean {
  return userIds.some((id) => id !== viewerId && isBlocked(viewerId, id));
}

export function assertNotBlocked(a: Id, b: Id): void {
  if (isBlocked(a, b)) throw blocked();
}

export function filterVisibleMessages<T extends { senderId: Id | null }>(viewerId: Id, msgs: T[]): T[] {
  return msgs.filter((m) => m.senderId === null || !isBlockedByMe(viewerId, m.senderId));
}
