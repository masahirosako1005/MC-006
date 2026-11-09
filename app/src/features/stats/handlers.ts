// 12 のハンドラ(MUN-API-01)。
import { ok, route } from "@/lib/api-route";
import { clock } from "@/lib/clock";
import { v } from "@/lib/validation";
import { resolveScope } from "./access";
import { parseStatsQuery } from "./query";
import { getStats } from "./service";

const OPT = v.string({ optional: true, max: 40 });
const STATS_QUERY_SCHEMA = v.object({ from: OPT, to: OPT, region: OPT, official: OPT });

export const getStatsHandler = route(async (c) => {
  const scope = resolveScope(c.user);
  c.query(STATS_QUERY_SCHEMA);
  const query = parseStatsQuery(c.url.searchParams, scope, clock.now());
  return ok(getStats(c.user, query));
});
