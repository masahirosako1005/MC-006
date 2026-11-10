import type { OfficialBadgeView } from "../types";

export interface OfficialBadgeProps {
  info: OfficialBadgeView;
  size?: "sm" | "md";
}

export function OfficialBadge({ info, size = "md" }: OfficialBadgeProps) {
  const official = info.official;
  return (
    <span
      aria-label={`${info.badgeLabel}(主催: ${info.sponsorName})`}
      style={{
        display: "inline-block", borderRadius: 999, fontWeight: 700,
        padding: size === "sm" ? "1px 8px" : "3px 12px", fontSize: size === "sm" ? 11 : 13,
        background: official ? "#d0ebff" : "#d3f9d8", color: official ? "#1864ab" : "#2b8a3e",
      }}
    >
      {info.badgeLabel}
    </span>
  );
}
