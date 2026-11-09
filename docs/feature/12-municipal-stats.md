# 12 自治体向け集計

状態の凡例は README に従う([事実]/[決定]/[案]/[未決]/[要確認]/[推定])。本書の ID 接頭辞は `MUN`(MUN-M=指標、MUN-RULE=個人非特定規則、MUN-FN=関数、MUN-API=API、MUN-UI=画面、MUN-REQ=他モジュールへの要望、MUN-T=試験、MUN-TASK=実装タスク)。以下は断りがない限り [案]。「デモ範囲外」と記した項目はデモでは実装しなくてよい(実装は任意)。

## 1. 概要と責務 / 対応する柱

- 柱11。グループ旅行・同行の利用実績を、**個人を特定しない集計**として自治体担当者に表示する読み取り専用モジュール。データは保存せず、他モジュールのストアから都度計算する(派生)。 [案]
- 自治体にとっての価値は「成果を説明できること」(ideas E-3: 参加者数、リピート、成立状況を個人を特定せずに確認したい)。デモでは 10 章の通しシナリオ最終場面(自治体担当者タナカが集計を見る)に使う。 [案]
- 責務: ①指標の計算(純粋関数) ②個人非特定の規則(件数の下限・補完秘匿)の強制 ③自治体ロールと担当地方による閲覧制御 ④ダッシュボード画面 ⑤デモ用の過去実績(合成)の生成。
- 責務外: 個人別・グループ別の一覧、CSV 出力、通知・メール配信(外部連携なし)、他モジュールの状態変更(書き込みは一切しない)。
- 骨子の [未決] への回答案(承認待ち): 実行確定・中止・再企画の件数は指標に含める [案]。優先度は B のまま。

## 2. 既存機能との関係

- 新規。既存の計測(`/api/v1/tracking` 等)は内容を確認できないため流用しない。本デモでは Store から導出する(scratch 2.3 の「個人を特定しない集計画面」に相当)。
- `app/` の既存の管理画面・集計は無い [事実、`app/src` に admin 系ディレクトリなし]。新設するパスは `src/app/[campaign]/admin/stats/`(既存 `[campaign]` 配下の兄弟として追加。既存ファイルは変更しない)。
- 既存 `src/lib/api.ts` の `api()` は `/api/v2` 固定のため `/api/groups/stats` には使えない。本モジュールの取得フック(`features/stats/ui/use-stats.ts`)は 00 の `useGroupsApi`(`lib/groups-api.ts`)を包んで作る(第 8.1 節)。
- Next.js 16.4.5 のガイド(`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`、`02-route-segment-config/index.md`)で次を確認した [事実]。本 worktree には `app/node_modules` が無いため、メインのチェックアウトにインストール済みの同一バージョンで読んだ。
  - Route Handler で未定義の HTTP メソッドを呼ぶと Next.js が `405 Method Not Allowed` を返す。
  - `cacheComponents: true`(本アプリの `next.config.ts`)では、ルートセグメント設定の `dynamic` などは使えない。GET の Route Handler は `request.headers` や Cookie を読むとリクエスト時に実行される(事前生成されない)。
  - 静的セグメント(`/api/groups/stats`)と動的セグメント(`/api/groups/[groupId]`)が並ぶ場合の解決順はガイドに記載が無い [要確認](MUN-TASK-01、MUN-T-31 で動作確認)。

### 2.1 利用ライブラリ・モジュール

新規に追加するライブラリは無い。グラフは自前の SVG で描く(第 8.2 節)。

| 名前 | 種別 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | フレームワーク | App Router のページ(`/[campaign]/admin/stats`)、Route Handler(`GET /api/groups/stats`) | MIT | `app/package.json` の 16.4.5 を維持 |
| react / react-dom | ライブラリ | 画面コンポーネント(`useState`、`useMemo`) | MIT | 19.3.0 を維持 |
| @mantine/core | UI ライブラリ | `Card`、`SimpleGrid`、`Table`、`Select`、`SegmentedControl`、`Alert`、`Badge`。テーマ色をグラフの色にも使う | MIT | ^9.7.5 を維持 |
| @mantine/dates | UI ライブラリ | 期間指定の `MonthPickerInput`(月単位の範囲選択) | MIT | ^9.7.5 を維持 |
| dayjs | ライブラリ | クライアントでの月ラベル表示(「2026年10月」)、`MonthPickerInput` の値の変換 | MIT | ^1.11.23 を維持 |
| @tabler/icons-react | アイコン | `PrivacyNote`、`ForbiddenNotice` の装飾アイコン(`aria-hidden`) | MIT | ^3.51.0 を維持 |
| vitest | 試験(devDependency) | 純粋関数・Route Handler の自動試験。00 が導入する(CMN-TASK-12) | MIT | 00 が最新の安定版を追加する。12 は追加しない |
| typescript / eslint / eslint-config-next | 開発ツール | 型検査、lint | Apache-2.0 / MIT / MIT | `app/package.json` のものを維持 |
| Web 標準 API(`URL`、`URLSearchParams`、`Request`、`Response`、`fetch`) | 実行環境 | クエリの解析、応答の生成、取得 | - | Node.js / ブラウザ組み込み。Node の標準モジュール(`node:*`)は使わない |
| 00 共通基盤 | 自前モジュール | `db()`(ストアの読み取り)、`currentUser`、`clock`、`AppError`/`invalidInput`/`forbidden`、`route()`/`ok()`、`v.date()`、`lib/datetime.ts`、`requireRole`、`useGroupsApi`、`ErrorNotice`/`LoadingBlock`/`MockBadge`、試験ヘルパー(`resetForTest`、`callRoute`) | - | 00 の設計書の署名に従う |

自前で実装するもの:

| 対象 | 理由 |
|---|---|
| グラフ(棒・折れ線・ファネル。SVG/CSS) | 3 種類で足り、「少数」の表示(棒なし+ハッチ+文字)を細かく制御するため(第 8.2 節) |
| 個人非特定の関数(`toCountCell`、`toRateCell`、`suppressBreakdown`) | 本モジュール固有の規則で、該当するライブラリが無いため |
| 擬似乱数(mulberry32) | 合成履歴を決定論的に作るのに 10 行程度で足りるため。公開されているアルゴリズムを参照して自前で書き、既存コードは転記しない |
| 月の計算(`monthsBetween`、月初・月末の判定) | `YYYY-MM` の文字列演算で足り、サーバーのタイムゾーン設定に依存させないため(00 の `lib/datetime.ts` を補助に使う) |

使わないもの: `@mantine/charts`・recharts・Chart.js(第 8.2 節)、`zustand`(画面の状態はコンポーネント内の `useState` で足りる)、`@mantine/hooks`(スマホ幅の列の出し分けは `@mantine/core` の `visibleFrom` で行う)。

## 3. 指標の定義(MUN-M)

### 3.1 共通の集計単位
- 集計軸: **期間**(JST の日付範囲。時系列は月単位)、**地方**(`Group.region`。自治体の担当地方のみ)、**公式枠か否か**(`Group.isOfficial`。`all`/`official`/`general`)。 [案]
- 「期間に属する」の基準は指標ごとに下表の「基準日時」で固定する(同じグループが複数月に重複計上されないようにする)。
- 「実行確定」= `confirmedAt` が非 null かつ `canceledAt` が null(状態名は 04 の確定後の実施中・完了を含む)。「中止」= `canceledAt` が非 null。`confirmedAt` と `canceledAt` が両方非 null(確定後の中止)のグループは「中止」として扱い、確定には数えない。状態名(募集中/最少人数到達/辞退期間 等)には依存せず、日時フィールドで判定する。docs/design 05 の状態名と 04 骨子の暫定状態名がずれているため、この方式で吸収する(第 17 章)。
- 人数の数え方: 「参加者」は確定グループの参加中(`GroupMember.status = "active"`)のメンバー。退会・辞退したメンバーは含めない。

### 3.2 指標一覧

