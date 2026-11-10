import type { EntryLinkFixture } from "../types";
import { buildEntryUrl } from "../parse";

export interface ExternalLinkListProps { links: EntryLinkFixture[]; campaign: string; showAbnormal: boolean }

export function ExternalLinkList({ links, campaign, showAbnormal }: ExternalLinkListProps) {
  const normal = links.filter((l) => !l.abnormal);
  const abnormal = links.filter((l) => l.abnormal);
  const render = (l: EntryLinkFixture) => (
    <li key={l.id} style={{ marginBottom: 12 }}>
      <a href={buildEntryUrl(campaign, l.params)}>{l.label}</a>
      <div style={{ fontSize: 12, color: "#666" }}>
        流入元: {l.source} / 条件: {Object.entries(l.params).filter(([k]) => k !== "src").map(([k, v]) => `${k}=${v}`).join(", ")}
      </div>
    </li>
  );
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <p role="note" style={{ background: "#fff3bf", padding: 8, borderRadius: 6 }}>これは外部サイトの再現用ダミーです(モック)。</p>
      <h1 style={{ fontSize: 20 }}>外部リンク集</h1>
      <ul style={{ listStyle: "none", padding: 0 }}>{normal.map(render)}</ul>
      {showAbnormal && (
        <section>
          <h2 style={{ fontSize: 16 }}>異常値の例(開発・試験用)</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>{abnormal.map(render)}</ul>
        </section>
      )}
    </main>
  );
}
