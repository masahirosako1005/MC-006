import { DemoBar } from "@/components/groups/common/DemoBar";
import { InviteCodeScreen } from "@/features/groups/discovery/ui/InviteCodeScreen";

export default async function InvitePage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  return (
    <>
      <DemoBar />
      <div style={{ padding: "16px" }}>
        <InviteCodeScreen campaign={campaign} />
      </div>
    </>
  );
}
