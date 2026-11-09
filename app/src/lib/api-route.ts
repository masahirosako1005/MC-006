// API 共通ラッパー(00 第 5.5)。
import "@/features/bootstrap";
import { connection } from "next/server";
import { AppError, invalidInput, forbidden, notFound, toResponse } from "./errors";
import { runHooks } from "./hooks";
import { isId } from "./ids";
import { LIMITS } from "./limits";
import { currentUser } from "./current-user";
import { safeParse } from "./validation";
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

export const ok = (body: unknown, headers?: Record<string, string>): ApiResult => ({ [API_RESULT]: true, status: 200, body, headers });
export const created = (body: unknown, location?: string): ApiResult => ({
  [API_RESULT]: true,
  status: 201,
  body,
  headers: location ? { Location: location } : undefined,
});
export const noContent = (): ApiResult => ({ [API_RESULT]: true, status: 204 });

const isApiResult = (r: unknown): r is ApiResult =>
  typeof r === "object" && r !== null && (r as Record<symbol, unknown>)[API_RESULT] === true;

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const PAGE_KEYS = new Set(["limit", "offset", "sort"]);

function newRequestId(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(4));
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

function guardMutating(req: Request): void {
  const origin = req.headers.get("origin");
  if (origin !== null) {
    let host: string | null = null;
    try { host = new URL(origin).host; } catch { host = null; }
    if (host === null || host !== req.headers.get("host")) throw forbidden("この要求は受け付けられません。");
  }
  const ct = req.headers.get("content-type") ?? "";
  if (!/^application\/json\s*(;|$)/i.test(ct.trim())) {
    throw new AppError("unsupported_media_type", "Content-Type は application/json を指定してください。");
  }
  const len = req.headers.get("content-length");
  if (len !== null && Number(len) > LIMITS.BODY_BYTES) {
    throw new AppError("payload_too_large", "リクエストが大きすぎます。");
  }
}

function toHttp(r: ApiResult): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  for (const [k, v] of Object.entries(r.headers ?? {})) headers.set(k, v);
  if (r.status === 204) return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify(r.body ?? {}), { status: r.status, headers });
}

export function route<P extends RouteParams = Record<string, never>>(
  handler: (c: ApiContext<P>) => Promise<ApiResult | unknown> | ApiResult | unknown,
  opts?: RouteOptions,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response> {
  return async (req, ctx) => {
    // 動的な Route Handler として扱わせる(ビルド時の事前生成を避ける)。
    try {
      await connection();
    } catch (e) {
      // 試験(Next のリクエスト外で直接呼ぶ)だけで起きる。ビルド時の動的化の信号は握りつぶさない。
      if (!(e instanceof Error && e.message.includes("outside a request scope"))) throw e;
    }
    const requestId = newRequestId();
    const url = new URL(req.url);
    try {
      if (opts?.demoOnly && process.env.DEMO_TOOLS === "off") throw notFound("ページ");
      if (MUTATING.has(req.method.toUpperCase())) guardMutating(req);
      if (!opts?.skipHooks) runHooks("beforeRequest");
      const auth = opts?.auth ?? "demoUser";
      const user = auth === "demoUser" ? currentUser(req) : undefined;
      let bodyText: Promise<string> | undefined;

      const c: ApiContext<P> = {
        req,
        url,
        requestId,
        get user(): Readonly<DemoUser> {
          if (!user) throw new Error("user is not available when auth is none");
          return user;
        },
        async id(name, prefix) {
          const params = (await ctx.params) as RouteParams;
          const v = params[name];
          if (typeof v !== "string" || !isId(prefix, v)) throw notFound();
          return v;
        },
        async body(schema) {
          bodyText ??= req.text();
          const text = await bodyText;
          if (new TextEncoder().encode(text).length > LIMITS.BODY_BYTES) {
            throw new AppError("payload_too_large", "リクエストが大きすぎます。");
          }
          if (text.trim() === "") throw invalidInput({ body: "本文が必要です。" });
          let json: unknown;
          try { json = JSON.parse(text); } catch { throw invalidInput({ body: "JSON の形式が正しくありません。" }); }
          const r = safeParse(schema, json);
          if (!r.ok) throw invalidInput(r.fields);
          return r.value;
        },
        query(schema) {
          const obj: Record<string, string> = {};
          for (const [k, v] of url.searchParams) obj[k] = v;
          const r = safeParse(schema, obj);
          if (!r.ok) throw invalidInput(r.fields);
          const known = r.value as Record<string, unknown>;
          const unknown: Record<string, string> = {};
          for (const k of Object.keys(obj)) {
            if (!PAGE_KEYS.has(k) && !(k in known)) unknown[k] = "指定できない項目です。";
          }
          if (Object.keys(unknown).length) throw invalidInput(unknown);
          return r.value;
        },
      };

      const result = await handler(c);
      const res = isApiResult(result) ? result : ok(result === undefined ? {} : result);
      return toHttp(res);
    } catch (e) {
      if (!(e instanceof AppError)) console.error(`[${requestId}]`, req.method, url.pathname, e);
      return toResponse(e, requestId);
    }
  };
}
