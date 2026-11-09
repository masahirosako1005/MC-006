import { randomInt } from "node:crypto";
import type { Id, IsoDateTime } from "@/lib/groups-types";
import { db } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import { notFound } from "@/lib/errors";
import type { Group, InviteCode, InviteCodeView } from "@/features/groups/types";
import { INVITE_CODE_CHARSET, INVITE_CODE_LENGTH, INVITE_CODE_TTL_DAYS } from "./constants";
import { normalizeInviteCode } from "./validation";

export { normalizeInviteCode } from "./validation";

function isActive(c: InviteCode | null | undefined): c is InviteCode {
  return !!c && c.revokedAt === null && Date.parse(c.expiresAt) > clock.now().getTime();
}

/** 衝突しない新しいコードを作る(最大 9 回)。 */
export function generateInviteCode(): InviteCode {
  const used = new Set(db().groups.list().map((g) => g.inviteCode?.code));
  for (let i = 0; i < 9; i++) {
    let code = "";
    for (let j = 0; j < INVITE_CODE_LENGTH; j++) code += INVITE_CODE_CHARSET[randomInt(INVITE_CODE_CHARSET.length)];
    if (used.has(code)) continue;
    const issuedAt: IsoDateTime = clock.nowIso();
    const expiresAt = new Date(clock.now().getTime() + INVITE_CODE_TTL_DAYS * 86400_000);
    return { code, issuedAt, expiresAt: toIso(expiresAt), revokedAt: null };
  }
  throw new Error("invite code collision");
}

function toIso(d: Date): IsoDateTime {
  // clock.nowIso と同じ JST 表記
  const j = new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 19);
  return `${j}+09:00`;
}

export function toInviteCodeView(c: InviteCode): InviteCodeView {
  return {
    code: `${c.code.slice(0, 5)}-${c.code.slice(5)}`,
    issuedAt: c.issuedAt,
    expiresAt: c.expiresAt,
    expired: !isActive(c),
  };
}

export function hasActiveInviteCode(g: Pick<Group, "inviteCode">): boolean {
  return isActive(g.inviteCode);
}

export function findGroupByInviteCode(rawCode: string): Readonly<Group> | undefined {
  const code = normalizeInviteCode(rawCode);
  if (code === null) return undefined;
  return db().groups.find((g) => g.inviteCode?.code === code && isActive(g.inviteCode));
}

export function assertInviteCode(groupId: Id, rawCode: string): void {
  const g = findGroupByInviteCode(rawCode);
  if (!g || g.id !== groupId) throw notFound();
}
