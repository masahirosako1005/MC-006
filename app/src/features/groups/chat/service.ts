// 06 サービス層(CHT-FN)。
import { clock } from "@/lib/clock";
import { invalidInput, unavailableState } from "@/lib/errors";
import { db, newId, tx } from "@/lib/groups-store";
import { idSeq } from "@/lib/ids";
import { isMember } from "@/lib/authz";
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import { canChat, canReadHistory } from "@/features/groups/lifecycle/policy";
import { assertGroupAccess, assertInGroup } from "@/features/safety/guards/access";
import { checkRate } from "@/features/safety/guards/rate-limit";
import { filterVisibleMessages } from "@/features/safety/blocks/block-service";
import { assertTextAllowed } from "@/features/safety/text/check-text";
import { createReport } from "@/features/safety/reports/report-service";
import { visibleProfile } from "@/features/safety/visibility/profile";
import type { ReportReason } from "@/features/safety/types";
import { CHAT_FREE_INPUT, PAGE_DEFAULT, PAGE_MAX } from "./constants";
import { CHAT_MESSAGES } from "./messages";
import { normalizeBody, validateBody } from "./sanitize";
import { renderSystemText } from "./system-messages";
import { CHAT_TEMPLATES } from "./templates";
import type {
  ChatAccess, ChatReadMark, ChatTemplate, GroupMessage, ListMessagesResponse, MessageDto, PostMessageInput,
} from "./types";

const seqOf = (m: { id: Id }): number => idSeq(m.id);

function groupMessages(groupId: Id): GroupMessage[] {
  return db().messages.filter((m) => m.groupId === groupId).sort((a, b) => seqOf(a) - seqOf(b));
}

export function chatAccess(user: DemoUser, group: Group): ChatAccess {
  if (!isMember(user, group)) return { canRead: false, canPost: false, reason: "not_member" };
  const canRead = canReadHistory(group);
  if (!canChat(group)) return { canRead, canPost: false, reason: "state_readonly" };
  return { canRead, canPost: true };
}

export function listTemplates(): readonly ChatTemplate[] {
  return CHAT_TEMPLATES;
}

function makeResolver(viewer: DemoUser, groupId: Id) {
  const cache = new Map<Id, string>();
  const resolveName = (id: Id): string => {
    const hit = cache.get(id);
    if (hit !== undefined) return hit;
    let name: string;
    if (!isMember(id, groupId)) name = CHAT_MESSAGES.formerMember;
    else {
      try {
        name = visibleProfile(viewer, id, { kind: "member", groupId }).displayName;
      } catch {
        name = CHAT_MESSAGES.memberFallback;
      }
    }
    cache.set(id, name);
    return name;
  };
  return { resolveName, isMemberNow: (id: Id) => isMember(id, groupId) };
}

export function toDto(
  m: GroupMessage,
  viewerId: Id,
  resolveName: (id: Id) => string,
  isMemberNow: (id: Id) => boolean,
): MessageDto {
  const isSystem = m.kind === "system";
  const senderName = isSystem
    ? CHAT_MESSAGES.systemSender
    : m.senderId && isMemberNow(m.senderId) ? resolveName(m.senderId) : CHAT_MESSAGES.formerMember;
  return {
    id: m.id,
    kind: m.kind,
    senderId: m.senderId,
    senderName,
    isMine: m.senderId !== null && m.senderId === viewerId,
    text: isSystem ? renderSystemText(m, resolveName) : m.body,
    templateId: m.templateId,
    createdAt: m.createdAt,
    reportedByMe: m.reportedBy.includes(viewerId),
  };
}

function readSeq(userId: Id, groupId: Id): number {
  return db().chatReads.get(`${groupId}:${userId}`)?.lastReadSeq ?? 0;
}

function unreadOf(user: DemoUser, groupId: Id): number {
  const since = readSeq(user.id, groupId);
  const msgs = groupMessages(groupId).filter((m) => seqOf(m) > since && m.senderId !== user.id);
  return filterVisibleMessages(user.id, msgs).length;
}

export function getUnreadCount(user: DemoUser, groupId: Id): number {
  try {
    const g = db().groups.get(groupId);
    if (!g || !isMember(user, g)) return 0;
    return unreadOf(user, groupId);
  } catch {
    return 0;
  }
}

