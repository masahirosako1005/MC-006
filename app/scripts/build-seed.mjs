// sample-data/*.csv から、モック API 用のシード (src/data/seed.json) を生成する。
// 実行: npm run seed
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (f) =>
  fs
    .readFileSync(path.join(root, "sample-data", f), "utf8")
    .replace(/^﻿/, "")
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(","));

// スポットの説明・地図座標(0-100)・合言葉は CSV に無いため、ここで定義する（架空データ）。
const SPOT_META = {
  雪雫の音楽堂: { x: 22, y: 18, hue: 205, desc: "雪解け水の音が反響する高原のホール。朝の演奏会が人気です。" },
  星綾の潮見台: { x: 78, y: 30, hue: 220, desc: "薄青岬の先端にある展望台。夕方には潮が星のように光ります。" },
  虹灯りの夜市: { x: 58, y: 52, hue: 320, desc: "夕暮れから灯りがともる屋台通り。地元の味が集まります。" },
  灯雲の石畳通り: { x: 40, y: 66, hue: 35, desc: "港町の古い石畳の通り。雲のような灯籠が並びます。" },
  月花の風車丘: { x: 14, y: 54, hue: 140, desc: "月見草が咲く丘に風車が回る、集落のシンボルです。" },
  瑠璃凪の水鏡湖: { x: 64, y: 76, hue: 190, desc: "風のない朝、空を鏡のように映す湖です。" },
  風詠みの灯台: { x: 88, y: 84, hue: 260, desc: "離島に立つ白い灯台。島の歌を風が運びます。" },
};

const stamps = read("12_スタンプ獲得履歴.csv").slice(1);
const spotMap = new Map();
for (const r of stamps) {
  if (!spotMap.has(r[5])) spotMap.set(r[5], r[6]);
}
const spots = [...spotMap].map(([stampName, spotName], i) => {
  const id = i + 1;
  const m = SPOT_META[stampName] ?? { x: 50, y: 50, hue: 200, desc: "" };
  const area = (spotName.match(/（(.+)）/)?.[1] ?? "").split("・")[0];
  return {
    id,
    stampName,
    name: spotName,
    area,
    description: m.desc,
    map: { x: m.x, y: m.y },
    hue: m.hue,
    keyword: `SPOT${String(id).padStart(2, "0")}`,
    stampCount: stamps.filter((r) => r[5] === stampName).length,
  };
});

// 特典名・景品名は CSV から。必要スタンプ数はデモ用の仮置き（本番値は未確認）。
const rewardRows = read("18_特典獲得履歴.csv").slice(1);
const rewardMap = new Map();
for (const r of rewardRows) if (!rewardMap.has(r[3])) rewardMap.set(r[3], r[4]);
const rewards = [...rewardMap]
  .sort(([a], [b]) => a.localeCompare(b, "ja"))
  .map(([name, prize], i) => ({
    id: i + 1,
    name,
    prize,
    requiredStamps: [3, 5, 7][i] ?? 7,
    method: "獲得",
    description: `スタンプを${[3, 5, 7][i] ?? 7}個集めると自動で獲得できます。`,
  }));

// デモ用ユーザー: 履歴の多い 1 名を現在のユーザーとして使う（実在個人ではないテストデータ）。
const demoUserId = "8800119";
const users = read("13_ユーザー一覧.csv").slice(1);
const u = users.find((r) => r[0] === demoUserId);
const history = stamps
  .filter((r) => r[0] === demoUserId)
  .map((r) => ({ lap: Number(r[4]), stampName: r[5], at: r[7] }));
const rewardHistory = rewardRows
  .filter((r) => r[0] === demoUserId)
  .map((r) => ({ name: r[3], prize: r[4], at: r[5] }));

const seed = {
  campaign: { slug: "nttw-demo", name: "星凪トラベルラリー（デモ）", sheetSize: 7 },
  user: { id: demoUserId, name: u?.[1] ?? "test_traveler", ageGroup: u?.[4] ?? "", region: u?.[5] ?? "" },
  spots,
  rewards,
  history,
  rewardHistory,
};
fs.writeFileSync(path.join(root, "app", "src", "data", "seed.json"), JSON.stringify(seed, null, 2));
console.log(`seed: spots=${spots.length} rewards=${rewards.length} history=${history.length} rewardHistory=${rewardHistory.length}`);
