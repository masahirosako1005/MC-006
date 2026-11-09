// 13 権限(INS-FN-01)。
import { forbidden } from "@/lib/errors";
import { db } from "@/lib/groups-store";
import type { DemoUser } from "@/lib/groups-types";
import type { BusinessScope } from "./types";

export function resolveBusinessScope(user: DemoUser): BusinessScope {
  const deny = () => forbidden("この画面は観光事業者のみ利用できます。", { reason: "not_business_owner" });
  if (user.role !== "business_owner" || !user.businessId) throw deny();
  const business = db().businesses.get(user.businessId);
  if (!business) throw deny();
  const regions = business.regionIds.flatMap((id) => {
    const r = db().regions.get(id);
    return r ? [{ id, name: r.name }] : [];
  });
  return { business, regions };
}
