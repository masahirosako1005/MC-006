import type { Id } from "@/lib/groups-types";
import { db } from "@/lib/groups-store";
import { conflict, invalidInput, notFound } from "@/lib/errors";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type { Group } from "@/features/groups/types";

export function getGroupById(id: Id): Readonly<Group> | undefined {
  return db().groups.get(id);
}

export function listAllGroups(): readonly Readonly<Group>[] {
  return db().groups.list();
}

export function countActiveMembers(groupId: Id): number {
  return db().members.count((m) => m.groupId === groupId && m.status === "active");
}

/** 04 だけが呼ぶ lifecycle の唯一の書き込み口。不一致は conflict + version_mismatch。 */
export function applyLifecyclePatch(
  groupId: Id,
  expectedRevision: number,
  patch: Partial<GroupLifecycle>,
): GroupLifecycle {
  const group = db().groups.get(groupId);
  if (!group) throw notFound("グループ");
  const cur = group.lifecycle;
  if (cur.revision !== expectedRevision) {
    throw conflict("他の更新と競合しました。再読み込みしてください。", {
      reason: "version_mismatch",
      detail: { current: cur },
    });
  }
  const rest: Partial<GroupLifecycle> = { ...patch };
  delete rest.revision;
  const next: GroupLifecycle = { ...cur, ...rest, revision: cur.revision + 1 };
  // INV-3 / INV-4
  const fields: Record<string, string> = {};
  if (next.minMembers < 2 || next.minMembers > group.capacity) {
    fields["lifecycle.minMembers"] = "最少人数は 2 人以上、人数上限以下にしてください";
  } else if (group.capacity === 2 && next.minMembers !== 2) {
    fields["lifecycle.minMembers"] = "人数上限が 2 人のときは最少人数も 2 人です";
  }
  if (next.deadlineDate >= group.trip.startDate) {
    fields["lifecycle.deadlineDate"] = "締切日は開始日より前にしてください";
  }
  if (Object.keys(fields).length > 0) throw invalidInput(fields);
  db().groups.update(groupId, { lifecycle: next });
  return next;
}
