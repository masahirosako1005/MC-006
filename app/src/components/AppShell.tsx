"use client";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ActionIcon, Indicator } from "@mantine/core";
import { IconArrowLeft, IconBell, IconChartBar, IconGift, IconHome, IconMap2, IconUsersGroup } from "@tabler/icons-react";
import { useApi } from "@/lib/api";
import { useCurrentUser } from "@/lib/groups-api";
import { DemoBar } from "@/components/groups/common/DemoBar";

const TITLES: Record<string, string> = {
  "": "ホーム", spots: "スポット", "spots/detail": "スポット詳細", rewards: "特典", "rewards/detail": "特典詳細",
  mypage: "マイページ", news: "お知らせ", notice: "お知らせ", rule: "利用規約", service: "サービスについて",
  qr: "スタンプを押す", qrerror: "エラー", reset: "リセット", resetfinish: "リセット完了", restore: "データ復元",
  pointHistory: "GET特典履歴", groups: "グループ", "new-group": "グループ作成", notifications: "通知", inquiries: "お問い合わせ", "products/tickets": "チケット購入",
};

export function AppShell({ children }: { children: React.ReactNode }) {
  const { campaign } = useParams<{ campaign: string }>();
  const base = `/${campaign}`;
  const pathname = usePathname();
  const rel = pathname.slice(base.length).replace(/^\/|\/$/g, "");
  const { data: unread } = useApi<{ count: number }>("/notifications/unread");
  const nav = [
    { href: base, rel: "", label: "ホーム", icon: <IconHome size={22} aria-hidden /> },
    { href: `${base}/spots`, rel: "spots", label: "スポット", icon: <IconMap2 size={22} aria-hidden /> },
    { href: `${base}/groups`, rel: "groups", label: "グループ", icon: <IconUsersGroup size={22} aria-hidden /> },
    { href: `${base}/pointHistory`, rel: "pointHistory", label: "GET特典履歴", icon: <IconGift size={22} aria-hidden /> },
  ];
  const { user } = useCurrentUser();
  if (user?.role === "municipal") nav.push({ href: `${base}/admin/stats`, rel: "admin/stats", label: "集計", icon: <IconChartBar size={22} aria-hidden /> });
  if (user?.role === "business_owner") nav.push({ href: `${base}/business/insights`, rel: "business/insights", label: "インサイト", icon: <IconChartBar size={22} aria-hidden /> });
  return (
    <div className="app-shell">
      <header className="app-header">
        {rel === "" ? <span /> : (
          <ActionIcon component={Link} href={base} variant="subtle" color="white" aria-label="ホームへ戻る" ml={8}><IconArrowLeft /></ActionIcon>
        )}
        <h1>{TITLES[rel] ?? "Raund"}</h1>
        <Indicator disabled={!unread?.count} size={10} offset={6} color="red">
          <ActionIcon component={Link} href={`${base}/notifications`} variant="subtle" color="white" aria-label="通知"><IconBell /></ActionIcon>
        </Indicator>
      </header>
      <DemoBar />
      <main className="app-main">{children}</main>
      <nav className="app-nav" aria-label="メインメニュー">
        {nav.map((n) => (
          <Link key={n.rel} href={n.href} aria-current={n.rel === "" ? (rel === "" ? "page" : undefined) : rel.startsWith(n.rel) ? "page" : undefined}>{n.icon}{n.label}</Link>
        ))}
      </nav>
    </div>
  );
}
