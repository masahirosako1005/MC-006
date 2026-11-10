// ダミー外部リンク(11 §4.3)。
import type { EntryLinkFixture } from "./types";

export const ENTRY_LINK_FIXTURES: EntryLinkFixture[] = [
  { id: "muni-normal", label: "星凪町の観光サイト: 冬の高原プラン", source: "muni-site",
    params: { region: "r-mizukoto", dateFrom: "2026-12-05", dateTo: "2026-12-07", vacancy: "2", src: "muni-site" } },
  { id: "muni-official", label: "自治体広報: 公式のおすすめプラン", source: "muni-pr",
    params: { region: "r-mizukoto", official: "1", src: "muni-pr" } },
  { id: "sns-alias", label: "SNS の投稿: 週末の旅仲間募集", source: "sns",
    params: { from: "2026-12-05", to: "2026-12-07", src: "sns" } },
  { id: "bad-values", label: "異常例: 不正な値と外部 URL", source: "other", abnormal: true,
    params: { region: "<script>", dateFrom: "2026-13-40", next: "https://example.invalid", src: "zzz" } },
  { id: "bad-region", label: "異常例: 未知の地方", source: "other", abnormal: true,
    params: { region: "r-nowhere", src: "other" } },
];
