// 08: 状態ごとの可否と共通前処理。スタブ(P-2-20)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { GroupRecord } from "@/features/safety/types";
import type { RallyAccess } from "./types";

export type RallyContext = { group: GroupRecord; access: RallyAccess };

export function rallyAccess(g: Pick<GroupRecord, "lifecycle">): RallyAccess {
  void g;
  throw new Error("not implemented");
}

export function loadRallyContext(user: DemoUser, groupId: Id): RallyContext {
  void user; void groupId;
  throw new Error("not implemented");
}

export function assertRallyOp(ctx: RallyContext, op: "stamp" | "review"): void {
  void ctx; void op;
  throw new Error("not implemented");
}
