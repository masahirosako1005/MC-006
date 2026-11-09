// エラー(統一仕様 3.3、00 第 5.4)。
export type ErrorCode =
  | "invalid_input" | "forbidden" | "blocked" | "not_found" | "method_not_allowed"
  | "conflict" | "unavailable_state" | "rate_limited"
  | "payload_too_large" | "unsupported_media_type" | "internal";

export interface ErrorBody {
  error: ErrorCode;
  reason?: string;
  message: string;
  fields?: Record<string, string>;
  detail?: Record<string, unknown>;
}

export const STATUS_BY_CODE: Record<ErrorCode, number> = {
  invalid_input: 400,
  forbidden: 403,
  blocked: 403,
  not_found: 404,
  method_not_allowed: 405,
  conflict: 409,
  unavailable_state: 409,
  rate_limited: 429,
  payload_too_large: 413,
  unsupported_media_type: 415,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly reason?: string;
  readonly fields?: Record<string, string>;
  readonly detail?: Record<string, unknown>;
  constructor(
    code: ErrorCode,
    message: string,
    opts?: { reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, opts?.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.reason = opts?.reason;
    this.fields = opts?.fields;
    this.detail = opts?.detail;
  }
}

type ErrOpts = { reason?: string; detail?: Record<string, unknown> };

export const invalidInput = (fields: Record<string, string>, message = "入力内容を確認してください。", opts?: ErrOpts) =>
  new AppError("invalid_input", message, { fields, ...opts });
export const forbidden = (message = "この操作を行う権限がありません。", opts?: ErrOpts) =>
  new AppError("forbidden", message, opts);
export const blocked = (message = "この操作は行えません。") => new AppError("blocked", message);
export const notFound = (label = "対象") => new AppError("not_found", `${label}が見つかりません。`);
export const conflict = (message: string, opts?: ErrOpts) => new AppError("conflict", message, opts);
export const unavailableState = (message: string, opts?: ErrOpts) => new AppError("unavailable_state", message, opts);
export const rateLimited = (
  retryAfterSec: number,
  message = "操作が多すぎます。しばらくしてからやり直してください。",
  opts?: { reason?: string },
) => new AppError("rate_limited", message, { reason: opts?.reason, detail: { retryAfterSec } });

export function toErrorBody(e: unknown, requestId?: string): { status: number; body: ErrorBody } {
  if (e instanceof AppError) {
    const body: ErrorBody = { error: e.code, message: e.message };
    if (e.reason) body.reason = e.reason;
    if (e.fields) body.fields = e.fields;
    if (e.detail) body.detail = e.detail;
    return { status: e.status, body };
  }
  return {
    status: 500,
    body: {
      error: "internal",
      message: "処理中にエラーが発生しました。時間をおいてもう一度お試しください。",
      ...(requestId ? { detail: { requestId } } : {}),
    },
  };
}

export function toResponse(e: unknown, requestId?: string): Response {
  const { status, body } = toErrorBody(e, requestId);
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (body.error === "rate_limited" && typeof body.detail?.retryAfterSec === "number") {
    headers["Retry-After"] = String(body.detail.retryAfterSec);
  }
  return new Response(JSON.stringify(body), { status, headers });
}
