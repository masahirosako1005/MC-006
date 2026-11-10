// 未来日程(ダミー 100 件)の生成。純粋関数のみ(I/O なし)。設計: docs/feature/13-tourism-owner-insight.md 第 5 章
export const SEED = 20261113;
export const DEMO_NOW = "2026-11-09T09:00:00+09:00";

const AREAS = ["r-hoshinagi", "r-suzukaze", "r-nijiho", "r-mizukoto"];
const AREA_NAME = { "r-hoshinagi": "星凪諸島", "r-suzukaze": "鈴風高原", "r-nijiho": "虹帆町", "r-mizukoto": "水琴地方" };
const SPOTS = {
  "r-hoshinagi": ["星綾の潮見台", "灯雲の石畳通り", "風詠みの灯台"],
  "r-suzukaze": ["雪雫の音楽堂"],
  "r-nijiho": ["虹灯りの夜市"],
  "r-mizukoto": ["月花の風車丘", "瑠璃凪の水鏡湖"],
};
// [週の開始(月曜), 星凪, 鈴風, 虹帆, 水琴, 種別, (連休の開始, 終了)]
const WEEKS = [
  ["2026-11-16", 5, 3, 3, 1, "holiday", "2026-11-21", "2026-11-23"],
  ["2026-11-23", 2, 2, 1, 1, "normal"],
  ["2026-11-30", 2, 1, 2, 1, "normal"],
  ["2026-12-07", 2, 2, 1, 1, "normal"],
  ["2026-12-14", 2, 2, 2, 0, "normal"],
  ["2026-12-21", 4, 2, 3, 1, "normal"],
  ["2026-12-28", 8, 5, 5, 2, "newyear"],
  ["2027-01-04", 5, 3, 3, 2, "holiday", "2027-01-09", "2027-01-11"],
  ["2027-01-11", 2, 2, 2, 1, "normal"],
  ["2027-01-18", 2, 2, 2, 1, "normal"],
  ["2027-01-25", 2, 2, 2, 1, "normal"],
];
// 過去実績(10 月 W1・W2)の週あたり人数(エリア別)の平均。補充する人数 = 水準 x 週の係数。
const AREA_BASE = { "r-hoshinagi": 188, "r-suzukaze": 142, "r-nijiho": 145, "r-mizukoto": 176 };
// 週の係数(0.8〜1.3 の範囲。連休・年末のピーク、年明け後の落ち着き、先の週ほどやや少なめ)
const WEEK_FACTOR = [1.1, 1.0, 0.94, 0.9, 0.88, 1.04, 1.3, 1.12, 0.96, 0.86, 0.82];
const BG_USERS = 1300;
const AGE_DIST = [["18-19", 6], ["20s", 39], ["30s", 33], ["40s", 32], ["50s", 22], ["60s", 15], ["70s+", 3]];
const COARSE = { "18-19": "under30", "20s": "under30", "30s": "30to49", "40s": "30to49", "50s": "50plus", "60s": "50plus", "70s+": "50plus" };
const WEEK_DIST = {
  holiday: { under30: 50, "30to49": 30, "50plus": 20 },
  newyear: { under30: 20, "30to49": 35, "50plus": 45 },
  normal: { under30: 30, "30to49": 43, "50plus": 27 },
};
const TAGS = ["温泉", "食べ歩き", "写真", "ハイキング", "歴史", "離島", "ゆっくり", "朝活"];
const PURPOSES = ["sightseeing", "food", "nature", "history", "photo", "relax", "stamp_rally"];
const WORDS = {
  normal: ["のんびり散策", "朝市さんぽ", "灯台めぐり", "夜市めぐり", "湖畔の朝", "冬の星空観察"],
  holiday: ["のんびり散策", "朝市さんぽ", "夜市めぐり", "三連休の島歩き", "冬の星空観察"],
  newyear: ["年末の小旅行", "新年の島歩き", "冬の星空観察", "のんびり散策"],
};
const DESCS = ["ゆっくり景色を楽しみたい方の集まりです。", "無理のないペースで巡ります。", "写真を撮りながら気軽に歩きます。", "地元の食べ物を楽しむ予定です。"];
const SUMMARIES = ["自治体がおすすめする、のんびり巡る公式プランです。", "地域の魅力を半日かけて楽しむ公式プランです。"];
const HIGHLIGHTS = ["景色の良い場所をめぐります", "地元の味を楽しめます", "ゆったりした日程です"];

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pad = (n) => String(n).padStart(2, "0");
const dayMs = 86400000;
const parseD = (s) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
const fmtD = (ms) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};
const addDays = (s, n) => fmtD(parseD(s) + n * dayMs);
// JST の壁時計を UTC として扱う分単位の値 <-> ISO 文字列
const toMin = (iso) =>
  Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10), +iso.slice(11, 13), +iso.slice(14, 16)) / 60000;