| ID | 指標名 | 定義式 | 元データ | 基準日時 | 自治体の意思決定上の価値 |
|---|---|---|---|---|---|
| MUN-M-01 | グループ作成数 | 期間内に作られた Group の数(再企画グループを含む) | Group(01) | `createdAt` | 同行ニーズの量。キャンペーンの訴求・公式枠の投入量を判断 |
| MUN-M-02 | 参加申請数 | 期間内の JoinRequest の数(全状態) | JoinRequest(03) | `createdAt` | 関心の高さ。公式枠を増やす地方の判断 |
| MUN-M-03 | 承認率 | 承認数 ÷(承認数+却下数)。取り下げ・申請中は分母に含めない | JoinRequest | `decidedAt` | 幹事の運用が滞っていないか。受け入れの間口の目安 |
| MUN-M-04 | 実行確定数 / 実行確定率 | 確定数 ÷(確定数+中止数) | Group(04) | 確定=`confirmedAt`、中止=`canceledAt` | 成立の安定度。成立支援策(最少人数・締切の案内)の要否 |
| MUN-M-05 | 中止率(理由別) | 中止数 ÷(確定数+中止数)。理由別件数=`deadline_unmet`(締切で最少人数に未達)/`organizer`(幹事操作)/`other`(その他の自動中止。辞退で最少人数を割った等) | Group(04) | `canceledAt` | 未達が多ければ参加者募集(広報・公式枠)の強化、幹事操作が多ければ運用の見直し |
| MUN-M-06 | 再企画率 | 期間内に中止になった Group のうち、`replannedFromId` として参照された割合(参照する再企画グループの作成日時は問わない) | Group(04) | 中止の `canceledAt` | 中止後に再企画されている割合。再企画の案内の効果 |
| MUN-M-07 | 成立人数の分布 | 実行確定した Group の参加者数(2〜6)ごとのグループ数。範囲外(1 以下)は数えない | Group、GroupMember(01) | `confirmedAt` | 小規模(2〜3 人)向けの宿・交通の需要。人数上限の設計 |
| MUN-M-08 | 入口別の流入 | 入口(`direct`/`external`/`official`/`invite`)ごとの一覧着地数 | EntryEvent(11) | `at` | 自治体サイト・広報(入口B)からの送客の効果 |
| MUN-M-09 | スタンプ取得数・訪問スポット | スタンプ取得の総数。スポット別の「取得したグループ数」上位 5 | GroupStamp(08)、seed.spots | `acquiredAt` | 回遊の実態。人気のスポット・訪問の少ないスポット |
| MUN-M-10 | 地方別の人気 | 地方ごとに M-01・M-02・M-04(確定数)・M-05(中止率)を並べた表 | 上記 | 各指標の基準 | 地方ごとの需給。どの地方に公式枠を足すか |
| MUN-M-11 | 再訪(リピート)率 | 期間内に確定したグループの参加者(重複なしの人数)のうち、`to` 以前(期間の開始前を含む)に確定したグループへの参加が 2 回以上の人の割合 | GroupMember、Group | `confirmedAt` | ideas の「リピート」。関係人口の継続性 |
| MUN-M-12 | 参加者の年代帯 | 期間内に確定した Group の参加者(重複なしの人数)を粗い年代帯(第 5.4 節)ごとに数えた人数 | GroupMember、DemoUser.ageBand(00/09) | `confirmedAt` | 訴求の対象層の把握(性別は扱わない) |

補足:
- 時系列(月別): M-01、M-02、M-04(確定数)、M-09(取得数)を月で並べる。系列は最大 12 か月。
- 地方別の表(M-10)の並び順: 作成数が数値のセルを降順、続いて「少数」のセル、同順位は 00 の `REGIONS` の順。「少数」どうしは実数で並べない(順序から値を推測させない)。
- ファネル(中止→再企画→再成立): 期間内に中止した Group 数 → うち再企画された数 → うち再企画グループが集計時点までに実行確定した数(確定日は期間外でもよい)。中止・再企画に関する自治体の打ち手(再企画の案内文言、日程の提案)を判断する。 [案]
- **見送った指標** [案]: 辞退数(辞退は 07 章論点 16 で「他の参加者に誰が辞退したかを出さない」方針。集計でも辞退の個数は出さない)、通報・ブロック件数(安全運用の情報で自治体向けではない)、チャット・費用メモの量(内容に近く、価値も低い)。入口から成立までの個人単位の紐付け(scratch の「流入元から成立までの紐付け」)は個人追跡になるため行わず、入口は「着地数」までとする。
- 再訪(M-11)・年代帯(M-12)は内部で参加者 ID を使うが、**応答には ID・名前を含めない**(第 5.1 節)。

### 3.3 率の扱い
- 率は第 5.3 節(MUN-RULE-03)の規則で丸める。分母が下限 K 未満なら「少数」、分子が K 未満なら「N% 未満」と返し、分子の実数を逆算させない。

## 4. 集計の元データと取得方法

読み取り専用の契約。各モジュールのデータを 00 のストア(`db()`)から直接読むが、**書き込みはしない**。モジュール間の名称差を吸収するため、`features/stats/facts.ts` に変換層(アダプタ)を置き、集計ロジックは中間表現 `GroupFact` だけを見る。 [案]

| 元データ | 提供元 | 使う項目(本書の名称) | 現行の 00 の型での名称(アダプタが変換) | 取得 |
|---|---|---|---|---|
| Group | 01、04 | id、campaign、region、official、createdAt、`confirmedAt`、`canceledAt`、`cancelReason`、`replannedFromId` | `isOfficial`、`cancelledAt`、`cancelReason`(`minNotReached` 等)、`replanOfId` | `db().groups.list()` |
| GroupMember | 01 | groupId、userId、状態(参加中/退会)、参加日時 | `status`(`active`/`left`/`withdrawn`)、`joinedAt` | `db().members.list()` |
| JoinRequest | 03 | groupId、状態(申請中/承認/却下/取り下げ)、申請日時、判断日時 | `status`、`createdAt`、`decidedAt` | `db().joinRequests.list()` |
| GroupStamp | 08 | groupId、spotId、取得日時 | `at` | `db().groupStamps.list()` |
| EntryEvent | 11 | 着地日時、campaign、region、入口 | (00 の Store に未定義。MUN-REQ-11) | `db().entryEvents.list()`(新設を要望) |
| DemoUser.ageBand | 00、09 | 年代帯 | `ageBand`(`under18`/`20s`/…/`60plus`) | `db().users.get(id)` |
| spots | 既存 seed.json | spotId、name(公開情報) | - | 読み取り import |

- 中止理由の変換(`toCancelReason`。`facts.ts` 内): 締切で最少人数に未達(00 の `minNotReached`、04 の `min_not_reached`)→ `deadline_unmet`。幹事の中止・幹事の不在(`organizerCancelled`/`organizer_cancelled`、`organizerLeft`/`organizer_left`)→ `organizer`。それ以外の値(辞退で最少人数を割った等。未知の値を含む)→ `other`。 [案]
- 「活動中のデータ」(group-seed と操作で増えるもの)に加え、**デモ用の過去実績(合成)**を同じ `GroupFact` の形で足す(第 13 章)。画面には「デモ用の過去実績(合成データ)を含む」と常時表示する。 [案]
- 非公開グループ・公開範囲(09)は集計では**考慮しない**: 集計は自治体向けの統計であり、個々のグループの中身を表示しないため、非公開でも件数には含める [案]。ただし第 5 章の下限規則で個別特定を防ぐ。この扱いは 09 と整合させる必要がある(第 17 章)。
- ブロック関係・通報状態は集計に使わない。

## 5. 個人非特定の規則(MUN-RULE)

07 章論点 11・17(人数が少ない場合の丸め)と 05 章末尾の未決「個人を特定しない集計の最小単位(件数の下限など)」に対する本書の提案。 [案]

### 5.1 出力に含めないもの(MUN-RULE-01)
- ユーザー ID、表示名、グループ ID、グループ名、幹事、招待コード、行き先の自由記述、チャット・メモ・費用メモの内容。性別。
- 個票(1 行 = 1 グループ/1 人)を返す API・画面を作らない。応答は常に集計値(`CountCell`/`RateCell`)のみ。
- 内部計算で参加者 ID を使う(M-11、M-12)場合も、応答型に ID 型を持たせず、試験で応答 JSON に `u-`/`g-` 形式の ID が含まれないことを検査する(MUN-T-05)。

### 5.2 件数の下限 K(MUN-RULE-02)
- `MIN_CELL_COUNT = 5`(`features/stats/config.ts`)。**表示される 1 セル(カード・表の 1 マス・グラフの 1 点)の件数が 1〜4 のとき「少数」と表示**し、数値を返さない。0 は「0」と表示する(0 は誰も該当しないので特定につながらない)。 [案]
- 集計単位は「グループ数」または「人数」。グループ数が 1〜4 のセルは単一グループを特定しうるため K 未満として扱う。 [案]
- 値は 09 の `memberSummary`(グループ内メンバーの年代帯、少人数丸め)とは別の規則。09 は「1 グループの参加前の概要」、本書は「複数グループの統計」を対象とする。K の値を 09 と共通にするかは [未決](第 17 章)。
- K=5 の根拠: 一般に小地域統計の秘匿で用いられる範囲を参考にした暫定値 [推定]。自治体へのヒアリングで確定する(11 章の「成果指標」の未決と連動)。

