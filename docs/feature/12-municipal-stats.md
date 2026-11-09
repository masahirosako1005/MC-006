# 12 自治体向け集計

状態の凡例は README に従う([事実]/[決定]/[案]/[未決]/[要確認]/[推定])。本書の ID 接頭辞は `MUN`(MUN-M=指標、MUN-RULE=個人非特定規則、MUN-FN=関数、MUN-API=API、MUN-UI=画面、MUN-REQ=他モジュールへの要望、MUN-T=試験、MUN-TASK=実装タスク)。以下は断りがない限り [案]。「デモ範囲外」と記した項目はデモでは実装しなくてよい(実装は任意)。「見送り」と記した試験・タスク・記述は、契約書 16.2 の見送りの範囲に当たり、デモでは実装・試験しない(削除せず印だけを付ける)。「余力」はデモ最小の後に実装する項目。

モジュール間で共有する名前・署名・パス・値・状態値は [_unified-contracts.md](_unified-contracts.md)(以下「契約書」)に従う。本書の記述と契約書が食い違う場合は契約書を正とする。本書で [決定 n] と書いたものは、契約書第 1 章のオーナー判断の番号を指す。

## 1. 概要と責務 / 対応する柱

- 柱11。グループ旅行・同行の利用実績を、個人を特定しない集計として自治体担当者に表示する読み取り専用モジュール。データは保存せず、他モジュールのストアと 11 の流入集計(`aggregateFunnel`)から都度計算する(派生)。 [案]
- 自治体にとっての価値は「成果を説明できること」(ideas E-3: 参加者数、リピート、成立状況を個人を特定せずに確認したい)。デモでは 10 章の通しシナリオ最終場面(自治体担当者タナカが集計を見る)に使う。 [案]
- 責務: ①指標の計算(純粋関数) ②個人非特定の規則(件数の下限・補完秘匿)の強制 ③自治体ロールと担当地方による閲覧制御 ④ダッシュボード画面 ⑤デモ用の過去実績(合成)の生成。
- 入口B の流入集計は本モジュールに統合した [決定 24、契約書 2.2・7.12]。11 の `GET /api/entry/stats` は廃止され、流入の指標(MUN-M-08)は本モジュールの `GET /api/stats` で返す。11 は計測イベント(`FunnelEvent`)の記録と件数の集計関数(`aggregateFunnel`)を持ち、少数セルの丸めと画面表示は本モジュールが行う。
- 責務外: 個人別・グループ別の一覧、CSV 出力、通知・メール配信(外部連携なし)、他モジュールの状態変更(書き込みは一切しない)、流入イベントの記録(11)。
- 骨子の [未決] への回答案(承認待ち): 実行確定・中止・再企画の件数は指標に含める [案]。優先度は B のまま。

## 2. 既存機能との関係

- 新規。既存の計測(`/api/v1/tracking` 等)は内容を確認できないため流用しない。本デモでは Store と 11 の計測イベントから導出する(scratch 2.3 の「個人を特定しない集計画面」に相当)。
- `app/` の既存の管理画面・集計は無い [事実、`app/src` に admin 系ディレクトリなし]。新設するパスは `src/app/[campaign]/admin/stats/`(既存 `[campaign]` 配下の兄弟として追加。既存ファイルは変更しない)。
- API は `GET /api/stats`(契約書 2.2)。ルーティングは契約書 2.1 の方式に従い、`features/stats/handlers.ts` に 00 の `route()` で包んだハンドラを置き、`app/src/app/api/stats/route.ts` は再エクスポートだけを書く。

```ts
// app/src/app/api/stats/route.ts
export { getStatsHandler as GET } from "@/features/stats/handlers";
```

