// 10: notify の本体(P-2-13)。service.ts は P-2-14 の所有のため、別ファイルに置き index.ts から公開する。
import type { Id } from "@/lib/groups-types";
import { clock } from "@/lib/clock";
import { invalidInput, notFound } from "@/lib/errors";
import { newId, tx } from "@/lib/groups-store";
import { parse } from "@/lib/validation";
import { ageBandsOf, formatMemberSummary, memberSummary } from "@/features/safety/visibility/summary";
import { paramsSchema } from "./params";
import { resolveRecipients } from "./recipients";
import { FALLBACK_SUMMARY } from "./messages";
import { NOTIFICATION_KINDS } from "./types";
import type { GroupNotification, NotificationKind, NotifyInput, NotifyResult } from "./types";

const EVENT_KEY = /^[A-Za-z0-9:_.@+-]{1,80}$/;

export function notify<K extends NotificationKind>(input: NotifyInput<K>): NotifyResult {
  const { kind, groupId, eventKey } = input;
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(kind)) throw invalidInput({ kind: "未対応の種類です。" });
  if (typeof eventKey !== "string" || !EVENT_KEY.test(eventKey)) throw invalidInput({ eventKey: "形式が正しくありません。" });
  const params = parse(paramsSchema(kind), input.params) as Record<string, unknown>;
  return tx((d) => {
    if (!d.groups.get(groupId)) throw notFound("グループ");
    const userIds = resolveRecipients(groupId, input.recipients);
    if (userIds.length === 0) return { created: [], skippedDuplicate: [], recipientCount: 0 };
    if (kind === "confirmed") {
      let text = FALLBACK_SUMMARY;
      try {
        const members = d.members.filter((m) => m.groupId === groupId && m.status === "active").map((m) => m.userId);
        const t = formatMemberSummary(memberSummary(ageBandsOf(members)));
        if (typeof t === "string" && Array.from(t).length >= 1 && Array.from(t).length <= 80) text = t;
      } catch {
        // 固定文にフォールバック(設計 11.3)
      }
      params.summaryText = text;
    }
    const created: GroupNotification[] = [];
    const skippedDuplicate: Id[] = [];
    for (const userId of userIds) {
      const dedupeKey = [kind, groupId, userId, eventKey].join(":");
      if (d.notifications.find((n) => n.dedupeKey === dedupeKey)) {
        skippedDuplicate.push(userId);
        continue;
      }
      created.push(
        d.notifications.insert({
          id: newId("n"), userId, kind, groupId,
          params: structuredClone(params) as unknown as GroupNotification["params"],
          dedupeKey, createdAt: clock.nowIso(), readAt: null,
        }) as GroupNotification,
      );
    }
    return { created, skippedDuplicate, recipientCount: userIds.length };
  });
}
