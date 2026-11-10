import type { HostBadgeView } from "../types";
import { OfficialBadge } from "./OfficialBadge";

export interface HostBadgeProps { info: HostBadgeView }

export function HostBadge({ info }: HostBadgeProps) {
  return <OfficialBadge info={info} />;
}
