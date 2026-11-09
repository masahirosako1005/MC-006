// 10: 宛先の解決(設計 6.5)。読み取り専用。
import type { Id } from "@/lib/groups-types";
import { db } from "@/lib/groups-store";
import { notFound } from "@/lib/errors";
import type { RecipientSpec } from "./types";

export function resolveRecipients(groupId: Id, specs: RecipientSpec[]): Id[] {
  const group = db().groups.get(groupId);
  if (!group) throw notFound("グループ");
  const out = new Set<Id>();
  for (const s of specs) {
    switch (s.type) {
      case "users":
        for (const id of s.userIds) if (db().users.get(id)) out.add(id);
        break;
      case "groupMembers":
        for (const m of db().members.filter((x) => x.groupId === groupId && x.status === "active")) {
          if (s.excludeOrganizer && m.userId === group.organizerId) continue;
          out.add(m.userId);
        }
        break;
      case "organizer":
        if (db().members.find((x) => x.groupId === groupId && x.userId === group.organizerId && x.status === "active")) {
          out.add(group.organizerId);
        }
        break;
      case "pendingApplicants":
        for (const r of db().joinRequests.filter((x) => x.groupId === groupId && x.status === "pending")) out.add(r.applicantId);
        break;
    }
  }
  // excludeUserIds は全宛先に適用する(設計 6.2 手順 4)。
  const excluded = new Set(specs.flatMap((s) => (s.type === "groupMembers" ? s.excludeUserIds ?? [] : [])));
  return [...out].filter((id) => !excluded.has(id)).sort();
}