### 5.3 率の丸め(MUN-RULE-03)
- 分母が 0 なら「対象なし」(`{kind:"none"}`。画面は「—」)。
- 分母が 1〜K-1 なら「少数」(`{kind:"few"}`)。
- 分母が K 以上で分子が 1〜K-1 なら「N% 未満」(`{kind:"below", percent: N}`、N = ceil(K ÷ 分母 × 100))。分子の実数を逆算させない。
- それ以外は整数 %(`{kind:"value", percent: round(分子 ÷ 分母 × 100)}`)。分子 0 は 0%。
- 実装は `toRateCell`(MUN-FN-07)。

### 5.4 年代帯の粒度(MUN-RULE-04)
- 集計では 3 区分のみ: `under30`(29 歳以下)、`30to49`、`50plus`。10 代は 09 の 18 歳確認により通常存在しないが、存在しても `under30` に含める。年齢の細かい指定・同年代のみ等の軸は設けない(07 章論点 11 の維持)。
- 年代帯は「地方 × 期間」の絞り込みと併用でき、各区分は K 未満なら「少数」。

### 5.5 補完秘匿(MUN-RULE-05)
- 内訳(地方別・月別・成立人数別・入口別・年代帯・スポット別・中止理由別)の中で「少数」のセルがちょうど 1 個だけあり、合計が別に表示される場合、合計から引き算して逆算できる。これを防ぐため、**少数セルが 1 個のとき、少数でない最小の(0 でない)セルも「少数」にする**(補完秘匿)。同じ値のセルが複数あるときは配列の先頭側を選ぶ。該当するセルが無い(他がすべて 0)ときは追加しない。`suppressBreakdown(counts, k)` で実装する。
- 内訳は系列(列)ごとに適用する(地方別の表は列ごと、時系列は系列ごと)。
- 少数セルが 2 個以上のときは追加しない(逆算できるのは 2 個以上の和までで、個別の値は分からない)。 [案]

### 5.6 グループ単位の特定を避ける規則(MUN-RULE-06)
- 公式枠は数が少ない(デモは 1〜2 件)ため、`official=official` の集計は 1 グループの特定につながりやすい。**フィルタ後の集計単位が K 未満のセルは「少数」**(5.2 と同じ)。
- [デモ範囲外] 公式枠フィルタの差分(全体 − 一般 = 公式)への対策: `official` が `official`/`general` のとき、スコープ(期間 × 地方)内の `official` グループ数と `general` グループ数の両方が、0 または K 以上でなければ、**そのフィルタ指定を受け付けない**(`invalid_input`、`fields.official = "この条件では少数のため表示できません"`)。
- 期間フィルタの最小は **1 か月(暦月単位)**。日単位・週単位の期間は指定できない(日単位の差分で少数のグループを特定されにくくするため)。 [案]
- 地方フィルタは担当地方のみ(第 9 章)。
- 既知の制約: 同じ条件の繰り返し・複数条件の組合せによる差分の推測は防げない。本デモはダミーデータのため許容し、実運用では要件を見直す [未決](第 17 章)。

### 5.7 その他
- 集計値の応答には `Cache-Control: no-store` を付ける(00 の `route()` が付与)。サーバーログに応答本文・クエリを出さない。
- 画面に「個人が特定できないよう、{K} 件未満の値は「少数」と表示しています」と常時表示する(MUN-UI の PrivacyNote)。

## 6. データ(05 章)

### 6.1 保存するデータ
- なし。05 章「集計」(参加、成立、再訪)の定義は本書第 3 章で埋める提案 [案]。

### 6.2 型定義(`features/stats/types.ts`)

```ts
import type { Region } from "@/lib/groups-types";   // 00 の地方の列挙

// ---- 列挙 ----
export type OfficialFilter = "all" | "official" | "general";
export type EntryChannel = "direct" | "external" | "official" | "invite";
export type CancelReason = "deadline_unmet" | "organizer" | "other";   // 変換規則は第 4 章
export type CoarseAgeBand = "under30" | "30to49" | "50plus";
export type RequestDecision = "pending" | "approved" | "rejected" | "withdrawn";

// ---- 中間表現(アダプタ/合成履歴が作る。ID は集計の内部だけで使い、応答へ出さない)----
export interface RequestFact {
  at: string;                  // ISO 8601 申請日時
  decision: RequestDecision;
  decidedAt: string | null;    // 承認/却下の日時
}
export interface StampFact { spotId: number; at: string }
export interface GroupFact {
  groupId: string;
  campaignId: string;
  regionId: Region;
  official: boolean;
  createdAt: string;
  confirmedAt: string | null;
  canceledAt: string | null;
  cancelReason: CancelReason | null;
  replannedFromId: string | null;
  memberCount: number;                 // 現在の参加中(active)メンバー数。= participantKeys.length
  participantKeys: string[];           // 不透明な識別子(M-11・M-12 の重複判定専用。出力しない)
  ageBands: (CoarseAgeBand | null)[];  // 各参加者の粗い年代帯(participantKeys と同順。不明は null)
  requests: RequestFact[];
  stamps: StampFact[];
  origin: "live" | "demo-history";
}
export interface EntryFact { at: string; campaignId: string; regionId: Region | null; channel: EntryChannel }

// ---- 問い合わせ ----
export interface StatsQuery {
  from: string;                // "YYYY-MM-DD"(月初のみ可)。JST
  to: string;                  // "YYYY-MM-DD"(月末のみ可)。JST
  regionId: Region | null;     // null = 担当地方すべて
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
  municipalityName: string;
  campaignId: string;
  regions: { id: Region; name: string }[];    // 自分が閲覧できる地方
  query: StatsQuery;                          // 正規化後(既定値を適用)
  minCellCount: number;                       // K
  includesDemoHistory: boolean;
  generatedAt: string;                        // clock.nowIso()
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
  regionId: Region; regionName: string;
  groupsCreated: CountCell; joinRequests: CountCell; confirmedGroups: CountCell;
  cancelRate: RateCell;
}
export interface FunnelStep { key: "canceled" | "replanned" | "replanConfirmed"; label: string; cell: CountCell }
export interface SpotRow { spotId: number; spotName: string; groups: CountCell }
export interface StatsResponse {
  meta: StatsMeta;
  summary: StatsSummary;                  // M-01〜06, 09, 11
  timeSeries: TimePoint[];                // 期間の各月(1〜12 件)
  regionTable: RegionRow[];               // M-10(1 地方指定時は 1 行)。並び順は第 3.2 節の補足
  funnel: FunnelStep[];                   // M-06(3 段。canceled → replanned → replanConfirmed)
  cancelReasons: LabeledCell[];           // M-05 内訳(key: "deadline_unmet" | "organizer" | "other")
  memberCountDistribution: LabeledCell[]; // M-07(key: "2"〜"6")
  entryChannels: LabeledCell[];           // M-08(key: EntryChannel の 4 値)
  topSpots: SpotRow[];                    // M-09(最大 5 行。並び順は下記)
  ageBands: LabeledCell[];                // M-12(key: CoarseAgeBand の 3 値)
}
```

- `topSpots` の選び方: 取得グループ数が 0 のスポットは出さない。少数でない行を件数の降順(同数は `spotId` 昇順)に並べ、5 行に満たなければ「少数」の行を `spotId` 昇順で補う。
- 内訳の配列(`cancelReasons`、`memberCountDistribution`、`entryChannels`、`ageBands`)は値が 0 のキーも省略せず、上記の key の順で返す。

### 6.3 自治体マスタ(`features/stats/municipalities.ts`、ダミー固定)

