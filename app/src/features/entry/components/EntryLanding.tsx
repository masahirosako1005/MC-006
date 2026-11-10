import type { AcceptedConditionView, IgnoredParam } from "../types";
import { ENTRY_IGNORED_REASON_LABEL, ENTRY_KEY_LABEL } from "../messages";
import { FocusHeading } from "./FocusHeading";

export interface EntryLandingProps {
  campaign: string;
  accepted: AcceptedConditionView[];
  ignored: IgnoredParam[];
  groupsPath: string;
}

const btn = { display: "inline-block", padding: "10px 18px", borderRadius: 8, textDecoration: "none", fontWeight: 600 } as const;

export function EntryLanding({ campaign, accepted, ignored, groupsPath }: EntryLandingProps) {
  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <FocusHeading>外部リンクから引き継いだ条件</FocusHeading>
      <section aria-labelledby="entry-accepted">
        <h2 id="entry-accepted" style={{ fontSize: 16 }}>受け取れた条件</h2>
        {accepted.length === 0 ? <p>受け取れた条件はありません。</p> : (
          <ul>{accepted.map((a) => <li key={a.key}>{a.label}: {a.value}</li>)}</ul>
        )}
      </section>
      <section aria-labelledby="entry-ignored" role="status" aria-live="polite">
        <h2 id="entry-ignored" style={{ fontSize: 16 }}>受け取れなかった項目</h2>
        <ul>
          {ignored.map((i, idx) => (
            <li key={`${i.key}-${idx}`}>
              {ENTRY_KEY_LABEL[i.key]}{i.count && i.count > 1 ? `(${i.count}件)` : ""}: {ENTRY_IGNORED_REASON_LABEL[i.reason]}
            </li>
          ))}
        </ul>
      </section>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 16 }}>
        <a href={groupsPath} style={{ ...btn, background: "#1971c2", color: "#fff" }}>この条件で一覧を見る</a>
        <a href={`/${campaign}/groups`} style={{ ...btn, border: "1px solid #1971c2", color: "#1971c2" }}>条件を変えて探す</a>
      </div>
    </main>
  );
}
