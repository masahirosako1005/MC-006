// 13 のしきい値(13 §7.2)。
import { MIN_CELL_COUNT } from "@/features/stats/config";

export const INSIGHT_WEEKS = 12;
export const PLANNED_STATUSES = {
  confirmed: ["confirmed", "in_progress"],
  tentative: ["recruiting", "min_reached", "withdrawal_period"],
} as const;
export const INSIGHT_THRESHOLDS = {
  minCell: MIN_CELL_COUNT,
  minDenominator: 30,
  forecastIncreasePercent: 20,
  groupsPerWeekArea: 5,
  weekendRatio: 1.15,
  eveningSharePercent: 40,
  satisfiedGapPoints: 10,
  themeSharePercent: 15,
  themeDissatisfiedMultiplier: 2,
  completeGapPoints: 10,
  maxCardsPerRule: { R01: 4, R02: 2, other: 2 },
} as const;
