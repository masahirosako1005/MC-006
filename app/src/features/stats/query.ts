// 12 クエリの検証(MUN-FN-02)。
import { AppError } from "@/lib/errors";
import { isDateStr, jstDate } from "@/lib/datetime";
import { isSlugId } from "@/lib/ids";
import { monthsBetween } from "./metrics";
import type { MunicipalScope, OfficialFilter, StatsQuery } from "./types";

const OFFICIALS: readonly string[] = ["all", "official", "general"];

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const monthEnd = (ym: string) => `${ym}-${pad(lastDay(Number(ym.slice(0, 4)), Number(ym.slice(5, 7))))}`;

export function parseStatsQuery(sp: URLSearchParams, scope: MunicipalScope, now: Date): StatsQuery {
  const fields: Record<string, string> = {};
  const rawFrom = sp.get("from") || undefined;
  const rawTo = sp.get("to") || undefined;
  const rawRegion = sp.get("region") || undefined;
  const rawOfficial = sp.get("official") || undefined;

  let to: string | undefined;
  if (rawTo !== undefined) {
    if (!isDateStr(rawTo) || rawTo !== monthEnd(rawTo.slice(0, 7))) fields.to = "月の末日を指定してください";
    else to = rawTo;
  } else {
    to = monthEnd(jstDate(now).slice(0, 7));
  }
  let from: string | undefined;
  if (rawFrom !== undefined) {
    if (!isDateStr(rawFrom) || !rawFrom.endsWith("-01")) fields.from = "月の初日(YYYY-MM-01)を指定してください";
    else from = rawFrom;
  } else if (to) {
    let y = Number(to.slice(0, 4));
    let m = Number(to.slice(5, 7)) - 2;
    if (m < 1) { m += 12; y -= 1; }
    from = `${y}-${pad(m)}-01`;
  }
  if (from && to && !fields.from && !fields.to) {
    if (from > to) fields.to = "開始月より後の月を指定してください";
    else if (monthsBetween(from, to).length > 12) fields.to = "期間は 12 か月以内で指定してください";
  }

  let official: OfficialFilter = "all";
  if (rawOfficial !== undefined) {
    if (OFFICIALS.includes(rawOfficial)) official = rawOfficial as OfficialFilter;
    else fields.official = "選択肢から選んでください";
  }
  let region: string | null = null;
  if (rawRegion !== undefined) {
    if (!isSlugId("r", rawRegion)) fields.region = "地方の指定が正しくありません";
    else region = rawRegion;
  }
  if (Object.keys(fields).length) {
    throw new AppError("invalid_input", "入力内容を確認してください。", { fields });
  }
  if (region && !scope.regions.some((r) => r.id === region)) {
    throw new AppError("forbidden", "この地方の集計は閲覧できません。", { reason: "region_out_of_scope" });
  }
  return { from: from as string, to: to as string, region, official };
}
