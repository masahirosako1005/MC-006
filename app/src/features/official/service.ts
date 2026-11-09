// 公式枠・地元の枠のサービス(11 ENT-FN-07〜12、14)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import { clock } from "@/lib/clock";
import { AppError, forbidden, invalidInput } from "@/lib/errors";
import { db, tx } from "@/lib/groups-store";
import { LIMITS } from "@/lib/limits";
import { createGroupInternal } from "@/features/groups/core/service";
import { validateCreateGroupInput } from "@/features/groups/core/validation";
import { buildInitialLifecycle, recordCreated, validateLifecycleInput } from "@/features/groups/lifecycle";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { requireVerified } from "@/features/safety/verification/verification-service";
import { EVENT_BADGE_LABEL, HOST_BADGE_LABEL, OFFICIAL_BADGE_LABEL } from "./messages";
import type {
  HostSlotInput, Listing, LocalHost, Municipality, OfficialBadgeView, OfficialSlotInput, SponsorRef,
} from "./types";

function sponsorName(s: SponsorRef): string {
  const r = s.type === "municipality" ? db().municipalities.get(s.id) : db().hosts.get(s.id);
  return r?.displayName ?? "";
}

function toBadge(l: Readonly<Listing>): OfficialBadgeView {
  const official = l.sponsor.type === "municipality";
  const badgeLabel: OfficialBadgeView["badgeLabel"] =
    l.kind === "host_slot" ? HOST_BADGE_LABEL : official ? OFFICIAL_BADGE_LABEL : EVENT_BADGE_LABEL;
  return {
    kind: l.kind, official, sponsorName: sponsorName(l.sponsor), badgeLabel,
    summary: l.summary, highlights: [...l.highlights],
  };
}

export function getOfficialBadges(groupIds: Id[]): Record<Id, OfficialBadgeView> {
  const out: Record<Id, OfficialBadgeView> = {};
  for (const id of groupIds) {
    const l = db().listings.get(id);
    if (l) out[id] = toBadge(l);
  }
  return out;
}

export function getListing(groupId: Id): Readonly<Listing> | undefined {
  return db().listings.get(groupId);
}

export function getMunicipality(id: string): Readonly<Municipality> | undefined {
  return db().municipalities.get(id);
}

export function resolveSponsor(user: DemoUser, type: SponsorRef["type"]): Readonly<Municipality> | Readonly<LocalHost> {
  if (type === "municipality" && user.role === "municipal" && user.municipalityId) {
    const m = db().municipalities.get(user.municipalityId);
    if (m) return m;
  }
  if (type === "host" && user.role === "host" && user.hostId) {
    const h = db().hosts.get(user.hostId);
    if (h) return h;
  }
  throw forbidden(type === "municipality" ? "自治体の担当者のみができる操作です。" : "地元の担い手のみができる操作です。");
}

const prefixFields = (f: Record<string, string> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(f ?? {}).map(([k, m]) => [`group.${k}`, m]));

function reprefix(e: unknown): unknown {
  if (e instanceof AppError && e.code === "invalid_input") {
    return new AppError("invalid_input", e.message, { fields: prefixFields(e.fields), reason: e.reason, detail: e.detail });
  }
  return e;
}

