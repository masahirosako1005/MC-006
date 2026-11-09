// status_changed の購読処理(JOIN-FN-09)。
import { db } from "@/lib/groups-store";
import { notify } from "@/features/notify/service";
import type { DomainEvent } from "@/lib/events";

const OPEN = new Set(["recruiting", "min_reached"]);

export function expireOnStatusChanged(e: Extract<DomainEvent, { type: "status_changed" }>): number {
  try {
    if (OPEN.has(e.to)) return 0;
    const pending = db().joinRequests.filter((r) => r.groupId === e.groupId && r.status === "pending");
    if (pending.length === 0) return 0;
    for (const r of pending) {
      db().joinRequests.update(r.id, { status: "expired", decidedBy: "system", decidedAt: e.at });
    }
    if (e.to === "withdrawal_period") {
      const title = db().groups.get(e.groupId)?.name ?? "";
      for (const r of pending) {
        try {
          notify({
            kind: "join_expired",
            groupId: e.groupId,
            eventKey: `je:${r.id}`,
            params: { groupTitle: title },
            recipients: [{ type: "users", userIds: [r.applicantId] }],
          });
        } catch (err) {
          console.error("join_expired notify failed", err);
        }
      }
    }
    return pending.length;
  } catch (err) {
    console.error("expireOnStatusChanged failed", err);
    return 0;
  }
}
