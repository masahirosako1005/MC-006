// 一覧画面の表示用の小さな整形(クライアント用)。
const WD = ["日", "月", "火", "水", "木", "金", "土"];
export function fmtDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  const w = WD[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}/${day}(${w})`;
}
export function fmtRange(start: string, end: string): string {
  return start === end ? fmtDate(start) : `${fmtDate(start)}〜${fmtDate(end)}`;
}
