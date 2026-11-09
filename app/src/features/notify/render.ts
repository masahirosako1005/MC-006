// 10: 通知の文面生成(純粋関数)。スタブ(P-2-13)。
import type { GroupNotification, NotificationDto } from "./types";

export function fillTemplate(template: string, values: Record<string, string | number>): string {
  void template; void values;
  throw new Error("not implemented");
}

export function renderNotification(n: GroupNotification): { title: string; body: string; link: NotificationDto["link"] } {
  void n;
  throw new Error("not implemented");
}

export function toDto(n: GroupNotification): NotificationDto {
  void n;
  throw new Error("not implemented");
}
