// 06 システムメッセージ(CHT-FN-05、13)。postSystemMessage は 06 の内部関数(公開しない)。
import { clock } from "@/lib/clock";
import { notFound } from "@/lib/errors";
import { db, newId } from "@/lib/groups-store";
import type { DemoUser, Id } from "@/lib/groups-types";
import { visibleProfile } from "@/features/safety/visibility/profile";
import type { GroupMessage, SystemEventType } from "./types";

export function postSystemMessage(
  groupId: Id,
  event: SystemEventType,
  subject?: { userId: Id; phase?: "withdrawal" | "leave" },
): GroupMessage | null {
  if (!db().groups.get(groupId)) throw notFound("グループ");
  return db().messages.insert({
    id: newId("msg"),
    groupId,
    senderId: null,
    kind: "system",
    body: "",
    templateId: null,
    systemEvent: event,
    systemSubjectUserId: subject?.userId ?? null,
    systemPhase: subject?.phase ?? null,
    createdAt: clock.nowIso(),
    reportState: "none",
    reportedBy: [],
  }) as GroupMessage;
}

const FIXED: Partial<Record<SystemEventType, string>> = {
  group_created: "グループが作成されました。",
  state_min_reached: "最少人数に達しました。まだ実行は確定していません。",
  state_confirmed: "実行が確定しました。",
  state_cancelled: "このグループは中止になりました。",
  state_started: "旅行が始まりました。",
  state_completed: "旅行が完了しました。",
  state_replanned: "このグループは再企画されました。",
};

export function renderSystemText(m: GroupMessage, resolveName: (userId: Id) => string): string {
  const e = m.systemEvent;
  if (e && FIXED[e]) return FIXED[e] as string;
  const name = m.systemSubjectUserId ? resolveName(m.systemSubjectUserId) : "メンバー";
  if (e === "member_joined") return `${name}さんが参加しました。`;
  if (e === "member_left") return m.systemPhase === "leave" ? `${name}さんが退会しました。` : `${name}さんが辞退しました。`;
  return "";
}

/**
 * 表示名の解決関数(09 visibleProfile 経由。6.7)。service.ts の toDto に渡して使う。
 * 参加中でない/未知のユーザーは「元メンバー」、visibleProfile が失敗したら「メンバー」。同一応答内は結果を使い回す。
 */
export function makeNameResolver(viewer: Pick<DemoUser, "id">, groupId: Id): (userId: Id) => string {
  const cache = new Map<Id, string>();
  return (userId) => {
    const hit = cache.get(userId);
    if (hit !== undefined) return hit;
    let name: string;
    const active = db().members.find((m) => m.groupId === groupId && m.userId === userId && m.status === "active");
    if (!active) name = "元メンバー";
    else {
      try { name = visibleProfile(viewer, userId, { kind: "member", groupId }).displayName; } catch { name = "メンバー"; }
    }
    cache.set(userId, name);
    return name;
  };
}