- `/api/stats` は `/api` 直下の静的セグメントで、同じ階層に動的セグメントが無い(契約書 2.1 の R-1・R-2 を満たす)。旧案の `/api/groups/stats` は廃止した。
- 既存 `src/lib/api.ts` の `api()` は `/api/v2` 固定のため使わない。本モジュールの取得フック(`features/stats/ui/use-stats.ts`)は 00 の `useGroupsApi`(`lib/groups-api.ts`)を包んで作る(第 8.1 節)。
- Next.js 16.4.5 のガイド(`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`02-route-segment-config/index.md`)で次を確認した [事実]。本 worktree には `app/node_modules` が無いため、メインのチェックアウトにインストール済みの同一バージョンで読んだ。
  - Route Handler で未定義の HTTP メソッドを呼ぶと Next.js が `405 Method Not Allowed` を返す。
  - `cacheComponents: true`(本アプリの `next.config.ts`)では、ルートセグメント設定の `dynamic` などは使えない。GET の Route Handler は `request.headers` や Cookie を読むとリクエスト時に実行される(事前生成されない)。
  - Route Handler と `cacheComponents` の挙動は、実装着手時に `npm ci` 後の `app/node_modules` で再確認する(判断は不要。契約書 14.2)。

### 2.1 利用ライブラリ・モジュール

新規に追加するライブラリは無い。グラフは自前の SVG で描く(第 8.2 節)。

| 名前 | 種別 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | フレームワーク | App Router のページ(`/[campaign]/admin/stats`)、Route Handler(`GET /api/stats`) | MIT | `app/package.json` の 16.4.5 を維持 |
| react / react-dom | ライブラリ | 画面コンポーネント(`useState`、`useMemo`) | MIT | 19.3.0 を維持 |
| @mantine/core | UI ライブラリ | `Card`、`SimpleGrid`、`Table`、`Select`、`SegmentedControl`、`Alert`、`Badge`。テーマ色をグラフの色にも使う | MIT | ^9.7.5 を維持 |
| @mantine/dates | UI ライブラリ | 期間指定の `MonthPickerInput`(月単位の範囲選択) | MIT | ^9.7.5 を維持 |
| dayjs | ライブラリ | クライアントでの月ラベル表示(「2026年10月」)、`MonthPickerInput` の値の変換 | MIT | ^1.11.23 を維持 |
| @tabler/icons-react | アイコン | `PrivacyNote`、`ForbiddenNotice` の装飾アイコン(`aria-hidden`) | MIT | ^3.51.0 を維持 |
| vitest | 試験(devDependency) | 純粋関数・Route Handler の自動試験。00 が導入する(契約書 11.3) | MIT | 00 が最新の安定版を追加する。12 は追加しない |
| typescript / eslint / eslint-config-next | 開発ツール | 型検査、lint | Apache-2.0 / MIT / MIT | `app/package.json` のものを維持 |
| Web 標準 API(`URL`、`URLSearchParams`、`Request`、`Response`、`fetch`) | 実行環境 | クエリの解析、応答の生成、取得 | - | Node.js / ブラウザ組み込み。Node の標準モジュール(`node:*`)は使わない |
| 00 共通基盤 | 自前モジュール | `db()`(ストアの読み取り)、`currentUser`、`clock`、`AppError`、`route()`/`ok()`、`c.query`(クエリの strict 検証)、`v.date()`、`isSlugId`、`lib/datetime.ts`、`useGroupsApi`、`ErrorNotice`/`LoadingBlock`/`MockBadge`、試験ヘルパー(`resetForTest`、`callRoute`、`fixtures.ts`) | - | 00 の設計書の署名に従う |
| 11 入口B・公式枠 | 自前モジュール | `aggregateFunnel`(流入の件数集計)、`ENTRY_SOURCES`、型 `Municipality`・`FunnelEvent`・`FunnelAggregate` | - | 契約書 7.11・7.12 の署名に従う |

自前で実装するもの:

| 対象 | 理由 |
|---|---|
| グラフ(棒・折れ線・ファネル。SVG/CSS) | 3 種類で足り、「少数」の表示(棒なし+ハッチ+文字)を細かく制御するため(第 8.2 節) |
| 個人非特定の関数(`toCountCell`、`toRateCell`、`suppressBreakdown`) | 本モジュール固有の規則で、該当するライブラリが無いため。集計の下限はこれらに一本化する(契約書 10.5) |
| 擬似乱数(mulberry32) | 合成履歴を決定論的に作るのに 10 行程度で足りるため。公開されているアルゴリズムを参照して自前で書き、既存コードは転記しない |
| 月の計算(`monthsBetween`、月初・月末の判定) | `YYYY-MM` の文字列演算で足り、サーバーのタイムゾーン設定に依存させないため(00 の `lib/datetime.ts` を補助に使う) |

使わないもの: `@mantine/charts`・recharts・Chart.js(第 8.2 節)、`zustand`(画面の状態はコンポーネント内の `useState` で足りる)、`@mantine/hooks`(スマホ幅の列の出し分けは `@mantine/core` の `visibleFrom` で行う)。

## 3. 指標の定義(MUN-M)

### 3.1 共通の集計単位

- 集計軸: 期間(JST の暦月の範囲。時系列は月単位)、地方(`Group.region`。自治体の担当地方のみ)、公式枠か否か(`Group.official`。`all`/`official`/`general`)。 [案]
- 「期間に属する」の基準は指標ごとに下表の「基準日時」で固定する(同じグループが複数月に重複計上されないようにする)。
- グループの区分は `group.lifecycle.status`(契約書 4.1 の `GroupStatus` 8 値)から決め、期間の判定には区分に対応する `lifecycle` の日時を使う。区分は `groupPhase`(MUN-FN-12)で導出する。

| `GroupStatus` | 区分(`GroupPhase`) | 期間の判定に使う日時 |
|---|---|---|
| `recruiting`、`min_reached`、`withdrawal_period` | `open`(未確定) | (確定・中止の指標には数えない) |
| `confirmed`、`in_progress`、`completed` | `confirmed`(実行確定) | `lifecycle.confirmedAt` |
| `cancelled`、`replanned` | `cancelled`(中止) | `lifecycle.cancelledAt` |

- 確定後に中止したグループ(T8 の `below_floor` だけ。幹事の中止は実行確定の前まで [決定 29、契約書 4.3])は状態が `cancelled`(または再企画後の `replanned`)になるため「中止」に数え、確定には数えない。`confirmedAt` が残っていても区分は状態で決まる。
- `replanned` は「中止したグループを幹事が再企画した後の元グループ」(契約書 4.1)。中止として数え、再企画率(M-06)の分子にも数える。再企画で作った新グループは `recruiting` から始まる別のグループとして M-01 に数える。
- 区分に対応する日時が `null` のグループ(例: 状態が `confirmed` で `confirmedAt` が `null`)は不整合として確定・中止の指標から除外する(M-01・M-02 には数える)。試験 MUN-T-32 で確認する。
- 人数の数え方: 「参加者」は確定グループの参加中(`GroupMember.status = "active"`)のメンバー。退会・辞退したメンバー(`left`)は含めない。

### 3.2 指標一覧

| ID | 指標名 | 定義式 | 元データ | 基準日時 | 自治体の意思決定上の価値 |
|---|---|---|---|---|---|
| MUN-M-01 | グループ作成数 | 期間内に作られた Group の数(再企画で作ったグループを含む) | Group(01) | `createdAt` | 同行ニーズの量。キャンペーンの訴求・公式枠の投入量を判断 |
| MUN-M-02 | 参加申請数 | 期間内の JoinRequest の数(5 状態すべて) | JoinRequest(03) | `createdAt` | 関心の高さ。公式枠を増やす地方の判断 |
| MUN-M-03 | 承認率 | 承認数 ÷(承認数+却下数)。取り下げ・失効・申請中は分母に含めない | JoinRequest | `decidedAt` | 幹事の運用が滞っていないか。受け入れの間口の目安 |
| MUN-M-04 | 実行確定数 / 実行確定率 | 確定数 ÷(確定数+中止数)。確定・中止は 3.1 の区分 | Group(04) | 確定=`lifecycle.confirmedAt`、中止=`lifecycle.cancelledAt` | 成立の安定度。成立支援策(最少人数・締切の案内)の要否 |
| MUN-M-05 | 中止率(理由別) | 中止数 ÷(確定数+中止数)。理由別件数は `lifecycle.cancelReason` を 3 区分に集約(`deadline_unmet`/`organizer`/`other`。第 4 章、契約書 4.3) | Group(04) | `lifecycle.cancelledAt` | 締切未達が多ければ参加者募集(広報・公式枠)の強化、幹事操作が多ければ運用の見直し |
| MUN-M-06 | 再企画率 | 期間内に中止した Group のうち、状態が `replanned` のものの割合(再企画した日時は問わない) | Group(04) | 中止の `lifecycle.cancelledAt` | 中止後に再企画されている割合。再企画の案内の効果 |
| MUN-M-07 | 成立人数の分布 | 実行確定した Group の参加者数(2〜6)ごとのグループ数。範囲外(1 以下)は数えない | Group、GroupMember(01) | `lifecycle.confirmedAt` | 小規模(2〜3 人)向けの宿・交通の需要。人数上限の設計 |
| MUN-M-08 | 流入(入口別・流入元別・イベント種別) | 11 の `aggregateFunnel` の件数(第 3.4 節)。入口別(入口A/入口B)、入口B の流入元別(`source`)、イベント種別(`type`)の 3 つの内訳 | FunnelEvent(11) | `FunnelEvent.day` | 自治体サイト・広報(入口B)からの送客の効果 |
| MUN-M-09 | スタンプ取得数・訪問スポット | スタンプ取得の総数。スポット別の「取得したグループ数」上位 5 | GroupStamp(08)、seed.spots | `GroupStamp.at` | 回遊の実態。人気のスポット・訪問の少ないスポット |
| MUN-M-10 | 地方別の人気 | 地方ごとに M-01・M-02・M-04(確定数)・M-05(中止率)を並べた表 | 上記 | 各指標の基準 | 地方ごとの需給。どの地方に公式枠を足すか |
| MUN-M-11 | 再訪(リピート)率 | 期間内に確定したグループの参加者(重複なしの人数)のうち、`to` 以前(期間の開始前を含む)に確定したグループへの参加が 2 回以上の人の割合 | GroupMember、Group | `lifecycle.confirmedAt` | ideas の「リピート」。関係人口の継続性 |
| MUN-M-12 | 参加者の年代帯 | 期間内に確定した Group の参加者(重複なしの人数)を集計用の 3 区分(第 5.4 節)ごとに数えた人数 | GroupMember、Profile.ageBand(09) | `lifecycle.confirmedAt` | 訴求の対象層の把握(性別は扱わない) |
| MUN-M-13 | 満足度 | アンケート回答のうち `satisfaction` が 4 以上の割合と、1〜5 の分布 | SurveyAnswer(08) | 第 3.5 節(`lifecycle.completedAt`) | 旅全体の評価。キャンペーンの継続判断 |
| MUN-M-14 | 再訪意向 | アンケート回答のうち `wantAgain = "yes"` の割合と、`yes`/`maybe`/`no` の分布 | SurveyAnswer | 同上 | また来たいと思われているか。M-11(行動としての再訪)と並べて見る |
| MUN-M-15 | 地元との交流 | アンケート回答のうち `localInteraction` が 4 以上の割合と、1〜5 の分布 | SurveyAnswer | 同上 | 地元の担い手・公式枠の交流施策の効果 |
| MUN-M-16 | 滞在中の回遊 | アンケート回答のうち `localExploration` が 4 以上の割合と、1〜5 の分布 | SurveyAnswer | 同上 | 回遊施策(スタンプラリー、M-09)の効果の主観的な確認 |
| MUN-M-17 | アンケート回答数・回答率 | 回答数と、回答数 ÷ 対象グループの参加中メンバー数 | SurveyAnswer、GroupMember | 同上 | M-13〜M-16 の信頼度の目安 |

補足:
- 時系列(月別): M-01、M-02、M-04(確定数)、M-09(取得数)を月で並べる。系列は最大 12 か月。
- 地方別の表(M-10)の並び順: 作成数が数値のセルを降順、続いて「少数」のセル、同順位は担当自治体の `Municipality.regionIds` の順。「少数」どうしは実数で並べない(順序から値を推測させない)。
- ファネル(中止→再企画→再成立): 期間内に中止した Group 数 → うち状態が `replanned` の数 → うち再企画で作ったグループ(`lifecycle.replanOfGroupId` が元グループを指すもの)が集計時点までに実行確定した数(確定日は期間外でもよい)。中止・再企画に関する自治体の打ち手(再企画の案内文言、日程の提案)を判断する。 [案]
- 見送った指標 [案]:
  - 辞退数(辞退は 07 章論点 16 で「他の参加者に誰が辞退したかを出さない」方針。集計でも辞退の個数は出さない)。
  - 通報・ブロック件数(安全運用の情報で自治体向けではない)、チャット・費用メモの量(内容に近く、価値も低い)。
  - 入口から成立までの個人単位の紐付け(scratch の「流入元から成立までの紐付け」)は個人追跡になるため行わない。11 の計測は流入元を一覧・申請へ引き継がないため(11 §4.4 の限界)、流入の指標は件数の内訳までとする。
  - アンケートの `planClarity`(旅程・集合のわかりやすさ): グループ内の運営(幹事の旅程づくり)の評価で、自治体の施策の判断に直接使わないため指標にしない。
  - 個人特典の付与数(08 の `rallyRewardGrants`): 契約書 7.12 の読む項目に含まれない。付与はグループの取得数が必要数に達したときに参加中メンバー全員へ行われる派生値で、回遊の実態は M-09 で足りるため含めない。
- アンケートの指標(M-13〜M-17)は `completed` のグループの回答だけを対象にし、余力とする(時系列・ファネルと同じ優先度)[統一、契約書 7.12]。
- 再訪(M-11)・年代帯(M-12)・アンケート(M-13〜M-17)は内部で参加者・回答を使うが、応答には ID・名前・個々の回答を含めない(第 5.1 節)。

### 3.3 率の扱い

- 率は第 5.3 節(MUN-RULE-03)の規則で丸める。分母が下限 K 未満なら「少数」、分子が K 未満なら「N% 未満」と返し、分子の実数を逆算させない。

### 3.4 流入(MUN-M-08)の定義

- 元データは 11 の `aggregateFunnel(q: FunnelQuery): FunnelAggregate` の結果(契約書 7.11・7.12)。`q` は `{ campaign: 担当自治体の Municipality.campaign, fromDay: query.from, toDay: query.to }` とし、12 の期間をそのまま渡す。合成履歴(第 13 章)の流入は `addFunnelEvents`(MUN-FN-14)で同じ形に加算する。
- `type`・`channel`・`source` は 11 の固定の列挙値だけを扱う [決定 20]。12 は独自の入口区分を持たない(旧案の `EntryEvent`・`EntryChannel` と `entryEvents` は廃止した。契約書 7.12)。
- 内訳は次の 3 つ。各内訳のキーは 11 の列挙の順で、値が 0 のキーも省略しない。

| 内訳 | キー | 値(`FunnelAggregate` から) |
|---|---|---|
| 入口別(`inflow.byEntry`) | `A`(一覧を直接開いた)、`B`(外部リンクから入口B に着地) | `A` = `listViewedByChannel.A`、`B` = `landedBySource` の合計(`entry_landed` の件数) |
| 入口B の流入元別(`inflow.bySource`) | `ENTRY_SOURCES` の 7 値(`muni-site`、`muni-pr`、`sns`、`search`、`travel-media`、`transport`、`other`)、`none`(`src` なし)、`unknown`(許可リスト外) | `landedBySource[key]` |
| イベント種別(`inflow.byType`) | `entry_landed`、`entry_params_ignored`、`list_viewed`、`official_viewed`、`official_requested` | 順に `landedBySource` の合計、`ignoredCount`、`listViewedByChannel` の合計、`officialViewed`、`officialRequested` |

- 地方・公式枠のフィルタは M-08 に適用しない。`FunnelQuery` に地方の条件が無く、`list_viewed`・`official_*` のイベントは地方を持たないため、M-08 は担当自治体のキャンペーン全体の件数になる。画面には「流入はキャンペーン全体の件数(地方・公式枠の絞り込みは適用しない)」と表示する。この扱いは第 9 章の「担当外の地方のデータを返さない」の例外で、`FunnelQuery` に地方の条件を追加しないことを含めて確定した [統一、契約書 7.12]。
- 期間の既定値は他の指標と同じ直近 3 か月(暦月。当月を含む)[決定 12]。
- `FunnelEvent.day` は JST の日付(11 §4.4)。12 の期間の境界(第 7.3 節)と日単位で一致する。

### 3.5 アンケート(MUN-M-13〜M-17)の対象(余力)

アンケートは 08 の `SurveyAnswer`(5 項目、契約書 7.8 [決定 19・25])。振り返りは `in_progress` と `completed` で書ける [決定 16] が、集計の対象は `completed` のグループの回答だけとする [統一、契約書 7.12]。デモでは余力の扱い。

- 対象グループ: 状態が `completed` で、`lifecycle.completedAt` が期間内のグループ。`in_progress` のグループの回答は、旅行中で回答が揃っておらず書き換えも続くため対象外とし、完了後に対象になる。
- 対象の回答: 対象グループの `rallySurveys` の回答すべて(1 人 1 件。08 が `(groupId, userId)` で一意を保証)。完了後も回答の書き換えはできる(`canReview`)が、集計はリクエストごとに計算するため、その時点の値を使う。
- 未入力の扱い: 回答していないメンバーは M-13〜M-16 の分母に含めない(補完しない)。回答率(M-17)の分母は対象グループの参加中メンバー数の合計で、未入力の多さは M-17 で示す。`SurveyAnswer` は 5 項目すべてが必須のため、項目ごとの未入力は発生しない。
- 割合の定義: 1〜5 の尺度は 4 以上を肯定とする。`wantAgain` は `yes` を肯定とし、`maybe` は肯定に含めない。
- 項目と指標の対応:

| 08 の項目(契約書 7.8) | 指標 | 肯定の条件 | 分布のキー |
|---|---|---|---|
| `satisfaction`(旅全体の満足度) | MUN-M-13 | 4 以上 | `"1"`〜`"5"` |
| `wantAgain`(また旅行したいか) | MUN-M-14 | `yes` | `yes`、`maybe`、`no` |
| `localInteraction`(地元の人との交流があったか) | MUN-M-15 | 4 以上 | `"1"`〜`"5"` |
| `localExploration`(滞在中にいろいろな場所を回れたか) | MUN-M-16 | 4 以上 | `"1"`〜`"5"` |
| `planClarity`(旅程・集合のわかりやすさ) | 使わない(3.2 の見送った指標) | - | - |

- 追加 2 項目(`localInteraction`、`localExploration`)の文言は [決定 25] で確定した(契約書 7.8: 「地元の人との交流があったか」「滞在中にいろいろな場所を回れたか」、各 5 段階)。画面の指標名は「地元との交流」「滞在中の回遊」とする。
- 平均値は出さない。尺度の平均は少数の回答で大きく動き、分布と割合の方が K の規則を一様に適用できるため。

## 4. 集計の元データと取得方法

読み取り専用の契約。各モジュールのデータを 00 の `db()` から直接読み、流入は 11 の `aggregateFunnel` を呼ぶ。書き込みはしない。集計ロジックが他モジュールの型に直接依存しないよう、`features/stats/facts.ts` に変換層(アダプタ)を置き、集計ロジックは中間表現 `GroupFact` と `FunnelAggregate` だけを見る。 [案]

| 元データ | コレクション(型の所有) | 使う項目(契約書の名前) | 取得 |
|---|---|---|---|
| Group | `groups`(01。`lifecycle` は 04) | `id`、`campaign`、`region`、`official`、`createdAt`、`lifecycle.status`、`lifecycle.confirmedAt`、`lifecycle.completedAt`、`lifecycle.cancelledAt`、`lifecycle.cancelReason`、`lifecycle.replanOfGroupId` | `db().groups.list()` |
| GroupMember | `members`(01) | `groupId`、`userId`、`status`(`active`/`left`) | `db().members.list()` |
| JoinRequest | `joinRequests`(03) | `groupId`、`status`(`pending`/`approved`/`rejected`/`withdrawn`/`expired`)、`createdAt`、`decidedAt` | `db().joinRequests.list()` |
| GroupStamp | `groupStamps`(08) | `groupId`、`spotId`、`at` | `db().groupStamps.list()` |
| SurveyAnswer | `rallySurveys`(08) | `groupId`、`satisfaction`、`wantAgain`、`localInteraction`、`localExploration` | `db().rallySurveys.list()` |
| Profile | `profiles`(09。ID は userId) | `ageBand`(09 の `AgeBand`) | `db().profiles.get(userId)` |
| Municipality | `municipalities`(11) | `id`、`campaign`、`displayName`、`regionIds` | `db().municipalities.get(id)` |
| Region | `regions`(02) | `id`、`name` | `db().regions.get(id)` |
| 流入 | 11 の `funnelEvents`(12 は直接読まない) | `FunnelAggregate` の `landedBySource`、`listViewedByChannel`、`ignoredCount`、`officialViewed`、`officialRequested` | `aggregateFunnel(q)` |
| spots | 既存 seed.json | `spotId`、`name`(公開情報) | 読み取り import |

- 型は所有モジュールの `features/<m>/types.ts` から `import type` で読む(契約書 3.1)。依存の向き [統一、契約書 4.6]: 実行時の import は 00・11 に限る。01・02・03・04・08・09 は型(`import type`)と 00 の `db()` によるデータの読み取りだけ。`CancelReasonCode` と `GroupStatus` は 04 の型を使う(契約書 4.1・4.3)。
- 中止理由の集約(`cancelReasonGroup`。MUN-FN-13): 契約書 4.3 の 5 値を 3 区分にする [統一、契約書 4.3]。区分のキーは契約書 4.3 の 12 の行(`deadline_unmet` = `min_not_reached`、`other` = 残りの自動 2 値、幹事 = `organizer_cancelled`・`organizer_left`)に合わせる。

| `CancelReasonCode`(04) | 区分(`CancelReasonGroup`) | 区分の表示名 |
|---|---|---|
| `min_not_reached` | `deadline_unmet` | 締切までに最少人数に達しなかった |
| `organizer_cancelled`、`organizer_left` | `organizer` | 幹事による中止・幹事の不在 |
| `below_min_in_withdrawal`、`below_floor` | `other` | 辞退で人数が下回った |

- 中止の区分(状態が `cancelled`・`replanned`)で `cancelReason` が `null` のグループは理由別の内訳に数えない(中止数には数える)。
- 「活動中のデータ」(group-seed と操作で増えるもの)に加え、デモ用の過去実績(合成)を同じ `GroupFact` の形で足す(第 13 章)。画面には「デモ用の過去実績(合成データ)を含む」と常時表示する。 [案]
- 非公開グループ・公開範囲(09)は集計では考慮しない: 集計は自治体向けの統計であり、個々のグループの中身を表示しないため、公開・非公開を問わず全グループを件数に含める [統一、契約書 7.12]。第 5 章の下限規則(K=5)で個別特定を防ぐ。
- Profile の `ageBand` は 09 の公開設定(`visibility`)にかかわらず読み、3 区分の人数として使う。個人の値は出さず、K=5 の規則で丸める [統一、契約書 7.12]。
- ブロック関係・通報状態は集計に使わない。

## 5. 個人非特定の規則(MUN-RULE)

07 章論点 11・17(人数が少ない場合の丸め)と 05 章末尾の未決「個人を特定しない集計の最小単位(件数の下限など)」に対する本書の規則。集計の下限は K=5 に統一された [決定 17、契約書 10.5]。

### 5.1 出力に含めないもの(MUN-RULE-01)

- ユーザー ID、表示名、グループ ID、グループ名、幹事、招待コード、行き先の自由記述、チャット・メモ・費用メモの内容、個々のアンケート回答。性別。
- 個票(1 行 = 1 グループ/1 人)を返す API・画面を作らない。応答は常に集計値(`CountCell`/`RateCell`)のみ。
- 内部計算で参加者 ID を使う(M-11、M-12、M-17)場合も、応答型に ID 型を持たせず、試験で応答 JSON に ID が含まれないことを検査する(MUN-T-05)。地方 ID(`r-<slug>`)は公開のマスタ値のため応答に含めてよい。

### 5.2 件数の下限 K(MUN-RULE-02)

- `MIN_CELL_COUNT = 5`(`features/stats/config.ts`)[決定 17]。表示される 1 セル(カード・表の 1 マス・グラフの 1 点)の件数が 1〜4 のとき「少数」と表示し、数値を返さない。0 は「0」と表示する(0 は誰も該当しないので特定につながらない)。
- 集計単位は「グループ数」「人数」「回答数」「イベント数」。グループ数が 1〜4 のセルは単一グループを特定しうるため K 未満として扱う。
- 集計の下限は本モジュールの `MIN_CELL_COUNT`・`toCountCell`・`toRateCell`・`suppressBreakdown` に一本化する(契約書 10.5。09 の `suppressSmallCell` と 08 の `rallyAggregate` は廃止され、12 はどちらも使わない)。
- 09 の `memberSummary`(グループ内メンバーの年代帯。4 人未満は年代を出さない)は別の規則として残る。09 は「1 グループの参加前の概要」、本書は「複数グループの統計」を対象とする。
- K=5 の根拠: 一般に小地域統計の秘匿で用いられる範囲を参考にした値 [推定]。実運用では自治体へのヒアリングで見直す(11 章の「成果指標」の未決と連動)。

### 5.3 率の丸め(MUN-RULE-03)

- 分母が 0 なら「対象なし」(`{kind:"none"}`。画面は「—」)。
- 分母が 1〜K-1 なら「少数」(`{kind:"few"}`)。
- 分母が K 以上で分子が 1〜K-1 なら「N% 未満」(`{kind:"below", percent: N}`、N = ceil(K ÷ 分母 × 100))。分子の実数を逆算させない。
- それ以外は整数 %(`{kind:"value", percent: round(分子 ÷ 分母 × 100)}`)。分子 0 は 0%。
- 実装は `toRateCell`(MUN-FN-07)。

### 5.4 年代帯の粒度(MUN-RULE-04)

- 集計では 3 区分のみ: `under30`、`30to49`、`50plus`。09 の `AgeBand`(7 区分、契約書 6.3)から `coarseAgeBand`(MUN-FN-09)で変換する(契約書 7.12)。

| 09 の `AgeBand` | 集計の区分(`CoarseAgeBand`) |
|---|---|
| `18-19`、`20s` | `under30` |
| `30s`、`40s` | `30to49` |
| `50s`、`60s`、`70s+` | `50plus` |
| Profile が無い | `null`(年代帯の集計から除外) |

- 年齢の細かい指定・同年代のみ等の軸は設けない(07 章論点 11 の維持)。
- 年代帯は「地方 × 期間」の絞り込みと併用でき、各区分は K 未満なら「少数」。

### 5.5 補完秘匿(MUN-RULE-05)

- 内訳(地方別・月別・成立人数別・流入の各内訳・年代帯・スポット別・中止理由別・アンケートの分布)の中で「少数」のセルがちょうど 1 個だけあり、合計が別に表示される場合、合計から引き算して逆算できる。これを防ぐため、少数セルが 1 個のとき、少数でない最小の(0 でない)セルも「少数」にする(補完秘匿)。同じ値のセルが複数あるときは配列の先頭側を選ぶ。該当するセルが無い(他がすべて 0)ときは追加しない。`suppressBreakdown(counts, k)` で実装する。
- 内訳は系列(列)ごとに適用する(地方別の表は列ごと、時系列は系列ごと、流入は内訳ごと)。
- 少数セルが 2 個以上のときは追加しない(逆算できるのは 2 個以上の和までで、個別の値は分からない)。 [案]

### 5.6 グループ単位の特定を避ける規則(MUN-RULE-06)

- 公式枠は数が少ない(デモは 1〜2 件)ため、`official=official` の集計は 1 グループの特定につながりやすい。フィルタ後の集計単位が K 未満のセルは「少数」(5.2 と同じ)。
- [デモ範囲外・見送り(契約書 16.2)] 公式枠フィルタの差分(全体 − 一般 = 公式)への対策: `official` が `official`/`general` のとき、スコープ(期間 × 地方)内の `official` グループ数と `general` グループ数の両方が、0 または K 以上でなければ、そのフィルタ指定を受け付けない(`invalid_input`、`reason: "small_cell_filter"`、`fields.official = "この条件では少数のため表示できません"`)。
- 期間フィルタの最小は 1 か月(暦月単位)。日単位・週単位の期間は指定できない(日単位の差分で少数のグループを特定されにくくするため)。 [案]
- 地方フィルタは担当地方のみ(第 9 章)。
- 既知の制約: 期間や条件を変えた複数回の照会の差分による推測への対策は見送る(契約書 10.5・16.2)。内訳の補完秘匿(5.5)は残す。

### 5.7 その他

- 集計値の応答には `Cache-Control: no-store` を付ける(00 の `route()` が付与)。サーバーログに応答本文・クエリを出さない。
- 画面に「個人が特定できないよう、{K} 件未満の値は「少数」と表示しています」と常時表示する(MUN-UI の PrivacyNote)。

## 6. データ(05 章)

### 6.1 保存するデータ

- なし。05 章「集計」(参加、成立、再訪)の定義は本書第 3 章で埋める提案 [案]。Store にコレクションを追加しない(旧案の `entryEvents` は作らない。契約書 3.1)。

### 6.2 型定義(`features/stats/types.ts`)

```ts
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";             // 00 の基本型
import type { GroupStatus, CancelReasonCode } from "@/features/groups/lifecycle/types"; // 04
import type { FunnelAggregate, FunnelEvent } from "@/features/entry/types";     // 11

// ---- 列挙 ----
export type OfficialFilter = "all" | "official" | "general";
export type GroupPhase = "open" | "confirmed" | "cancelled";                    // 3.1 の区分。groupPhase で導出
export type CancelReasonGroup = "deadline_unmet" | "organizer" | "other";       // 第 4 章の集約(契約書 4.3)
export type CoarseAgeBand = "under30" | "30to49" | "50plus";
export type RequestStatus = "pending" | "approved" | "rejected" | "withdrawn" | "expired"; // 03 の JoinRequestStatus と同値
export type Score = 1 | 2 | 3 | 4 | 5;
export type WantAgain = "yes" | "maybe" | "no";

// ---- 中間表現(アダプタ/合成履歴が作る。ID は集計の内部だけで使い、応答へ出さない)----
export interface RequestFact {
  at: IsoDateTime;               // 申請日時(JoinRequest.createdAt)
  status: RequestStatus;
  decidedAt: IsoDateTime | null; // 判断日時(承認/却下/取り下げ/失効)
}
export interface StampFact { spotId: number; at: IsoDateTime }
export interface SurveyFact {     // 個々の回答。userId と planClarity は持たない
  satisfaction: Score;
  wantAgain: WantAgain;
  localInteraction: Score;
  localExploration: Score;
}
export interface GroupFact {
  groupId: string;                     // 活動中は Group.id(g-NNN)、合成履歴は hist-NNNN。内部のみ
  campaign: string;
  region: Id;                          // Region.id(r-<slug>)
  official: boolean;
  status: GroupStatus;                 // 04 の 8 値
  createdAt: IsoDateTime;
  confirmedAt: IsoDateTime | null;     // lifecycle.confirmedAt
  completedAt: IsoDateTime | null;     // lifecycle.completedAt
  cancelledAt: IsoDateTime | null;     // lifecycle.cancelledAt
  cancelReason: CancelReasonCode | null;
  replanOfGroupId: string | null;      // lifecycle.replanOfGroupId(再企画で作ったグループの元)
  memberCount: number;                 // 参加中(active)メンバー数。= participantKeys.length
  participantKeys: string[];           // 不透明な識別子(M-11・M-12 の重複判定専用。出力しない)
  ageBands: (CoarseAgeBand | null)[];  // 各参加者の集計区分(participantKeys と同順。不明は null)
  requests: RequestFact[];
  stamps: StampFact[];
  surveys: SurveyFact[];
  origin: "live" | "demo-history";
}

// ---- 問い合わせ ----
export interface StatsQuery {
  from: DateStr;               // "YYYY-MM-DD"(月初のみ可)。JST
  to: DateStr;                 // "YYYY-MM-DD"(月末のみ可)。JST
  region: Id | null;           // null = 担当地方すべて
  official: OfficialFilter;
}

// ---- 個人非特定のセル ----
export type CountCell = { few: false; value: number } | { few: true };
export type RateCell =
  | { kind: "value"; percent: number }   // 整数 %
  | { kind: "below"; percent: number }   // 「percent% 未満」
  | { kind: "few" }                      // 分母が K 未満
  | { kind: "none" };                    // 分母が 0(対象なし)
export interface LabeledCell { key: string; label: string; cell: CountCell }

// ---- 応答 ----
export interface StatsMeta {
  municipalityName: string;                   // Municipality.displayName
  campaign: string;                           // Municipality.campaign
  regions: { id: Id; name: string }[];        // 自分が閲覧できる地方(Municipality.regionIds の順)
  query: StatsQuery;                          // 正規化後(既定値を適用)
  minCellCount: number;                       // K
  includesDemoHistory: boolean;
  generatedAt: IsoDateTime;                   // clock.nowIso()
}
export interface StatsSummary {
  groupsCreated: CountCell;      // M-01
  joinRequests: CountCell;       // M-02
  approvalRate: RateCell;        // M-03
  confirmedGroups: CountCell;    // M-04
  confirmRate: RateCell;         // M-04
  cancelRate: RateCell;          // M-05
  replanRate: RateCell;          // M-06
  stampsAcquired: CountCell;     // M-09
  repeatRate: RateCell;          // M-11
}
export interface TimePoint {
  month: string;                 // "YYYY-MM"
  groupsCreated: CountCell;
  joinRequests: CountCell;
  confirmedGroups: CountCell;
  stampsAcquired: CountCell;
}
export interface RegionRow {
  regionId: Id; regionName: string;
  groupsCreated: CountCell; joinRequests: CountCell; confirmedGroups: CountCell;
  cancelRate: RateCell;
}
export interface FunnelStep { key: "cancelled" | "replanned" | "replanConfirmed"; label: string; cell: CountCell }
export interface SpotRow { spotId: number; spotName: string; groups: CountCell }
export interface InflowStats {                // M-08(第 3.4 節)
  byEntry: LabeledCell[];                     // key: "A" | "B"
  bySource: LabeledCell[];                    // key: ENTRY_SOURCES の 7 値、"none"、"unknown"
  byType: LabeledCell[];                      // key: FunnelEventType の 5 値
}
export interface SurveyItemStat {             // M-13〜M-16
  key: "satisfaction" | "wantAgain" | "localInteraction" | "localExploration";
  label: string;
  positiveRate: RateCell;                     // 4 以上(wantAgain は yes)の割合
  distribution: LabeledCell[];                // key: "1"〜"5"、wantAgain は "yes" | "maybe" | "no"
}
export interface SurveyStats {
  responses: CountCell;                       // M-17 回答数
  responseRate: RateCell;                     // M-17 回答率
  items: SurveyItemStat[];                    // 上の key の順で 4 件
}
export interface StatsResponse {
  meta: StatsMeta;
  summary: StatsSummary;                  // M-01〜06, 09, 11
  timeSeries: TimePoint[];                // 期間の各月(1〜12 件)
  regionTable: RegionRow[];               // M-10(1 地方指定時は 1 行)。並び順は第 3.2 節の補足
  funnel: FunnelStep[];                   // M-06(3 段。cancelled → replanned → replanConfirmed)
  cancelReasons: LabeledCell[];           // M-05 内訳(key: CancelReasonGroup の 3 値)
  memberCountDistribution: LabeledCell[]; // M-07(key: "2"〜"6")
  inflow: InflowStats;                    // M-08
  topSpots: SpotRow[];                    // M-09(最大 5 行。並び順は下記)
  ageBands: LabeledCell[];                // M-12(key: CoarseAgeBand の 3 値)
  survey: SurveyStats;                    // M-13〜M-17
}

// ---- 範囲 ----
export interface MunicipalScope {
  municipality: { id: string; campaign: string; displayName: string };
  regions: { id: Id; name: string }[];   // Municipality.regionIds の順。名前は db().regions から
}
export type { FunnelAggregate };
// 合成履歴の流入イベント。11 の FunnelEvent から Store 用の id(fe-NNN)などを除いた形。Store には入れない
export type HistoryFunnelEvent = Pick<FunnelEvent, "type" | "day" | "campaign" | "channel" | "source">;
```

- `topSpots` の選び方: 取得グループ数が 0 のスポットは出さない。少数でない行を件数の降順(同数は `spotId` 昇順)に並べ、5 行に満たなければ「少数」の行を `spotId` 昇順で補う。
- 内訳の配列(`cancelReasons`、`memberCountDistribution`、`inflow` の 3 つ、`ageBands`、`survey.items[].distribution`)は値が 0 のキーも省略せず、上記の key の順で返す。
- `GroupFact.groupId` の `hist-` と `participantKeys` の `h-` は合成履歴の内部の識別子で、00 の `newId` の接頭辞(契約書 3.2)には含めない。Store に保存せず、応答にも出さない。

### 6.3 自治体と担当地方

- 自治体は 11 が所有する `Municipality`(契約書 7.11)を `db().municipalities` から読む。旧案の `features/stats/municipalities.ts`(12 独自のマスタ)は廃止した(契約書 7.12)。

```ts
// 11 の型(契約書 7.11)。12 は import type で読む
export interface Municipality { id: string; campaign: string; displayName: string; regionIds: Id[] }
```

- 担当者は `DemoUser.role = "municipal"` と `DemoUser.municipalityId`(契約書 3.6)から引く。seed は契約書 11.4 のとおり、自治体担当者 2 人(`u-009` が `mun-demo-a`、`u-011` が `mun-demo-b`)。
- 担当地方 [統一、契約書 7.12・11.4]: `mun-demo-a` = `r-nijiho`、`r-hoshinagi`、`r-suzukaze`(この順)。`mun-demo-b` = `r-mizukoto`。`mun-demo-b` は IDOR 試験用(`mun-demo-a` の担当者が `r-mizukoto` を指定すると拒否される)。12 は地方 ID をコードに固定せず、`db().municipalities` の `regionIds` から読む。
- 「自治体担当者の名前(タナカ)」は ideas のペルソナ名で、実在個人ではない。

## 7. インターフェース(関数 MUN-FN / API MUN-API)

### 7.1 関数(`features/stats/`。サーバー側の関数はすべて同期)

| ID | シグネチャ | 責務 | 例外 |
|---|---|---|---|
| MUN-FN-01 | `resolveScope(user: DemoUser): MunicipalScope` | `user.role === "municipal"` かを 12 が判定し(00 の `requireRole` は `reason` を付けないため使わない。契約書 7.12)、`db().municipalities.get(user.municipalityId)` の担当自治体と、`regionIds` の地方(名前は `db().regions`)を返す | `forbidden`(403、`reason: "not_municipal"`。ロール違い、`municipalityId` が無い・Store に無い) |
| MUN-FN-02 | `parseStatsQuery(sp: URLSearchParams, scope: MunicipalScope, now: Date): StatsQuery` | クエリ文字列の検証と既定値の適用(第 7.2・7.3 節) | `invalid_input`(400。`fields` 付き)、地方が担当外なら `forbidden`(`reason: "region_out_of_scope"`) |
| MUN-FN-03 | `collectFacts(scope: MunicipalScope, query: StatsQuery, now: Date, opts?: { includeHistory?: boolean }): { groups: GroupFact[]; funnel: FunnelAggregate }` | 活動中データのアダプタ + 合成履歴。`campaign` が担当自治体のもので、かつ担当地方の `GroupFact` だけを返す(フィルタは集計前)。流入は `aggregateFunnel({ campaign, fromDay: query.from, toDay: query.to })` に合成履歴を `addFunnelEvents` で加算する。合成履歴のうち `now` より後の日時のものは除く。`includeHistory` の既定は true | なし(`aggregateFunnel` の `invalid_input` は `parseStatsQuery` の検証により発生しない) |
| MUN-FN-04 | `computeStats(input: { groups: GroupFact[]; funnel: FunnelAggregate; query: StatsQuery; meta: Omit<StatsMeta,"query">; k?: number }): StatsResponse` | 全指標の計算(純粋関数。時計・ストアに触れない)。`query` の期間・地方・公式枠で `groups` を絞り込み、`meta.query` に `query` を入れて返す。`k` の既定は `MIN_CELL_COUNT`。地方・公式枠のフィルタは流入(M-08)には適用しない(第 3.4 節) | [デモ範囲外・見送り] `invalid_input`(5.6 の公式枠ガード) |
| MUN-FN-05 | `getStats(user: DemoUser, query: StatsQuery, opts?: { includeHistory?: boolean }): StatsResponse` | `resolveScope` → `collectFacts` → `computeStats`。`meta.generatedAt` に `clock.nowIso()` を入れる | 上記のもの |
| MUN-FN-06 | `toCountCell(n: number, k: number): CountCell` | n が 1〜k-1 なら `{few:true}`、それ以外は `{few:false,value:n}` | なし |
| MUN-FN-07 | `toRateCell(num: number, den: number, k: number): RateCell` | 第 5.3 節の規則。den=0 → none。den<k → few。num が 1〜k-1 → `below(ceil(k/den*100))`。num=0 → `value(0)`。他は `value(round(num/den*100))` | なし |
| MUN-FN-08 | `suppressBreakdown(counts: number[], k: number): boolean[]` | 内訳の秘匿フラグ(true=少数)。5.5 の補完秘匿を含む | なし |
| MUN-FN-09 | `coarseAgeBand(ageBand: AgeBand \| undefined): CoarseAgeBand \| null` | 09 の `AgeBand` を集計の 3 区分へ(第 5.4 節の表)。`undefined`(Profile が無い)は null | なし |
| MUN-FN-10 | `buildDemoHistory(municipalities: readonly Municipality[]): { groups: GroupFact[]; funnelEvents: HistoryFunnelEvent[] }` | 決定論的な合成履歴(第 13 章)。モジュール内でキャッシュ(自治体の `regionIds` が同じなら 1 回だけ生成) | なし |
| MUN-FN-11 | `monthsBetween(from: string, to: string): string[]` | `"YYYY-MM"` の連続リスト(JST)。`from` の月から `to` の月まで(両端を含む) | なし |
| MUN-FN-12 | `groupPhase(status: GroupStatus): GroupPhase` | 第 3.1 節の表で 8 値を 3 区分へ | なし |
| MUN-FN-13 | `cancelReasonGroup(code: CancelReasonCode): CancelReasonGroup` | 第 4 章の表で 5 値を 3 区分へ | なし |
| MUN-FN-14 | `addFunnelEvents(base: FunnelAggregate, events: readonly HistoryFunnelEvent[]): FunnelAggregate` | 合成履歴の流入イベントのうち `campaign` が `base.campaign` で、`day` が `base.fromDay`〜`base.toDay` のものを `base` の各件数に加算した新しい値を返す(純粋関数。`base` は変更しない)。加算の規則は 11 の `aggregateFunnel` の集計規則(11 §4.4)と同じ | なし |

例外の生成は 00 の `AppError`(`new AppError("forbidden", message, { reason })`、`new AppError("invalid_input", message, { fields })`)を使う。`message` は利用者向けの日本語で常に付ける(契約書 3.3)。

### 7.2 API

| ID | メソッド・パス | 認可 | 説明 |
|---|---|---|---|
| MUN-API-01 | `GET /api/stats` | 自治体ロールのみ(`currentUser(req)` から判定。クエリ・ヘッダの自己申告は信用しない) | 指標の取得。ハンドラは `features/stats/handlers.ts` の `getStatsHandler`(00 の `route()` で包む)。`app/src/app/api/stats/route.ts` は `GET` だけを再エクスポートする |

処理の順序: `route()`(`currentUser` 解決、`beforeRequest` フックで 04 の `evaluateAll` が先に実行される。契約書 3.5)→ `resolveScope(c.user)`(ロールが違えば入力検証より先に 403)→ `c.query(STATS_QUERY_SCHEMA)`(00。strict。schema は `from`・`to`・`region`・`official` の 4 キーを任意の文字列として宣言し、それ以外のキーは `invalid_input`、`fields.<key>`)→ `parseStatsQuery(c.url.searchParams, scope, clock.now())`(値の検証と既定値) → `getStats(c.user, query)` → `ok(response)`。12 は `evaluateAll` を自分で呼ばない。

リクエスト(クエリ。すべて任意):

| パラメータ | 型・範囲 | 既定 | 検証(失敗時の `fields` のキー) |
|---|---|---|---|
| `from` | `YYYY-MM-DD`(月の 1 日のみ) | `to` の 2 か月前の月初(直近 3 か月、当月を含む)[決定 12] | 00 の `v.date()` で実在日付、かつ日が `01`(`from`) |
| `to` | `YYYY-MM-DD`(月末日のみ) | `clock.now()` の属する月の月末 | 実在日付かつ月末日、`from <= to`、範囲は 12 か月以内(`to`) |
| `region` | 地方 ID(`r-<slug>`) | なし(担当地方すべて) | 形式は 00 の `isSlugId("r", v)`。形式不正は `invalid_input`(`region`。契約書 3.2 のクエリの ID の扱い)。形式が正しく担当地方(`scope.regions`)に無いものは `forbidden`(`reason: "region_out_of_scope"`。存在しない地方も同じ) |
| `official` | `all` \| `official` \| `general` | `all` | 列挙(`official`)。[デモ範囲外・見送り] 5.6 のガード |

- クエリは strict [統一、契約書 3.4・7.12]: 未知のパラメータは `invalid_input`(`fields.<key>`。00 の `c.query`)。09 の `rejectProhibitedParams` は呼ばない(契約書 3.4。性別・年齢のキーも未知キーとして 400 になる)。同じパラメータが複数あるときは最初の値を使う。
- レスポンス 200: `StatsResponse`(6.2)。`Cache-Control: no-store`。データが無い期間でも 200(件数のセルは 0、率のセルは `none`。画面は空状態を表示)。
- エラー: 第 12 章の表に従う。エラーの本文は契約書 3.3 の `ErrorBody`(`error`、`reason`、`message`、`fields`)。
- 集計のタイミング: リクエストごとに都度計算。ダミー規模(合成履歴で約 190 グループ + 活動中 12 件、流入イベント数百件)ではキャッシュ不要 [案]。「日付を進める」(00 の `/api/demo/clock`)や状態変更が次の取得で反映される。

### 7.3 クエリの正規化規則

- `to` 未指定: `clock.now()` の JST 月末。`from` 未指定: `to` の月から 2 か月前の月初(直近 3 か月、暦月単位)[決定 12]。例: clock が 2026-11-09 なら `from=2026-09-01`、`to=2026-11-30`。
- 期間境界: `from` 00:00:00+09:00 以上、`to` の翌日 00:00:00+09:00 未満。流入(`FunnelEvent.day`)は `from` 以上 `to` 以下の日付。
- 時系列の月数 = `monthsBetween(from, to).length`(1〜12)。12 か月は最大 366 日のため、11 の `FunnelQuery` の幅の上限(366 日)に収まる。
- 検証メッセージ(`messages.ts`): `from`「月の初日(YYYY-MM-01)を指定してください」、`to`「月の末日を指定してください」/「開始月より後の月を指定してください」/「期間は 12 か月以内で指定してください」、`region`「地方の指定が正しくありません」、`official`「選択肢から選んでください」。

## 8. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| 集計画面(自治体) | 集計画面(自治体) | `/[campaign]/admin/stats`(契約書 2.2 の画面のパス) |

- URL の `[campaign]` は共通レイアウト用で、集計対象は `Municipality.campaign` で決まる(URL の値で対象を切り替えない)。

### 8.1 コンポーネント構成(MUN-UI)

```
app/src/app/[campaign]/admin/stats/page.tsx        MUN-UI-01  ページ(StatsDashboard を置くだけ。"use client" は StatsDashboard 側)
features/stats/ui/StatsDashboard.tsx               MUN-UI-02  状態管理と全体レイアウト
features/stats/ui/use-stats.ts                     MUN-UI-03  取得フック
features/stats/ui/FilterBar.tsx                    MUN-UI-04  期間・地方・公式枠
features/stats/ui/MetricCard.tsx                   MUN-UI-05  指標カード
features/stats/ui/TimeSeriesChart.tsx              MUN-UI-06  月別の棒/折れ線(SVG)
features/stats/ui/RegionTable.tsx                  MUN-UI-07  地方別の表
features/stats/ui/FunnelChart.tsx                  MUN-UI-08  中止→再企画→再成立
features/stats/ui/BarList.tsx                      MUN-UI-09  分布(成立人数・流入・年代帯・スポット・アンケート)
features/stats/ui/CellText.tsx                     MUN-UI-10  CountCell/RateCell の表示(「少数」)
features/stats/ui/ChartTableToggle.tsx             MUN-UI-11  グラフ/表の切替と表の代替
features/stats/ui/PrivacyNote.tsx                  MUN-UI-12  下限の説明・合成データ・モックの表示
features/stats/ui/ForbiddenNotice.tsx              MUN-UI-13  権限なしの案内
features/stats/ui/SurveyPanel.tsx                  MUN-UI-14  アンケート(M-13〜M-17)。割合のカードと分布(BarList)
```

props / state / データ取得:

```ts
// MUN-UI-03(00 の useGroupsApi<StatsResponse>("/api/stats?…") を包む。query=null のときはクエリなしで取得し、サーバーの既定値を使う)
export function useStats(query: StatsQuery | null): {
  data: StatsResponse | null;
  error: ApiError | null;        // 00 の ApiError(code、reason、fields。code: "forbidden" | "invalid_input" | "internal" | "network" ほか)
  loading: boolean;
  reload: () => Promise<void>;
};
// MUN-UI-02: state = { query: StatsQuery | null }。初回は query=null で取得し、
//   応答の meta.query を FilterBar の初期値に使う。フィルタ変更で setQuery → useStats が再取得。
// MUN-UI-04
interface FilterBarProps { regions: { id: Id; name: string }[]; value: StatsQuery;
  onChange(next: StatsQuery): void; disabled?: boolean; errors?: Record<string, string> }
// MUN-UI-05
interface MetricCardProps { title: string; cell: CountCell | RateCell; unit?: string; hint: string; minCount: number; loading?: boolean }
// MUN-UI-06
interface TimeSeriesChartProps { points: TimePoint[]; series: { key: keyof Omit<TimePoint,"month">; label: string }[] }
// MUN-UI-07
interface RegionTableProps { rows: RegionRow[]; minCount: number }
// MUN-UI-08 / 09
interface FunnelChartProps { steps: FunnelStep[]; minCount: number }
interface BarListProps { title: string; items: LabeledCell[]; unit: string; minCount: number; note?: string }
// MUN-UI-10
interface CellTextProps { cell: CountCell | RateCell; unit?: string; minCount: number }
// MUN-UI-14
interface SurveyPanelProps { survey: SurveyStats; minCount: number }
```

`CellText` の表示規則:

| セル | 表示 | `aria-label` |
|---|---|---|
| `{few:false,value:n}` | `n` + 単位(例「12 件」) | 同じ |
| `{few:true}` / `{kind:"few"}` | 「少数」 | 「少数({K} 件未満のため非表示)」 |
| `{kind:"value",percent:p}` | `p%` | 同じ |
| `{kind:"below",percent:p}` | `p% 未満` | 同じ |
| `{kind:"none"}` | 「—」 | 「対象なし」 |

- 取得は `useGroupsApi`(`cache: "no-store"`)。クエリは `URLSearchParams` で組み立てる。エラー時の表示は第 12 章の表に従う。
- 画面構成(上から): ①モック/合成データ/下限の注意(PrivacyNote)②FilterBar(期間: 直近 3・6・12 か月のプリセット(既定は 3 か月)+ `MonthPickerInput`(@mantine/dates、`type="range"`。選んだ開始月の 1 日を `from`、終了月の末日を `to` にする)、地方(`Select`。先頭に「担当地方すべて」)、公式枠(`SegmentedControl`: すべて/公式枠/一般))③指標カード 6 枚(作成数、申請数、承認率、実行確定率、中止率、スタンプ取得数。M-11 の再訪率は 7 枚目として余力で追加)④月別推移(TimeSeriesChart)⑤地方別の表(RegionTable、M-10)⑥流入(M-08。BarList で入口別・流入元別・イベント種別。見出しの下に「キャンペーン全体の件数(地方・公式枠の絞り込みは適用しない)」と表示)⑦中止・再企画のファネル(FunnelChart + 中止理由の内訳)⑧分布(成立人数、年代帯、人気スポット)⑨アンケート(SurveyPanel。満足度・再訪意向・地元との交流・滞在中の回遊の割合と分布、回答数・回答率。「完了したグループの回答のみ」と表示)。
- スマホ幅: カードは 2 列 → 1 列、表は横スクロール枠(`overflow-x:auto`)を使わず列を絞る(地方 / 作成 / 申請 / 確定 / 中止率)。グラフは幅 100%。
- デモ最小実装(優先度 B): ③のカード、⑤の表、⑥の流入元別(`inflow.bySource`)の BarList。⑥は 11 の流入集計を本モジュールに統合したため最小に含める。④、⑥の残り、⑦〜⑨は余力。

### 8.2 グラフ表示の方針(MUN-UI の選択)

- 決定案: 外部グラフライブラリを使わず、自前の SVG/CSS で描く(契約書 11.1 でもグラフライブラリは採らない)。理由: ①依存を増やさない(rule.md 8 のライセンス確認の対象を増やさない)、②棒・折れ線・ファネルの 3 種のみで足りる、③「少数」の表現を細かく制御できる。
- 検討した候補: `@mantine/charts`(MIT。内部で recharts を使う。推移的依存の d3 系は ISC/BSD。依存が増え、`package-lock` 全体のライセンス確認が必要)、Chart.js(MIT。canvas のためアクセシビリティの扱いが弱い)。いずれも採用しない [案]。グラフの種類が増えたら再検討し、その際は `package.json`/`package-lock.json` の全推移的依存のライセンス(MIT/ISC/BSD/Apache 以外が混じらないか、強いコピーレフトが無いか)を 08 章の一覧に追加して確認する。
- 描画規則: 棒の値は常にラベルで併記。折れ線は系列ごとに点のマーカー形状を変えて(○/□)区別する。色は Mantine のテーマ色を使い、色だけに頼らない(パターン/形状/直接ラベル)。「少数」のセルは棒を描かず、斜線のハッチ+「少数」の文字を表示。

### 8.3 アクセシビリティ(MUN-UI)

- すべてのグラフに「表で見る」切替(ChartTableToggle)を置き、同じ値を `<table>`(`<caption>`、`<th scope>`)で提示する。スクリーンリーダー向けにはグラフは `role="img"` + `aria-label`(要約: 最大値と傾向)を付け、表を既定で読めるようにする(グラフは `aria-hidden` にせず説明を付ける)。
- 色のコントラスト比は WCAG AA(本文 4.5:1、グラフ要素 3:1)を目安にする。アニメーションは付けない(`prefers-reduced-motion` の分岐は不要)。
- 「少数」は文字で表示し、aria-label は第 8.1 節の表のとおり。キーボード操作でフィルタ・切替すべて可能。
- 状態は色ではなくラベルと形状で示す(例: 率のバッジに「▲」等の記号は使わず、数値と「未満」の文字で表す)。

## 9. 自治体ユーザーのダミーと権限

- 認可の根拠はサーバー側で解決した現在ユーザーのみ(`currentUser(req)`。Cookie `demoUser`)。クエリ・ヘッダ・ボディで自治体 ID を渡す口を作らない(IDOR 対策)。 [案]
- 権限チェックの順序: ①`user.role === "municipal"`(12 が判定し、違えば `forbidden` + `reason: "not_municipal"`。契約書 7.12) ②`user.municipalityId` の `Municipality` が `db().municipalities` に存在 ③`region` 指定があれば担当地方に含まれる ④`collectFacts` が担当地方でフィルタしてから集計する(集計後に地方を隠す方式にしない)。
- 担当外の地方・他自治体のグループのデータは、存在を示唆する応答(件数・「少数」を含む)を返さない。担当外 `region` は `forbidden`。例外は流入(M-08)で、11 の計測が地方を持たないため担当自治体のキャンペーン全体の件数を返す(第 3.4 節。契約書 7.12 で確定)。
- 一般の利用者ユーザー(旅行者)と地元の担い手(`host`)はこの API・画面にアクセスできない: API は `forbidden`、画面は `ForbiddenNotice`。AppShell のメニューにも出さない(MUN-REQ-00a)。メニューの非表示はアクセス制御ではなく、アクセス制御は API の認可で行う。
- 自治体ロールの利用者も、他モジュールの利用者向け API(参加申請など)には通常ユーザーとしては触れない。デモでは別ユーザーに切り替えて操作する。
- デモユーザー: 00 の seed の自治体担当者 2 人(`u-009` → `mun-demo-a`、`u-011` → `mun-demo-b`。契約書 11.4)。

## 10. 状態遷移

- なし(状態を持たない)。画面の取得状態(loading / loaded / error)のみ。グループの状態(04 の 8 値)は読むだけで、区分の導出は第 3.1 節。

## 11. 入力検証・セキュリティ

OWASP Top 10 の代表項目のうち、本モジュールに関係するもの。

| 項目 | 対処 |
|---|---|
| アクセス制御・IDOR | 第 9 章。自治体 ID・地方の権限は Cookie から解決した現在ユーザーだけで判定する。担当外の地方は 403 で、件数・「少数」を返さない。担当地方で絞ってから集計する |
| 入力検証・インジェクション | クエリは 7.2 の表で検証(日付は 00 の `v.date()`、地方は `isSlugId` と担当地方との完全一致、`official` は列挙)。未知のパラメータは `invalid_input`(strict。契約書 3.4)。SQL・ファイルパス・`eval` に入力を渡さない(ストアはメモリ上の配列) |
| XSS | 表示は React のエスケープに任せる。`dangerouslySetInnerHTML` 禁止。スポット名・地方名・流入元の表示名は seed/マスタ/`messages.ts` 由来で、利用者の入力を表示しない |
| CSRF | 本モジュールの API は GET のみで状態を変えない。CORS ヘッダを付けないため、別オリジンのページは応答を読めない。Cookie は 00 の `SameSite=Lax` |
| 認証・セッション(デモ) | ログイン不要のデモのため Cookie `demoUser` は利用者が書き換えられる(00 第 7 章)。画面に「モック」と表示し、実運用では自治体担当者の認証が必要と第 18 章に記す |
| セキュリティ設定 | 00 の `route()` が `Cache-Control: no-store`、`X-Content-Type-Options: nosniff` を付ける。画面を含む全応答に `next.config.ts` の `X-Frame-Options`・`X-Content-Type-Options`・`Referrer-Policy` が付く(契約書 11.2。CSP は設けない)。GET 以外のメソッドは 405 |
| 機密データ | 応答は集計値のみ(第 5 章)。ID・表示名・グループ名・自由記述・個々のアンケート回答を含めない。件数の下限 K と補完秘匿を `computeStats` の出口で適用し、UI 側では再計算しない(サーバーから受け取った `CountCell`/`RateCell` をそのまま表示) |
| ログ | 応答本文・クエリ・利用者 ID をログに出さない。想定外の例外は 00 の `route()` が `requestId` と例外のみを `console.error` に出す |

- 既知の制約(デモでは対処しない): 複数回の照会の差分による推測(5.6。見送り、契約書 16.2)、応答時間の差による推測、大量リクエストによる負荷(期間は最大 12 か月、データはダミー規模)。
- 禁止表現(09)は入力を受けないため適用なし。画面文言に恋愛を連想させる語、「相乗り」「マッチング」を使わない(`messages.ts` に集約し、10 章の静的検査の対象にする)。

## 12. エラー処理

| コード | HTTP | 発生条件 | 画面での表示・挙動 |
|---|---|---|---|
| `forbidden` | 403 | `reason: "not_municipal"`: 自治体ロールでない(Cookie なし・不正値で既定の旅行者ユーザーになった場合、地元の担い手を含む)、`municipalityId` が Store に無い。`reason: "region_out_of_scope"`: 担当外または存在しない `region` | `ForbiddenNotice`: 「自治体担当者のみ閲覧できます」と、デモユーザー切替で自治体担当者を選ぶ案内。`region_out_of_scope` は「この地方の集計は表示できません」。集計値は表示しない。担当外の地方の存在は示さない一般文言 |
| `invalid_input` | 400 | 日付の形式・範囲(月初・月末でない、`from > to`、12 か月超)、`region` の形式不正、`official` の値の不正、未知のクエリパラメータ(`fields.<key>`)。[デモ範囲外・見送り] 公式枠ガード(5.6、`reason: "small_cell_filter"`) | FilterBar の該当項目の下に `fields` のメッセージを表示(例: 「期間は 12 か月以内で指定してください」)。直前の集計結果は表示したままにする |
| `method_not_allowed` | 405 | GET 以外のメソッド(Next.js が応答) | 画面からは発生しない |
| `internal` | 500 | 想定外の例外 | 00 の `ErrorNotice`(「問題が発生しました」、再読み込みの案内)。本文に内部情報を出さない |
| `network` | -(クライアント) | 取得の失敗、JSON でない応答 | 00 の `ErrorNotice` と「もう一度試す」(`reload`) |
| (空状態) | 200 | 期間内のデータが無い | 「この期間の実績はありません」。件数のセルは 0、率のセルは「—」 |

- 対象なし(`not_found`)・状態不正(`unavailable_state`)・競合(`conflict`)・頻度超過(`rate_limited`)は発生しない: パスに ID を取らず、状態を変更せず、頻度制限の対象にしないため。他の利用者の操作による変更は次の取得で反映する。

## 13. デモ用のダミーデータ(MUN-DEMO)

集計は 6〜12 人・12 グループ程度の group-seed だけでは K=5 の規則により大半が「少数」になり、画面の確認に必要な件数が足りない。そこで過去実績(合成)を 12 が生成して足す。 [案]

- 生成: `features/stats/demo-history.ts` の `buildDemoHistory(municipalities)`。擬似乱数(mulberry32、種 = `20261109`)による決定論的生成。ファイルは持たない(seed.json・group-seed.json に書かない。Store にも入れない)。
- 対象期間: 固定 `2026-04-01` 〜 `2026-10-31`(7 か月)[案]。活動中データ(group-seed と操作)は 00 の clock の現在日付(00 の `meta.demoNow` = 2026-11-09 [事実、00 第 4.4 節])の前後にあり、同じ集計の対象に含まれる。clock の初期値が 2026-11 以降であることが前提(MUN-REQ-00b)。既定の期間(直近 3 か月 = 2026-09〜2026-11)には履歴の 2 か月分が入る。
- 地方: `db().municipalities` の各自治体の `regionIds` を使う(地方 ID を 12 に固定で書かない)。規模は担当地方の並び順で決める。`mun-demo-a` の 1 番目の地方は月 8 グループ、2 番目は月 6、3 番目は月 3〜5(月によって K 未満になり「少数」表示を確認できる)。`mun-demo-b` の地方(IDOR 試験用)は月 5。`mun-demo-a` の 3 地方で約 150 グループ(再企画で作ったグループを含む)、`mun-demo-b` を含めて約 190。公式枠は全体の約 20%(1・2 番目の地方に集中)。
- グループ 1 件あたり:
  - 申請 2〜8 件(承認 60%/却下 10%/取り下げ 15%/失効 5%/申請中 10% 程度)。
  - 状態: 実行確定の区分 60%/中止の区分 30%/未確定 10%。実行確定の区分は、旅行終了日が clock の現在日付より前なら `completed`、それ以外は `confirmed`。
  - 中止の理由: `min_not_reached` 70%、`below_min_in_withdrawal` 10%、`organizer_cancelled` 15%、`below_floor` 5%(確定後の中止。`confirmedAt` も持つ)。
  - 中止のうち 50% を再企画(元グループの状態を `replanned` にし、元と同じ地方に中止の 1〜7 日後に `replanOfGroupId` で元を指すグループを作る。2026-10-31 を超える場合は作らず、元は `cancelled` のまま。再企画で作ったグループの 60% が実行確定)。
  - 確定グループの人数 2〜6(3〜4 人が多い)、スタンプ 0〜4 件(`spotId` は seed の spots から)、参加者の年代帯は 3 区分に分布。
  - `completed` のグループのアンケート: 参加者の約 70% が回答。満足度・地元との交流・滞在中の回遊は 3〜5 が多い分布、再訪意向は `yes` 55%/`maybe` 35%/`no` 10% 程度。
- 参加者: `participantKeys` は不透明な 80 個のキー(`h-000`〜)のプールから割り当て(同じキーが複数グループに出ることで再訪率が出る)。実在ユーザーとは無関係。
- 流入: `funnelEvents` として `HistoryFunnelEvent`(11 の `FunnelEvent` の `type`・`day`・`campaign`・`channel`・`source`。ID は持たない)で、自治体の `campaign` ごとに日単位で作る。月あたり `list_viewed`(`channel: "A"`、`source: "none"`)数十件、`entry_landed`(`channel: "B"`、`source` は `muni-site` 多め、`muni-pr`・`sns`・`search` 中程度、`travel-media`・`transport`・`other`・`none` は少数、`unknown` は 0〜2 件)、`entry_params_ignored` 数件、`official_viewed`・`official_requested` 数件。値は 11 の列挙値だけを使う [決定 20]。Store の `funnelEvents` には入れず、`addFunnelEvents` で集計値に加算する。
- `GroupFact.origin = "demo-history"`。画面に「デモ用の過去実績(合成データ)を含む」と表示する。`includeHistory: false` で無効化できる(試験用)。
- 00 の group-seed との契約: group-seed の Group/JoinRequest/GroupStamp/SurveyAnswer は活動中として 12 のアダプタが読む。履歴との ID 衝突を避けるため、合成履歴の ID は `hist-` 接頭辞(00 の ID 形式 `g-NNN` とは重ならない)。

## 14. 実装タスク(MUN-TASK)

規模は S(半日以内)/M(1 日程度)/L(2 日以上)。前提タスクに他モジュール(00 等)の完了が含まれる場合は括弧で示す。

| ID | タスク | 規模 | 前提 |
|---|---|---|---|
| MUN-TASK-01 | `types.ts`、`config.ts`(K=5、最大 12 か月、既定 3 か月)、`messages.ts`(指標名、流入元・イベント種別・中止理由の区分・アンケート項目の表示名、検証メッセージ) | S | (04: `GroupStatus`・`CancelReasonCode`、11: `FunnelAggregate` の型) |
| MUN-TASK-02 | `privacy.ts`: `toCountCell`、`toRateCell`、`suppressBreakdown`、`coarseAgeBand` と単体試験(MUN-T-01〜04、06) | M | 01、(09: `AgeBand`) |
| MUN-TASK-03 | `access.ts`: `resolveScope`(ロールの判定と `not_municipal`。MUN-T-08〜13 のうち関数で確認できるもの) | S | 01、(00: `DemoUser.role`・`municipalityId`。11: `municipalities` の seed) |
| MUN-TASK-04 | `query.ts`: `parseStatsQuery`、`monthsBetween`(MUN-T-16・17。MUN-T-14・15 は見送り) | M | 01、(00: clock、`v.date`、`isSlugId`) |
| MUN-TASK-05 | `metrics.ts`: `groupPhase`、`cancelReasonGroup`、`computeStats`(M-01〜M-17。M-13〜M-17 は余力。[デモ範囲外・見送り] 公式枠ガード)と単体試験(MUN-T-07、18〜34。MUN-T-33・34 は余力、35〜37 は見送り) | L | 02 |
| MUN-TASK-06 | `facts.ts`: ストアのアダプタ(Group/GroupMember/JoinRequest/GroupStamp/SurveyAnswer/Profile → GroupFact)、`aggregateFunnel` の呼び出し、`addFunnelEvents`(MUN-T-40) | M | 01、(00、01、03、04、08、09 の Store と seed、11 の `aggregateFunnel`) |
| MUN-TASK-07 | `demo-history.ts`: 決定論的な合成履歴(第 13 章)と試験(MUN-T-38〜39) | M | 01 |
| MUN-TASK-08 | `service.ts`: `getStats`、`collectFacts` の統合 | S | 03、04、05、06、07 |
| MUN-TASK-09 | `handlers.ts`(`getStatsHandler`)と `app/src/app/api/stats/route.ts`: MUN-API-01、クエリの strict 検証(`c.query`)、エラー変換、`no-store`(MUN-T-05、08〜13、41〜47、55) | M | 08、(00: `route()`、`c.query`、`AppError`、`currentUser`、`callRoute`、`insertGroup`) |
| MUN-TASK-10 | UI 基盤: `use-stats.ts`、`CellText`、`MetricCard`、`PrivacyNote`、`ForbiddenNotice` | M | 01、09、(00: `useGroupsApi`、`ErrorNotice`) |
| MUN-TASK-11 | `StatsDashboard`+ページ+`FilterBar`。カード 6 枚、地方別表、流入元別の BarList(デモ最小。MUN-T-48〜50) | M | 10、12 |
| MUN-TASK-12 | `RegionTable`、`ChartTableToggle`、`BarList`(分布・流入) | M | 10 |
| MUN-TASK-13 | `TimeSeriesChart`(SVG。系列、マーカー、少数ハッチ、表の代替)(MUN-T-51) | L | 12 |
| MUN-TASK-14 | `FunnelChart` と中止理由内訳、`SurveyPanel`(アンケート) | M | 12 |
| MUN-TASK-15 | AppShell への導線(自治体ロールのみ)の確認・調整。00 側の作業 | S | 11、(00) |
| MUN-TASK-16 | 通し確認: デモシナリオ最終場面(タナカが集計を見る)、IDOR、アクセシビリティ確認(MUN-T-52〜54) | M | 11(13、14、15 は余力) |

推奨順序と最小デモ線: 01 → 02 → 05 →(06、07 並行)→ 08 → 09 → 10 → 12 → 11 → 16(これで B の最小)。03・04 は 08 の前までに行う。13・14 は余力。15 は 00 側の作業。

## 15. 受け入れ条件・試験項目(MUN-T)

K=5 として記述。共通の準備: 試験用 `GroupFact[]` と `FunnelAggregate` を直接渡して `computeStats` を呼ぶ(ストア不要)。API の試験は 00 の `resetForTest`・`callRoute`・`fixtures.ts`(`GROUP_BY_STATUS` ほか。契約書 11.3)を使い、Vitest(`npm test`)で実行する。試験の中で作るデータは 00 の `insertGroup`・`insertMember` で入れ、ID は 900 番台(`g-901` など)とする(契約書 3.2・3.7)。`computeStats` に直接渡す `GroupFact` の `groupId` も 900 番台にする。10 章の試験観点(個人が特定できない、閾値処理、ロール制限、集計値が Store と一致)に対応。

### 15.1 個人非特定の規則(privacy.ts ほか)

| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-01 | `toCountCell(4,5)` / `(5,5)` / `(0,5)` / `(1,5)` | `{few:true}` / `{few:false,value:5}` / `{few:false,value:0}` / `{few:true}` |
| MUN-T-02 | `toRateCell(3,4,5)`(分母 4)、`toRateCell(0,0,5)`(分母 0) | `{kind:"few"}`、`{kind:"none"}` |
| MUN-T-03 | `toRateCell(3,20,5)`、`(4,10,5)`、`(6,10,5)`、`(0,10,5)` | `{kind:"below",percent:25}`、`{kind:"below",percent:50}`、`{kind:"value",percent:60}`、`{kind:"value",percent:0}` |
| MUN-T-04 | `suppressBreakdown([3,8,12,20],5)`、`([3,2,12,20],5)`、`([0,8,12],5)`、`([8,12,20],5)` | `[true,true,false,false]`、`[true,true,false,false]`(2 個以上は追加なし)、`[false,false,false]`、`[false,false,false]` |
| MUN-T-05 | 応答 JSON を文字列化し ID を検索 | `u-\d+`、`g-\d+`、`m-\d+`、`jr-\d+`、`gs-\d+`、`rs-\d+`、`fe-\d+`、`mun-`、`hist-`、`h-\d+`、表示名、招待コードが含まれない。応答のキー集合が型定義と一致 |
| MUN-T-06 | `coarseAgeBand` に `18-19`、`20s`、`30s`、`40s`、`50s`、`60s`、`70s+`、`undefined` | 順に `under30`、`under30`、`30to49`、`30to49`、`50plus`、`50plus`、`50plus`、`null` |
| MUN-T-07 | `groupPhase` に 8 値、`cancelReasonGroup` に 5 値 | 第 3.1 節・第 4 章の表のとおり(`replanned` → `cancelled`、`organizer_left` → `organizer`、`below_floor` → `other` など) |

### 15.2 権限(access / API)

| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-08 | 旅行者ユーザーで `GET /api/stats` | 403 `forbidden`、`reason: "not_municipal"`。本文に集計値なし |
| MUN-T-09 | Cookie なし(00 の既定ユーザー u-001 = 旅行者として解決される) | 403 `forbidden`、`reason: "not_municipal"` |
| MUN-T-10 | 地元の担い手 `u-012`(`host`)で `GET /api/stats` | 403 `forbidden`、`reason: "not_municipal"` |
| MUN-T-11 | `u-009`(`mun-demo-a`)で `region=r-mizukoto`(`mun-demo-b` の担当地方)、`region=r-zzz`(形式は正しいが存在しない) | どちらも 403 `forbidden`、`reason: "region_out_of_scope"`(件数・「少数」を含まない)。`mun-demo-a` の担当地方なら 200 |
| MUN-T-12 | `u-009` で `region` 省略 | `regionTable` と `meta.regions` に `mun-demo-a` の担当地方のみ。`r-mizukoto` の行・値は集計(合計)にも含まれない(合計 = 担当地方の和) |
| MUN-T-13 | `u-011`(`mun-demo-b`)で `region` 省略 | `meta.municipalityName` が `mun-demo-b` の表示名、`regionTable` は `r-mizukoto` の 1 行のみ |

### 15.3 クエリの検証

| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-14 | [見送り(契約書 16.2)] `from=2026-04-15`(月初でない) | 400 `invalid_input`、`fields.from` |
| MUN-T-15 | [見送り(契約書 16.2)] `from=2026-04-01&to=2027-06-30`(15 か月) | 400 `invalid_input`、`fields.to` |
| MUN-T-16 | パラメータなし、clock=2026-11-09 | `meta.query.from=2026-09-01`、`to=2026-11-30`(直近 3 か月)、`region=null`、`official="all"` |
| MUN-T-17 | `region=<script>`、`region=水琴地方`(ID でない) | 400 `invalid_input`、`fields.region`(403 ではない) |
| MUN-T-55 | `u-009` で `?foo=1`、`?gender=female`(未知のキー) | 400 `invalid_input`、`fields.foo`(`fields.gender`)。集計値を含まない(契約書 3.4 の strict。`rejectProhibitedParams` は呼ばない) |

### 15.4 指標の計算(computeStats)

共通の fixture F1(全て同一地方・期間内、公式枠なし。`groupId` は `g-901`〜`g-912`):
- 元グループ 10 件。実行確定の区分 6(状態 `confirmed` 2、`in_progress` 1、`completed` 3)、中止の区分 4(状態 `replanned` 2、`cancelled` 2。理由は `min_not_reached` 3、`organizer_cancelled` 1)。
- 再企画で作ったグループ 2 件(`replanOfGroupId` で `replanned` の 2 件を指す。1 件は `confirmed`、1 件は `recruiting`)。
- 申請: 承認 20、却下 5、取り下げ 2、失効 1、申請中 2。

| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-18 | M-01 | グループ作成数 = 12(再企画で作ったグループを含む)。`{few:false,value:12}` |
| MUN-T-19 | M-02 | 申請数 = 30(5 状態すべて) |
| MUN-T-20 | M-03 承認率 | 20÷(20+5)=80%。`{kind:"value",percent:80}`(取り下げ・失効・申請中は分母外) |
| MUN-T-21 | M-04 実行確定率 | 確定 7(再企画で作ったグループの確定 1 を含む)÷(7+4)=64%。確定数 7 |
| MUN-T-22 | M-05 中止率 | 4÷11=36% だが分子 4<5 のため `{kind:"below",percent:46}`(ceil(5÷11×100))。理由別: `deadline_unmet` 3→few、`organizer` 1→few、`other` 0→0(少数が 2 個のため補完秘匿の追加なし) |
| MUN-T-23 | M-06 再企画率 | `replanned` 2 ÷ 中止 4 → 分母 4<5 のため `{kind:"few"}` |
| MUN-T-24 | M-06 ファネル | 中止 4(few)、再企画 2(few)、再企画後の確定 1(few) |
| MUN-T-25 | M-07 成立人数分布 | 確定 7 グループの人数が `[2,3,3,3,4,4,6]` → 2→1(few)、3→3(few)、4→2(few)、5→0(0)、6→1(few)。少数が複数なので補完秘匿の追加なし |
| MUN-T-26 | M-08 流入 | `FunnelAggregate`: `landedBySource` が `muni-site` 12、`muni-pr` 7、`sns` 3、他 0。`listViewedByChannel` が A 40、B 0。`ignoredCount` 2、`officialViewed` 9、`officialRequested` 0。→ `bySource` は少数が `sns` の 1 個のため補完秘匿で `muni-pr` も少数: `[12,few,few,0,0,0,0,0,0]`。`byEntry` は A 40、B 22。`byType` は `[22,few,40,9,0]` の後、少数が 1 個のため最小の非少数 `official_viewed`(9)も few → `[22,few,40,few,0]`。`query.region`・`query.official` を変えても値が変わらない |
| MUN-T-27 | M-09 | スタンプ取得 18 件、スポット別グループ数(spot1: 6、spot2: 4、spot3: 3)→ 上位 `[6,few,few]`(少数の行は spotId 昇順)。補完秘匿は少数が 2 個のため追加なし |
| MUN-T-28 | M-11 再訪率 | 確定グループの参加者 = 重複なし 14 人、うち 2 回以上 6 人 → 6÷14=43% `{kind:"value",percent:43}`。分母 3(<5)のとき few |
| MUN-T-29 | M-12 年代帯 | `under30` 6、`30to49` 5、`50plus` 3(few)→ 少数 1 個なので最小の非少数 `30to49`(5)も few → `[6,few,few]`。性別の区分が型にも応答にも存在しない |
| MUN-T-30 | 期間境界 | `confirmedAt=2026-09-30T23:59:59+09:00` は 9 月、`2026-10-01T00:00:00+09:00` は 10 月に入る(JST)。同一グループが 2 つの月に計上されない |
| MUN-T-31 | 確定後の中止 | 状態 `cancelled`、`cancelReason: "below_floor"`、`confirmedAt` と `cancelledAt` の両方が非 null の Group は中止に数え(理由は `other`)、確定数・成立人数分布に含めない。状態 `replanned` で `confirmedAt` を持つものも同じ |
| MUN-T-32 | 状態による区分 | 状態 `withdrawal_period` で `confirmedAt` が null のものは確定・中止のどちらにも数えない(M-01 には数える)。状態 `confirmed` で `confirmedAt` が null のもの(不整合)は確定数から除外 |

アンケートの fixture F2(余力。全て同一地方、公式枠なし。`groupId` は `g-921`〜`g-925`): 状態 `completed`・`completedAt` が期間内のグループ 3 件(参加中メンバー 4 人ずつ、計 12 人)。回答 10 件: `satisfaction` `[5,5,4,4,4,3,3,2,5,4]`、`wantAgain` yes 6・maybe 3・no 1、`localInteraction` 4 以上が 4 件、`localExploration` 4 以上が 5 件。加えて、状態 `in_progress` のグループ 1 件(回答 3 件)と、`completedAt` が期間外の `completed` グループ 1 件(回答 4 件)。

| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-33 | M-13〜M-17 | 回答数 10、回答率 10÷12=83%。満足度 7÷10=70%(`value`)、分布 `1:0, 2:few, 3:few, 4:few, 5:few`(少数が複数のため追加なし)。再訪意向 6÷10=60%、分布 `yes:6, maybe:few, no:few`。地元との交流 4÷10 → 分子 4<5 のため `{kind:"below",percent:50}`。滞在中の回遊 5÷10=50% |
| MUN-T-34 | アンケートの対象 | `in_progress` のグループと期間外の `completed` グループの回答は数えない。未回答のメンバー(2 人)は M-13〜M-16 の分母に入らず、M-17 の分母には入る。`planClarity` が応答に存在しない |

### 15.5 公式枠ガード(MUN-RULE-06)[デモ範囲外・見送り(契約書 16.2)]

| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-35 | `official=official`、スコープ内の公式グループ 2 件・一般 30 件 | 400 `invalid_input`、`reason: "small_cell_filter"`、`fields.official`(公式 2 件は 0 でも K 以上でもない) |
| MUN-T-36 | 同条件で `official=all` | 200(通常の計算。公式 2 件は内訳に出さない) |
| MUN-T-37 | `official=official`、公式 12 件・一般 30 件 | 200。公式 12 件の集計のみ |

### 15.6 デモ履歴・流入の合成(demo-history.ts、facts.ts)

| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-38 | `buildDemoHistory(municipalities)` を 2 回呼ぶ | 完全に同一の結果(決定論的)。ID は `hist-` 接頭辞で一意。`status` は 8 値のいずれかで、`replanned` の元グループには `replanOfGroupId` で指すグループが 1 件ある。`funnelEvents` の `type`・`channel`・`source` は 11 の列挙値のみ |
| MUN-T-39 | 規模 | `mun-demo-a` の 3 地方のグループ数が 150±15(再企画で作ったものを含む)。3 番目の地方は少なくとも 1 か月が K 未満(「少数」表示の確認用)。1 番目の地方の 7 か月合計は K 以上。再訪率の分母が K 以上。`completed` のグループの回答数が K 以上 |
| MUN-T-40 | `addFunnelEvents` | `base` の期間外・別キャンペーンのイベントは加算しない。期間内のイベントは 11 の集計規則どおりに各件数へ加算され、`base` 自体は変更されない |

### 15.7 API・整合

| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-41 | 00 の `insertGroup` で `g-901`(`r-nijiho`、状態 `confirmed`、`confirmedAt` が既定の期間内)を追加し、`u-009` で取得(`includeHistory:false`) | 確定数が追加前より 1 多く、Store の件数と一致 |
| MUN-T-42 | (1) 00 の `insertGroup`・`insertMember` で `g-902`(`r-nijiho`、`recruiting`、参加中メンバーが最少人数未満)を入れ、00 の `/api/demo/clock` で締切を越える → `beforeRequest` で 04 の自動中止が評価された後に取得。(2) `GROUP_BY_STATUS.cancelled`(g-013、`r-hoshinagi`)の幹事 u-007 が 04 の `POST G/replan` で再企画した後に取得 | (1) g-902 が中止に集計される。(2) g-013 が `replanned` になり、再企画率・ファネルの値が変わる |
| MUN-T-43 | リセット(00 の `POST /api/demo/reset`)後 | 活動中データが seed に戻り、履歴は不変 |
| MUN-T-44 | 応答ヘッダとルーティング | `GET /api/stats` が本モジュールのハンドラで処理される。`Cache-Control: no-store`、`X-Content-Type-Options: nosniff` |
| MUN-T-45 | `POST /api/stats` | 405 |
| MUN-T-46 | データが無い期間(履歴より前、`includeHistory:false`) | 200。件数のセルは 0、率のセルは `{kind:"none"}`。画面は空状態 |
| MUN-T-47 | 流入の統合 | 11 の `recordFunnelEvent` で `entry_landed`(`source: "muni-site"`)を 5 件記録してから取得(`includeHistory:false`) → `inflow.bySource` の `muni-site` が 5。別キャンペーンのイベントは数えない |

### 15.8 画面

| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-48 | 自治体担当者(`u-009`)でページを開く | カード 6 枚、地方別表、流入元別の一覧が出る。「少数」は文字で表示。モック・合成データ・下限の注意と、流入がキャンペーン全体の件数である旨が見える |
| MUN-T-49 | 旅行者でページを開く | `ForbiddenNotice`。集計値が DOM に無い |
| MUN-T-50 | 地方フィルタの選択肢 | 担当地方のみ(他自治体の地方は選べない) |
| MUN-T-51 | グラフと表の同値性 | 各グラフの値が「表で見る」の表と一致。「少数」のセルがグラフでは棒なし+ハッチ+文字 |
| MUN-T-52 | アクセシビリティ | キーボードのみで全操作、グラフに `role="img"`+`aria-label`、色を白黒にしても系列・「少数」を判別できる |
| MUN-T-53 | スマホ幅(375px) | 横スクロールなしでカード・表が読める |
| MUN-T-54 | 静的検査 | 画面文言・`messages.ts` に「相乗り」「マッチング」・恋愛を連想させる語・性別の区分が無い |

## 16. 他モジュールとの契約

### 16.1 12 が使う(読み取りのみ)

依存の向き [統一、契約書 4.6]: 実行時の import は 00・11 に限る。01・02・03・04・08・09 は型(`import type`)と 00 の `db()` によるデータの読み取りだけ。

| 先 | 名前 | 用途 |
|---|---|---|
| 00 | `db()`(`groups`、`members`、`joinRequests`、`groupStamps`、`rallySurveys`、`profiles`、`municipalities`、`regions`)、`currentUser(req)`、`route()`/`ok()`、`c.query`、`AppError`、`clock.now()`/`clock.nowIso()`、`v.date()`、`isSlugId`、`useGroupsApi`/`ApiError`、`ErrorNotice`、`resetForTest`/`callRoute`/`insertGroup`/`insertMember`/`fixtures.ts` | データ取得、認可、エラー、期間の既定値、画面の取得、試験 |
| 11 | `aggregateFunnel(q: FunnelQuery): FunnelAggregate`、`ENTRY_SOURCES`、型 `Municipality`・`FunnelEvent`・`FunnelAggregate`(自治体は `db().municipalities` で読み、11 の `getMunicipality` は使わない) | M-08、担当地方(`regionIds`)、合成履歴の流入 |
| 09(型) | `AgeBand`、`Profile` | M-12(`coarseAgeBand`) |
| 01(型) | `Group`、`GroupMember` | M-01、07、10、11、12、17 |
| 03(型) | `JoinRequest` | M-02、03 |
| 04(型) | `GroupStatus`、`CancelReasonCode`、`GroupLifecycle` | M-04〜06(第 3.1 節の区分) |
| 08(型) | `GroupStamp`、`SurveyAnswer` | M-09、M-13〜M-17 |
| 02(型) | `Region` | 地方の名前 |

### 16.2 12 が提供する(呼ばれる側)

| 名前 | 呼び出し元 |
|---|---|
| `GET /api/stats` | 12 の画面のみ |

- 集計の下限(`MIN_CELL_COUNT` ほか)は 12 の内部の定義で、他モジュールに提供しない(09・08 の集計用の閾値は廃止。契約書 10.5)。

### 16.3 他モジュールへの要望(MUN-REQ。他ファイルは編集していない)

契約書で確定した項目(Group の項目名、`GroupStatus` 8 値、`CancelReasonCode`、`GroupStamp.at`、`AgeBand`、`Municipality`、`aggregateFunnel`)は要望から外した。残る要望は次のとおり。

| ID | 宛先 | 要望 |
|---|---|---|
| MUN-REQ-00a | 00 | seed(自治体担当者 `u-009`(`mun-demo-a`)・`u-011`(`mun-demo-b`)、全デモユーザーの `Profile`、`regions`、`municipalities`)は確定済み(契約書 11.4・7.12)。残る要望は、AppShell の集計画面への導線を自治体ロールのみに表示することだけ |
| MUN-REQ-00b | 00 | clock の初期値を 2026-11 以降(合成履歴の後)にする。現行の `meta.demoNow`(2026-11-09)を維持 |
| MUN-REQ-04 | 04 | 解消(契約書 4.2 で確定)。確定後に中止したとき `confirmedAt` を消さないこと、再企画で `replanned` にしたとき `cancelledAt`・`cancelReason` を消さないこと、`completed` に遷移したとき `completedAt` を設定すること(第 3.1 節・第 3.5 節の判定が依存する) |
| MUN-REQ-08 | 08 | 解消(契約書 7.8・7.12)。`rallySurveys` を契約書 7.8 の `SurveyAnswer`(5 項目)にすること。12 は `rallyAggregate` を使わない(契約書 7.8 で削除) |
| MUN-REQ-11 | 11 | 解消(契約書 7.12。担当地方は第 6.3 節の値、`FunnelQuery` に地方の条件は追加しない)。seed の `municipalities` に `regionIds` を置き、`mun-demo-a` と `mun-demo-b` の担当地方を重ならないようにする(第 6.3 節)。`FunnelQuery` に地方の条件が無い点の扱い(第 17 章の確認事項 2) |
| MUN-REQ-README | README | 解消(契約書 4.6 で確定。README の更新は契約書第 12 章の作業に含まれる)。依存図の 12 の矢印を、実行時は 12 → 00・11、型と `db()` の読み取りは 01・02・03・04・08・09 に改める |

## 17. 設計上の確認事項(矛盾・不足)

1. 状態の判定: 契約書 4.1 の `GroupStatus` 8 値で区分し、期間は `lifecycle` の日時で判定する(第 3.1 節)。旧版の「状態名に依存せず日時だけで判定する」方式は、04 の `confirmedAt` などが遷移の有効時刻で、確定後の中止でも残るため、状態で区分する方式に改めた。
2. 流入の地方の範囲: 11 の `FunnelQuery` は `campaign` と期間だけを条件にし、`list_viewed`・`official_*` は地方を持たない。そのため M-08 は担当自治体のキャンペーン全体の件数になり、同じキャンペーンの他自治体の地方への流入も含む(第 3.4 節、第 9 章の例外)。地方別に分けるには、11 の `FunnelQuery` に `regionIds` を追加し、`entry_landed` だけを地方で絞る形が要る [未決]。11 の `FunnelAggregate.landedByRegion` は地方別の着地数を持つが、`source` との組合せが無いため流入元別の内訳には使えない。デモでは 2 自治体が同じキャンペーン(`nttw-demo`)のため、件数だけの開示として許容する案 [案]。解消(契約書 7.12): `FunnelQuery` に地方の条件は追加せず、M-08 はキャンペーン全体の件数とし、画面にその旨を注記する。
3. README の依存関係図: 12 は 01、03 のみに依存と書かれているが、実際は 00、11、09 を実行時に使い、01〜04、08 の型を読む。README の図・表の更新が要る(本書は編集しない。MUN-REQ-README)。解消(契約書 4.6): 実行時は 00・11、型と `db()` の読み取りは 01・02・03・04・08・09。
4. 05 章の未決「個人を特定しない集計の最小単位」は K=5 で確定した [決定 17]。07 章論点 11・17 の少人数(2〜3 人)丸めは 1 グループ内の概要の話で、09 の `memberSummary`(4 人未満は年代を出さない)として別に残る。
5. 非公開グループの集計への算入: 本書は算入する案。09/01 の公開範囲の方針(非公開は招待コードのみ)と整合するか、自治体に非公開の件数を見せてよいかを確認したい [未決]。Profile の `ageBand` を公開設定にかかわらず 3 区分の人数として使う点も同じく確認したい [未決]。解消(契約書 7.12): 非公開グループも数え、年代帯は公開設定にかかわらず 3 区分の人数に使う(K=5)。
6. 公式枠: 07 論点 12 は「公式表示は自治体担当者の操作でのみ付く」。12 は公式枠の付与操作を持たない(11 の `createGroupInternal({ official: true })` と seed)。公式枠の自治体ごとの帰属は 11 の `Listing.sponsor` で、12 は `Group.official` と地方だけで絞る。
7. 差分による推測は防げない(5.6)。ダミーデータのデモでは許容。実運用では集計クエリの制限・ノイズ付加・ヒアリングに基づく K の見直しが要る [未決]。デモでは見送り(契約書 10.5・16.2)。既知の制約として 5.6 に記載し、補完秘匿(5.5)は残す。
8. 成果指標の確定(12 章「計測指標(柱11)の中身」、02 章): 本書の M-01〜M-17 は提案。自治体へのヒアリング(ideas 12 章)で選別が要る。
9. 日時の基準: 時系列は JST の暦月で切る。00 の `clock` が `+09:00` 付き ISO 8601 を返すこと(契約書 3.4)と、11 の `FunnelEvent.day` が JST の日付であることが前提。
10. デモの形(12 章 #1): 「同行成立中心」でも「集合型イベント中心」でも指標の定義は同じ(Group 基準)。11 の集合型イベントは Group として作られるため、そのまま集計対象になる。
11. キャンペーン: 自治体 = 1 キャンペーン(`Municipality.campaign`)の前提。複数キャンペーン横断は競技範囲外と推定 [推定]。
12. 担当地方の ID: 契約書は `Municipality.regionIds` の型だけを決め、各自治体の担当地方と地方 ID(`r-<slug>`)の値は決めていない。12 は seed から読み、地方 ID を固定で書かない(第 6.3 節・第 13 章)[要確認]。解消(契約書 7.12): `mun-demo-a` = `r-nijiho`・`r-hoshinagi`・`r-suzukaze`、`mun-demo-b` = `r-mizukoto`。
13. アンケートの対象期間: 振り返りは実施中から書ける [決定 16] が、集計は `completed` のグループだけを対象にした(第 3.5 節)。実施中の回答を早く見たい要望があれば、`in_progress` を含める選択肢を FilterBar に足す [未決]。解消(契約書 7.12): `completed` のグループの回答だけを対象にし、余力とする。
14. 合成履歴の期間(2026-04〜2026-10)と既定の期間(直近 3 か月)の重なりは 2 か月分のため、既定の表示では 3 番目の地方の多くのセルが「少数」になる。デモで見せる件数が足りない場合は、プリセットの「直近 6 か月」を使う案内を画面に置く [案]。
15. README の「骨子の API 名」: 骨子の `getStats(user, period)` を `getStats(user, query, opts?)` に拡張した(地方・公式枠の追加のため)。

## 18. 未決事項

- 指標の最終採否(M-01〜M-17、02 章)と丸め方。K の値は 5 で確定 [決定 17]。
- 非公開グループと年代帯の公開設定を集計でどう扱うか。解消(契約書 7.12。非公開も数え、年代帯は公開設定にかかわらず 3 区分の人数に使う)。
- 差分による推測への実運用の対策。デモでは見送り(契約書 10.5・16.2)。
- 流入(M-08)を担当地方に絞るか(第 17 章の確認事項 2)。解消(契約書 7.12。絞らず、キャンペーン全体の件数)。
- 自治体ロールの実運用上の認証(デモは Cookie の擬似ロール)。
- 担当地方の割り当て。解消(契約書 7.12・11.4。第 6.3 節)。
- グラフライブラリを将来採るか(現決定案: 採らない)。

## 19. 実装メモ(デモ範囲)

- 優先度は B(デモ終盤の 1 画面)。最小は MUN-TASK-01〜12 と 16(カード 6 枚、地方別の表、流入元別の一覧。K の規則と権限は省略しない)。時系列・ファネル・アンケート(TASK-13、14。M-13〜M-17 の計算を含む)は余力。
- 見送り(契約書 16.2): 公式枠ガード(5.6、MUN-T-35〜37)、日付の検証の境界の試験(MUN-T-14・15)、複数回の照会の差分による推測への対策(5.6)。内訳の補完秘匿(5.5)は見送らない。
- 作成する主なファイル: `app/src/features/stats/{types,config,messages,privacy,query,access,facts,demo-history,metrics,service,handlers}.ts`、`features/stats/ui/*.tsx`、`app/src/app/api/stats/route.ts`、`app/src/app/[campaign]/admin/stats/page.tsx`。
- 既存ファイルの変更: なし(AppShell の導線は 00 の作業)。
- 試験: 純粋関数(privacy、query、metrics、facts の `addFunnelEvents`、demo-history)は 00 の Vitest(`npm test`)で単体試験を書く(`*.test.ts` を同じ階層に置く)。API は `callRoute` による結合試験。画面は通しの手動確認+`npm run build`/`npm run lint`。
