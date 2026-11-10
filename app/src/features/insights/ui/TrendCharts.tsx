"use client";
// 週別の旅行者人数(過去実績+未来予定)の棒グラフと、選択した週の年代別円グラフ(自作 SVG)。
import { useState } from "react";
import { Card, Group, Select, Stack, Table, Text, Title } from "@mantine/core";
import type { TrendWeek } from "../types";
import { cellNum, cellText } from "./cell";

const W = 720, H = 300, L = 48, R = 12, T = 16, B = 62;
const PAST = "#1c7ed6", FUTURE = "#e8590c";
const AGE_COLORS = ["#1c7ed6", "#2f9e44", "#e8590c"];

function short(w: TrendWeek) { return w.weekStart.slice(5).replace("-", "/"); }
function niceMax(m: number) {
  if (m <= 0) return 10;
  const p = Math.pow(10, Math.floor(Math.log10(m)));
  for (const k of [1, 2, 5, 10]) if (m <= k * p) return k * p;
  return m;
}

function BarChart({ weeks, sel, onSelect }: { weeks: TrendWeek[]; sel: number; onSelect(i: number): void }) {
  const vals = weeks.map((w) => (w.total.few ? 0 : w.total.value));
  const max = niceMax(Math.max(...vals, 0));
  const pw = W - L - R, ph = H - T - B;
  const step = pw / weeks.length, bw = step * 0.64;
  const y = (v: number) => T + ph - (v / max) * ph;
  const firstFuture = weeks.findIndex((w) => w.kind === "future");
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => Math.round(max * t));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="週別の旅行者人数の棒グラフ(過去の実績と未来の予定)"
      style={{ width: "100%", height: "auto", display: "block" }}>
      <defs>
        <pattern id="trend-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fff4e6" />
          <rect width="3" height="6" fill={FUTURE} />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#dee2e6" />
          <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#495057">{t}</text>
        </g>
      ))}
      <text x={4} y={12} fontSize="11" fill="#495057">人</text>
      {weeks.map((w, i) => {
        const x = L + i * step + (step - bw) / 2;
        const v = vals[i];
        const isSel = i === sel;
        const label = `${w.label}${w.partial ? "(一部の日のみ)" : ""} ${w.kind === "past" ? "実績" : "予定"} ${cellText(w.total)}`;
        return (
          <g key={w.weekStart} tabIndex={0} role="button" aria-label={label} aria-pressed={isSel}
            style={{ cursor: "pointer", outline: "none" }}
            onClick={() => onSelect(i)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(i); } }}>
            <title>{label}</title>
            <rect x={L + i * step} y={T} width={step} height={ph} fill={isSel ? "#f1f3f5" : "transparent"} />
            {w.total.few ? (
              <text x={x + bw / 2} y={y(0) - 4} textAnchor="middle" fontSize="10" fill="#495057">少数</text>
            ) : (
              <>
                <rect x={x} y={y(v)} width={bw} height={Math.max(0, y(0) - y(v))}
                  fill={w.kind === "past" ? PAST : "url(#trend-hatch)"} stroke={w.kind === "past" ? PAST : FUTURE} strokeWidth={isSel ? 2.5 : 1} />
                <text x={x + bw / 2} y={y(v) - 3} textAnchor="middle" fontSize="10" fill="#212529">{v}</text>
              </>
            )}
            <text x={x + bw / 2} y={H - B + 14} textAnchor="middle" fontSize="10" fill="#495057">{short(w)}</text>
          </g>
        );
      })}
      {firstFuture > 0 && (
        <g>
          <line x1={L + firstFuture * step} x2={L + firstFuture * step} y1={T} y2={H - B + 4} stroke="#495057" strokeDasharray="4 3" />
          <text x={L + firstFuture * step + 4} y={T + 10} fontSize="11" fill="#495057">今日の週から先は予定</text>
        </g>
      )}
      <text x={L + pw / 2} y={H - B + 30} textAnchor="middle" fontSize="11" fill="#495057">週の開始日(月/日)</text>
      <g transform={`translate(${L}, ${H - 14})`} fontSize="11" fill="#212529">
        <rect width="12" height="12" y="-10" fill={PAST} /><text x="18" y="0">実績(来訪した旅行者)</text>
        <rect x="170" width="12" height="12" y="-10" fill="url(#trend-hatch)" stroke={FUTURE} /><text x="188" y="0">予定(参加予定の旅行者)</text>
      </g>
    </svg>
  );
}

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)];
  const [x0, y0] = p(a0), [x1, y1] = p(a1);
  return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`;
}

function AgePie({ week }: { week: TrendWeek }) {
  if (week.ageChart === "empty") return <Text size="sm" c="dimmed">この週の旅行者データはありません。</Text>;
  if (week.ageChart === "hidden") {
    return <Text size="sm" c="dimmed">この週は公開できる人数が少ないため(年代の合計が 4 人未満)、年代別の円グラフは表示しません。</Text>;
  }
  const shown = week.byAge.reduce((s, a) => s + (a.cell.few ? 0 : a.cell.value), 0);
  const vs = week.byAge.map((a) => (a.cell.few ? 0 : a.cell.value));
  const slices = week.byAge.map((a, i) => {
    const before = vs.slice(0, i).reduce((s, n) => s + n, 0);
    return { a, i, v: vs[i], a0: (before / shown) * 2 * Math.PI, a1: ((before + vs[i]) / shown) * 2 * Math.PI };
  });
  const nonZero = slices.filter((s) => s.v > 0);
  return (
    <Group align="center" gap="lg" wrap="wrap">
      <svg viewBox="0 0 160 160" role="img" aria-label={`${week.label} の年代別構成の円グラフ`} style={{ width: 160, maxWidth: "100%", flex: "0 0 auto" }}>
        {nonZero.length === 1
          ? <circle cx="80" cy="80" r="74" fill={AGE_COLORS[nonZero[0].i]}><title>{`${nonZero[0].a.label} ${nonZero[0].v}人 100%`}</title></circle>
          : nonZero.map((s) => (
            <path key={s.a.age} d={arcPath(80, 80, 74, s.a0, s.a1)} fill={AGE_COLORS[s.i]} stroke="#fff" strokeWidth="2">
              <title>{`${s.a.label} ${s.v}人 ${Math.round((s.v / shown) * 100)}%`}</title>
            </path>
          ))}
      </svg>
      <Stack gap={4}>
        {slices.map((s) => (
          <Group key={s.a.age} gap="xs" wrap="nowrap">
            <span aria-hidden style={{ width: 12, height: 12, background: AGE_COLORS[s.i], display: "inline-block", borderRadius: 2 }} />
            <Text size="sm">{s.a.label}:{s.a.cell.few ? "少数" : `${s.v}人(${Math.round((s.v / shown) * 100)}%)`}</Text>
          </Group>
        ))}
        <Text size="xs" c="dimmed">割合は、少数を除く公開人数 {shown} 人に対するものです。</Text>
      </Stack>
    </Group>
  );
}

export function TrendCharts({ trend }: { trend: TrendWeek[] }) {
  const defIdx = (() => {
    const f = trend.findIndex((w) => w.kind === "future" && w.ageChart === "ok");
    return f >= 0 ? f : Math.max(0, trend.length - 1);
  })();
  const [sel, setSel] = useState<number | null>(null);
  const idx = sel !== null && sel < trend.length ? sel : defIdx;
  if (trend.length === 0) return null;
  const week = trend[idx];
  return (
    <Stack gap="lg">
      <Card withBorder>
        <Title order={4} mb="xs">週別の旅行者人数(過去の実績と未来の予定)</Title>
        <Text size="xs" c="dimmed" mb="sm">
          実績は集計済みの来訪者数、予定は参加が決まった・募集中のグループの人数です(性質が異なるため、単純な比較はできません)。5 人未満は「少数」と表示します。棒をクリックすると、下の円グラフの週が切り替わります。
        </Text>
        <BarChart weeks={trend} sel={idx} onSelect={setSel} />
      </Card>
      <Card withBorder>
        <Title order={4} mb="xs">週別の年代別構成</Title>
        <Select label="週を選ぶ" mb="sm" allowDeselect={false} value={String(idx)} onChange={(v) => v !== null && setSel(Number(v))}
          data={trend.map((w, i) => ({ value: String(i), label: `${w.label}(${w.kind === "past" ? "実績" : "予定"})` }))} />
        <Text size="sm" fw={600} mb="xs">{week.label}({week.kind === "past" ? "実績" : "予定"}) 合計 {cellText(week.total)}</Text>
        <AgePie week={week} />
      </Card>
      <Card withBorder>
        <Title order={4} mb="sm">週別・年代別の旅行者人数(グラフと同じデータ)</Title>
        <Table.ScrollContainer minWidth={520}>
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>週</Table.Th><Table.Th>区分</Table.Th>
                {trend[0].byAge.map((a) => <Table.Th key={a.age}>{a.label}</Table.Th>)}
                <Table.Th>合計</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {trend.map((w) => (
                <Table.Tr key={w.weekStart}>
                  <Table.Td>{w.label}{w.partial ? "(一部の日のみ)" : ""}</Table.Td>
                  <Table.Td>{w.kind === "past" ? "実績" : "予定"}</Table.Td>
                  {w.byAge.map((a) => <Table.Td key={a.age}>{cellNum(a.cell)}</Table.Td>)}
                  <Table.Td fw={700}>{cellNum(w.total)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    </Stack>
  );
}