```ts
export interface Municipality { id: string; name: string; campaignId: string; regionIds: Region[] }
export const MUNICIPALITIES: readonly Municipality[];   // 2 件(下記)
export function getMunicipality(id: string): Municipality | undefined;
```
- デモ 2 件 [案]: ①`mun-demo-a`「デモ市観光課(タナカ担当)」が 3 地方(`虹帆町`、`星凪諸島`、`鈴風高原`)を担当、②`mun-demo-b`「別デモ市(他地方の確認用)」が 1 地方(`水琴地方`)を担当。②は IDOR 試験用(①で②の地方を指定すると拒否される)。地方の値は 00 の `REGIONS` と一致させる。ID の形式は 11 の `MunicipalityId`(`mun-` 接頭辞)に合わせる。
- 自治体担当者のダミーユーザーは 00 の `DemoUser` に `role: "municipal"`、`municipalityId` を持たせる(MUN-REQ-00a)。「自治体担当者の名前(タナカ)」は ideas のペルソナ名で、実在個人ではない。

## 7. インターフェース(関数 MUN-FN / API MUN-API)

### 7.1 関数(`features/stats/`。サーバー側の関数はすべて同期)

| ID | シグネチャ | 責務 | 例外 |
|---|---|---|---|
| MUN-FN-01 | `resolveScope(user: DemoUser): MunicipalScope` | 自治体ロールか判定し、担当自治体・地方を返す。`type MunicipalScope = { municipality: Municipality; regionIds: Region[] }` | `forbidden`(403。ロール違い、`municipalityId` が無い・マスタに無い) |
| MUN-FN-02 | `parseStatsQuery(sp: URLSearchParams, scope: MunicipalScope, now: Date): StatsQuery` | クエリ文字列の検証と既定値の適用(第 7.2・7.3 節) | `invalid_input`(400。`fields` 付き)、地方が担当外なら `forbidden` |
| MUN-FN-03 | `collectFacts(scope: MunicipalScope, now: Date, opts?: { includeHistory?: boolean }): { groups: GroupFact[]; entries: EntryFact[] }` | 活動中データのアダプタ + 合成履歴。`campaignId` が担当自治体のものかつ担当地方の `GroupFact`/`EntryFact` だけを返す(フィルタは集計前)。合成履歴のうち `now` より後の日時のものは除く。`includeHistory` の既定は true | なし |
| MUN-FN-04 | `computeStats(input: { groups: GroupFact[]; entries: EntryFact[]; query: StatsQuery; meta: Omit<StatsMeta,"query">; k?: number }): StatsResponse` | 全指標の計算(純粋関数。時計・ストアに触れない)。`query` の期間・地方・公式枠で絞り込み、`meta.query` に `query` を入れて返す。`k` の既定は `MIN_CELL_COUNT`。`official` フィルタは入口別(M-08)には適用しない | [デモ範囲外] `invalid_input`(5.6 の公式枠ガード) |
| MUN-FN-05 | `getStats(user: DemoUser, query: StatsQuery, opts?: { includeHistory?: boolean }): StatsResponse` | `resolveScope` → `collectFacts` → `computeStats`。`meta.generatedAt` に `clock.nowIso()` を入れる | 上記のもの |
| MUN-FN-06 | `toCountCell(n: number, k: number): CountCell` | n が 1〜k-1 なら `{few:true}`、それ以外は `{few:false,value:n}` | なし |
| MUN-FN-07 | `toRateCell(num: number, den: number, k: number): RateCell` | 第 5.3 節の規則。den=0 → none。den<k → few。num が 1〜k-1 → `below(ceil(k/den*100))`。num=0 → `value(0)`。他は `value(round(num/den*100))` | なし |
| MUN-FN-08 | `suppressBreakdown(counts: number[], k: number): boolean[]` | 内訳の秘匿フラグ(true=少数)。5.5 の補完秘匿を含む | なし |
| MUN-FN-09 | `coarseAgeBand(ageBand: string): CoarseAgeBand \| null` | 00/09 の年代帯コードを 3 区分へ。`under18`・`18-19`・`20s` → `under30`、`30s`・`40s` → `30to49`、`50s`・`60s`・`60plus`・`70s+` → `50plus`。未知は null(年代帯の集計から除外) | なし |
| MUN-FN-10 | `buildDemoHistory(): { groups: GroupFact[]; entries: EntryFact[] }` | 決定論的な合成履歴(第 13 章)。モジュール内でキャッシュ(1 回だけ生成) | なし |
| MUN-FN-11 | `monthsBetween(from: string, to: string): string[]` | `"YYYY-MM"` の連続リスト(JST)。`from` の月から `to` の月まで(両端を含む) | なし |

例外の生成は 00 の `forbidden()`、`invalidInput(fields)` を使う。

### 7.2 API

| ID | メソッド・パス | 認可 | 説明 |
|---|---|---|---|
| MUN-API-01 | `GET /api/groups/stats` | 自治体ロールのみ(`currentUser(req)` から判定。クエリ・ヘッダの自己申告は信用しない) | 指標の取得。`app/src/app/api/groups/stats/route.ts`。00 の `route()` で包み、`GET` のみを export する |

処理の順序: `route()`(`currentUser` 解決)→ `resolveScope(c.user)`(ロールが違えば入力検証より先に 403)→ `parseStatsQuery(c.url.searchParams, scope, clock.now())` → `getStats(c.user, query)` → `ok(response)`。

リクエスト(クエリ。すべて任意):

| パラメータ | 型・範囲 | 既定 | 検証(失敗時の `fields` のキー) |
|---|---|---|---|
| `from` | `YYYY-MM-DD`(月の 1 日のみ) | `to` の 5 か月前の月初(直近 6 か月) | 00 の `v.date()` で実在日付、かつ日が `01`(`from`) |
| `to` | `YYYY-MM-DD`(月末日のみ) | `clock.now()` の属する月の月末 | 実在日付かつ月末日、`from <= to`、範囲は 12 か月以内(`to`) |
| `region` | 地方(00 の `REGIONS` の値。1〜20 字) | なし(担当地方すべて) | 担当地方(`scope.regionIds`)のいずれかと完全一致。一致しなければ `forbidden`(存在しない地方も同じ) |
| `official` | `all` \| `official` \| `general` | `all` | 列挙(`official`)。[デモ範囲外] 5.6 のガード |

- 未知のパラメータは無視する。同じパラメータが複数あるときは最初の値を使う。
- レスポンス 200: `StatsResponse`(6.2)。`Cache-Control: no-store`。データが無い期間でも 200(件数のセルは 0、率のセルは `none`。画面は空状態を表示)。
- エラー: 第 12 章の表に従う。
- 集計のタイミング: **リクエストごとに都度計算**。ダミー規模(合成履歴で約 190 グループ + 活動中 12 件)ではキャッシュ不要 [案]。「日付を進める」(clock 差し替え)や状態変更が次の取得で反映される。

### 7.3 クエリの正規化規則
- `to` 未指定: `clock.now()` の JST 月末。`from` 未指定: `to` の月から 5 か月前の月初。
- 期間境界: `from` 00:00:00+09:00 以上、`to` の翌日 00:00:00+09:00 未満。
- 時系列の月数 = `monthsBetween(from, to).length`(1〜12)。
- 検証メッセージ(`messages.ts`): `from`「月の初日(YYYY-MM-01)を指定してください」、`to`「月の末日を指定してください」/「開始月より後の月を指定してください」/「期間は 12 か月以内で指定してください」、`official`「選択肢から選んでください」。

## 8. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| 集計画面(自治体) | 集計画面(自治体) | `/[campaign]/admin/stats` |

- URL の `[campaign]` は共通レイアウト用で、集計対象は `Municipality.campaignId` で決まる(URL の値で対象を切り替えない)。

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
features/stats/ui/BarList.tsx                      MUN-UI-09  分布(成立人数・入口・年代帯・スポット)
features/stats/ui/CellText.tsx                     MUN-UI-10  CountCell/RateCell の表示(「少数」)
features/stats/ui/ChartTableToggle.tsx             MUN-UI-11  グラフ/表の切替と表の代替
features/stats/ui/PrivacyNote.tsx                  MUN-UI-12  下限の説明・合成データ・モックの表示
features/stats/ui/ForbiddenNotice.tsx              MUN-UI-13  権限なしの案内
```

props / state / データ取得:

```ts
// MUN-UI-03(00 の useGroupsApi<StatsResponse> を包む。query=null のときはクエリなしで取得し、サーバーの既定値を使う)
export function useStats(query: StatsQuery | null): {
  data: StatsResponse | null;
  error: ApiError | null;        // 00 の ApiError(code: "forbidden" | "invalid_input" | "internal" | "network" ほか、fields)
  loading: boolean;
  reload: () => Promise<void>;
};
// MUN-UI-02: state = { query: StatsQuery | null }。初回は query=null で取得し、
//   応答の meta.query を FilterBar の初期値に使う。フィルタ変更で setQuery → useStats が再取得。
// MUN-UI-04
interface FilterBarProps { regions: { id: Region; name: string }[]; value: StatsQuery;
  onChange(next: StatsQuery): void; disabled?: boolean; errors?: Record<string, string> }
