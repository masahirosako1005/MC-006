import { notFound, redirect } from "next/navigation";
import { EntryLanding } from "@/features/entry/components/EntryLanding";
import { recordFunnelEvent } from "@/features/entry/funnel";
import { describeFilter, resolveEntry } from "@/features/entry/parse";
import type { EntryResolution, RawQuery } from "@/features/entry/types";
import { listRegions } from "@/features/groups/discovery/regions";

export default async function EntryPage({ params, searchParams }: {
  params: Promise<{ campaign: string }>;
  searchParams: Promise<RawQuery>;
}) {
  const { campaign } = await params;
  const query = await searchParams;
  let r: EntryResolution;
  try {
    r = resolveEntry(campaign, query);
  } catch (e) {
    if ((e as { code?: string }).code === "not_found") notFound();
    throw e;
  }
  const region = r.filter.region || undefined;
  recordFunnelEvent({ type: "entry_landed", campaign, channel: "B", source: r.source, region });
  if (!r.showLanding) redirect(r.groupsPath);
  recordFunnelEvent({ type: "entry_params_ignored", campaign, channel: "B", source: r.source, region });
  return (
    <EntryLanding
      campaign={campaign}
      accepted={describeFilter(r.filter, listRegions(campaign))}
      ignored={r.ignored}
      groupsPath={r.groupsPath}
    />
  );
}
