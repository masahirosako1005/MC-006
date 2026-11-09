// seed の読み込み・検証(00 第 4.4)。
import type { Id, IsoDateTime } from "./groups-types";
import futureTrips from "@/data/future-trips.json";

export type GroupSeed = {
  schemaVersion: 2;
  meta: { demoNow: IsoDateTime; defaultUserId: Id; campaign: string; tagCatalog: string[] };
} & Record<string, unknown>;

// COLLECTION_NAMES は groups-store.ts と循環するため持たない。必須キーと「配列の要素は全て一意の string id」で検査する。
const REQUIRED = ["users", "groups", "members", "regions", "businesses"];
// future-trips.json から連結するコレクション(INS-C-07)
const FUTURE_KEYS = ["users", "profiles", "verifications", "groups", "members", "groupStatusLogs", "listings"];

const bad = (m: string): never => { throw new Error(`seed invalid: ${m}`); };

/** group-seed に future-trips.json を連結した新しいオブジェクトを返す。 */
export function withFutureTrips(base: unknown): Record<string, unknown> {
  const b = base as Record<string, unknown>;
  const f = futureTrips as unknown as Record<string, unknown>;
  const out: Record<string, unknown> = { ...b };
  for (const k of FUTURE_KEYS) {
    out[k] = [...((b[k] as unknown[]) ?? []), ...((f[k] as unknown[]) ?? [])];
  }
  return out;
}

export function parseSeed(raw: unknown): GroupSeed {
  if (!raw || typeof raw !== "object") return bad("not an object");
  const o = raw as Record<string, unknown>;
  if (o.schemaVersion !== 2) bad("schemaVersion must be 2");
  const meta = o.meta as Record<string, unknown> | undefined;
  if (!meta || typeof meta.demoNow !== "string" || Number.isNaN(Date.parse(meta.demoNow))) bad("meta.demoNow");
  if (typeof meta!.defaultUserId !== "string" || typeof meta!.campaign !== "string") bad("meta.defaultUserId/campaign");
  if (!Array.isArray(meta!.tagCatalog)) bad("meta.tagCatalog");
  for (const k of REQUIRED) if (!Array.isArray(o[k])) bad(`${k} must be an array`);
  for (const [k, v] of Object.entries(o)) {
    if (!Array.isArray(v)) continue;
    const seen = new Set<string>();
    for (const e of v) {
      const id = (e as { id?: unknown } | null)?.id;
      if (typeof id !== "string") bad(`${k}: element without string id`);
      if (seen.has(id as string)) bad(`${k}: duplicate id ${id}`);
      seen.add(id as string);
    }
  }
  if (!(o.users as { id: string }[]).some((u) => u.id === meta!.defaultUserId)) bad("defaultUserId not in users");
  return o as GroupSeed;
}