// MUN-UI-05
interface MetricCardProps { title: string; cell: CountCell | RateCell; unit?: string; hint: string; minCount: number; loading?: boolean }
// MUN-UI-06
interface TimeSeriesChartProps { points: TimePoint[]; series: { key: keyof Omit<TimePoint,"month">; label: string }[] }
// MUN-UI-07
interface RegionTableProps { rows: RegionRow[]; minCount: number }
// MUN-UI-08 / 09
interface FunnelChartProps { steps: FunnelStep[]; minCount: number }
interface BarListProps { title: string; items: LabeledCell[]; unit: string; minCount: number }
// MUN-UI-10
interface CellTextProps { cell: CountCell | RateCell; unit?: string; minCount: number }
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
- 画面構成(上から): ①モック/合成データ/下限の注意(PrivacyNote)②FilterBar(期間: 直近 3・6・12 か月のプリセット + `MonthPickerInput`(@mantine/dates、`type="range"`。選んだ開始月の 1 日を `from`、終了月の末日を `to` にする)、地方(`Select`。先頭に「担当地方すべて」)、公式枠(`SegmentedControl`: すべて/公式枠/一般))③指標カード 6 枚(作成数、申請数、承認率、実行確定率、中止率、スタンプ取得数。M-11 の再訪率は 7 枚目として余力で追加)④月別推移(TimeSeriesChart)⑤地方別の表(RegionTable、M-10)⑥中止・再企画のファネル(FunnelChart + 中止理由の内訳)⑦分布(成立人数、入口、年代帯、人気スポット)。
- スマホ幅: カードは 2 列 → 1 列、表は横スクロール枠(`overflow-x:auto`)を使わず列を絞る(地方 / 作成 / 申請 / 確定 / 中止率)。グラフは幅 100%。
- デモ最小実装(優先度 B): ③のカードと⑤の表のみで足りる。④〜⑦は余力。

### 8.2 グラフ表示の方針(MUN-UI の選択)
- **決定案: 外部グラフライブラリを使わず、自前の SVG/CSS で描く。** 理由: ①依存を増やさない(rule.md 8 のライセンス確認の対象を増やさない)、②棒・折れ線・ファネルの 3 種のみで足りる、③「少数」の表現を細かく制御できる。
- 検討した候補: `@mantine/charts`(MIT。内部で recharts を使う。推移的依存の d3 系は ISC/BSD。依存が増え、`package-lock` 全体のライセンス確認が必要)、Chart.js(MIT。canvas のためアクセシビリティの扱いが弱い)。いずれも**採用しない** [案]。グラフの種類が増えたら再検討し、その際は `package.json`/`package-lock.json` の全推移的依存のライセンス(MIT/ISC/BSD/Apache 以外が混じらないか、強いコピーレフトが無いか)を 08 章の一覧に追加して確認する。
- 描画規則: 棒の値は常にラベルで併記。折れ線は系列ごとに点のマーカー形状を変えて(○/□)区別する。色は Mantine のテーマ色を使い、**色だけに頼らない**(パターン/形状/直接ラベル)。「少数」のセルは棒を描かず、斜線のハッチ+「少数」の文字を表示。

### 8.3 アクセシビリティ(MUN-UI)
- すべてのグラフに「表で見る」切替(ChartTableToggle)を置き、同じ値を `<table>`(`<caption>`、`<th scope>`)で提示する。スクリーンリーダー向けにはグラフは `role="img"` + `aria-label`(要約: 最大値と傾向)を付け、表を既定で読めるようにする(グラフは `aria-hidden` にせず説明を付ける)。
- 色のコントラスト比は WCAG AA(本文 4.5:1、グラフ要素 3:1)を目安にする。アニメーションは付けない(`prefers-reduced-motion` の分岐は不要)。
- 「少数」は文字で表示し、aria-label は第 8.1 節の表のとおり。キーボード操作でフィルタ・切替すべて可能。
- 状態は色ではなくラベルと形状で示す(例: 率のバッジに「▲」等の記号は使わず、数値と「未満」の文字で表す)。

## 9. 自治体ユーザーのダミーと権限

- 認可の根拠は**サーバー側で解決した現在ユーザーのみ**(`currentUser(req)`。Cookie `demoUser`)。クエリ・ヘッダ・ボディで自治体 ID を渡す口を作らない(IDOR 対策)。 [案]
- 権限チェックの順序: ①`user.role === "municipal"`(00 の `requireRole(user, "municipal")`) ②`getMunicipality(user.municipalityId)` が存在 ③`region` 指定があれば担当地方に含まれる ④`collectFacts` が**担当地方でフィルタしてから**集計する(集計後に地方を隠す方式にしない)。
- 担当外の地方・他自治体のデータは、存在を示唆する応答(件数・「少数」を含む)を返さない。担当外 `region` は `forbidden`。
- 一般の利用者ユーザー(旅行者)はこの API・画面にアクセスできない: API は `forbidden`、画面は `ForbiddenNotice`。AppShell のメニューにも出さない(MUN-REQ-00c)。メニューの非表示はアクセス制御ではなく、アクセス制御は API の認可で行う。
- 自治体ロールの利用者も、他モジュールの利用者向け API(参加申請など)には通常ユーザーとしては触れない。デモでは別ユーザーに切り替えて操作する。
- デモユーザー: 00 の `group-seed.json` に自治体担当者 2 人(上記の 2 自治体)を `role: "municipal"` として追加(MUN-REQ-00a)。

## 10. 状態遷移

- なし(状態を持たない)。画面の取得状態(loading / loaded / error)のみ。

## 11. 入力検証・セキュリティ

OWASP Top 10 の代表項目のうち、本モジュールに関係するもの。

| 項目 | 対処 |
|---|---|
| アクセス制御・IDOR | 第 9 章。自治体 ID・地方の権限は Cookie から解決した現在ユーザーだけで判定する。担当外の地方は 403 で、件数・「少数」を返さない。担当地方で絞ってから集計する |
| 入力検証・インジェクション | クエリは 7.2 の表で検証(日付は 00 の `v.date()`、地方は担当地方との完全一致、`official` は列挙)。未知のパラメータは無視。SQL・ファイルパス・`eval` に入力を渡さない(ストアはメモリ上の配列) |
| XSS | 表示は React のエスケープに任せる。`dangerouslySetInnerHTML` 禁止。スポット名・地方名は seed/マスタ由来で、利用者の入力を表示しない |
| CSRF | 本モジュールの API は GET のみで状態を変えない。CORS ヘッダを付けないため、別オリジンのページは応答を読めない。Cookie は 00 の `SameSite=Lax` |
| 認証・セッション(デモ) | ログイン不要のデモのため Cookie `demoUser` は利用者が書き換えられる(00 第 7 章)。画面に「モック」と表示し、実運用では自治体担当者の認証が必要と第 18 章に記す |
| セキュリティ設定 | 00 の `route()` が `Cache-Control: no-store`、`X-Content-Type-Options: nosniff` を付ける。GET 以外のメソッドは 405 |
| 機密データ | 応答は集計値のみ(第 5 章)。ID・表示名・グループ名・自由記述を含めない。件数の下限 K と補完秘匿を `computeStats` の出口で適用し、UI 側では再計算しない(サーバーから受け取った `CountCell`/`RateCell` をそのまま表示) |
| ログ | 応答本文・クエリ・利用者 ID をログに出さない。想定外の例外は 00 の `route()` が `requestId` と例外のみを `console.error` に出す |

- 既知の制約(デモでは対処しない): 複数条件の差分による推測(5.6)、応答時間の差による推測、大量リクエストによる負荷(期間は最大 12 か月、データはダミー規模)。
- 禁止表現(09)は入力を受けないため適用なし。画面文言に恋愛を連想させる語、「相乗り」「マッチング」を使わない(`messages.ts` に集約し、10 章の静的検査の対象にする)。

## 12. エラー処理