function createSlot(
  user: DemoUser,
  input: OfficialSlotInput | HostSlotInput,
  sponsor: SponsorRef,
  official: boolean,
): Group {
  requireVerified(user.id, "create_group");
  const raw = input as unknown as Record<string, unknown>;
  const fields: Record<string, string> = {};
  const kinds = official ? ["official_plan", "gathering_event"] : ["host_slot", "gathering_event"];
  if (!kinds.includes(input.kind)) fields.kind = "種別が正しくありません。";
  const { summary, highlights } = input;
  const S = LIMITS.OFFICIAL_SUMMARY;
  if (typeof summary !== "string" || [...summary].length < S.min || [...summary].length > S.max) {
    fields.summary = `要約は ${S.max} 文字以内で入力してください。`;
  }
  const H = LIMITS.OFFICIAL_HIGHLIGHT;
  if (!Array.isArray(highlights) || highlights.length > H.maxItems) {
    fields.highlights = `見どころは ${H.maxItems} 件以内で指定してください。`;
  } else {
    highlights.forEach((h, i) => {
      if (typeof h !== "string" || [...h].length < H.min || [...h].length > H.max) {
        fields[`highlights.${i}`] = `見どころは ${H.min}〜${H.max} 文字で入力してください。`;
      }
    });
  }
  const g = raw.group;
  if (typeof g !== "object" || g === null || Array.isArray(g)) fields.group = "グループの内容が必要です。";
  if (Object.keys(fields).length) throw invalidInput(fields);

  const gr = g as Record<string, unknown>;
  let checked;
  try {
    checked = validateCreateGroupInput({ ...gr, visibility: "public" });
  } catch (e) {
    throw reprefix(e);
  }
  if (sponsor.type === "municipality") {
    const m = db().municipalities.get(sponsor.id);
    if (m && !m.regionIds.includes(checked.region)) {
      throw invalidInput({ "group.region": "担当地方の中から選んでください。" });
    }
  }

  // 禁止表現(09)。field は本文の項目パス。
  const ack = { ackReview: input.ackReview === true };
  const guard = (text: string, ctx: Parameters<typeof assertTextAllowed>[1], field: string) =>
    assertTextAllowed(text, ctx, field, ack);
  guard(checked.name, "group_name", "group.name");
  guard(checked.trip.destination, "group_destination", "group.trip.destination");
  if (checked.trip.dateNote) guard(checked.trip.dateNote, "group_date_note", "group.trip.dateNote");
  if (checked.description) guard(checked.description, "group_description", "group.description");
  checked.tags.forEach((t, i) => guard(t, "group_tag", `group.tags.${i}`));
  guard(summary, "official_summary", "summary");
  (highlights as string[]).forEach((h, i) => guard(h, "official_highlight", `highlights.${i}`));

  const now = clock.now();
  const created = tx(() => {
    let lifecycleInput;
    try {
      lifecycleInput = validateLifecycleInput(
        { minMembers: typeof gr.minMembers === "number" ? gr.minMembers : undefined, deadlineDate: gr.deadlineDate as string },
        { capacity: checked.capacity, startDate: checked.trip.startDate, now },
      );
    } catch (e) {
      throw reprefix(e);
    }
    const lifecycle = buildInitialLifecycle(lifecycleInput, now);
    const group = createGroupInternal({ ...checked, visibility: "public", official, organizerId: user.id, lifecycle });
    db().listings.insert({
      id: group.id, kind: input.kind, sponsor, summary, highlights: [...(highlights as string[])],
      approvalMode: "organizer", createdAt: clock.nowIso(),
    });
    return group;
  });
  recordCreated(created.id);
  return created;
}

export function createOfficialSlot(user: DemoUser, input: OfficialSlotInput): Group {
  const m = resolveSponsor(user, "municipality");
  if (m.id !== input.municipalityId) throw forbidden("自治体の担当者のみができる操作です。");
  return createSlot(user, input, { type: "municipality", id: m.id }, true);
}

export function createHostSlot(user: DemoUser, input: HostSlotInput): Group {
  const h = resolveSponsor(user, "host");
  if (h.id !== input.hostId) throw forbidden("地元の担い手のみができる操作です。");
  return createSlot(user, input, { type: "host", id: h.id }, false);
}

export function assertListingInvariants(): string[] {
  const out: string[] = [];
  for (const g of db().groups.list()) {
    const l = db().listings.get(g.id);
    if (g.official && !(l && l.sponsor.type === "municipality")) out.push(`${g.id}: official だが自治体の Listing が無い`);
    if (!g.official && l && l.sponsor.type === "municipality") out.push(`${g.id}: official でないが自治体の Listing がある`);
  }
  for (const l of db().listings.list()) {
    if (!db().groups.get(l.id)) out.push(`${l.id}: Listing の Group が無い`);
  }
  return out;
}
