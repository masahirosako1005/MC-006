"use client";
// クライアント fetch(00 第 5.9)。署名スタブ(P-1-4 で実装)。
import type { DemoUserSummary } from "./groups-types";
import type { ErrorCode } from "./errors";

export class ApiError extends Error {
  code: ErrorCode | "network";
  status: number;
  reason?: string;
  fields?: Record<string, string>;
  detail?: Record<string, unknown>;
  constructor(
    code: ErrorCode | "network",
    status: number,
    message: string,
    opts?: { reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown> },
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.reason = opts?.reason;
    this.fields = opts?.fields;
    this.detail = opts?.detail;
  }
}

export const NTF_REFRESH_EVENT = "ntf:refresh";

const ni = (): never => { throw new Error("not implemented"); };

export async function gapi<T>(path: string, init?: RequestInit): Promise<T> { void path; void init; return ni(); }
export const gpost = <T,>(path: string, data?: unknown): Promise<T> => { void path; void data; return ni(); };
export const gput = <T,>(path: string, data?: unknown): Promise<T> => { void path; void data; return ni(); };
export const gpatch = <T,>(path: string, data?: unknown): Promise<T> => { void path; void data; return ni(); };
export const gdelete = <T,>(path: string): Promise<T> => { void path; return ni(); };
export function useGroupsApi<T>(path: string | null): { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> } {
  void path; return ni();
}
export function useCurrentUser(): { user: DemoUserSummary | null; loading: boolean } { return ni(); }