| コード | HTTP | 発生条件 | 画面での表示・挙動 |
|---|---|---|---|
| `forbidden` | 403 | 自治体ロールでない(Cookie なし・不正値で既定の旅行者ユーザーになった場合を含む)、`municipalityId` がマスタに無い、担当外または存在しない `region` | `ForbiddenNotice`: 「自治体担当者のみ閲覧できます」と、デモユーザー切替で自治体担当者を選ぶ案内。集計値は表示しない。担当外の地方の存在は示さない一般文言 |
| `invalid_input` | 400 | 日付の形式・範囲(月初・月末でない、`from > to`、12 か月超)、`official` の値の不正。[デモ範囲外] 公式枠ガード(5.6) | FilterBar の該当項目の下に `fields` のメッセージを表示(例: 「期間は 12 か月以内で指定してください」)。直前の集計結果は表示したままにする |
| `method_not_allowed` | 405 | GET 以外のメソッド | 画面からは発生しない |
| `internal` | 500 | 想定外の例外 | 00 の `ErrorNotice`(「問題が発生しました」、再読み込みの案内)。本文に内部情報を出さない |
| `network` | -(クライアント) | 取得の失敗、JSON でない応答 | 00 の `ErrorNotice` と「もう一度試す」(`reload`) |
| (空状態) | 200 | 期間内のデータが無い | 「この期間の実績はありません」。件数のセルは 0、率のセルは「—」 |

- 対象なし(`not_found`)・状態不正(`unavailable_state`)・競合(`conflict`)は発生しない: パスに ID を取らず、状態を変更しないため。他の利用者の操作による変更は次の取得で反映する。

## 13. デモ用のダミーデータ(MUN-DEMO)

集計は 6〜10 人・6〜10 グループの group-seed だけでは K=5 の規則により大半が「少数」になり、画面の確認に必要な件数が足りない。そこで**過去実績(合成)**を 12 が生成して足す。 [案]

- 生成: `features/stats/demo-history.ts` の `buildDemoHistory()`。擬似乱数(mulberry32、種 = `20261109`)による**決定論的**生成。ファイルは持たない(seed.json・group-seed.json に書かない)。
- 対象期間: 固定 `2026-04-01` 〜 `2026-10-31`(7 か月)[案]。活動中データ(group-seed と操作)は 00 の clock の現在日付(00 の `meta.demoNow` = 2026-11-09 [事実、00 第 4.4 節])の前後にあり、同じ集計の対象に含まれる。clock の初期値が 2026-11 以降であることが前提(第 17 章)。
- 規模: 地方 A(`虹帆町`)は月 8 グループ、地方 B(`星凪諸島`)は月 6、地方 C(`鈴風高原`)は月 3〜5(月によって K 未満になり「少数」表示を確認できる)。地方 D(`水琴地方`)は別自治体②の担当(IDOR 試験用)で月 5。自治体①の 3 地方で約 150 グループ(再企画グループを含む)、地方 D を含めて約 190。公式枠は全体の約 20%(地方 A・B に集中)。
- グループ 1 件あたり: 申請 2〜8 件(承認 65%/却下 10%/取り下げ 15%/申請中 10% 程度)、確定 60%/中止 30%(うち締切未達 80%・幹事操作 20%)/募集中 10%、中止のうち 50% が再企画(再企画グループは元と同じ地方に中止の 1〜7 日後に作る。2026-10-31 を超える場合は作らない。再企画の 60% が確定)、確定グループの人数 2〜6(3〜4 人が多い)、スタンプ 0〜4 件(`spotId` は seed の spots から)、参加者の年代帯は 3 区分に分布。
- 参加者: `participantKeys` は不透明な 80 個のキー(`h-000`〜)のプールから割り当て(同じキーが複数グループに出ることで再訪率が出る)。**実在ユーザーとは無関係**。
- 入口別の流入: 月ごとに `direct` 多め、`external`(入口B)、`official`、`invite` を数十件(`EntryFact`)。
- `GroupFact.origin = "demo-history"`。画面に「デモ用の過去実績(合成データ)を含む」と表示する。`includeHistory: false` で無効化できる(試験用)。
- 00 の group-seed との契約: group-seed の Group/JoinRequest/GroupStamp は活動中として 12 のアダプタが読む。履歴との ID 衝突を避けるため、合成履歴の ID は `hist-` 接頭辞(group-seed の ID 形式 `g-001` とは重ならない)。

## 14. 実装タスク(MUN-TASK)

規模は S(半日以内)/M(1 日程度)/L(2 日以上)。前提タスクに他モジュール(00 等)の完了が含まれる場合は括弧で示す。

| ID | タスク | 規模 | 前提 |
|---|---|---|---|
| MUN-TASK-01 | Next.js 16 ドキュメントの残りの確認(静的セグメントと動的セグメントの解決順)。結果を 00 へ共有 | S | なし |
| MUN-TASK-02 | `types.ts`、`config.ts`(K=5、最大 12 か月)、`messages.ts` | S | なし |
| MUN-TASK-03 | `privacy.ts`: `toCountCell`、`toRateCell`、`suppressBreakdown`、`coarseAgeBand` と単体試験(MUN-T-01〜04) | M | 02 |
| MUN-TASK-04 | `municipalities.ts`(ダミー 2 件)と `access.ts`: `resolveScope`(MUN-T-06〜08b) | S | 02、(00: DemoUser.role、municipalityId) |
| MUN-TASK-05 | `query.ts`: `parseStatsQuery`、`monthsBetween`(MUN-T-09〜11) | M | 02、(00: clock、`v.date`) |
| MUN-TASK-06 | `metrics.ts`: `computeStats`(M-01〜M-12、[デモ範囲外] 公式枠ガード)と単体試験(MUN-T-12〜25c) | L | 03 |
| MUN-TASK-07 | `facts.ts`: ストアのアダプタ(Group/Member/JoinRequest/GroupStamp/EntryEvent → GroupFact/EntryFact)。名称差と中止理由の変換(第 4 章) | M | 02、(00、01、03、04、08、11 の項目確定) |
| MUN-TASK-08 | `demo-history.ts`: 決定論的な合成履歴(第 13 章)と試験(MUN-T-26〜27) | M | 02 |
| MUN-TASK-09 | `service.ts`: `getStats`、`collectFacts` の統合 | S | 04、05、06、07、08 |
| MUN-TASK-10 | `app/api/groups/stats/route.ts`: MUN-API-01、エラー変換、`no-store`(MUN-T-05、MUN-T-28〜33) | M | 09、(00: `route()`、AppError、currentUser) |
| MUN-TASK-11 | UI 基盤: `use-stats.ts`、`CellText`、`MetricCard`、`PrivacyNote`、`ForbiddenNotice` | M | 02、10、(00: `useGroupsApi`、`ErrorNotice`) |
| MUN-TASK-12 | `StatsDashboard`+ページ+`FilterBar`。カード 6 枚と地方別表(デモ最小。MUN-T-34〜36) | M | 11、13 |
| MUN-TASK-13 | `RegionTable`、`ChartTableToggle`、`BarList`(分布) | M | 11 |
| MUN-TASK-14 | `TimeSeriesChart`(SVG。系列、マーカー、少数ハッチ、表の代替)(MUN-T-37) | L | 13 |
| MUN-TASK-15 | `FunnelChart` と中止理由内訳 | M | 13 |
| MUN-TASK-16 | AppShell への導線(自治体ロールのみ)の確認・調整。00 側の作業 | S | 12、(00) |
| MUN-TASK-17 | 通し確認: デモシナリオ最終場面(タナカが集計を見る)、IDOR、アクセシビリティ確認(MUN-T-38〜40) | M | 12(14、15、16 は余力) |

推奨順序と最小デモ線: 02 → 03 → 06 →(07、08 並行)→ 09 → 10 → 11 → 13 → 12 → 17(これで B の最小)。01 は 10 の前までに行う。14・15 は余力。16 は 00 側の作業。

## 15. 受け入れ条件・試験項目(MUN-T)

K=5 として記述。共通の準備: 試験用 `GroupFact[]` を直接渡して `computeStats` を呼ぶ(ストア不要)。API の試験は 00 の `resetForTest`・`callRoute` を使う。10 章の試験観点(個人が特定できない、閾値処理、ロール制限、集計値が Store と一致)に対応。

