import type { DateStr, Id } from "@/lib/groups-types";
import type {
  CreateGroupRequest, GroupDetailView, UpdateGroupPatch, Visibility,
} from "@/features/groups/types";

export interface GroupFormValues {
  name: string;
  region: Id;
  destination: string;
  startDate: DateStr | null;
  endDate: DateStr | null;
  dateNote: string;
  capacity: number;
  minMembers: number;
  deadlineDate: DateStr | null;
  visibility: Visibility;
  tags: string[];
  description: string;
}
export type FieldErrors = Record<string, string>;
export interface ApiErrorView { code: string; reason?: string; message: string; fields?: FieldErrors; }

export function toCreateGroupRequest(values: GroupFormValues, campaign: string): CreateGroupRequest {
  void values; void campaign;
  throw new Error("not implemented");
}
export function toUpdateGroupPatch(initial: GroupFormValues, values: GroupFormValues): UpdateGroupPatch {
  void initial; void values;
  throw new Error("not implemented");
}
export function groupToFormValues(group: GroupDetailView["group"]): GroupFormValues {
  void group;
  throw new Error("not implemented");
}
