import type { OfficialBadgeView } from "../types";

export interface OfficialBadgeProps {
  info: OfficialBadgeView;
  size?: "sm" | "md";
}

export function OfficialBadge(props: OfficialBadgeProps) {
  void props;
  return <span data-stub="OfficialBadge" />;
}
