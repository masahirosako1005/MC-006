// 05 の DTO 組み立て(PLN-FILE-04)。
import type { DemoUser } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import type { GroupPlan, PlanView } from "./types";

export function buildPlanView(_user: Readonly<DemoUser>, _group: Group, _plan: Readonly<GroupPlan>): PlanView {
  throw new Error("not implemented");
}
