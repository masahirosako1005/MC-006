// 13 §4: 集計済みデータの生成(純粋関数)。入力は CSV から取り出した最小限の列。
import { toCountCell, toRateCell, suppressBreakdown } from "./privacy.mjs";

export const AGES = ["under30", "30to49", "50plus"];
export const AGE_KEYS = [...AGES, "all"];
const GOOD_POINTS = { 旅先の交流: "interaction", "景観・名所": "scenery", スタンプ収集: "stamps", "特典・景品": "rewards", 特になし: "none" };
const SCORES = { 大変満足: 5, やや満足: 4, 普通: 3, やや不満: 2, 大変不満: 1 };
const THEMES = [
  ["guidance", ["案内", "標識", "看板", "道順", "迷"]],
  ["transport", ["交通", "バス", "電車", "駐車", "移動", "アクセス"]],
  ["rest", ["休憩", "ベンチ", "座れ", "トイレ"]],
  ["reward", ["特典", "景品", "交換", "受け取"]],
  ["app", ["アプリ", "操作", "読み取", "読み込"]],
  ["spot_info", ["説明", "解説", "由来"]],
  ["shops", ["店", "飲食", "食事", "土産"]],
  ["crowd", ["混雑", "混ん", "行列"]],
];
export const THEME_KEYS = [...THEMES.map((t) => t[0]), "none"];
const HOUR_BANDS = ["night", "morning", "daytime", "evening"];

export function ageBand3(label) {
  if (label === "10代" || label === "20代") return "under30";
  if (label === "30代" || label === "40代") return "30to49";
  if (label === "50代" || label === "60代以上") return "50plus";
  throw new Error("年代が既知の選択肢にありません");
}
export function hourBandOf(h) {
  return h <= 5 ? "night" : h <= 10 ? "morning" : h <= 16 ? "daytime" : "evening";
}
export function classifyRequestThemes(text) {
  const t = text.normalize("NFC");
  const hit = THEMES.filter(([, kws]) => kws.some((w) => t.includes(w))).map(([k]) => k);
  return hit.length ? hit : ["none"];
}

const dayMs = (d) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10));
const addDays = (d, n) => new Date(dayMs(d) + n * 86400000).toISOString().slice(0, 10);
const weekdayOf = (d) => new Date(dayMs(d)).getUTCDay();