const toIso = (m) => {
  const d = new Date(m * 60000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+09:00`;
};
const dayStartMin = (s) => parseD(s) / 60000;

export function buildFutureTrips(opts = {}) {
  const seed = opts.seed ?? SEED;
  const demoNow = opts.demoNow ?? DEMO_NOW;
  let rng = mulberry32(seed);
  const int = (a, b) => a + Math.floor(rng() * (b - a + 1));
  const pick = (arr) => arr[Math.floor(rng() * arr.length)];
  const shuffle = (arr) => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const weighted = (pairs) => {
    const total = pairs.reduce((s, p) => s + p[1], 0);
    let r = rng() * total;
    for (const [v, w] of pairs) {
      r -= w;
      if (r < 0) return v;
    }
    return pairs[pairs.length - 1][0];
  };
  const nowMin = toMin(demoNow);

  // 1. 日程の枠
  const slots = [];
  for (const w of WEEKS) {
    const monday = w[0];
    const counts = w.slice(1, 5);
    const kind = w[5];
    const areas = [];
    AREAS.forEach((a, i) => {
      for (let k = 0; k < counts[i]; k++) areas.push(a);
    });
    const order = shuffle(areas.map((_, i) => i));
    const holidayN = kind === "holiday" ? Math.round(areas.length * 0.7) : 0;
    order.forEach((idx, rank) => {
      let start, end;
      if (kind === "holiday" && rank < holidayN) {
        start = w[6];
        end = w[7];
      } else if (kind === "newyear") {
        start = addDays("2026-12-29", int(0, 2));
        end = addDays(start, int(1, 2));
      } else if (kind === "holiday") {
        start = addDays(monday, int(0, 4));
        end = addDays(start, int(0, 1));
      } else {
        start = addDays(monday, int(0, 5));
        end = addDays(start, int(0, 1));
      }
      slots.push({ area: areas[idx], start, end, kind });
    });
  }
  slots.sort((a, b) => a.start.localeCompare(b.start) || AREAS.indexOf(a.area) - AREAS.indexOf(b.area));

  // 2. 背景ユーザー 150 人
  const bands = [];
  for (const [b, n] of AGE_DIST) for (let i = 0; i < n; i++) bands.push(b);
  const userBands = shuffle(bands);
  const users = [];
  const profiles = [];
  const verifications = [];
  const userInfo = [];
  for (let i = 0; i < 150; i++) {
    const id = `u-${101 + i}`;
    const displayName = `旅行者${101 + i}`;
    users.push({ id, displayName, role: "traveler", background: true });
    profiles.push({
      id,
      userId: id,
      displayName,
      ageBand: userBands[i],
      bio: "",
      travelPurposes: shuffle(PURPOSES).slice(0, int(1, 2)),
      realName: null,
      contact: null,
      visibility: { displayName: "public", ageBand: "reviewer", bio: "reviewer", travelPurposes: "reviewer", realName: "self", contact: "self" },
    });
    verifications.push({ id, userId: id, status: "verified", method: "mock_self_declaration", confirmedAt: "2026-10-01T10:00:00+09:00" });
    userInfo.push({ id, coarse: COARSE[userBands[i]], busy: [], orgCount: 0 });
  }

  // 3. 公式枠 8 件(水琴地方以外から)
  const officialIdx = slots.map((s, i) => (s.area !== "r-mizukoto" ? i : -1)).filter((i) => i >= 0);
  const officialSet = new Set(shuffle(officialIdx).slice(0, 8));

  // 4. グループ
  const groups = [];
  const members = [];
  const groupStatusLogs = [];
  const listings = [];
  let mSeq = 1001;
  let sSeq = 1001;
  const overlaps = (u, s, e) => u.busy.some(([bs, be]) => s <= be && e >= bs);
  const W = { confirmed: [50, 25, 10], withdrawal_period: [10, 5, 0], min_reached: [20, 30, 30], recruiting: [20, 40, 60] };

  let bgM = 1;
  let bgS = 1;
  const emit = (slot, i, o = {}) => {
    const extra = !!o.extra;
    const pool = o.pool ?? userInfo;
    const gid = extra ? `g-bg-${String(i + 1).padStart(4, "0")}` : `g-${101 + i}`;
    const official = !extra && officialSet.has(i);
    const mid = () => (extra ? `m-bg-${String(bgM++).padStart(5, "0")}` : `m-${mSeq++}`);
    const sid = () => (extra ? `sl-bg-${String(bgS++).padStart(5, "0")}` : `sl-${sSeq++}`);
    const month = slot.start.slice(5, 7);
    const col = month === "11" ? 0 : month === "12" ? 1 : 2;
    const status = weighted(Object.keys(W).filter((k) => !extra || k !== "recruiting").map((k) => [k, W[k][col]]));
    const capacity = extra ? o.size + int(0, 2) : weighted([[4, 40], [3, 20], [5, 20], [6, 15], [2, 5]]);
    const minMembers = extra ? int(2, 3) : capacity === 2 ? 2 : int(0, 1) ? 2 : 3;

    let deadlineDate;
    if (status === "confirmed") deadlineDate = addDays("2026-10-26", int(0, 10));
    else if (status === "withdrawal_period") deadlineDate = "2026-11-08";
    else {
      const c = addDays(slot.start, -10);
      deadlineDate = c > "2026-11-10" ? c : "2026-11-10";
    }
    const deadlineAt = toIso(dayStartMin(deadlineDate) + 1440);
    const withdrawalEndsAt = toIso(toMin(deadlineAt) + 2 * 1440);

    let cDate;
    if (status === "confirmed") {
      const span = Math.max(0, Math.round((parseD(addDays(deadlineDate, -3)) - parseD("2026-10-05")) / dayMs));
      cDate = addDays("2026-10-05", int(0, span));
    } else cDate = addDays("2026-10-20", int(0, status === "withdrawal_period" ? 17 : 19));
    const createdMin = dayStartMin(cDate) + int(9 * 60, 21 * 60);
    const createdAt = toIso(createdMin);
    const upper = Math.min(toMin(deadlineAt), nowMin) - 1;

    const count = extra ? o.size : status === "recruiting" ? int(1, minMembers - 1) : int(minMembers, capacity);

    const primary = weighted(Object.entries(WEEK_DIST[slot.kind]));
    const chosen = [];
    const take = (pred) => {
      const c = pool.filter((u) => !chosen.includes(u) && !overlaps(u, slot.start, slot.end) && pred(u));
      return c.length ? pick(c) : null;
    };
    let organizerId;
    let bgCount = count; // 背景ユーザーの人数
    if (official) {
      organizerId = "u-009"; // 公式枠の幹事は背景ユーザーではない
      bgCount = count - 1;
    } else {
      const lim = extra ? 5 : 2;
      const og = take((u) => u.orgCount < lim && u.coarse === primary) || take((u) => u.orgCount < lim);
      if (!og) throw new Error(`organizer not found for ${gid}`);
      og.orgCount++;
      organizerId = og.id;
      chosen.push(og);
      bgCount = count - 1;
    }
    for (let k = 0; k < bgCount; k++) {
      const u = (rng() < 0.7 ? take((x) => x.coarse === primary) : null) || take(() => true);
      if (!u) throw new Error(`member not found for ${gid}`);
      chosen.push(u);
    }
    for (const u of chosen) u.busy.push([slot.start, slot.end]);

    const others = chosen.filter((u) => u.id !== organizerId);
    const times = others.map(() => createdMin + 1 + Math.floor(rng() * Math.max(1, upper - createdMin)));
    times.sort((a, b) => a - b);
    const memberList = [{ userId: organizerId, role: "organizer", min: createdMin }];
    others.forEach((u, k) => memberList.push({ userId: u.id, role: "member", min: times[k] }));
    for (const m of memberList) {
      members.push({ id: mid(), groupId: gid, userId: m.userId, role: m.role, status: "active", joinedAt: toIso(m.min), leftAt: null });
    }

    let seq = 0;
    const log = (from, to, event, effMin, actor) =>
      groupStatusLogs.push({
        id: sid(), groupId: gid, seq: ++seq, from, to, event,
        effectiveAt: toIso(effMin), evaluatedAt: toIso(effMin), actor, meta: null,
      });
    log(null, "recruiting", "created", createdMin, organizerId);
    let updatedMin = createdMin;
    let transitions = 0;
    let withdrawalStartedAt = null;
    let withdrawalEndsAtV = null;
    let confirmedAt = null;
    if (status !== "recruiting") {
      const t = memberList[minMembers - 1].min;
      log("recruiting", "min_reached", "count_reached", t, "system");
      transitions++;
      updatedMin = t;
    }
    if (status === "withdrawal_period" || status === "confirmed") {
      log("min_reached", "withdrawal_period", "deadline_met", toMin(deadlineAt), "system");
      transitions++;
      updatedMin = toMin(deadlineAt);
      withdrawalStartedAt = deadlineAt;
      withdrawalEndsAtV = withdrawalEndsAt;
    }
    if (status === "confirmed") {
      log("withdrawal_period", "confirmed", "withdrawal_ended", toMin(withdrawalEndsAt), "system");
      transitions++;
      updatedMin = toMin(withdrawalEndsAt);
      confirmedAt = withdrawalEndsAt;
    }

    groups.push({
      id: gid,
      name: `${AREA_NAME[slot.area]} ${pick(WORDS[slot.kind])}`,
      campaign: "nttw-demo",
      region: slot.area,
      trip: { destination: pick(SPOTS[slot.area]), startDate: slot.start, endDate: slot.end, dateNote: "" },
      capacity,
      visibility: extra ? "private" : "public",
      tags: shuffle(TAGS).slice(0, int(1, 2)),
      description: pick(DESCS),
      official,
      organizerId,
      inviteCode: null,
      lifecycle: {
        status, minMembers, deadlineDate, deadlineAt, deadlineExtendedCount: 0,
        withdrawalStartedAt, withdrawalEndsAt: withdrawalEndsAtV, confirmedAt,
        startedAt: null, completedAt: null, cancelledAt: null, cancelReason: null, organizerCancelReason: null,
        replanOfGroupId: null, replannedToGroupId: null, replannedAt: null,
        deadlineSoonNoticeSent: false, withdrawalEndingNoticeSent: false, revision: 1 + transitions,
      },
      createdAt,
      updatedAt: toIso(updatedMin),
    });
    if (official) {
      listings.push({
        id: gid, kind: "official_plan", sponsor: { type: "municipality", id: "mun-demo-a" },
        summary: pick(SUMMARIES), highlights: shuffle(HIGHLIGHTS).slice(0, int(1, 2)),
        approvalMode: "organizer", createdAt,
      });
    }
  };
  slots.forEach((slot, i) => emit(slot, i));

  // 5. 週ごとの水準を過去実績並みにする補充(非公開の背景グループ)。既存 100 件の生成結果は変えない(別の乱数列を使う)。
  rng = mulberry32(seed + 7919);
  const bgPool = [];
  const bgBands = [];
  for (const [b, n] of AGE_DIST) for (let k = 0; k < Math.round((n * BG_USERS) / 150); k++) bgBands.push(b);
  shuffle(bgBands).forEach((band, k) => {
    const id = `u-bg-${String(k + 1).padStart(4, "0")}`;
    const displayName = `旅行者B${k + 1}`;
    users.push({ id, displayName, role: "traveler", background: true });
    profiles.push({
      id, userId: id, displayName, ageBand: band, bio: "",
      travelPurposes: shuffle(PURPOSES).slice(0, int(1, 2)), realName: null, contact: null,
      visibility: { displayName: "public", ageBand: "reviewer", bio: "reviewer", travelPurposes: "reviewer", realName: "self", contact: "self" },
    });
    verifications.push({ id, userId: id, status: "verified", method: "mock_self_declaration", confirmedAt: "2026-10-01T10:00:00+09:00" });
    bgPool.push({ id, coarse: COARSE[band], busy: [], orgCount: 0 });
  });
  const publicGroups = groups.slice();
  const memberCount = (g, from, to) =>
    g.trip.startDate <= to && g.trip.endDate >= from ? members.filter((m) => m.groupId === g.id).length : 0;
  const bgSlots = [];
  WEEKS.forEach((w, wi) => {
    const monday = w[0];
    const sunday = addDays(monday, 6);
    const factor = Math.min(1.3, Math.max(0.8, WEEK_FACTOR[wi] * (0.94 + rng() * 0.12)));
    const shares = AREAS.map((a) => AREA_BASE[a] * (0.9 + rng() * 0.2));
    AREAS.forEach((area, ai) => {
      const target = Math.round(shares[ai] * factor);
      const existing = publicGroups.filter((g) => g.region === area).reduce((s, g) => s + memberCount(g, monday, sunday), 0);
      let remain = target - existing;
      while (remain > 0) {
        const size = Math.min(remain + 2, int(8, 14));
        remain -= size;
        let start, end;
        const kind = w[5];
        if (kind === "newyear") {
          start = addDays("2026-12-28", int(0, 3));
          end = addDays(start, int(0, 1));
        } else if (kind === "holiday" && rng() < 0.6) {
          start = w[6];
          end = w[7] <= sunday ? w[7] : sunday;
        } else {
          start = addDays(monday, int(0, 5));
          end = addDays(start, int(0, 1));
        }
        bgSlots.push({ slot: { area, start, end, kind }, size });
      }
    });
  });
  bgSlots.sort((a, b) => a.slot.start.localeCompare(b.slot.start));
  // 公開グループと別の id(g-bg-NNNN)で採番する(newId のカウンタに影響しない)
  bgSlots.forEach((b, k) => emit(b.slot, k, { extra: true, size: b.size, pool: bgPool }));

  return { schemaVersion: 1, generator: { seed, demoNow }, users, profiles, verifications, groups, members, groupStatusLogs, listings };
}
