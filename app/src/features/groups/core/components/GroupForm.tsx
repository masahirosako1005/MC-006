"use client";
import type { Id } from "@/lib/groups-types";
import type { GroupFormValues } from "./formValues";

export interface GroupFormProps {
  mode: "create" | "edit" | "replan";
  campaign: string;
  groupId?: Id;
  initial?: GroupFormValues;
  onSubmit?: (values: GroupFormValues) => Promise<{ groupId: Id }>;
  onDone: (groupId: Id) => void;
}

export function GroupForm(props: GroupFormProps) {
  void props;
  return <div data-stub="GroupForm" />;
}
