import type { PublicGroupDetail } from "../types";

export interface PublicGroupDetailScreenProps { campaign: string; group: PublicGroupDetail; onApply(): void }

export function PublicGroupDetailScreen(props: PublicGroupDetailScreenProps) {
  void props;
  return <div data-stub="PublicGroupDetailScreen" />;
}