### 15.1 個人非特定の規則(privacy.ts)
| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-01 | `toCountCell(4,5)` / `(5,5)` / `(0,5)` / `(1,5)` | `{few:true}` / `{few:false,value:5}` / `{few:false,value:0}` / `{few:true}` |
| MUN-T-02 | `toRateCell(3,4,5)`(分母 4)、`toRateCell(0,0,5)`(分母 0) | `{kind:"few"}`、`{kind:"none"}` |
| MUN-T-03 | `toRateCell(3,20,5)`、`(4,10,5)`、`(6,10,5)`、`(0,10,5)` | `{kind:"below",percent:25}`、`{kind:"below",percent:50}`、`{kind:"value",percent:60}`、`{kind:"value",percent:0}` |
| MUN-T-04 | `suppressBreakdown([3,8,12,20],5)`、`([3,2,12,20],5)`、`([0,8,12],5)`、`([8,12,20],5)` | `[true,true,false,false]`、`[true,true,false,false]`(2 個以上は追加なし)、`[false,false,false]`、`[false,false,false]` |
| MUN-T-05 | 応答 JSON を文字列化し ID を検索 | `u-\d+`、`g-\d+`、`hist-`、`h-\d+`、表示名、招待コードが含まれない。応答のキー集合が型定義と一致 |

### 15.2 権限(access / API)
| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-06 | 旅行者ユーザーで `GET /api/groups/stats` | 403 `forbidden`。本文に集計値なし |
| MUN-T-07 | Cookie なし(00 の既定ユーザー u-001 = 旅行者として解決される) | 403 `forbidden` |
| MUN-T-08 | 自治体①で `region=<自治体②の地方>`、`region=<存在しない値>` | どちらも 403 `forbidden`(件数・「少数」を含まない)。自治体①の担当地方なら 200 |
| MUN-T-08b | 自治体①で `region` 省略 | `regionTable` に①の担当地方のみ。②の地方の行・値は集計(合計)にも含まれない(合計 = 担当地方の和) |

### 15.3 クエリの検証
| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-09 | `from=2026-04-15`(月初でない) | 400 `invalid_input`、`fields.from` |
| MUN-T-10 | `from=2026-04-01&to=2027-06-30`(15 か月) | 400 `invalid_input`、`fields.to` |
| MUN-T-11 | パラメータなし、clock=2026-11-09 | `meta.query.from=2026-06-01`、`to=2026-11-30`(6 か月) |

### 15.4 指標の計算(computeStats)
共通の fixture F1(全て同一地方・期間内、公式枠なし): 元グループ 10 件(確定 6、中止 4。中止理由は `deadline_unmet` 3、`organizer` 1)、再企画グループ 2 件(中止 4 件のうち 2 件を `replannedFromId` で参照。うち 1 件が確定、1 件が募集中)。申請: 承認 20、却下 5、取り下げ 3、申請中 2。
| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-12 | M-01 | グループ作成数 = 12(再企画グループを含む)。`{few:false,value:12}` |
| MUN-T-13 | M-02 | 申請数 = 30 |
| MUN-T-14 | M-03 承認率 | 20÷(20+5)=80%。`{kind:"value",percent:80}`(取り下げ・申請中は分母外) |
| MUN-T-15 | M-04 実行確定率 | 確定 7(再企画の確定 1 を含む)÷(7+4)=64%。確定数 7 |
| MUN-T-16 | M-05 中止率 | 4÷11=36% だが分子 4<5 のため `{kind:"below",percent:46}`(ceil(5÷11×100))。理由別: `deadline_unmet` 3→few、`organizer` 1→few、`other` 0→0(少数が 2 個のため補完秘匿の追加なし) |
| MUN-T-17 | M-06 再企画率 | 2÷4 → 分母 4<5 のため `{kind:"few"}` |
| MUN-T-18 | M-06 ファネル | 中止 4(few)、再企画 2(few)、再企画後の確定 1(few) |
| MUN-T-19 | M-07 成立人数分布 | 確定 7 グループの人数が `[2,3,3,3,4,4,6]` → 2→1(few)、3→3(few)、4→2(few)、5→0(0)、6→1(few)。少数が複数なので補完秘匿の追加なし |
| MUN-T-20 | M-08 入口別 | EntryFact: direct 12、external 7、official 3、invite 0。少数は official の 1 個だけなので、補完秘匿で少数でない最小の 0 でないセル(external 7)も少数にする → `[12,few,few,0]` |
| MUN-T-21 | M-09 | スタンプ取得 18 件、スポット別グループ数(spot1: 6、spot2: 4、spot3: 3)→ 上位 `[6,few,few]`(少数の行は spotId 昇順)。補完秘匿は少数が 2 個のため追加なし |
| MUN-T-22 | M-11 再訪率 | 確定グループの参加者 = 重複なし 14 人、うち 2 回以上 6 人 → 6÷14=43% `{kind:"value",percent:43}`。分母 3(<5)のとき few |
| MUN-T-23 | M-12 年代帯 | `under30` 6、`30to49` 5、`50plus` 3(few)→ 少数 1 個なので最小の非少数 `30to49`(5)も few → `[6,few,few]`。性別の区分が型にも応答にも存在しない |
| MUN-T-24 | 期間境界 | `confirmedAt=2026-09-30T23:59:59+09:00` は 9 月、`2026-10-01T00:00:00+09:00` は 10 月に入る(JST)。同一グループが 2 つの月に計上されない |
| MUN-T-24b | 確定後の中止 | `confirmedAt` と `canceledAt` が両方ある Group は中止に数え、確定数・成立人数分布に含めない |

### 15.5 公式枠ガード(MUN-RULE-06)[デモ範囲外]
| ID | 入力 | 期待結果 |
|---|---|---|
| MUN-T-25 | `official=official`、スコープ内の公式グループ 2 件・一般 30 件 | 400 `invalid_input`、`fields.official`(公式 2 件は 0 でも K 以上でもない) |
| MUN-T-25b | 同条件で `official=all` | 200(通常の計算。公式 2 件は内訳に出さない) |
| MUN-T-25c | `official=official`、公式 12 件・一般 30 件 | 200。公式 12 件の集計のみ |

### 15.6 デモ履歴(demo-history.ts)
| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-26 | `buildDemoHistory()` を 2 回呼ぶ | 完全に同一の結果(決定論的)。ID は `hist-` 接頭辞で一意 |
| MUN-T-27 | 規模 | 自治体①の 3 地方のグループ数が 150±15(再企画を含む)。地方 C は少なくとも 1 か月が K 未満(「少数」表示の確認用)。地方 A の 7 か月合計は K 以上。再訪率の分母が K 以上 |

### 15.7 API・整合
| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-28 | 活動中ストアに確定グループを 1 件追加(`includeHistory:false`) | 集計値(確定数)が Store の件数と一致 |
| MUN-T-29 | clock を進めて締切超過 → 自動中止(04)が評価された後に再取得 | `canceledAt` を持つグループが中止に集計される。再企画後に再企画率が変わる |
| MUN-T-30 | リセット(00 の `POST /api/demo/reset`)後 | 活動中データが seed に戻り、履歴は不変 |
| MUN-T-31 | 応答ヘッダとルーティング | `GET /api/groups/stats` が本モジュールの Route Handler で処理される(動的セグメントの route に解決されない)。`Cache-Control: no-store` |
| MUN-T-32 | `POST /api/groups/stats` | 405 |
| MUN-T-33 | データが無い期間(履歴より前) | 200。件数のセルは 0、率のセルは `{kind:"none"}`。画面は空状態 |

### 15.8 画面
| ID | 検証 | 期待結果 |
|---|---|---|
| MUN-T-34 | 自治体①でページを開く | カード 6 枚と地方別表が出る。「少数」は文字で表示。モック・合成データ・下限の注意が見える |
| MUN-T-35 | 旅行者でページを開く | `ForbiddenNotice`。集計値が DOM に無い |
| MUN-T-36 | 地方フィルタの選択肢 | 担当地方のみ(他自治体の地方は選べない) |
| MUN-T-37 | グラフと表の同値性 | 各グラフの値が「表で見る」の表と一致。「少数」のセルがグラフでは棒なし+ハッチ+文字 |
| MUN-T-38 | アクセシビリティ | キーボードのみで全操作、グラフに `role="img"`+`aria-label`、色を白黒にしても系列・「少数」を判別できる |
| MUN-T-39 | スマホ幅(375px) | 横スクロールなしでカード・表が読める |
| MUN-T-40 | 静的検査 | 画面文言・`messages.ts` に「相乗り」「マッチング」・恋愛を連想させる語・性別の区分が無い |

## 16. 他モジュールとの契約

