// 12 権限(MUN-FN-01)。署名スタブ。
import type { DemoUser } from "@/lib/groups-types";
import type { MunicipalScope } from "./types";

export function resolveScope(user: DemoUser): MunicipalScope { void user; throw new Error("not implemented"); }
