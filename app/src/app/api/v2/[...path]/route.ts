// 本番の https://api.raund.net/api/v2 に似たパスを提供するローカル用モック。
// リクエスト/レスポンスの形は本番と同一ではない（本番の形式は未確認）。
import seed from "@/data/seed.json";
import { acquire, reset, state } from "@/lib/server-store";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const notFound = () => json({ error: "not_found" }, 404);

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(_req: Request, ctx: Ctx) {
  const [a, b, c] = (await ctx.params).path;
  const s = state();
  const acquired = new Set(s.stamps.map((x) => x.spotId));
  // keyword（合言葉）は押印の秘密なので一覧/詳細には含めない。
  const withFlag = (sp: (typeof seed.spots)[number]) => {
    const pub: Partial<typeof sp> = { ...sp };
    delete pub.keyword;
    return { ...pub, acquired: acquired.has(sp.id) };
  };

  switch (a) {
    case "campaign":
      return json({ ...seed.campaign, mainColor: "#2f6ba3", subColor: "#e1eef8", lap: s.lap });
    case "menus":
      return json([
        { key: "home", label: "ホーム", path: "" },
        { key: "spots", label: "スポット", path: "/spots" },
        { key: "history", label: "GET特典履歴", path: "/pointHistory" },
      ]);
    case "popups":
      return json([{ id: 1, title: "ようこそ", body: "スポットをめぐってスタンプを集めましょう。これはローカルのデモ環境です。" }]);
    case "spots":
      if (!b) return json(seed.spots.map(withFlag));
      { const sp = seed.spots.find((x) => String(x.id) === b); return sp ? json(withFlag(sp)) : notFound(); }
    case "sheets":
      return json([{ id: 1, size: seed.campaign.sheetSize, lap: s.lap }]);
    case "rewards":
      if (!b) return json(seed.rewards);
      { const r = seed.rewards.find((x) => String(x.id) === b); return r ? json(r) : notFound(); }
    case "notifications":
      if (b === "unread") return json({ count: 1 });
      return json([{ id: 1, title: "デモ環境について", body: "このサイトは本番サイトの構造を再現したローカル環境です。", at: "2026-11-09 09:00:00", read: false }]);
    case "user":
      if (!b) return json({ ...seed.user, lap: s.lap });
      if (b === "sheets") return json([{ id: 1, lap: s.lap, size: seed.campaign.sheetSize, stamps: s.stamps }]);
      if (b === "stamps") return json(s.stamps);
      if (b === "rewards")
        return json(s.rewards.map((r) => ({ ...r, ...seed.rewards.find((x) => x.id === r.rewardId) })));
      if (b === "activities") {
        const names = new Map(seed.spots.map((x) => [x.id, x.name]));
        const rows = [
          ...s.stamps.map((x) => ({ type: "stamp", label: names.get(x.spotId), at: x.at })),
          ...s.rewards.map((x) => ({ type: "reward", label: seed.rewards.find((r) => r.id === x.rewardId)?.prize, at: x.at })),
        ].sort((p, q) => q.at.localeCompare(p.at));
        return json(rows);
      }
      return notFound();
    default:
      void c;
      return notFound();
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  const body = await req.json().catch(() => ({}));
  if (a === "user" && b === "stamps") {
    if (typeof body.keyword !== "string" || body.keyword.length === 0 || body.keyword.length > 64)
      return json({ error: "invalid_code" }, 400);
    const r = acquire(body.keyword);
    return r.ok ? json(r) : json({ error: r.code }, r.code === "already_acquired" ? 409 : 400);
  }
  if (a === "user" && b === "reset") {
    reset();
    return json({ ok: true });
  }
  if (a === "inquiries") {
    const { email, message } = body as { email?: unknown; message?: unknown };
    if (typeof email !== "string" || !/^[^@\s]+@[^@\s]+$/.test(email) || typeof message !== "string" || !message.trim() || message.length > 2000)
      return json({ error: "validation" }, 400);
    state().inquiries.push({ email, message, at: new Date().toISOString() });
    return json({ ok: true });
  }
  return notFound();
}
