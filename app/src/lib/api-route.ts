// API 共通ラッパー(00 第 5.5)。署名スタブ(P-1-3 で実装)。
import type { DemoUser, Id } from "./groups-types";
import type { IdPrefix } from "./ids";
import type { Infer, Schema } from "./validation";

export type RouteParams = Record<string, string | string[]>;
export interface ApiContext<P extends RouteParams = Record<string, never>> {
  req: Request;
  url: URL;
  user: Readonly<DemoUser>;
  requestId: string;
  id(name: keyof P & string, prefix: IdPrefix): Promise<Id>;
  body<S extends Schema>(schema: S): Promise<Infer<S>>;
  query<S extends Schema>(schema: S): Infer<S>;
}
export interface RouteOptions {
  auth?: "demoUser" | "none";
  demoOnly?: boolean;
  skipHooks?: boolean;
}
export const API_RESULT: unique symbol = Symbol("apiResult");
export type ApiResult = { [API_RESULT]: true; status: number; body?: unknown; headers?: Record<string, string> };

export const ok = (body: unknown, headers?: Record<string, string>): ApiResult => { void body; void headers; throw new Error("not implemented"); };
export const created = (body: unknown, location?: string): ApiResult => { void body; void location; throw new Error("not implemented"); };
export const noContent = (): ApiResult => { throw new Error("not implemented"); };

export function route<P extends RouteParams = Record<string, never>>(
  handler: (c: ApiContext<P>) => Promise<ApiResult | unknown> | ApiResult | unknown,
  opts?: RouteOptions,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response> {
  void handler; void opts;
  // スタブ: ビルド時のプリレンダーで落ちないよう 501 を返す(P-1-3 で本実装に置き換える)。
  return async () => Response.json(
    { error: "internal", reason: "not_implemented", message: "未実装です" },
    { status: 501 },
  );
}
