// 09: 頻度制限(固定ウィンドウ)。
import { clock } from "@/lib/clock";
import { rateLimited } from "@/lib/errors";
import { registerHook } from "@/lib/hooks";
import type { Id } from "@/lib/groups-types";
import { RATE_LIMITS } from "../policy";

const g = globalThis as unknown as { __safetyRateBuckets?: Map<string, { count: number; resetAt: number }> };
function buckets(): Map<string, { count: number; resetAt: number }> {
  return (g.__safetyRateBuckets ??= new Map());
}

export function checkRate(name: keyof typeof RATE_LIMITS, userId: Id, scope?: Id): void {
  const { limit, windowMs } = RATE_LIMITS[name];
  const key = scope ? `${name}:${userId}:${scope}` : `${name}:${userId}`;
  const now = clock.now().getTime();
  const m = buckets();
  let b = m.get(key);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + windowMs };
    m.set(key, b);
  }
  if (b.count >= limit) throw rateLimited(Math.max(1, Math.ceil((b.resetAt - now) / 1000)));
  b.count += 1;
}

export function resetRateBuckets(): void {
  buckets().clear();
}

registerHook("afterReset", "safety:rate", resetRateBuckets);
