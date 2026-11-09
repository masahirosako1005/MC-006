import { ApiError } from "@/lib/groups-api";

// フックではなく純関数(名前は設計書どおり)。
export function useFormErrors(err: unknown): { fields: Record<string, string>; general: string | null } {
  if (err === null || err === undefined) return { fields: {}, general: null };
  if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) return { fields: err.fields, general: null };
  return { fields: {}, general: err instanceof Error ? err.message : String(err) };
}
