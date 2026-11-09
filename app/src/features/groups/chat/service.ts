// 06 サービス層(CHT-FN)。署名スタブ(P-2-17 で実装)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import type { ReportReason } from "@/features/safety/types";
import type {
  ChatAccess, ChatTemplate, GroupMessage, ListMessagesResponse, MessageDto, PostMessageInput,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function listMessages(
  _user: DemoUser,
  _groupId: Id,
  _opts?: { sinceId?: Id; before?: Id; limit?: number },
): ListMessagesResponse { return ni(); }
export function postMessage(_user: DemoUser, _groupId: Id, _input: PostMessageInput): MessageDto { return ni(); }
export function reportMessage(
  _user: DemoUser, _groupId: Id, _messageId: Id, _reason: ReportReason, _body?: string,
): { reported: true } { return ni(); }
export function markChatRead(_user: DemoUser, _groupId: Id, _lastReadId: Id): { unreadCount: number } { return ni(); }
export function chatAccess(_user: DemoUser, _group: Group): ChatAccess { return ni(); }
export function listTemplates(): readonly ChatTemplate[] { return ni(); }
export function getUnreadCount(_user: DemoUser, _groupId: Id): number { return ni(); }
export function toDto(
  _m: GroupMessage,
  _viewerId: Id,
  _resolveName: (id: Id) => string,
  _isMemberNow: (id: Id) => boolean,
): MessageDto { return ni(); }
