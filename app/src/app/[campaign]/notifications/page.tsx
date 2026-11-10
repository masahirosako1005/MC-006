import { NotificationList } from "@/features/notify/ui/NotificationList";

export default async function NotificationsPage({ params }: { params: Promise<{ campaign: string }> }) {
  const { campaign } = await params;
  return <NotificationList campaign={campaign} />;
}
