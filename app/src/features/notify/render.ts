// 10: 通知の文面生成(純粋関数)。
import { formatJst } from "@/lib/datetime";
import type { GroupNotification, NotificationDto, NotificationKind, ParamsOf } from "./types";
import { KIND_META } from "./kinds";
import { CANCEL_BODIES, CANCEL_GUIDE, CANCEL_NO_GUIDE, TEMPLATES } from "./messages";

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_m, k: string) => {
    if (!Object.prototype.hasOwnProperty.call(values, k)) throw new Error(`template value missing: ${k}`);
    return String(values[k]);
  });
}

function formatChanges(p: ParamsOf<"conditions_changed">): string {
  const parts: string[] = [];
  if (p.minParticipants) parts.push(`最少人数が${p.minParticipants.from}人から${p.minParticipants.to}人になりました。`);
  if (p.deadline) parts.push(`締切が${formatJst(p.deadline.from)}から${formatJst(p.deadline.to)}になりました。`);
  return parts.join("");
}

export function renderNotification(n: GroupNotification): { title: string; body: string; link: NotificationDto["link"] } {
  const tpl = TEMPLATES[n.kind as NotificationKind];
  const meta = KIND_META[n.kind as NotificationKind];
  if (!tpl || !meta) throw new Error(`unknown kind: ${String(n.kind)}`);
  const p = n.params as unknown as Record<string, unknown>;
  const vals: Record<string, string | number> = {};
  for (const [k, val] of Object.entries(p)) if (typeof val === "string" || typeof val === "number") vals[k] = val;
  let linkGroupId = n.groupId;
  switch (n.kind) {
    case "confirmed": // seed の通知は summaryText を持たないので補う(F-031)
      if (vals.summaryText === undefined) vals.summaryText = `参加者 ${String(vals.count ?? "")} 人(年代は表示しません)`;
      break;
    case "withdraw_period_started": vals.withdrawUntil = formatJst(p.withdrawUntil as string); break;
    case "deadline_near": vals.deadline = formatJst(p.deadlineDate as string); break;
    case "conditions_changed": vals.changes = formatChanges(n.params as ParamsOf<"conditions_changed">); break;
    case "replan_invited": linkGroupId = p.newGroupId as string; break;
    case "cancelled": {
      const reason = p.reason as keyof typeof CANCEL_BODIES;
      const body = CANCEL_BODIES[reason];
      if (!body) throw new Error(`unknown cancel reason: ${String(reason)}`);
      vals.reasonBody = fillTemplate(body, vals);
      vals.guide = CANCEL_NO_GUIDE.includes(reason) ? "" : CANCEL_GUIDE;
      break;
    }
  }
  return {
    title: tpl.title,
    body: fillTemplate(tpl.body, vals),
    link: { groupId: linkGroupId, view: meta.defaultView },
  };
}

export function toDto(n: GroupNotification): NotificationDto {
  const r = renderNotification(n);
  return {
    id: n.id, kind: n.kind, groupId: n.groupId, title: r.title, body: r.body, link: r.link,
    createdAt: n.createdAt, read: n.readAt !== null,
  };
}
