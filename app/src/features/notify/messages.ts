// 10: テンプレート文言(kind × 理由)。スタブ(P-2-13)。
import type { NotificationKind } from "./types";

export interface Template { title: string; body: string }

export const TEMPLATES: Partial<Record<NotificationKind, Template>> = {};
