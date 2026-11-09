// 06 の Route Handler(CHT-API-01〜04)。入力の形式検証と service の呼び出しのみ。
import { route, ok, created } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";
import type { GroupParams } from "@/features/stub";
import * as svc from "./service";
import { PAGE_MAX } from "./constants";

const REASONS = [
  "contact_solicitation", "harassment", "inappropriate_content", "money_solicitation",
  "off_purpose", "impersonation", "minor_suspected", "other",
] as const;
const TEMPLATE_IDS = ["tpl-01", "tpl-02", "tpl-03", "tpl-04", "tpl-05", "tpl-06"] as const;

export const listMessagesHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const q = c.query(v.object({
    sinceId: v.id("msg", { optional: true }),
    before: v.id("msg", { optional: true }),
    limit: v.int({ min: 1, max: PAGE_MAX, coerce: true, optional: true }),
  }));
  return ok(svc.listMessages(c.user, groupId, { sinceId: q.sinceId, before: q.before, limit: q.limit }));
});

export const postMessageHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const raw = (await c.req.clone().json().catch(() => null)) as { kind?: unknown } | null;
  if (raw && raw.kind === "template") {
    const b = await c.body(v.object({ kind: v.enum(["template"] as const), templateId: v.enum(TEMPLATE_IDS) }));
    return created(svc.postMessage(c.user, groupId, { kind: "template", templateId: b.templateId }));
  }
  const b = await c.body(v.object({
    kind: v.enum(["normal"] as const),
    body: v.string({ multiline: true, min: 1 }),
    ackReview: v.boolean({ optional: true }),
  }));
  return created(svc.postMessage(c.user, groupId, { kind: "normal", body: b.body, ackReview: b.ackReview }));
});

export const reportMessageHandler = route<{ groupId: string; messageId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const messageId = await c.id("messageId", "msg");
  const b = await c.body(v.object({
    reason: v.enum(REASONS),
    body: v.string({ optional: true, max: LIMITS.REPORT_BODY.max, multiline: true }),
  }));
  return ok(svc.reportMessage(c.user, groupId, messageId, b.reason, b.body || undefined));
});

export const markChatReadHandler = route<GroupParams>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const b = await c.body(v.object({ lastReadId: v.id("msg") }));
  return ok(svc.markChatRead(c.user, groupId, b.lastReadId));
});
