// P-0-2 のスタブ用。ハンドラ本体を実装するタスクは、このファイルの stubRoute を route() に置き換える。
import { API_RESULT, route } from "@/lib/api-route";
import type { ApiResult, RouteOptions, RouteParams } from "@/lib/api-route";

export type GroupParams = { groupId: string };

export function notImplemented(): ApiResult {
  return {
    [API_RESULT]: true,
    status: 501,
    body: { error: "internal", reason: "not_implemented", message: "未実装です" },
  };
}

export function stubRoute<P extends RouteParams = Record<string, never>>(opts?: RouteOptions) {
  return route<P>(async () => notImplemented(), opts);
}
