// 試験の ID 定数(00 第 9.1、契約 11.3、INS-C-14)。試験に ID 文字列を直書きしない。
import type { GroupStatus, Id } from "@/lib/groups-types";

export const USER = {
  misaki: "u-001",
  kenta: "u-002",
  yui: "u-003",
  daisuke: "u-004",
  haruka: "u-005",
  sota: "u-006",
  nanami: "u-007",
  hinata: "u-008",
  municipalA: "u-009",
  unverified: "u-010",
  municipalB: "u-011",
  host: "u-012",
  businessOwner: "u-013",
  otherBusinessOwner: "u-014",
} as const;

export const REGION = {
  mizukoto: "r-mizukoto",
  suzukaze: "r-suzukaze",
  hoshinagi: "r-hoshinagi",
  nijiho: "r-nijiho",
} as const;

export const MUNICIPALITY = { a: "mun-demo-a", b: "mun-demo-b" } as const;
export const HOST = { a: "host-demo-a" } as const;

export const GROUP_BY_STATUS: Record<GroupStatus, Id> = {
  recruiting: "g-001",
  min_reached: "g-003",
  withdrawal_period: "g-004",
  confirmed: "g-005",
  in_progress: "g-011",
  completed: "g-010",
  cancelled: "g-013",
  replanned: "g-006",
};

export const OFFICIAL_GROUPS = ["g-002", "g-005"] as const;
export const PRIVATE_GROUP = "g-008";
export const BLOCK_SAMPLE = { blockerId: "u-001", blockedId: "u-006" } as const;
export const LEFT_MEMBER_SAMPLE = { groupId: "g-011", userId: "u-006", withdrawalId: "wd-002" } as const;
export const UNVERIFIED_USER = "u-010";
export const UNDERAGE_USER = "u-008";
export const REPLAN_TARGET_GROUP = "g-007";
export const ONE_TO_ONE_GROUP = "g-009";
export const FULL_GROUP = "g-012";

export const BUSINESS_OWNER = "u-013";
export const OTHER_BUSINESS_OWNER = "u-014";
export const BUSINESSES = ["biz-demo-a", "biz-demo-b"] as const;
