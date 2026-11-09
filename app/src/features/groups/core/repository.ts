import type { Id } from "@/lib/groups-types";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type { Group } from "@/features/groups/types";

export function getGroupById(id: Id): Readonly<Group> | undefined {
  void id;
  throw new Error("not implemented");
}

export function listAllGroups(): readonly Readonly<Group>[] {
  throw new Error("not implemented");
}

export function countActiveMembers(groupId: Id): number {
  void groupId;
  throw new Error("not implemented");
}

/** 04 だけが呼ぶ lifecycle の唯一の書き込み口。不一致は conflict + version_mismatch。 */
export function applyLifecyclePatch(
  groupId: Id,
  expectedRevision: number,
  patch: Partial<GroupLifecycle>,
): GroupLifecycle {
  void groupId; void expectedRevision; void patch;
  throw new Error("not implemented");
}
