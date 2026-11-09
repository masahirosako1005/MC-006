// ドメインイベント(00 第 5.12)。同期のイベントバス。
import type { Id, IsoDateTime } from "./groups-types";

// 暫定: GroupStatus・CancelReasonCode は 04 の lifecycle/types.ts が揃う P-0-2 で import 型に置き換える。
type GroupStatus = string;
type CancelReasonCode = string;

export type DomainEvent =
  | { type: "group_created"; groupId: Id; organizerId: Id; at: IsoDateTime }
  | { type: "member_joined"; groupId: Id; userId: Id; at: IsoDateTime }
  | { type: "member_left"; groupId: Id; userId: Id; phase: GroupStatus; withdrawalId: Id; at: IsoDateTime }
  | { type: "status_changed"; groupId: Id; from: GroupStatus; to: GroupStatus;
      cancelReason: CancelReasonCode | null; revision: number; at: IsoDateTime };

type Handler = (e: never) => void;
const g = globalThis as unknown as { __groupsEvents?: Map<DomainEvent["type"], Map<string, Handler>> };
const registry = () => (g.__groupsEvents ??= new Map());

export function emit(e: DomainEvent): void {
  const handlers = registry().get(e.type);
  if (!handlers) return;
  for (const h of handlers.values()) (h as (e: DomainEvent) => void)(e);
}

export function on<T extends DomainEvent["type"]>(
  type: T,
  key: string,
  handler: (e: Extract<DomainEvent, { type: T }>) => void,
): void {
  const r = registry();
  let m = r.get(type);
  if (!m) { m = new Map(); r.set(type, m); }
  m.set(key, handler as Handler);
}
