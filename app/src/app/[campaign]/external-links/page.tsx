import { notFound } from "next/navigation";
import { ExternalLinkList } from "@/features/entry/components/ExternalLinkList";
import { ENTRY_LINK_FIXTURES } from "@/features/entry/fixtures";
import { getCampaign } from "@/features/groups/discovery/regions";

export default async function ExternalLinksPage({ params, searchParams }: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<{ abnormal?: string | string[] }>;
}) {
  const { campaign } = await params;
  const sp = await searchParams;
  if (!getCampaign(campaign)) notFound();
  return <ExternalLinkList links={ENTRY_LINK_FIXTURES} campaign={campaign} showAbnormal={sp.abnormal === "1"} />;
}
