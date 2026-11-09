// 13 のハンドラ(INS-API-01・02)。
import { route } from "@/lib/api-route";
import { resolveBusinessScope } from "./access";
import { parseInsightQuery } from "./query";
import { getInsightForecast, getInsightSuggestions } from "./service";

export const getInsightsHandler = route(async (c) => {
  const scope = resolveBusinessScope(c.user);
  return getInsightForecast(c.user, parseInsightQuery(c.url.searchParams, scope));
});

export const getInsightSuggestionsHandler = route(async (c) => {
  const scope = resolveBusinessScope(c.user);
  return getInsightSuggestions(c.user, parseInsightQuery(c.url.searchParams, scope));
});