export function listMessages(
  user: DemoUser,
  groupId: Id,
  opts?: { sinceId?: Id; before?: Id; limit?: number },
): ListMessagesResponse {
  const group = assertGroupAccess(user.id, groupId, "member");
  if (opts?.sinceId && opts?.before) throw invalidInput({ before: CHAT_MESSAGES.sinceBeforeBoth });
  const limit = Math.min(Math.max(opts?.limit ?? PAGE_DEFAULT, 1), PAGE_MAX);
  const all = groupMessages(groupId);
  let slice: GroupMessage[];
  let nextCursor: string | null = null;
  let latestId: Id | null = all.length ? all[all.length - 1].id : null;
  if (opts?.sinceId) {
    const s = idSeq(opts.sinceId);
    slice = all.filter((m) => seqOf(m) > s);
  } else {
    const pool = opts?.before ? all.filter((m) => seqOf(m) < idSeq(opts.before!)) : all;
    slice = pool.slice(-limit);
    if (pool.length > slice.length) nextCursor = slice[0].id;
    if (opts?.before) latestId = null;
  }
  const visible = filterVisibleMessages(user.id, slice).slice(0, limit);
  const { resolveName, isMemberNow } = makeResolver(user, groupId);
  return {
    items: visible.map((m) => toDto(m, user.id, resolveName, isMemberNow)),
    nextCursor,
    latestId,
    unreadCount: unreadOf(user, groupId),
    access: chatAccess(user, group),
    serverTime: clock.nowIso(),
  };
}

export function postMessage(user: DemoUser, groupId: Id, input: PostMessageInput): MessageDto {
  const group = assertGroupAccess(user.id, groupId, "member");
  if (!canChat(group)) {
    throw unavailableState(CHAT_MESSAGES.readonly, { reason: "state_readonly", detail: { state: group.lifecycle.status } });
  }
  let body: string;
  let templateId: GroupMessage["templateId"] = null;
  const kind = (input as { kind?: unknown }).kind;
  if (kind === "template") {
    const tpl = CHAT_TEMPLATES.find((t) => t.id === (input as { templateId?: unknown }).templateId);
    if (!tpl) throw invalidInput({ templateId: CHAT_MESSAGES.templateUnknown });
    body = tpl.text;
    templateId = tpl.id;
  } else if (kind === "normal") {
    if (!CHAT_FREE_INPUT) throw invalidInput({ body: CHAT_MESSAGES.freeInputDisabled });
    const i = input as { body: unknown; ackReview?: boolean };
    body = normalizeBody(i.body);
    const v = validateBody(body);
    if (!v.ok) throw invalidInput({ body: v.message });
    assertTextAllowed(body, "chat_message", "body", { ackReview: i.ackReview });
  } else {
    throw invalidInput({ kind: "種類が正しくありません。" });
  }
  checkRate("chat_post", user.id, groupId);
  const msg = tx((d) =>
    d.messages.insert({
      id: newId("msg"), groupId, senderId: user.id, kind: kind as "normal" | "template", body, templateId,
      systemEvent: null, systemSubjectUserId: null, systemPhase: null,
      createdAt: clock.nowIso(), reportState: "none", reportedBy: [],
    }),
  );
  const { resolveName, isMemberNow } = makeResolver(user, groupId);
  return toDto(msg, user.id, resolveName, isMemberNow);
}

export function markChatRead(user: DemoUser, groupId: Id, lastReadId: Id): { unreadCount: number } {
  assertGroupAccess(user.id, groupId, "member");
  const msg = assertInGroup(db().messages.get(lastReadId), groupId);
  const seq = seqOf(msg);
  tx((d) => {
    const id = `${groupId}:${user.id}`;
    const cur = d.chatReads.get(id);
    if (!cur) {
      const row: ChatReadMark = { id, groupId, userId: user.id, lastReadSeq: seq, updatedAt: clock.nowIso() };
      d.chatReads.insert(row);
    } else if (seq > cur.lastReadSeq) {
      d.chatReads.update(id, { lastReadSeq: seq, updatedAt: clock.nowIso() });
    }
  });
  return { unreadCount: unreadOf(user, groupId) };
}

export function reportMessage(
  user: DemoUser, groupId: Id, messageId: Id, reason: ReportReason, body?: string,
): { reported: true } {
  assertGroupAccess(user.id, groupId, "member");
  const msg = assertInGroup(db().messages.get(messageId), groupId);
  if (msg.kind === "system") throw invalidInput({ messageId: CHAT_MESSAGES.cannotReportSystem });
  if (msg.senderId === user.id) throw invalidInput({ messageId: CHAT_MESSAGES.cannotReportOwn });
  if (msg.reportedBy.includes(user.id)) return { reported: true };
  tx((d) => {
    createReport(user, { targetType: "message", targetId: messageId, reason, body, groupId });
    d.messages.update(messageId, { reportState: "reported", reportedBy: [...msg.reportedBy, user.id] });
  });
  return { reported: true };
}
