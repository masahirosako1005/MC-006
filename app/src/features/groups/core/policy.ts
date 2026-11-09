import type { GroupStatus } from "@/features/groups/lifecycle/types";
import type { EditableField } from "@/features/groups/types";

const ALL: EditableField[] = ["name", "region", "trip", "capacity", "visibility", "tags", "description"];
const TABLE: Record<GroupStatus, readonly EditableField[]> = {
  recruiting: ALL,
  min_reached: ["name", "region", "visibility", "tags", "description"],
  withdrawal_period: ["name", "tags", "description"],
  confirmed: ["tags", "description"],
  in_progress: ["description"],
  completed: [],
  cancelled: [],
  replanned: [],
};

export function editableFields(status: GroupStatus): ReadonlySet<EditableField> {
  return new Set(TABLE[status] ?? []);
}
