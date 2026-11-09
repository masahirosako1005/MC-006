// 最小限の CSV 読み込み。必要な列だけを取り出す(INS-BLD-02)。
// requiredHeaders: { key: "見出し" } または { key: { prefix: "前方一致" } }
import fs from "node:fs";

export function readCsv(file, requiredHeaders) {
  const lines = fs.readFileSync(file, "utf8").replace(/^﻿/, "").trim().split(/\r?\n/);
  const header = lines[0].split(",");
  const idx = {};
  for (const [key, spec] of Object.entries(requiredHeaders)) {
    const i =
      typeof spec === "string" ? header.indexOf(spec) : header.findIndex((h) => h.startsWith(spec.prefix));
    if (i < 0) throw new Error(`csv: 見出しが見つかりません (${key})`);
    idx[key] = i;
  }
  return lines.slice(1).map((line, n) => {
    const cols = line.split(",");
    if (cols.length !== header.length) throw new Error(`csv: 列数が見出しと違います (行 ${n + 2})`);
    const row = {};
    for (const [key, i] of Object.entries(idx)) row[key] = cols[i];
    return row;
  });
}
