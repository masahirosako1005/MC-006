// 11 公式枠のハンドラ(ENT-API-03。ENT-API-04 は見送り=契約書 16.2)。
import { created, route } from "@/lib/api-route";
import type { Schema } from "@/lib/validation";
import { stubRoute } from "@/features/stub";
import { createOfficialSlot, getListing, getOfficialBadges } from "./service";
import type { OfficialSlotInput, SlotCreated } from "./types";

const RawBody: Schema<Record<string, unknown>> = {
  parse(input, path, issues) {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      issues[path || "body"] = "本文の形式が正しくありません。";
      return undefined as never;
    }
    return input as Record<string, unknown>;
  },
};

export const postOfficialSlotHandler = route(async (c) => {
  const raw = await c.body(RawBody);
  const g = createOfficialSlot(c.user, raw as unknown as OfficialSlotInput);
  const body: SlotCreated = { groupId: g.id, listing: getListing(g.id)!, badge: getOfficialBadges([g.id])[g.id] };
  return created(body, `/api/groups/${g.id}`);
});

export const postHostSlotHandler = stubRoute();
