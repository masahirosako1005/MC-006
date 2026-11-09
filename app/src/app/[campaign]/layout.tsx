import { Suspense } from "react";
import { AppShell } from "@/components/AppShell";

// デモ用キャンペーンのみ静的に生成する。他の slug も実行時に同じシェルで描画される。
export function generateStaticParams() {
  return [{ campaign: "nttw-demo" }];
}

// AppShell は useParams/usePathname を使うため、静的シェル生成時に Suspense が必要。
export default function CampaignLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="app-shell" aria-busy="true" />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
