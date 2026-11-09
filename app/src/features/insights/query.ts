// 13 クエリの検証(INS-FN-02)。
import { forbidden, invalidInput } from "@/lib/errors";
import { isSlugId } from "@/lib/ids";
import type { BusinessScope, InsightQuery } from "./types";

const MSG_REGION = "エリアの指定が正しくありません";
const MSG_UNKNOWN = "使用できない条件です";

export function parseInsightQuery(sp: URLSearchParams, scope: BusinessScope): InsightQuery {
  const fields: Record<string, string> = {};
  for (const key of new Set(sp.keys())) {
    if (key !== "region") fields[key] = MSG_UNKNOWN;
  }
  const all = sp.getAll("region");
  if (all.length > 1 || (all.length === 1 && !isSlugId("r", all[0]))) fields.region = MSG_REGION;
  if (Object.keys(fields).length) throw invalidInput(fields);
  if (all.length === 0) return { region: null };
  if (!scope.regions.some((r) => r.id === all[0])) {
    throw forbidden("指定のエリアは担当外です。", { reason: "region_out_of_scope" });
  }
  return { region: all[0] };
}
