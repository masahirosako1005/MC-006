import type { CountCell } from "@/features/stats/types";
export function cellText(c: CountCell | undefined | null, unit = "人"): string {
  if (!c) return "-";
  return c.few ? "少数" : `${c.value}${unit}`;
}
export function cellNum(c: CountCell | undefined | null): string {
  if (!c) return "-";
  return c.few ? "少数" : String(c.value);
}
