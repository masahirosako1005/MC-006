// 05 の DTO 組み立て(PLN-FILE-04)。
import type { DemoUser, Id } from "@/lib/groups-types";
import type { Group } from "@/features/groups/core/types";
import { db } from "@/lib/groups-store";
import { clock } from "@/lib/clock";
import seed from "@/data/seed.json";
import { canEdit } from "@/features/groups/lifecycle/policy";
import { statusLabel } from "@/features/groups/lifecycle/messages";
import { PLAN_MESSAGES } from "./messages";
import { isWithinSchedule } from "./validation";
import { PLAN_LIMITS } from "./types";
import type {
  ActorRef, GroupPlan, MeetingNote, MeetingNoteView, PlanItem, PlanItemView, PlanView, ScheduleMemo,
  ScheduleMemoView, SpotRef,
} from "./types";

type Trip = { startDate: string; endDate: string };
type RawSpot = { id: number; name: string; area: string };
const rawSpots = (): RawSpot[] => seed.spots as unknown as RawSpot[];

export function spotExists(id: number): boolean {
  return rawSpots().some((s) => s.id === id);
}
export function spotRef(id: number | null): SpotRef | null {
  if (id === null) return null;
  const s = rawSpots().find((x) => x.id === id);
  return s ? { id: s.id, name: s.name, area: s.area } : null; // keyword 等は返さない
}
export const allSpots = (): SpotRef[] => rawSpots().map((s) => ({ id: s.id, name: s.name, area: s.area }));

export function actorRef(groupId: Id, userId: Id): ActorRef {
  const active = db().members.count((m) => m.groupId === groupId && m.userId === userId && m.status === "active") > 0;
  if (!active) return { userId, displayName: PLAN_MESSAGES.formerMember, isFormerMember: true };
  const name = db().profiles.get(userId)?.displayName ?? db().users.get(userId)?.displayName ?? "";
  return { userId, displayName: name, isFormerMember: false };
}

export function itemView(groupId: Id, trip: Trip, it: PlanItem): PlanItemView {
  const { spotId, createdBy, updatedBy, ...rest } = it;
  return {
    ...rest,
    spot: spotRef(spotId),
    createdBy: actorRef(groupId, createdBy),
    updatedBy: actorRef(groupId, updatedBy),
    outOfRange: !isWithinSchedule(it.date, trip),
  };
}
export function meetingView(groupId: Id, trip: Trip, m: MeetingNote): MeetingNoteView {
  const { spotId, updatedBy, ...rest } = m;
  return {
    ...rest,
    spot: spotRef(spotId),
    updatedBy: updatedBy ? actorRef(groupId, updatedBy) : null,
    outOfRange: m.date !== null && !isWithinSchedule(m.date, trip),
  };
}
export function memoView(groupId: Id, m: ScheduleMemo): ScheduleMemoView {
  const { updatedBy, ...rest } = m;
  return { ...rest, updatedBy: updatedBy ? actorRef(groupId, updatedBy) : null };
}

export function buildPlanView(_user: Readonly<DemoUser>, group: Group, plan: Readonly<GroupPlan>): PlanView {
  const editable = canEdit(group);
  const trip = group.trip;
  const items = [...plan.items]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.seq - b.seq))
    .map((it) => itemView(group.id, trip, it));
  return {
    groupId: group.id,
    groupStatus: group.lifecycle.status,
    editable,
    readOnlyReason: editable ? null : PLAN_MESSAGES.readOnly(statusLabel(group.lifecycle.status)),
    schedule: { startDate: trip.startDate, endDate: trip.endDate },
    meeting: meetingView(group.id, trip, plan.meeting),
    scheduleMemo: memoView(group.id, plan.scheduleMemo),
    items,
    itemsRevision: plan.itemsRevision,
    spotOptions: allSpots(),
    limits: PLAN_LIMITS,
    serverTime: clock.nowIso(),
  };
}
