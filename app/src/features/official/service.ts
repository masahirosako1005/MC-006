// 公式枠・地元の枠のサービス(11 ENT-FN-07〜12、14)。署名スタブ。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import type {
  HostSlotInput, Listing, LocalHost, Municipality, OfficialBadgeView, OfficialSlotInput, SponsorRef,
} from "./types";

const ni = (): never => { throw new Error("not implemented"); };

export function getOfficialBadges(groupIds: Id[]): Record<Id, OfficialBadgeView> {
  void groupIds;
  return ni();
}

export function getListing(groupId: Id): Readonly<Listing> | undefined {
  void groupId;
  return ni();
}

export function getMunicipality(id: string): Readonly<Municipality> | undefined {
  void id;
  return ni();
}

export function createOfficialSlot(user: DemoUser, input: OfficialSlotInput): Group {
  void user; void input;
  return ni();
}

export function createHostSlot(user: DemoUser, input: HostSlotInput): Group {
  void user; void input;
  return ni();
}

export function resolveSponsor(user: DemoUser, type: SponsorRef["type"]): Readonly<Municipality> | Readonly<LocalHost> {
  void user; void type;
  return ni();
}

export function assertListingInvariants(): string[] {
  return ni();
}
