import type { GroupStatus } from "@/features/groups/lifecycle/types";
import type { EditableField } from "@/features/groups/types";

export function editableFields(status: GroupStatus): ReadonlySet<EditableField> {
  void status;
  throw new Error("not implemented");
}
