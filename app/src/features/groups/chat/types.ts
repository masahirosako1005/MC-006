// 06 グループチャットの型(CHT-TYPE)。
import type { Id, IsoDateTime, CursorPage } from "@/lib/groups-types";

export type MessageKind = "normal" | "template" | "system";
export type ReportState = "none" | "reported";

export type SystemEventType =
  | "group_created"
  | "member_joined"
  | "member_left"
  | "state_min_reached"
  | "state_confirmed"
  | "state_cancelled"
  | "state_started"
  | "state_completed"
  | "state_replanned";

export type TemplateId = "tpl-01" | "tpl-02" | "tpl-03" | "tpl-04" | "tpl-05" | "tpl-06";
export interface ChatTemplate { id: TemplateId; label: string; text: string }

/** db().messages の要素 */
export interface GroupMessage {
  id: Id;
  groupId: Id;
  senderId: Id | null;
  kind: MessageKind;
  body: string;
  templateId: TemplateId | null;
  systemEvent: SystemEventType | null;
  systemSubjectUserId: Id | null;
  systemPhase: "withdrawal" | "leave" | null;
  createdAt: IsoDateTime;
  reportState: ReportState;
  reportedBy: Id[];
}

/** db().chatReads の要素。id は `${groupId}:${userId}` */
export interface ChatReadMark { id: string; groupId: Id; userId: Id; lastReadSeq: number; updatedAt: IsoDateTime }

export interface MessageDto {
  id: Id;
  kind: MessageKind;
  senderId: Id | null;
  senderName: string;
  isMine: boolean;
  text: string;
  templateId: TemplateId | null;
  createdAt: IsoDateTime;
  reportedByMe: boolean;
}

export interface ChatAccess {
  canRead: boolean;
  canPost: boolean;
  reason?: "not_member" | "state_readonly";
}

export interface ListMessagesResponse extends CursorPage<MessageDto> {
  latestId: Id | null;
  unreadCount: number;
  access: ChatAccess;
  serverTime: IsoDateTime;
}

export type PostMessageInput =
  | { kind: "normal"; body: string; ackReview?: boolean }
  | { kind: "template"; templateId: TemplateId };
