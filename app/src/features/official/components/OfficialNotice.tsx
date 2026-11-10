import { DEMO_SPONSOR_NOTE, OFFICIAL_DISCLAIMER } from "../messages";

export interface OfficialNoticeProps { variant: "card" | "detail" }

export function OfficialNotice({ variant }: OfficialNoticeProps) {
  return (
    <p role="note" style={{ fontSize: variant === "card" ? 11 : 13, color: "#555", margin: "4px 0" }}>
      {OFFICIAL_DISCLAIMER}{variant === "detail" ? ` ${DEMO_SPONSOR_NOTE}` : ""}
    </p>
  );
}
