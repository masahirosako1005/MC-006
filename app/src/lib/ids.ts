// ID 接頭辞と形式検査(統一仕様 3.2、INS-C-02)。
export const ID_PREFIXES = [
  "u", "g", "m", "jr", "wd", "sl", "n", "pi", "msg", "ex", "gs", "rm", "rs", "ph", "rg", "rp", "bl", "fe",
] as const;
export type IdPrefix = (typeof ID_PREFIXES)[number];

/** seed で決める ID の接頭辞(採番しない)。 */
export const SLUG_PREFIXES = ["r", "mun", "host", "biz"] as const;
export type SlugPrefix = (typeof SLUG_PREFIXES)[number];

type Id = string;

const ID_RE = /^([a-z]+)-(\d{3,8})$/;

/** 採番 ID の形式検査 `^<prefix>-\d{3,8}$`(存在確認はしない)。 */
export function isId(prefix: IdPrefix, v: unknown): v is Id {
  if (typeof v !== "string") return false;
  const m = ID_RE.exec(v);
  return m !== null && m[1] === prefix;
}

/** seed で決める ID の形式検査 `^<prefix>-[a-z0-9-]{1,30}$`(存在確認はしない)。 */
export function isSlugId(prefix: SlugPrefix, v: unknown): v is Id {
  return typeof v === "string" && new RegExp(`^${prefix}-[a-z0-9-]{1,30}$`).test(v);
}

/** 採番 ID の連番部分。形式不正は Error。 */
export function idSeq(id: Id): number {
  const m = ID_RE.exec(id);
  if (!m) throw new Error(`invalid id: ${id}`);
  return Number(m[2]);
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 推測困難なトークン(Crockford Base32 大文字。8 バイトで 13 文字)。 */
export function newToken(bytes = 8): string {
  const buf = globalThis.crypto.getRandomValues(new Uint8Array(bytes));
  let bits = 0;
  let acc = 0;
  let out = "";
  for (const b of buf) {
    acc = (acc << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(acc >>> (bits - 5)) & 31];
      bits -= 5;
    }
    acc &= (1 << bits) - 1;
  }
  if (bits > 0) out += CROCKFORD[(acc << (5 - bits)) & 31];
  return out;
}
// newId(prefix) は counters を持つ groups-store.ts に置く。
