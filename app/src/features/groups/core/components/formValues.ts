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
  return {
    name: values.name.trim(),
    campaign,
    region: values.region,
    trip: {
      destination: values.destination.trim(),
      startDate: values.startDate as DateStr,
      endDate: values.endDate as DateStr,
      dateNote: values.dateNote.trim(),
    },
    capacity: values.capacity,
    visibility: values.visibility,
    tags: values.tags,
    description: values.description.trim(),
    minMembers: values.minMembers,
    deadlineDate: values.deadlineDate as DateStr,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function toUpdateGroupPatch(initial: GroupFormValues, values: GroupFormValues): UpdateGroupPatch {
  const patch: UpdateGroupPatch = {};
  if (values.name.trim() !== initial.name) patch.name = values.name.trim();
  if (values.region !== initial.region) patch.region = values.region;
  if (values.capacity !== initial.capacity) patch.capacity = values.capacity;
  if (values.visibility !== initial.visibility) patch.visibility = values.visibility;
  if (!same(values.tags, initial.tags)) patch.tags = values.tags;
  if (values.description.trim() !== initial.description) patch.description = values.description.trim();
  const tripKeys = ["destination", "startDate", "endDate", "dateNote"] as const;
  if (tripKeys.some((k) => values[k] !== initial[k])) {
    patch.trip = {
      destination: values.destination.trim(),
      startDate: values.startDate as DateStr,
      endDate: values.endDate as DateStr,
      dateNote: values.dateNote.trim(),
    };
  }
  return patch;
}

export function groupToFormValues(group: GroupDetailView["group"]): GroupFormValues {
  return {
    name: group.name,
    region: group.region,
    destination: group.trip.destination,
    startDate: group.trip.startDate,
    endDate: group.trip.endDate,
    dateNote: group.trip.dateNote,
    capacity: group.capacity,
    minMembers: group.lifecycle.minMembers,
    deadlineDate: group.lifecycle.deadlineDate,
    visibility: group.visibility,
    tags: [...group.tags],
    description: group.description,
  };
}
