// 試験ヘルパー(00 第 9.1、契約 3.7)。
import seed from "@/data/group-seed.json";
import { clock } from "@/lib/clock";
import { db, newId, resetStore } from "@/lib/groups-store";
import type { Block } from "@/features/safety/types";
import type { Group, GroupMember, MemberRole, Trip } from "@/features/groups/types";
import type { GroupLifecycle } from "@/features/groups/lifecycle/types";
import type { Id, IsoDateTime } from "@/lib/groups-types";

/** ストアと時計を seed の状態へ戻す。futureTrips: true のときだけ未来日程(P-1-1 のストアが対応)を含める。 */
export function resetForTest(opts?: { now?: IsoDateTime; futureTrips?: boolean }): void {
  (resetStore as (o?: { futureTrips?: boolean }) => void)({ futureTrips: opts?.futureTrips ?? false });
  clock.freeze(opts?.now ?? seed.meta.demoNow);
}

export function asUser(userId: Id): { cookie: string } {
  return { cookie: `demoUser=${userId}` };
}

export interface CallOptions {
  method?: string;
  body?: unknown;
  user?: Id;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  rawBody?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: { params: Promise<any> }) => Promise<Response>;

export async function callRoute(
  handler: Handler,
  path: string,
  opts: CallOptions = {},
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ status: number; body: any; headers: Headers }> {
  const method = (opts.method ?? (opts.body !== undefined || opts.rawBody !== undefined ? "POST" : "GET")).toUpperCase();
  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  const lower = new Set(Object.keys(headers).map((k) => k.toLowerCase()));
  if (method !== "GET" && method !== "HEAD" && !lower.has("content-type")) headers["Content-Type"] = "application/json";
  if (opts.user && !lower.has("cookie")) headers["Cookie"] = asUser(opts.user).cookie;
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    if (opts.rawBody !== undefined) init.body = opts.rawBody;
    else if (opts.body !== undefined) init.body = JSON.stringify(opts.body);
  }
  const res = await handler(new Request("http://localhost:3000" + path, init), { params: Promise.resolve(opts.params ?? {}) });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try { body = JSON.parse(text); } catch { body = text; }
  }
  return { status: res.status, body, headers: res.headers };
}

// 試験用の固定 ID(900 番台)。counters は変えない。
function nextFixedId(prefix: string, exists: (id: Id) => boolean): Id {
  for (let n = 901; n < 1000; n++) {
    const id = `${prefix}-${n}`;
    if (!exists(id)) return id;
  }
  throw new Error(`no free test id for ${prefix}`);
}

const BASE_LIFECYCLE: GroupLifecycle = {
  status: "recruiting",
  minMembers: 2,
  deadlineDate: "2026-12-01",
  deadlineAt: "2026-12-02T00:00:00+09:00",
  deadlineExtendedCount: 0,
  withdrawalStartedAt: null,
  withdrawalEndsAt: null,
  confirmedAt: null,
  startedAt: null,
  completedAt: null,
  cancelledAt: null,
  cancelReason: null,
  organizerCancelReason: null,
  replanOfGroupId: null,
  replannedToGroupId: null,
  replannedAt: null,
  deadlineSoonNoticeSent: false,
  withdrawalEndingNoticeSent: false,
  revision: 1,
};

const BASE_TRIP: Trip = { destination: "試験の行き先", startDate: "2026-12-10", endDate: "2026-12-11", dateNote: "" };

export function insertGroup(
  partial: Partial<Omit<Group, "trip" | "lifecycle">> & { trip?: Partial<Trip>; lifecycle?: Partial<GroupLifecycle> } = {},
): Readonly<Group> {
  const { trip, lifecycle, ...rest } = partial;
  const now = clock.nowIso();
  const id = rest.id ?? newId("g");
  const organizerId = rest.organizerId ?? "u-001";
  const group: Group = {
    id,
    name: "試験グループ",
    campaign: seed.meta.campaign,
    region: "r-mizukoto",
    capacity: 4,
    visibility: "public",
    tags: [],
    description: "",
    official: false,
    inviteCode: null,
    createdAt: now,
    updatedAt: now,
    ...rest,
    organizerId,
    trip: { ...BASE_TRIP, ...trip },
    lifecycle: { ...BASE_LIFECYCLE, ...lifecycle },
  };
  const inserted = db().groups.insert(group);
  insertMember(id, organizerId, "organizer");
  return inserted;
}

export function insertMember(groupId: Id, userId: Id, role: MemberRole = "member", id?: Id): Readonly<GroupMember> {
  return db().members.insert({
    id: id ?? nextFixedId("m", (x) => db().members.get(x) !== undefined),
    groupId,
    userId,
    role,
    status: "active",
    joinedAt: clock.nowIso(),
    leftAt: null,
  });
}

export function insertBlock(blockerId: Id, blockedId: Id, id?: Id): Readonly<Block> {
  return db().blocks.insert({
    id: id ?? nextFixedId("bl", (x) => db().blocks.get(x) !== undefined),
    blockerId,
    blockedId,
    createdAt: clock.nowIso(),
    releasedAt: null,
    sourceGroupId: null,
  });
}
