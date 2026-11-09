// 10: kind のメタ情報(既定のリンク先、必須/任意)。スタブ(P-2-13)。
import type { NotificationKind, NotificationView } from "./types";

export interface KindMeta {
  defaultView: NotificationView;
  optional: boolean;
}

export const KIND_META: Partial<Record<NotificationKind, KindMeta>> = {};
