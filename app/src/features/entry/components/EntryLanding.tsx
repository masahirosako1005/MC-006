import type { AcceptedConditionView, IgnoredParam } from "../types";

export interface EntryLandingProps {
  campaign: string;
  accepted: AcceptedConditionView[];
  ignored: IgnoredParam[];
  groupsPath: string;
}

export function EntryLanding(props: EntryLandingProps) {
  void props;
  return <div data-stub="EntryLanding" />;
}
