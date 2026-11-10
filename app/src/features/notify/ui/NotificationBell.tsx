"use client";
// 10: 未読バッジ付きベル。ntf:refresh と定期更新で未読数を保つ。
import Link from "next/link";
import { ActionIcon, Indicator } from "@mantine/core";
import { useUnreadCount } from "../client";

export function NotificationBell(props: { base: string }) {
  const { count } = useUnreadCount();
  return (
    <Indicator label={count > 99 ? "99+" : count} disabled={count === 0} size={16} color="red">
      <ActionIcon
        component={Link}
        href={`${props.base}/notifications`}
        variant="default"
        size="lg"
        aria-label={`グループの通知(未読 ${count} 件)`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <path d="M10 5a2 2 0 1 1 4 0a7 7 0 0 1 4 6v3a4 4 0 0 0 2 3H4a4 4 0 0 0 2-3v-3a7 7 0 0 1 4-6" />
          <path d="M9 17v1a3 3 0 0 0 6 0v-1" />
        </svg>
      </ActionIcon>
    </Indicator>
  );
}
