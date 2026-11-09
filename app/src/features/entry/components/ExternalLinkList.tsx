import type { EntryLinkFixture } from "../types";

export interface ExternalLinkListProps { links: EntryLinkFixture[]; campaign: string; showAbnormal: boolean }

export function ExternalLinkList(props: ExternalLinkListProps) {
  void props;
  return <div data-stub="ExternalLinkList" />;
}
