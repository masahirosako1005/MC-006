import type { Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/types";

export { normalizeInviteCode } from "./validation";

export function findGroupByInviteCode(rawCode: string): Readonly<Group> | undefined {
  void rawCode;
  throw new Error("not implemented");
}

export function assertInviteCode(groupId: Id, rawCode: string): void {
  void groupId; void rawCode;
  throw new Error("not implemented");
}