### 16.1 12 が呼ぶ(読み取りのみ)
| 先 | 名前 | 用途 |
|---|---|---|
| 00 | `db()`、`currentUser(req)`、`route()`/`ok()`、`AppError`/`forbidden`/`invalidInput`、`requireRole`、`clock.now()`/`clock.nowIso()`、`v.date()`、`useGroupsApi`/`ApiError`、`ErrorNotice` | データ取得、認可、エラー、期間の既定値、年代帯、画面の取得 |
| 01 | Group/GroupMember のフィールド(第 4 章) | M-01、07、10、11、12 |
| 03 | JoinRequest のフィールド | M-02、03 |
| 04 | `confirmedAt`/`canceledAt`/`cancelReason`/`replannedFromId` に相当する項目 | M-04〜06 |
| 08 | GroupStamp のフィールド | M-09 |
| 11 | `EntryEvent` | M-08 |
| 09 | 年代帯のコード(`coarseAgeBand` が解釈) | M-12 |

### 16.2 12 が提供する(呼ばれる側)
| 名前 | 呼び出し元 |
|---|---|
| `GET /api/groups/stats` | 12 の画面のみ |
| `MIN_CELL_COUNT` / `toCountCell`(参考。09 の少人数丸めと値を合わせたい場合に再利用可) | 09(任意) |

### 16.3 他モジュールへの要望(MUN-REQ。他ファイルは編集していない)
| ID | 宛先 | 要望 |
|---|---|---|
| MUN-REQ-00a | 00 | `DemoUser` に `municipalityId?: string` を追加(`role: "traveler" \| "municipal"` は 00 に定義済み)。group-seed に自治体担当者 2 人(第 6.3 節の 2 自治体)を置く |
| MUN-REQ-00b | 00 | `DemoUser.ageBand` の値の確定(00 と 09 でコードが異なる。`coarseAgeBand` は両方を受け付ける)。参照は `db().users.get(id)` を使う |
| MUN-REQ-00c | 00 | `Store` に `entryEvents`(11 用)を追加。デモユーザー切替に自治体担当者を含め、AppShell の導線を自治体ロールのみ表示 |
| MUN-REQ-00d | 00 | clock の初期値を 2026-11 以降(合成履歴の後)にする。現行の `meta.demoNow`(2026-11-09)を維持 |
| MUN-REQ-00e | 00 | 自動試験の実行方式。00 第 9.1 節の Vitest(`npm test`、`@` エイリアスあり)に従う。決定が変わったら 12 へ連絡 |
| MUN-REQ-01 | 01 | Group に `campaign`、`region`、公式枠フラグ、`createdAt` が確実にあること。メンバーの `joinedAt` を持つこと(骨子にあり)。`Group.officialMunicipalityId` は集計では不要だが 11 と整合 |
| MUN-REQ-04 | 04 | Group に実行確定日時、中止日時、中止理由(締切未達と幹事操作を区別できる値)、再企画元のグループ ID を持たせる(docs/design 05 の「実行確定日時、中止日時と中止理由、再企画元のグループID」に対応)。状態名ではなく日時で判定できるようにしたい。確定後の中止があり得る場合、確定日時と中止日時が両方 non-null になりうる。12 は「中止」を優先して扱う(第 3.1 節)ので、04 でもこの扱いを明記してほしい |
| MUN-REQ-03 | 03 | JoinRequest に `createdAt`(申請日時)、`decidedAt`、`status` を持たせる。骨子の「申請日時/判断日時」と一致させる |
| MUN-REQ-08 | 08 | GroupStamp に取得日時と `spotId` を持たせる(骨子は「取得日時」)。グループ中止後の取得記録の扱いを明記 |
| MUN-REQ-11 | 11 | 入口の記録 `EntryEvent { at, campaign, region, channel: "direct"\|"external"\|"official"\|"invite" }` を一覧の着地時に `recordEntry(channel, region)` で store に追記(個人 ID は持たない)。11 骨子に記録の項目が無いため追加が必要 |
| MUN-REQ-09 | 09 | 年代帯のコードの確定。少人数丸めの閾値を K と揃えるか(第 17 章) |

## 17. 設計上の確認事項(矛盾・不足)

1. **状態名のずれ**: 04 骨子は 3〜4 状態(募集中/実行確定/中止/再企画)、docs/design 05 は 7 状態(募集中/最少人数到達/辞退期間/実行確定/実施中/完了/中止)。本書は状態名に依存せず日時で判定する(MUN-REQ-04)。再企画の扱い(状態か印か)は 05 章でも未決。
2. **00 の Store 一覧**に `entryEvents`(11)が無い。00 の Store の拡張が要る(MUN-REQ-00c)。辞退の記録(00 の `withdrawals`)は本書では集計しないため使わない。
3. **README の依存関係図**: 12 は 01、03 のみに依存と書かれているが、実際は 00、04、08、11(と 09 の年代帯)も読む。README の図・表の更新が要る(本書は編集しない)。
4. **05 章の未決「個人を特定しない集計の最小単位」**に対し K=5 を提案(第 5 章)。07 章論点 11・17 の少人数(2〜3 人)丸めは 1 グループ内の概要の話で、本書の K(複数グループの統計)とは単位が異なる。09 の `memberSummary` の閾値と共通にするか [未決]。
5. **非公開グループの集計への算入**: 本書は算入する案。09/01 の公開範囲の方針(非公開は招待コードのみ)と整合するか、自治体に非公開の件数を見せてよいかを確認したい [未決]。
6. **公式枠**: 07 論点 12 は「公式表示は自治体担当者の操作でのみ付く」。12 は公式枠の付与操作を持たない(デモは seed)。自治体ごとの公式枠の帰属(`officialMunicipalityId`)は 11 の未決(#18)に依存。
7. **差分による推測は防げない**(5.6)。ダミーデータのデモでは許容。実運用では集計クエリの制限・ノイズ付加・ヒアリングに基づく K の見直しが要る [未決]。
8. **成果指標の確定**(12 章「計測指標(柱11)の中身」、02 章): 本書の M-01〜M-12 は提案。自治体へのヒアリング(ideas 12 章)で選別が要る。
9. **日時の基準**: 時系列は JST の暦月で切る。00 の `clock` が `+09:00` 付き ISO 8601 を返すこと(00 第 5.3 節の `clock.nowIso`)が前提。
10. **デモの形(12 章 #1)**: 「同行成立中心」でも「集合型イベント中心」でも指標の定義は同じ(Group 基準)。集合型イベントの申込が Group でない場合、集計対象への追加が要る [未決]。
11. **キャンペーン**: 自治体 = 1 キャンペーン(`campaignId`)の前提で `Municipality.campaignId` を持たせた。複数キャンペーン横断は競技範囲外と推定 [推定]。
12. **Next.js 16 の仕様**: 405 の自動応答と `cacheComponents` 下の Route Handler の扱いは確認済み(第 2 章)。静的セグメントと動的セグメントの解決順は未確認 [要確認](MUN-TASK-01)。
13. **README の「骨子の API 名」**: 骨子の `getStats(user, period)` を `getStats(user, query, opts?)` に拡張した(地方・公式枠の追加のため)。

## 18. 未決事項

- 指標の最終採否(M-01〜M-12、02 章)、K の値(5)と丸め方、09 との共通化。
- 非公開グループを集計に含めるか。差分による推測への実運用の対策。
- 自治体ロールの実運用上の認証(デモは Cookie の擬似ロール)。
- 地方の割り当て(第 6.3 節の案。00 の group-seed と自治体の担当範囲の確定後)。
- グラフライブラリを将来採るか(現決定案: 採らない)。

## 19. 実装メモ(デモ範囲)

- 優先度は B(デモ終盤の 1 画面)。最小は MUN-TASK-01〜13 と 17(カード 6 枚と地方別の表。K の規則と権限は省略しない)。時系列・ファネル・分布(TASK-14、15)は余力。
- 作成する主なファイル: `app/src/features/stats/{types,config,messages,privacy,query,municipalities,access,facts,demo-history,metrics,service}.ts`、`features/stats/ui/*.tsx`、`app/src/app/api/groups/stats/route.ts`、`app/src/app/[campaign]/admin/stats/page.tsx`。
- 既存ファイルの変更: なし(AppShell の導線は 00 の作業)。
- 試験: 純粋関数(privacy、query、metrics、demo-history)は 00 の Vitest(`npm test`)で単体試験を書く(`*.test.ts` を同じ階層に置く)。API は `callRoute` による結合試験。画面は通しの手動確認+`npm run build`/`npm run lint`。