export function buildInsightAggregates({ users, stamps, surveys }, { spotRegion, truncatedFrom, k, periodFrom = "2026-10-01", periodTo = "2026-10-20" }) {
  const ageOf = new Map(users.map((u) => [u.id, ageBand3(u.age)]));
  const ageKeysOf = (id) => (ageOf.has(id) ? [ageOf.get(id), "all"] : ["all"]);

  const areaMap = new Map();
  for (const { spotId, regionId } of Object.values(spotRegion)) {
    if (!areaMap.has(regionId)) areaMap.set(regionId, []);
    areaMap.get(regionId).push(spotId);
  }
  const areas = [...areaMap].map(([regionId, spotIds]) => ({ regionId, spotIds: spotIds.sort((a, b) => a - b) }));
  const areaKeys = [...areas.map((a) => a.regionId), "all"];

  const weeks = [];
  for (let i = 0, from = periodFrom; from <= periodTo; i++, from = addDays(from, 7)) {
    const end = addDays(from, 6);
    const to = end > periodTo ? periodTo : end;
    const days = (dayMs(to) - dayMs(from)) / 86400000 + 1;
    weeks.push({ key: `W${i + 1}`, from, to, days, useForBaseline: days === 7 && to < truncatedFrom });
  }

  const st = stamps.map((s) => {
    const m = spotRegion[s.stampName];
    if (!m) throw new Error("スタンプ名が既知のスポットにありません");
    return { id: s.userId, lap: s.lap, regionId: m.regionId, date: s.at.slice(0, 10), hour: +s.at.slice(11, 13) };
  });

  // T1
  const visitVolume = [];
  for (const w of weeks) {
    const inWeek = st.filter((s) => s.date >= w.from && s.date <= w.to);
    for (const area of areaKeys) {
      const rows = inWeek.filter((s) => area === "all" || s.regionId === area);
      const vis = {}, vst = {};
      for (const a of AGE_KEYS) { vis[a] = new Set(); vst[a] = new Set(); }
      for (const s of rows) for (const a of ageKeysOf(s.id)) { vis[a].add(s.id); vst[a].add(s.id + "|" + s.date); }
      const flags = suppressBreakdown(AGES.map((a) => vis[a].size), k);
      for (const a of AGE_KEYS) {
        const few = (a !== "all" && flags[AGES.indexOf(a)]) || (vis[a].size >= 1 && vis[a].size < k);
        visitVolume.push({
          week: w.key, area, age: a,
          visitors: few ? { few: true } : toCountCell(vis[a].size, k),
          visits: few ? { few: true } : toCountCell(vst[a].size, k),
        });
      }
    }
  }

  // T2, T3: 打ち切り前のみ
  const early = st.filter((s) => s.date >= periodFrom && s.date < truncatedFrom);
  const weekdayProfile = [];
  const dayCount = Array(7).fill(0);
  for (let d = periodFrom; d < truncatedFrom; d = addDays(d, 1)) dayCount[weekdayOf(d)]++;
  const visitsBy = {};
  for (const s of early) for (const a of ageKeysOf(s.id)) (visitsBy[weekdayOf(s.date) + "|" + a] ??= new Set()).add(s.id + "|" + s.date);
  for (let wd = 0; wd < 7; wd++) {
    const flags = suppressBreakdown(AGES.map((a) => visitsBy[wd + "|" + a]?.size ?? 0), k);
    for (const a of AGE_KEYS) {
      const n = visitsBy[wd + "|" + a]?.size ?? 0;
      const f = a !== "all" && flags[AGES.indexOf(a)];
      weekdayProfile.push({ weekday: wd, age: a, visits: f ? { few: true } : toCountCell(n, k), days: dayCount[wd] });
    }
  }
  const hourProfile = [];
  const uniq = {};
  const hc = {};
  for (const s of early) for (const a of ageKeysOf(s.id)) {
    (uniq[a] ??= new Set()).add(s.id);
    const key = hourBandOf(s.hour) + "|" + a;
    hc[key] = (hc[key] ?? 0) + 1;
    hc["total|" + a] = (hc["total|" + a] ?? 0) + 1;
  }
  for (const b of HOUR_BANDS) for (const a of AGE_KEYS) {
    const n = hc[b + "|" + a] ?? 0;
    const fewAge = (uniq[a]?.size ?? 0) < k;
    hourProfile.push({
      hourBand: b, age: a,
      stamps: fewAge && n > 0 ? { few: true } : toCountCell(n, k),
      share: toRateCell(n, hc["total|" + a] ?? 0, k),
    });
  }

  // T4
  const perUser = new Map();
  for (const s of st) {
    const p = perUser.get(s.id) ?? { n: 0, lap2: false };
    p.n++;
    if (s.lap >= 2) p.lap2 = true;
    perUser.set(s.id, p);
  }
  const reg = {}, c3 = {}, c7 = {}, c2 = {};
  for (const a of AGE_KEYS) reg[a] = c3[a] = c7[a] = c2[a] = 0;
  for (const u of users) for (const a of ageKeysOf(u.id)) {
    reg[a]++;
    const p = perUser.get(u.id);
    if (p?.n >= 3) c3[a]++;
    if (p?.n >= 7) c7[a]++;
    if (p?.lap2) c2[a]++;
  }
  const cells = (m) => {
    const f = suppressBreakdown(AGES.map((a) => m[a]), k);
    return Object.fromEntries(AGE_KEYS.map((a) => [a, a !== "all" && f[AGES.indexOf(a)] ? { few: true } : toCountCell(m[a], k)]));
  };
  const [R, C3, C7, C2] = [reg, c3, c7, c2].map(cells);
  const participation = AGE_KEYS.map((a) => ({
    age: a, registered: R[a], stamp3plus: C3[a], stamp7plus: C7[a], lap2: C2[a], completeRate: toRateCell(c7[a], reg[a], k),
  }));

  // アンケート
  const sv = surveys.map((s) => {
    if (!(s.satisfaction in SCORES)) throw new Error("満足度が既知の選択肢にありません");
    const goods = s.good.split("、").map((x) => x.trim()).filter(Boolean);
    for (const g of goods) if (!(g in GOOD_POINTS)) throw new Error("良かった点が既知の選択肢にありません");
    return { ages: ageKeysOf(s.userId), score: SCORES[s.satisfaction], goods: goods.map((g) => GOOD_POINTS[g]), themes: classifyRequestThemes(s.request) };
  });
  const of = (a) => sv.filter((s) => s.ages.includes(a));
  const satisfaction = [], goodPoints = [], requestThemes = [];
  for (const a of AGE_KEYS) {
    const rs = of(a);
    const dist = [1, 2, 3, 4, 5].map((n) => rs.filter((s) => s.score === n).length);
    const flags = suppressBreakdown(dist, k);
    satisfaction.push({
      age: a, respondents: toCountCell(rs.length, k),
      distribution: Object.fromEntries(dist.map((n, i) => [String(i + 1), flags[i] ? { few: true } : toCountCell(n, k)])),
      satisfiedRate: toRateCell(rs.filter((s) => s.score >= 4).length, rs.length, k),
      dissatisfiedRate: toRateCell(rs.filter((s) => s.score <= 2).length, rs.length, k),
    });
    const opts = Object.values(GOOD_POINTS);
    const gc = opts.map((o) => rs.filter((s) => s.goods.includes(o)).length);
    const gf = suppressBreakdown(gc, k);
    opts.forEach((o, i) => goodPoints.push({
      age: a, option: o, respondents: gf[i] ? { few: true } : toCountCell(gc[i], k), share: toRateCell(gc[i], rs.length, k),
    }));
  }
  for (const a of AGE_KEYS) for (const t of THEME_KEYS) {
    const rs = of(a).filter((s) => s.themes.includes(t));
    requestThemes.push({
      age: a, theme: t, respondents: toCountCell(rs.length, k), share: toRateCell(rs.length, of(a).length, k),
      dissatisfiedRate: toRateCell(rs.filter((s) => s.score <= 2).length, rs.length, k),
    });
  }

  return {
    schemaVersion: 1,
    meta: { source: "sample-data", campaign: "nttw-demo", periodFrom, periodTo, truncatedFrom, weeks, minCellCount: k, areas },
    visitVolume, weekdayProfile, hourProfile, participation, satisfaction, goodPoints, requestThemes,
  };
}

// 出力検査(13 §4.7)。違反があれば例外。
export function checkInsightOutput(out, forbiddenHeaders, k) {
  const bad = [];
  const walk = (v) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") {
      if (v.few === false && typeof v.value === "number" && v.value !== 0 && v.value < k) bad.push("count<K");
      Object.values(v).forEach(walk);
    }
  };
  walk(out);
  const json = JSON.stringify(out);
  if (/\d{7}/.test(json)) bad.push("7桁の数字");
  for (const h of forbiddenHeaders) if (json.includes(h)) bad.push("個人の列名");
  if (bad.length) throw new Error("出力検査に失敗: " + [...new Set(bad)].join(", "));
}
