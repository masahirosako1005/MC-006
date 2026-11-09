# 13 観光事業オーナー向け需要見込みと提案

状態の凡例は README に従う([事実]/[推定]/[決定]/[統一]/[案]/[未決]/[要確認])。本書の ID 接頭辞は `INS`(INS-D=データ、INS-P=個人非特定の規則、INS-R=提案ルール、INS-FN=関数、INS-BLD=ビルド時スクリプト、INS-GEN=未来日程の生成、INS-API=API、INS-UI=画面、INS-T=試験、INS-TASK=実装タスク、INS-Q=未決・要判断、INS-C=契約への追加事項)。以下は断りがない限り [案]。「見送り(契約書 16.2)」と記した項目は、メインルートの動作を優先して作り込みを後回しにするもの。

モジュール間で共有する名前・署名・パス・値・状態値は [_unified-contracts.md](_unified-contracts.md)(以下「契約書」)に従う。本書の記述と契約書が食い違う場合は契約書を正とする。契約書に無いもの(本モジュールで新たに必要になるロール、コレクション、seed、ルート)は第 22 章「契約への追加事項」に列挙し、契約書への反映を待つ。本書で [決定 n] と書いたものは、`.work/review.md` のオーナー判断の番号(論点 31〜34 は同 第 13 章)を指す。

## 1. 概要と責務

- 観光事業オーナー(宿泊・飲食・体験・土産などの事業者)に、担当エリアへ「いつごろ・どの年代の旅行者が・どれくらいの人数で来るか」の見込みと、「そのときに提供するとよいサービス」の提案を示す読み取り専用モジュール [決定 31〜33]。
- 見込みは、過去の集計(sample-data のスタンプ取得とアンケートをビルド時に集計した値)に、本アプリのグループ旅行の未来の日程(参加予定の人数と年代帯)を重ねて求める [決定 32]。提案は集計値とルール(条件 → 定型文)で作る。外部 API・LLM は使わない(rule.md: localhost 完結、外部依存なし)。
- 責務:
  1. 観光事業オーナーのロール(`business_owner`)と、事業者の担当エリアによる閲覧範囲の制御(第 3 章)。
  2. ビルド時の集計済みデータの生成(`app/scripts/build-seed.mjs` の拡張。個人レコードを出力しない。第 4 章)。
  3. デモ用の未来の旅行日程 100 件の生成(グループ・メンバー・背景ユーザー。第 5 章)。
  4. 週別・年代帯別・エリア別の来訪見込みの計算(第 6 章)。
  5. 提案ルールの評価と提案カードの生成(第 7 章)。
  6. 観光事業オーナー向けダッシュボード画面(第 11 章)。
- 責務外: 予約・販売・決済、事業者の登録・編集画面、個票の表示、通知の送信、他モジュールの状態の変更(書き込みは一切しない。未来日程は seed として投入するだけで、実行時は読むだけ)。
- 優先度: B(デモ終盤の 1 画面)。最小は第 21 章。

## 2. 既存機能との関係

- 新規。`app/src` に事業者向けの画面・API は無い [事実、`app/src/app` の構成]。
- 既存の `app/scripts/build-seed.mjs` を拡張し、`sample-data/*.csv` から集計済みデータ `app/src/data/insight-aggregates.json` を追加で出力する。既存の出力(`app/src/data/seed.json`)の内容と形は変えない(既存の個人レコードの扱いは INS-Q-01)。
- 未来の旅行日程は、01 の `Group`(契約書 4.2 の形)と同じ形のダミーとして 00 の seed に投入する。生成は新しいスクリプト `app/scripts/build-future-trips.mjs` が行い、`app/src/data/future-trips.json` に書く。00 の seed 読み込み(`group-seed.ts`)がこれを `group-seed.json` と合わせて Store に入れる(INS-C-07)。
- 個人非特定の関数(`toCountCell`、`toRateCell`、`suppressBreakdown`、`coarseAgeBand`、`MIN_CELL_COUNT`)と「少数」の表示部品(`CellText`、`ChartTableToggle`)は 12 のものを再利用する(契約書 10.5 の一本化を守る)。ビルド時スクリプト(Node の `.mjs`)は TypeScript を読み込めないため、同じ規則を `app/scripts/lib/privacy.mjs` に書き、12 の関数と同じ結果になることを試験で確かめる(INS-T-01)。
- ルーティングは契約書 2.1 の方式(リソースごとの `route.ts`、ハンドラは `features/insights/handlers.ts` に 00 の `route()` で包んで置き、`route.ts` は再エクスポートだけ)。

```ts
// app/src/app/api/insights/route.ts
export { getInsightForecastHandler as GET } from "@/features/insights/handlers";
// app/src/app/api/insights/suggestions/route.ts
export { getInsightSuggestionsHandler as GET } from "@/features/insights/handlers";
```

- `/api/insights` の子は静的セグメント `suggestions` だけで、同じ階層に動的セグメントを置かない。`_` で始まるフォルダは作らない(契約書 2.1 の R-1・R-2)。

### 2.1 利用ライブラリ・モジュール

新規に追加するライブラリは無い(契約書 11.1)。

| 名前 | 種別 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | フレームワーク | ページ `/[campaign]/business/insights`、Route Handler 2 本 | MIT | `app/package.json` の 16.4.5 を維持 |
| react / react-dom | ライブラリ | 画面コンポーネント | MIT | 19.3.0 を維持 |
| @mantine/core | UI ライブラリ | `Card`、`SimpleGrid`、`Table`、`Select`、`Badge`、`Alert` | MIT | ^9.7.5 を維持 |
| @tabler/icons-react | アイコン | 提案カードの事業種別アイコン(`aria-hidden`) | MIT | ^3.51.0 を維持 |
| vitest | 試験(devDependency) | 純粋関数・スクリプト・Route Handler の試験。00 が導入する(契約書 11.3) | MIT | 00 が追加する。13 は追加しない |
| typescript / eslint / eslint-config-next | 開発ツール | 型検査、lint | Apache-2.0 / MIT / MIT | 既存を維持 |
| Node.js 標準モジュール(`node:fs`、`node:path`、`node:url`) | 実行環境 | ビルド時スクリプトの入出力(`scripts/` だけで使う。アプリ本体では使わない) | - | Node.js 組み込み(本環境は v24.21.0 [事実]) |
| 00 共通基盤 | 自前モジュール | `db()`、`currentUser`、`clock`、`AppError`、`route()`/`ok()`、`isSlugId`、`lib/datetime.ts`(`addDays`、`daysBetween`、`formatJst`)、`useGroupsApi`、`ErrorNotice`/`LoadingBlock`/`MockBadge`、試験ヘルパー | - | 00 の署名に従う |
| 12 自治体向け集計 | 自前モジュール | `features/stats/privacy.ts`(`toCountCell`、`toRateCell`、`suppressBreakdown`、`coarseAgeBand`)、`features/stats/config.ts`(`MIN_CELL_COUNT`)、型 `CountCell`・`RateCell`・`CoarseAgeBand`、`features/stats/ui/CellText.tsx`・`ChartTableToggle.tsx` | - | 12 の署名に従う(INS-C-10) |

自前で実装するもの:

| 対象 | 理由 |
|---|---|
| 週別の積み上げ棒グラフ(SVG) | 1 種類で足りる。「少数」の表示を 12 と同じ規則で制御するため(グラフライブラリは採らない。契約書 11.1) |
| CSV の読み取り(`split(",")` と見出しの照合) | 既存の `build-seed.mjs` と同じ方式。引用符を含む値が無いことは分析で確認済み [事実、`.work/sample-data-analysis.md` 2 章]。列数が見出しと違う行があれば生成を中止する |
| 擬似乱数(mulberry32) | 未来日程を決定論的に作るのに 10 行程度で足りる。12 と同じ方式 |
| 提案文のテンプレートの差し込み(`{key}` の置換) | 置換する値は集計値とラベルだけで、利用者の入力を差し込まないため、テンプレートエンジンは不要 |

## 3. 利用者とロール

### 3.1 ロールの追加 [決定 31・34]

- サービスの利用者は 4 ロールになる。認証はモックで、00 のデモバーでユーザーを切り替える(既存の仕組み)。

| ロール(`UserRole`) | 画面上の名称 | 主な利用 | 担当範囲の参照先 |
|---|---|---|---|
| `traveler` | 旅行者 | グループ旅行の作成・参加(01〜10) | - |
| `municipal` | 自治体担当 | 公式枠の作成(11)、自治体向け集計(12) | `municipalityId` → `Municipality`(11) |
| `host` | 地元の担い手 | 同行枠の作成(11) | `hostId` → `LocalHost`(11) |
| `business_owner`(追加) | 観光事業オーナー | 需要見込みと提案(13) | `businessId` → `TourismBusiness`(13) |

- 値の名前は契約書の命名(列挙値は snake_case の英小文字)に合わせ `business_owner` とする。
- `DemoUser` に `businessId?: string`(`role = "business_owner"` のとき必須。`TourismBusiness.id`)を加える。
- 未来日程用の背景ユーザー(第 5 章)を区別するため、`DemoUser` に `background?: boolean` を加える。`true` のユーザーは 00 の `listDemoUsers`(デモバーの切替候補)に出さない。それ以外の扱い(Cookie で指定された場合の受理など)は通常のユーザーと同じ。

```ts
// 00 lib/groups-types.ts への追加(INS-C-01)
export type UserRole = "traveler" | "municipal" | "host" | "business_owner";
export interface DemoUser {
  id: Id;
  displayName: string;
  role: UserRole;
  municipalityId?: string;      // role=municipal のとき必須
  hostId?: string;              // role=host のとき必須
  businessId?: string;          // role=business_owner のとき必須。TourismBusiness.id(biz-<slug>)
  background?: boolean;         // 未来日程の背景ユーザー。デモバーの切替候補に出さない
}
```

### 3.2 事業者(`TourismBusiness`。所有 13)

```ts
// features/insights/types.ts
export type BusinessCategory = "lodging" | "food" | "activity" | "souvenir";
export interface TourismBusiness {
  id: string;                  // biz-<slug>(seed のみ。00 の isSlugId("biz", v))
  campaign: string;            // "nttw-demo"
  displayName: string;         // 架空の事業者名。1〜30 字
  category: BusinessCategory;
  regionIds: Id[];             // 担当エリア(02 の Region.id)。1 件以上
}
```

| 事業種別 | 表示名 |
|---|---|
| `lodging` | 宿泊 |
| `food` | 飲食 |
| `activity` | 体験 |
| `souvenir` | 土産 |

- 事業種別は 4 区分に固定する(シンプルな区分。交通・小売などの細分は作らない)。
- 保存先: 00 の Store のコレクション `businesses`(`Repo<TourismBusiness>`、seed のみ。実行時に追加・変更しない)。担当者は `DemoUser.businessId` から引く(事業者側に利用者 ID を持たない。11 の `Municipality` と同じ形)。

### 3.3 デモユーザーと事業者の seed(INS-D-01)

| id | 表示名 | role | 所属 | 年代帯(Profile) | 本人確認 | 用途 |
|---|---|---|---|---|---|---|
| u-013 | カオル | business_owner | `biz-demo-a` | 40s | verified | 観光事業オーナーの主な視点 |
| u-014 | シオリ | business_owner | `biz-demo-b` | 50s | verified | 別の事業者(IDOR 試験用) |

| id | 表示名(架空) | 種別 | 担当エリア |
|---|---|---|---|
| `biz-demo-a` | そよかぜ荘 | `lodging` | `r-suzukaze`、`r-hoshinagi` |
| `biz-demo-b` | 虹帆食堂 | `food` | `r-nijiho` |

- 2 事業者の担当エリアは重ならないようにする(`biz-demo-a` の担当者が `r-nijiho` を指定すると拒否されることを試験する)。`r-mizukoto` はどちらも担当しない。
- `Profile.displayName` は `DemoUser.displayName` と同じ値にする(契約書 3.6)。`Verification` は `verified`、`method: "mock_self_declaration"`。
- 名前・事業者名はすべて架空。実在の店舗名・個人名を使わない。

### 3.4 デモバーとメニュー

- デモバー(00 の CMN-UI-01)のロール表示に「観光事業オーナー」を加える。切替候補は `listDemoUsers` の結果(`background: true` を除く 14 人)。
- AppShell のメニューに「需要見込みと提案」(`/[campaign]/business/insights`)を、`role = "business_owner"` のときだけ表示する(00 の作業。INS-C-13)。メニューの非表示はアクセス制御ではなく、制御は API の認可で行う(第 12 章)。

## 4. 集計済みデータ(ビルド時に生成)

### 4.1 方針(INS-P-01〜03)

- INS-P-01: sample-data の CSV はビルド時スクリプトの中だけで読む。アプリ(`app/src`)と設計書には、集計済みの値だけを置く [決定 33]。出力に含めないもの: ユーザー ID、ユーザー名、メールアドレス、LINE の ID、個々のアンケート回答・自由記述の文章、個別の取得日時、性別、職業、居住地域、6 区分の年代。
- INS-P-02: 年代は 3 区分(`under30` = 10代・20代、`30to49` = 30代・40代、`50plus` = 50代・60代以上)に変換して集計する。12 の MUN-RULE-04 と同じ区分(`CoarseAgeBand`)。6 区分は出力しない(10代が 22 名で少数セルが出るため)。
- INS-P-03: 少数の扱い(K=5)はビルド時に適用し、1〜4 の実数を JSON に残さない(画面での非表示だけでは配布物から値が読めるため)。件数は `CountCell`、率は `RateCell`(12 の型)で出力し、率はビルド時に実数から計算してから丸める(MUN-RULE-03)。内訳に合計が並ぶ表(年代の内訳、満足度の 5 段階、良かった点の 5 択)には補完秘匿(`suppressBreakdown`)を適用する。要望テーマは 1 回答が複数テーマに入る(内訳の和が合計と一致しない)ため補完秘匿を適用しない。エリアの内訳もユニーク人数で和が合計と一致しないため適用しない。

### 4.2 入力と使う列

| ファイル | 使う列(見出しで照合) | 用途 |
|---|---|---|
| `12_スタンプ獲得履歴.csv` | `ユーザID`、`周回`、`スタンプ名`、`獲得日時` | 来訪(スタンプ取得)。週・曜日・時間帯・エリア |
| `13_ユーザー一覧.csv` | `ユーザーID`、`年代` | 年代の付与(結合キーは ID。ID は出力しない)、登録者数 |
| `08_アンケート回答_参加後.csv` | `user_id`、`アンケート①` で始まる列、`アンケート②` で始まる列、`アンケート③` で始まる列 | 満足度、良かった点、要望テーマ |

- 上記以外の列(氏名、メールアドレス、LINE、性別、居住地域、登録時アンケート)は読み込んだ行から取り出さない。
- `獲得日時` はタイムゾーン表記が無いため JST として扱う [推定、分析 2.3]。
- 見出しが見つからない、列数が見出しと違う行がある、年代・満足度・良かった点の値が既知の選択肢に無い場合は、生成を中止して終了コード 1 で終える(fail-fast)。標準出力には件数だけを出し、行の内容を出さない。

### 4.3 集計の単位と期間(INS-D-02)

- 期間: `periodFrom = 2026-10-01`、`periodTo = 2026-10-20`(データの範囲から求める)。
- 打ち切り: `truncatedFrom = 2026-10-16`(この日以降は件数が急減し、抽出の打ち切りとみられる [推定、分析 6 章 2])。スクリプトの定数とする。週別の表(T1)は全期間を出力するが、平常値(第 6 章)には打ち切り前の完全な週だけを使う。曜日別(T2)・時間帯別(T3)は `periodFrom`〜`truncatedFrom` の前日(15 日間)だけを集計する。
- 週: `periodFrom` を起点に 7 日ずつ区切る(W1 = 10/01〜10/07、W2 = 10/08〜10/14、W3 = 10/15〜10/20)。7 日あり、かつ `truncatedFrom` より前に終わる週を `useForBaseline: true` とする(本データでは W1・W2)。
- 来訪: 「同じ利用者・同じ日のスタンプ取得のまとまり」を 1 来訪とする(分析 4 章の定義)。来訪者: 期間内にスタンプを 1 件以上取得したユニークな利用者。
- エリア: スポット → エリア(02 の `Region.id`)の対応をスクリプトの定数 `SPOT_REGION` に置く(既存の `SPOT_META` と同じ場所)。対応は 00 の seed のグループ名と地方の組合せに合わせる(INS-Q-05)。

| spotId | スタンプ名(架空) | エリア(スポット名の括弧内) | `regionId` |
|---|---|---|---|
| 1 | 雪雫の音楽堂 | 鈴風高原 | `r-suzukaze` |
| 2 | 星綾の潮見台 | 星凪諸島 | `r-hoshinagi` |
| 3 | 虹灯りの夜市 | 虹帆町 | `r-nijiho` |
| 4 | 灯雲の石畳通り | 星綴港 | `r-hoshinagi` |
| 5 | 月花の風車丘 | 月灯集落 | `r-mizukoto` |
| 6 | 瑠璃凪の水鏡湖 | 雫森谷 | `r-mizukoto` |
| 7 | 風詠みの灯台 | 白波離島 | `r-hoshinagi` |

### 4.4 集計テーブル(INS-D-03)

分析報告 7.2 の案 T1〜T10 のうち、提案ルール(第 7 章)と画面に使うものだけを確定した。

| # | キー(JSON) | 集計単位 | 値 | 少数・補完秘匿 | 使う所 |
|---|---|---|---|---|---|
| T1 | `visitVolume` | 週(W1〜W3)× エリア(4 地方 + `all`)× 年代(3 区分 + `all`) | `visitors`(ユニーク人数)、`visits`(来訪数) | `visitors` を `toCountCell`。`visitors` が少数なら `visits` も少数。週 × エリアごとに年代の内訳へ補完秘匿 | 平常値(第 6 章) |
| T2 | `weekdayProfile` | 曜日(0=日〜6=土)× 年代(3 区分 + `all`) | `visits`、`days`(集計した暦日の数) | `visits` を `toCountCell`。曜日ごとに年代の内訳へ補完秘匿 | INS-R03、過去の傾向 |
| T3 | `hourProfile` | 時間帯(`night` 0〜5 時、`morning` 6〜10 時、`daytime` 11〜16 時、`evening` 17〜23 時)× 年代(3 区分 + `all`) | `stamps`(取得件数)、`share`(その年代の取得に占める割合) | `stamps` を `toCountCell`(年代のユニーク人数が K 未満なら少数)。`share` は `toRateCell` | INS-R04、過去の傾向 |
| T4 | `participation` | 年代(3 区分 + `all`) | `registered`(登録者)、`stamp3plus`、`stamp7plus`、`lap2`(2 周目の取得者)、`completeRate`(`stamp7plus ÷ registered`) | 件数は `toCountCell`、率は `toRateCell` | INS-R08 |
| T5 | `satisfaction` | 年代(3 区分 + `all`) | `respondents`、`distribution`(`"1"`〜`"5"` の度数)、`satisfiedRate`(4〜5)、`dissatisfiedRate`(1〜2) | 度数に補完秘匿(合計 = `respondents`)。率は `toRateCell` | INS-R05、INS-R07、過去の傾向 |
| T6 | `goodPoints` | 年代(3 区分 + `all`)× 良かった点(5 択) | `respondents`、`share` | 年代ごとに 5 択の内訳へ補完秘匿 | INS-R09 |
| T7 | `requestThemes` | 年代(3 区分 + `all`)× 要望テーマ(9 区分) | `respondents`(延べ)、`share`(その年代の回答者に占める割合)、`dissatisfiedRate`(そのテーマを挙げた回答者のうち 1〜2 の割合) | 件数は `toCountCell`、率は `toRateCell`。補完秘匿は適用しない(INS-P-03) | INS-R01、R05〜R07、過去の傾向 |

- 見送り(契約書 16.2): 分析報告の T4 スポット別の人気、T5 発地(居住地域)、T10 認知経路、月粒度の表。スポット間・発地間の差が小さく(5% 未満)提案に使わないため。将来データが増えた場合に追加する。
- 満足度の対応: 大変満足 = 5、やや満足 = 4、普通 = 3、やや不満 = 2、大変不満 = 1。
- 良かった点の対応: 旅先の交流 = `interaction`、景観・名所 = `scenery`、スタンプ収集 = `stamps`、特典・景品 = `rewards`、特になし = `none`。
- 平均値は出力しない(12 の方針。分布と割合で持つ)。

### 4.5 要望テーマの辞書(INS-D-04)

アンケート③は文章で保持せず、ビルド時に辞書(テーマ → キーワード)で分類した件数だけを出力する(分析 6 章 7)。1 回答が複数のテーマに入ることがある(延べ)。どのキーワードにも当たらない回答は `none`(要望なし・その他)とする。

| テーマ | 表示名 | キーワード(部分一致) |
|---|---|---|
| `guidance` | 案内・標識 | 案内、標識、看板、道順、迷 |
| `transport` | 交通・移動 | 交通、バス、電車、駐車、移動、アクセス |
| `rest` | 休憩 | 休憩、ベンチ、座れ、トイレ |
| `reward` | 特典・景品 | 特典、景品、交換、受け取 |
| `app` | アプリ操作 | アプリ、操作、読み取、読み込 |
| `spot_info` | スポット説明 | 説明、解説、由来 |
| `shops` | 周辺店舗情報 | 店、飲食、食事、土産 |
| `crowd` | 混雑 | 混雑、混ん、行列 |
| `none` | 要望なし・その他 | (どれにも当たらない) |

- キーワードは [案]。実装時に、本データでの分類件数が分析報告 5.5 の値(交通・移動 48、特典・景品 42、案内・標識 33、周辺店舗情報 20、休憩 19、アプリ操作 10、スポット説明 10、混雑 5、要望なし 112、複数テーマ 12)と一致するよう語を調整する(INS-T-05)。調整後の辞書を本表に反映する。
- 辞書と照合する前に、文章を NFC に正規化する。文章・照合結果の文章は出力しない。

### 4.6 出力ファイルの形(`app/src/data/insight-aggregates.json`)

```ts
// features/insights/types.ts(実行時の読み込みと検証に使う)
import type { Id, DateStr } from "@/lib/groups-types";
import type { CountCell, RateCell, CoarseAgeBand } from "@/features/stats/types";

export type AgeKey = CoarseAgeBand | "all";
export type AreaKey = Id | "all";                                   // Region.id
export type HourBand = "night" | "morning" | "daytime" | "evening";
export type GoodPoint = "interaction" | "scenery" | "stamps" | "rewards" | "none";
export type RequestTheme =
  | "guidance" | "transport" | "rest" | "reward" | "app" | "spot_info" | "shops" | "crowd" | "none";
export type Score5 = "1" | "2" | "3" | "4" | "5";

export interface PastWeek { key: string; from: DateStr; to: DateStr; days: number; useForBaseline: boolean }

export interface InsightAggregates {
  schemaVersion: 1;
  meta: {
    source: "sample-data";
    campaign: string;                 // "nttw-demo"
    periodFrom: DateStr;              // "2026-10-01"
    periodTo: DateStr;                // "2026-10-20"
    truncatedFrom: DateStr;           // "2026-10-16"
    weeks: PastWeek[];                // W1〜W3
    minCellCount: number;             // 5
    areas: { regionId: Id; spotIds: number[] }[];   // SPOT_REGION を地方ごとにまとめたもの
  };
  visitVolume: { week: string; area: AreaKey; age: AgeKey; visitors: CountCell; visits: CountCell }[];       // T1
  weekdayProfile: { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; age: AgeKey; visits: CountCell; days: number }[];     // T2
  hourProfile: { hourBand: HourBand; age: AgeKey; stamps: CountCell; share: RateCell }[];                    // T3
  participation: { age: AgeKey; registered: CountCell; stamp3plus: CountCell; stamp7plus: CountCell;
                   lap2: CountCell; completeRate: RateCell }[];                                              // T4
  satisfaction: { age: AgeKey; respondents: CountCell; distribution: Record<Score5, CountCell>;
                  satisfiedRate: RateCell; dissatisfiedRate: RateCell }[];                                   // T5
  goodPoints: { age: AgeKey; option: GoodPoint; respondents: CountCell; share: RateCell }[];                 // T6
  requestThemes: { age: AgeKey; theme: RequestTheme; respondents: CountCell; share: RateCell;
                   dissatisfiedRate: RateCell }[];                                                           // T7
}
```

- 行数の目安: T1 = 3 週 × 5 エリア × 4 年代 = 60、T2 = 28、T3 = 16、T4 = 4、T5 = 4、T6 = 20、T7 = 36。合計 約 170 行、20 KB 程度。静的 JSON として import し、バンドルに含める。
- 生成日時などの変動する値は含めない(同じ入力から同じファイルができ、差分が出ないようにする)。
- 配列の並びは固定(週 → エリア(`meta.areas` の順、`all` は末尾)→ 年代(`under30`、`30to49`、`50plus`、`all`))。

### 4.7 `build-seed.mjs` の拡張(INS-BLD)

| ID | ファイル | 内容 |
|---|---|---|
| INS-BLD-01 | `app/scripts/build-seed.mjs`(既存・拡張) | 既存の `seed.json` の生成の後に、CSV を読んで `buildInsightAggregates` を呼び、`app/src/data/insight-aggregates.json` を書く。I/O だけを持つ |
| INS-BLD-02 | `app/scripts/lib/csv.mjs` | `readCsv(file, requiredHeaders): Record<string,string>[]`。BOM 除去、`split(",")`、見出しで列を引く(前方一致の指定も可)。列数の不一致・見出しの欠落は例外 |
| INS-BLD-03 | `app/scripts/lib/privacy.mjs` | `toCountCell`、`toRateCell`、`suppressBreakdown`(12 の MUN-FN-06〜08 と同じ規則。K は引数)。12 の関数と同じ結果になることを INS-T-01 で確かめる |
| INS-BLD-04 | `app/scripts/lib/insight-aggregate.mjs` | 純粋関数 `buildInsightAggregates({ users, stamps, surveys }, { spotRegion, truncatedFrom, k }): InsightAggregates`。入力は CSV から取り出した最小限の列の配列(ID は結合のためだけに使い、出力に入れない)。`ageBand3(label)`、`hourBandOf(hour)`、`classifyRequestThemes(text)` を含む |

- 実行: `cd app && npm run seed`。`package.json` の `seed` スクリプトを `node scripts/build-seed.mjs && node scripts/build-future-trips.mjs` に改める(INS-C-08)。`npm run build`・`npm run dev` では再生成しない(生成済みの JSON をリポジトリに置く。既存の `seed.json` と同じ運用)。
- 標準出力: `insight-aggregates: visitVolume=60 weekdayProfile=28 ...` の件数のみ。
- 出力の検査(スクリプトの最後に行い、違反があれば書き込まずに終了コード 1): (1) 出力の全ての `CountCell` の値が 0 または K 以上、(2) 出力の JSON 文字列に 7 桁の数字の並びと、入力の見出しのうち個人の列名(`user_id`、`ユーザーID`、`ユーザ名` など)が含まれない。

## 5. 未来の旅行日程(ダミー 100 件)

### 5.1 方針(INS-D-05)[決定 33]

- 01 の `Group`(契約書 4.2 の入れ子の形)と同じ形のグループを 100 件、00 の seed に投入する。メンバー・プロフィール・本人確認・状態遷移の記録も、所有モジュールの型の形で一緒に作る。
- 生成は決定論的(mulberry32、種 `20261113`)。`app/scripts/build-future-trips.mjs` が `app/src/data/future-trips.json` に書く。純粋関数は `app/scripts/lib/future-trips.mjs` の `buildFutureTrips(opts)`(INS-GEN-01)。
- 日付は 00 の `meta.demoNow`(`2026-11-09T09:00:00+09:00`)を基準とした絶対値。スクリプトの定数 `DEMO_NOW` が `group-seed.json` の `meta.demoNow` と一致することを試験で確かめる(INS-T-12)。デモ実施日に合わせて `demoNow` をずらす場合は、定数を変えて再生成する。
- 生成するデータは架空。名前・説明は固定の語彙から組み立て、実在の店舗名・個人名を含めない。sample-data の値(個人の行)は使わない。

### 5.2 ID の範囲(INS-D-06)

| 種類 | ID | 件数の目安 | 備考 |
|---|---|---|---|
| 背景ユーザー(`DemoUser`、`background: true`) | `u-101`〜`u-250` | 150 | `role: "traveler"`。表示名は `旅行者101` の形(架空) |
| `Profile`・`Verification` | 各 userId | 150 ずつ | `ageBand` は 5.4 の分布。`verified` |
| グループ | `g-101`〜`g-200` | 100 | 旅行の開始日の昇順、同日はエリアの順で採番 |
| メンバー | `m-1001`〜 | 約 300 | 幹事を含む |
| 状態遷移の記録(04 の `GroupStatusLog`) | `sl-1001`〜 | 約 250 | 作成と、現在の状態に至る遷移 |
| 公式枠の付帯情報(11 の `Listing`) | 親の groupId | 8 | 1 対 1 の資源 |

- 手書きの seed(`g-001`〜`g-013`、`u-001`〜`u-014` など)と範囲を分ける。00 の `counters` は seed の最大値で初期化されるため、実行時に新しく作るグループは `g-201` から採番される。
- 試験の前提データ(00 の `resetForTest`)は既定で未来日程を含めない(`resetForTest({ futureTrips: true })` のときだけ含める)。他モジュールの試験の期待値(`newId("g")` が `g-014` になること、一覧の件数など)は変わらない(INS-C-07)。

### 5.3 日程とエリアの配分(INS-D-07)

週は月曜始まり(JST)。旅行の開始日が属する週とエリアごとのグループ数を次の表で固定する(合計 100)。連休(11/21〜23、年末年始、1/9〜11)に件数を寄せ、見込みの増減が画面で分かるようにする。

| 開始日の週 | 星凪諸島 `r-hoshinagi` | 鈴風高原 `r-suzukaze` | 虹帆町 `r-nijiho` | 水琴地方 `r-mizukoto` | 計 | 備考 |
|---|---|---|---|---|---|---|
| 11/16〜11/22 | 5 | 3 | 3 | 1 | 12 | 三連休(11/21〜23) |
| 11/23〜11/29 | 2 | 2 | 1 | 1 | 6 | |
| 11/30〜12/06 | 2 | 1 | 2 | 1 | 6 | |
| 12/07〜12/13 | 2 | 2 | 1 | 1 | 6 | |
| 12/14〜12/20 | 2 | 2 | 2 | 0 | 6 | |
| 12/21〜12/27 | 4 | 2 | 3 | 1 | 10 | 冬休みの始まり |
| 12/28〜01/03 | 8 | 5 | 5 | 2 | 20 | 年末年始 |
| 01/04〜01/10 | 5 | 3 | 3 | 2 | 13 | 三連休(1/9〜11) |
| 01/11〜01/17 | 2 | 2 | 2 | 1 | 7 | |
| 01/18〜01/24 | 2 | 2 | 2 | 1 | 7 | |
| 01/25〜01/31 | 2 | 2 | 2 | 1 | 7 | |
| 計 | 36 | 26 | 26 | 12 | 100 | |

- 開始日と日数:
  - 11/16 の週: 70% は 11/21〜11/23(3 日)、残りは週内の月〜金のいずれかから 1〜2 日。
  - 12/28 の週: 開始日 12/29〜12/31、2〜3 日。
  - 01/04 の週: 70% は 1/9〜1/11(3 日)、残りは週内の月〜金から 1〜2 日。
  - その他の週: 週内の月〜土のいずれかから 1〜2 日(終了日は開始日の 0〜1 日後)。
- 行き先(`trip.destination`): そのエリアのスポットのスタンプ名(4.3 の表)から 1 つ。`dateNote` は `""`。
- グループ名: エリアの表示名 + 固定の語(「のんびり散策」「朝市さんぽ」「灯台めぐり」「夜市めぐり」「湖畔の朝」「冬の星空観察」「年末の小旅行」「新年の島歩き」など)。`LIMITS.GROUP_NAME`(30 字)以内。09 の禁止表現に当たらない語だけを使う(INS-T-13)。
- 説明: 固定の短文(例「ゆっくり景色を楽しみたい方の集まりです。」)。タグ: 00 の `meta.tagCatalog` から 1〜2 件。
- 公開範囲: すべて `public`。招待コードは `null`。

### 5.4 人数・年代帯(INS-D-08)

- 定員(`capacity`): 4 が 40%、3 が 20%、5 が 20%、6 が 15%、2 が 5%。最少人数(`lifecycle.minMembers`): 定員 2 のとき 2、それ以外は 2 または 3(各 50%)。
- 背景ユーザー 150 人の年代帯(09 の `AgeBand`): `18-19` 6、`20s` 39、`30s` 33、`40s` 32、`50s` 22、`60s` 15、`70s+` 3。3 区分では `under30` 45(30%)、`30to49` 65(43%)、`50plus` 40(27%)で、過去データの構成(20〜40代が 68%)に近い。
- グループごとに「主な年代」を週別の分布から 1 つ選び、メンバーの 70% を主な年代の背景ユーザーから、30% を全体から選ぶ。

| 週 | `under30` | `30to49` | `50plus` |
|---|---|---|---|
| 11/16 の週、01/04 の週(三連休) | 50% | 30% | 20% |
| 12/28 の週(年末年始) | 20% | 35% | 45% |
| その他 | 30% | 43% | 27% |

- 同じ背景ユーザーの旅行日が重ならないように割り当てる。1 人が幹事になるのは 2 件まで(01 の作成上限 5 件の範囲内)。
- 人数(参加中のメンバー数、幹事を含む): 状態が `recruiting` なら 1〜`minMembers − 1`、それ以外は `minMembers`〜`capacity`。退会・辞退のメンバー(`left`)は作らない。申請(`joinRequests`)・通知・チャットは作らない(メンバーは seed で直接登録したものとする)。

### 5.5 状態と日時(INS-D-09)

状態は旅行の開始月で重みを変えて選ぶ。日時は 04 の規則(`deadlineAt = startOfNextJstDay(deadlineDate)`、`withdrawalEndsAt = deadlineAt + 2 日`、`startDate >= deadlineDate + 3 日`)に合わせ、`demoNow` 時点で 04 の `evaluate` が「変化なし」を返す値にする。

| 状態 | 11 月開始 | 12 月開始 | 1 月開始 | 締切日(`deadlineDate`) | 主な日時 |
|---|---|---|---|---|---|
| `confirmed` | 50% | 25% | 10% | 10/26〜11/05 のいずれか | `withdrawalStartedAt = deadlineAt`、`confirmedAt = withdrawalEndsAt` |
| `withdrawal_period` | 10% | 5% | 0% | 11/08 | `withdrawalStartedAt = 11/09 00:00`、`withdrawalEndsAt = 11/11 00:00` |
| `min_reached` | 20% | 30% | 30% | `max(11/10, startDate − 10 日)` | 遷移の時刻 = 最少人数に達したメンバーの `joinedAt` |
| `recruiting` | 20% | 40% | 60% | 同上 | - |

- `createdAt`: `confirmed` は 10/05〜(締切日 − 3 日)、それ以外は 10/20〜11/08 のいずれか(9:00〜21:00 の時刻)。`updatedAt` は最後の遷移の時刻。メンバーの `joinedAt` は `createdAt` 以後、締切と `demoNow` の早い方より前。
- `lifecycle` の他の項目は 04 の初期値(`null`、`0`、`false`)。`revision` は 1 + 遷移の回数。
- 状態遷移の記録(04 の `GroupStatusLog`): `created`(`from: null`、`actor` = 幹事)を必ず 1 件。`min_reached` 以降は `count_reached`、`withdrawal_period` 以降は `deadline_met`、`confirmed` は `withdrawal_ended` を加える(`actor: "system"`、`effectiveAt = evaluatedAt` = 遷移の時刻)。
- 公式枠(`official: true`): 8 件。`r-mizukoto` 以外のグループから乱数で選び、幹事を `u-009`(`mun-demo-a`)にする。11 の `Listing`(`kind: "official_plan"`、`sponsor: { type: "municipality", id: "mun-demo-a" }`、`approvalMode: "organizer"`、固定の要約・見どころ 1〜2 件、`createdAt` = グループの作成日時)を付ける。公式枠の幹事は旅行日の重なりの制約の対象外とする。
- 見送り(契約書 16.2): 中止・再企画済み・実施中・完了の未来日程、非公開グループ、申請中の申請、元メンバー。主ルートの見込み(第 6 章)に必要な状態の分布だけを作る。

### 5.6 `future-trips.json` の形

```ts
interface FutureTripsSeed {
  schemaVersion: 1;
  generator: { seed: number; demoNow: IsoDateTime };   // 20261113、"2026-11-09T09:00:00+09:00"
  users: DemoUser[];                  // background: true
  profiles: Profile[];                // 09 の形。displayName は users と同じ値、bio は ""、travelPurposes 1〜2 件、realName・contact は null、visibility は 09 の既定値
  verifications: Verification[];      // 09 の形。status "verified"、confirmedAt "2026-10-01T10:00:00+09:00"
  groups: Group[];                    // 01 の形(lifecycle は 04 の形)
  members: GroupMember[];             // 01 の形。role は organizer / member、status は active
  groupStatusLogs: GroupStatusLog[];  // 04 の形
  listings: Listing[];                // 11 の形(公式枠 8 件)
}
```

- 00 の `group-seed.ts` は `group-seed.json` の各コレクションの末尾に、同じ名前のコレクションを連結してから `parseSeed` で検査する(ID の一意性・参照の整合・列挙値)。`future-trips.json` に無いコレクションは連結しない。

## 6. 見込み(需要)の算出

### 6.1 用語

| 用語 | 定義 |
|---|---|
| 対象週 | `clock.today()` の属する週(月曜始まり、JST)から 12 週(`INSIGHT_WEEKS = 12`)。2026-11-09 なら 11/09〜2027-01-31 |
| 平常値(`baseline`) | 過去の完全な週(T1 の `useForBaseline: true`、本データは W1・W2)の来訪者数(ユニーク人数)の平均。エリア × 年代ごと。全ての対象週に同じ値を使う(季節差を反映しない。6.5) |
| 参加予定(`planned`) | 対象週に旅行期間が重なるグループ旅行の参加中メンバー数。状態が `confirmed`・`in_progress` のものを「確定」、`recruiting`・`min_reached`・`withdrawal_period` のものを「未確定」とし、`completed`・`cancelled`・`replanned` は数えない |
| 見込み(`expected`) | 平常値 + 参加予定(少数のセルは加えない。6.3) |
| 増加率 | (見込み − 平常値)÷ 平常値 × 100 の整数(四捨五入)。平常値が少数・0 のときは出さない |

- 参加予定は、手書きの seed・未来日程のダミー・デモ中に作られたグループを区別せず、`db().groups` の全グループから数える。デモでグループを作ったり中止したりすると、次の取得で見込みが変わる。
- 期間の重なり: `trip.startDate <= weekEnd` かつ `trip.endDate >= weekStart`。週をまたぐ旅行は両方の週に数える(週ごとの「その週に滞在する人数」)。
- 年代: メンバーの 09 `Profile.ageBand` を 12 の `coarseAgeBand` で 3 区分にする(公開設定にかかわらず読む。12 と同じ扱い、契約書 7.12)。`Profile` が無いメンバーは数えない。
- 対象のグループ: `campaign` が事業者の `campaign` と同じで、`region` が担当エリア(クエリで 1 エリアを指定した場合はそのエリア)に含まれるもの。公開・非公開を問わない(件数のみ。K=5 を適用。12 と同じ扱い)。

### 6.2 計算式

対象週 w、エリア r、年代 a について:

```
baseline(r, a)  = round( Σ_{W ∈ baselineWeeks} visitors(W, r, a) ÷ |baselineWeeks| )
                  ただし visitors のどれかが少数なら baseline(r, a) は少数
planned(w, r, a) = |{ (g, m) : g は対象のグループ、w と旅行期間が重なる、m は g の参加中メンバー、
                               coarseAgeBand(m の Profile.ageBand) = a }|
expected(w, r, a) = baseline(r, a) + planned(w, r, a) の値(planned が少数なら加えない)
                  ただし baseline(r, a) が少数なら expected(w, r, a) は少数(INS-P-06)
```

- 複数エリア(担当エリアすべて)の値は、エリアごとの値の和とする。平常値の和は、少数のエリアを除いた和とし、除いたエリアがあれば `partial: true` にする。複数のエリアを同じ週に訪れた人は重複して数える(画面に注記)。
- 年代の合計(`all`)の平常値は T1 の `age: "all"` の行を使う。参加予定の合計は年代別の実数の和。
- 参加予定の少数判定は、実数の和を求めてから最後に行う(エリアの和・年代の和の実数に `toCountCell`)。平常値はビルド時に少数判定済みの値から計算する。
- 計算は都度(リクエストごと)。グループ 113 件・対象週 12 週の規模ではキャッシュしない。

### 6.3 少数セルの扱い(INS-P-04〜06)

- INS-P-04: 参加予定・グループ数は `toCountCell(n, K)` で出す(K = 12 の `MIN_CELL_COUNT` = 5)。
- INS-P-05: 週ごとの年代の内訳(3 区分 + 合計)と、確定・未確定の内訳(2 区分 + 合計)には `suppressBreakdown` を適用する。エリア別の表は週ごとにエリアの内訳(+ 合計)へ適用する。
- INS-P-06: 見込みには少数のセルの値を加えない。加えなかったセルがあれば `partial: true` とし、画面は「+少数」を併記する(合計から少数の値を逆算させない)。増加率は加えた値だけで計算する。1 エリア・1 年代のセルで平常値が少数のときは、見込みも少数(`{few:true}`)とし、増加率は出さない。
- 平常値の元データ(T1)は sample-data の人数で、ビルド時に K=5 を適用済み。

### 6.4 計算例(試験 INS-T-20 の前提)

エリア `r-suzukaze`、平常値: `under30` 25(W1 20・W2 30)、`30to49` 40、`50plus` 少数、合計 75。グループ: G1(確定、11/21〜23、`under30` 4 人・`30to49` 1 人)、G2(未確定、11/17、`under30` 2 人・`50plus` 1 人)、G3(中止、数えない)。

| 週 | 年代 | 平常値 | 参加予定(実数 → 表示) | 見込み | 増加率 |
|---|---|---|---|---|---|
| 11/16〜22 | `under30` | 25 | 6 → 6 | 31 | 24% |
| 11/16〜22 | `30to49` | 40 | 1 → 少数 | 40(+少数) | 0% |
| 11/16〜22 | `50plus` | 少数 | 1 → 少数 | 少数 | - |
| 11/16〜22 | 合計 | 75 | 8 → 8 | 83 | 11% |
| 11/23〜29 | `under30` | 25 | 4 → 少数 | 25(+少数) | 0% |
| 11/23〜29 | `30to49` | 40 | 1 → 少数 | 40(+少数) | 0% |
| 11/23〜29 | 合計 | 75 | 5 → 5 | 80 | 7% |

- 11/16 の週の確定・未確定の内訳は 5・3 → 3 が少数のため補完秘匿で 5 も少数。グループ数 2 → 少数。
- `50plus` の見込みは、平常値と参加予定がともに少数のため少数とする(`expected` を `{few:true}`)。

### 6.5 限界の表示(INS-D-10)

画面と API の `limitations` に次の文言を常に出す(`messages.ts` の定数)。

1. 過去のデータは 2026 年 10 月 1 日〜20 日のスタンプラリー参加者の記録です。月・季節による違いは判断できないため、平常値は 10 月の週平均を全ての週に同じ値で使っています。
2. 10 月 16 日以降は記録が少なく(抽出の打ち切りとみられます)、平常値の計算に使っていません。
3. 来訪はスタンプの取得で数えています。スタンプを取得しない来訪者、ラリーに参加していない来訪者は含みません。
4. 参加予定は、本アプリのグループ旅行の参加中メンバーです。募集中のグループを含み、中止・人数の変更で変わります。
5. デモ用の未来の旅行日程(ダミー 100 件)を含みます。
6. 時間帯の傾向は参考値です(深夜の記録が多く、時刻の記録に疑義があります)。
7. アンケートの回答者はスタンプを 3 個以上取得した方だけで、途中でやめた方の声は含みません。
8. 個人が特定できないよう、5 人(件)未満の値は「少数」と表示しています。

## 7. 提案ルール

### 7.1 共通の規則

- 形式: 条件(集計値で判定)→ 定型文。外部 API・LLM は使わない [決定 32]。
- 判定に使うセルが少数(`few`・`below`・`none`)のときは、そのルールを成立させない。
- 割合で判定する場合の分母(回答者・登録者)は `INSIGHT_THRESHOLDS.minDenominator`(30)以上とする。
- 率は整数 %(`RateCell` の `value`)で比較する。四捨五入後の値を使うため、分析報告の小数の値と成否が異なる場合がある(例: 特典・景品の回答割合 14.6% は 15% として扱い、INS-R06 が成立する)。
- 提案文に差し込むのは、集計値(人数・割合・差)、週の日付、エリア名、年代の表示名、テーマの表示名だけ。グループ名・利用者名・ID・自由記述は差し込まない(INS-P-07)。少数のセルは差し込まない。
- 過去の傾向によるルール(INS-R03〜R09)の対象期間は、対象週のうち、対象の年代の見込みが最も多い週とする(同じ値なら早い週)。年代を問わないルールは合計の見込みが最も多い週。見込みが少数の週は選ばない。
- 同じルールで対象の年代が 3 区分すべてになった場合は、1 枚のカードにまとめ、年代を「全年代」とする。
- 過去の傾向(T2〜T7)はキャンペーン全体の集計で、エリア別ではない。カードの根拠にその旨を書く。

### 7.2 しきい値(`features/insights/config.ts`)

```ts
import { MIN_CELL_COUNT } from "@/features/stats/config";   // 12。K = 5

export const INSIGHT_WEEKS = 12;
export const PLANNED_STATUSES = {
  confirmed: ["confirmed", "in_progress"],
  tentative: ["recruiting", "min_reached", "withdrawal_period"],
} as const;
export const INSIGHT_THRESHOLDS = {
  minCell: MIN_CELL_COUNT,          // 判定に使う人数・件数の下限
  minDenominator: 30,               // 割合で判定するときの分母の下限
  forecastIncreasePercent: 20,      // INS-R01
  groupsPerWeekArea: 5,             // INS-R02
  weekendRatio: 1.15,               // INS-R03
  eveningSharePercent: 40,          // INS-R04
  satisfiedGapPoints: 10,           // INS-R05
  themeSharePercent: 15,            // INS-R06
  themeDissatisfiedMultiplier: 2,   // INS-R07
  completeGapPoints: 10,            // INS-R08
  maxCardsPerRule: { R01: 4, R02: 2, other: 2 },
} as const;
```

| 定数 | 値 | 根拠 |
|---|---|---|
| `minCell` | 5 | 集計の下限 K=5 [決定 17]。少数のセルで提案しない |
| `minDenominator` | 30 | 割合が 1 件で 3 ポイント以上動かない規模。分析報告 8 章の共通の前提 [案] |
| `forecastIncreasePercent` | 20 | 平常の 1.2 倍。分析報告 R1 の値。人員・仕込みを増やす判断の目安 |
| `groupsPerWeekArea` | 5 | K と同じ。5 組以上で、グループ向けの席・部屋の準備に意味がある規模 [案] |
| `weekendRatio` | 1.15 | 分析報告 R3 の値。1 日あたりの来訪の差が 15% 以上 |
| `eveningSharePercent` | 40 | 分析報告 R2 の値。時間帯 4 区分の均等(25%)を大きく上回る |
| `satisfiedGapPoints` | 10 | 分析報告 R4 の値 |
| `themeSharePercent` | 15 | 分析報告 R5 の値。回答者の 6〜7 人に 1 人 |
| `themeDissatisfiedMultiplier` | 2 | 分析報告 R6 の値。全体の不満の割合の 2 倍 |
| `completeGapPoints` | 10 | 分析報告 R7 の値 |
| `maxCardsPerRule` | R01 4、R02 2、他 2 | 画面に並ぶカードを 20 枚以内にする(4 + 2 + 2 × 7) |

### 7.3 ルール一覧(INS-R)

分析報告 8 章の R1〜R10 を精査し、9 個に確定した。R1 は未来の見込みに基づく形に改め(INS-R01)、未来の日程から直接求める INS-R02 を加えた。R9(特典の到達率)と R10(認知経路)は見送る(契約書 16.2): R9 はラリーの運営者向けで事業者の行動に結びつきにくく、R10 は分析報告で差が小さく成立しない見込みのため。

| ID | 名称 | 条件 | 事業種別 | 区分 |
|---|---|---|---|---|
| INS-R01 | 来訪増の見込み | 対象週 w・エリア r・年代 a で、増加率 ≥ 20% かつ参加予定 ≥ K(少数でない)。エリアは担当エリアごとに判定する | 全種別 | 未来 |
| INS-R02 | グループ旅行の集中 | 対象週 w・エリア r で、期間が重なるグループ旅行(参加予定の状態)が 5 件以上 | 宿泊・飲食・体験 | 未来 |
| INS-R03 | 週末に多い年代 | T2: 年代 a の週末(土・日)の 1 日あたり来訪数 ÷ 平日の 1 日あたり来訪数 ≥ 1.15 | 飲食・体験 | 過去 |
| INS-R04 | 夕方以降の来訪(参考) | T3: 年代 a の `evening` の `share` ≥ 40% | 飲食・体験 | 過去 |
| INS-R05 | 満足度の低い年代 | T5: 年代 a の `satisfiedRate` が `all` より 10 ポイント以上低い、かつ年代 a の回答者 ≥ 30 | 全種別 | 過去 |
| INS-R06 | 要望の多いテーマ | T7(`age: "all"`): テーマ x(`none` を除く)の `share` ≥ 15%、回答者全体 ≥ 30 | テーマの対応表 | 過去 |
| INS-R07 | 不満につながるテーマ | T7(`age: "all"`): テーマ x の回答者 ≥ 30、かつ `dissatisfiedRate` ≥ T5 の `all` の `dissatisfiedRate` × 2 | テーマの対応表 | 過去 |
| INS-R08 | 全スポットを巡る年代 | T4: 年代 a の `completeRate` が `all` より 10 ポイント以上高い、かつ登録者 ≥ 30 | 宿泊・飲食・土産 | 過去 |
| INS-R09 | 交流を評価する年代 | T6: 年代 a で `respondents` が最大の良かった点が `interaction`(同数は 5 択の順で先のもの)、かつ年代 a の回答者 ≥ 30 | 体験・宿泊 | 過去 |

本データでの成立の見込み(分析報告の集計値による。実装後に INS-T-06 で確認する):

| ID | 見込み | 分析報告の値 |
|---|---|---|
| INS-R01 | 年末年始・三連休の週に成立する見込み(未来日程の配分による) | - |
| INS-R02 | 12/28 の週の `r-hoshinagi`(8 件)・`r-suzukaze`(5 件)・`r-nijiho`(5 件)、11/16 と 01/04 の週の `r-hoshinagi`(5 件)。旅行期間が週をまたぐと件数が増える | 5.3 の表 |
| INS-R03 | `under30` で成立の見込み | 30 歳未満 平日 11.4・週末 13.5(1.18 倍。全 20 日の値)。本書は打ち切り前の 15 日で集計するため値が変わる [要確認] |
| INS-R04 | 3 区分すべてで成立 → 「全年代」の 1 枚 | 各年代のスタンプの 40〜46% が 17 時以降 |
| INS-R05 | `under30` で成立 | 30 歳未満の満足の割合 49%、全体 62%。上位テーマは特典・景品(20%) |
| INS-R06 | 交通・移動、特典・景品で成立 | 17%、15%(14.6% の四捨五入) |
| INS-R07 | 交通・移動、特典・景品で成立。アプリ操作・混雑は回答者が 30 未満のため不成立 | 不満の割合 40%、38%(全体 19%) |
| INS-R08 | `50plus` で成立 | 50 歳以上 47%、全体 36% |
| INS-R09 | `30to49` で成立 | 30〜49 歳は交流・景観の比率が高い |

### 7.4 提案文のテンプレート(`features/insights/messages.ts`)

`{…}` は差し込み。`{期間}` は `formatJst(weekStart, "M月D日")〜formatJst(weekEnd, "M月D日")`、`{年代}` は年代の表示名(「30 歳未満」「30〜49 歳」「50 歳以上」「全年代」)。

| ID | 見出し | 提案内容 |
|---|---|---|
| INS-R01 | {年代}の来訪が増える見込み | 「{期間}は{エリア}で{年代}の来訪が平常時より約 {増加率}% 多い見込みです。受付・案内の人員や、食材・備品の準備を増やしてください。{年代}の要望で多い『{テーマ}』には、{テーマの施策}」(年代の上位テーマが無い・少数のときは 2 文目を省く) |
| INS-R02 | グループ旅行が集中する週 | 「{期間}は{エリア}で {組数} 組のグループ旅行(参加予定 {人数} 人)が予定されています。2〜6 人で使える席・部屋・体験の枠を用意し、グループ単位の予約を受け付けてください。」 |
| INS-R03 | 週末に多い年代 | 「{年代}は平日より週末に多く来訪する傾向があります。週末に{年代}向けの企画やメニューを用意してください。」 |
| INS-R04 | 夕方以降の来訪(参考) | 「{年代}の来訪は 17 時以降が {割合}% を占めます。夕方以降の営業や、夜の体験メニューを検討してください。」 |
| INS-R05 | 満足度を上げる余地がある年代 | 「{年代}の満足の割合は {値}% で、全体より {差} ポイント低い状況です。{年代}の要望で多い『{テーマ}』には、{テーマの施策}」 |
| INS-R06 | 要望の多いテーマ | 「アンケート回答者の {割合}% が『{テーマ}』に関する要望を挙げています。{テーマの施策}」 |
| INS-R07 | 不満につながりやすいテーマ | 「『{テーマ}』を挙げた方の不満の割合は {値}% で、全体({全体}%)の約 {倍率} 倍です。{テーマの施策}」 |
| INS-R08 | 全スポットを巡る年代 | 「{年代}は全スポットを巡る方が多い傾向です。休憩できる場所の案内や、ゆっくり巡るモデルコース、周辺の飲食・土産の情報を用意してください。」 |
| INS-R09 | 交流を評価する年代 | 「{年代}は旅の良かった点に『旅先の交流』を最も多く挙げています。地元の方と話せる体験や、交流の場を企画してください。」 |

テーマの施策と事業種別(INS-R01・R05〜R07 の `{テーマの施策}` と事業種別):

| テーマ | 施策(差し込む文) | 事業種別 |
|---|---|---|
| `guidance` | 「店舗・施設までの道順と、近くのスポットへの行き方を店頭や予約の確認で案内してください。」 | 全種別 |
| `transport` | 「最寄りの駅・バス停からの移動手段と所要時間を案内し、送迎や荷物の預かりを検討してください。」 | 宿泊・体験 |
| `rest` | 「休憩できる席や場所を用意し、案内に明記してください。」 | 飲食・土産 |
| `reward` | 「ラリーの特典と組み合わせた割引や、景品の受け取り場所の案内を検討してください。」 | 土産・飲食 |
| `app` | 「スタンプの取得方法を店頭で案内できるようにしてください。」 | 全種別 |
| `spot_info` | 「周辺スポットの見どころを紹介する資料を用意してください。」 | 体験・宿泊 |
| `shops` | 「周辺の店舗の営業時間や品ぞろえの情報をまとめて案内してください。」 | 飲食・土産 |
| `crowd` | 「混み合う時間帯の予約枠や整理券を検討してください。」 | 全種別 |

### 7.5 提案カードの項目と並び

```ts
export type InsightRuleId = "R01" | "R02" | "R03" | "R04" | "R05" | "R06" | "R07" | "R08" | "R09";
export interface SuggestionCard {
  ruleId: InsightRuleId;
  title: string;                                  // 7.4 の見出し
  period: { weekStart: DateStr; weekEnd: DateStr; label: string };   // 対象期間
  periodBasis: "forecast" | "past_pattern";       // 見込みの週 / 過去の傾向を見込みの最大の週に当てたもの
  ageBand: CoarseAgeBand | "all";                 // 対象の年代
  ageLabel: string;
  regionId: Id | null;                            // 対象エリア。null = 担当エリアすべて
  regionName: string;                             // 「担当エリアすべて」を含む
  expected: CountCell;                            // 見込み人数(対象週・エリア・年代)
  evidence: { label: string; value: string }[];   // 根拠(数値)。例 { label: "平常値(過去の週平均)", value: "25 人" }
  action: string;                                 // 提案内容(7.4 の定型文に値を差し込んだもの)
  categories: BusinessCategory[];                 // 事業種別
  reference: boolean;                             // 参考扱い(INS-R04 のみ true)
}
```

- 根拠の例(INS-R01): 「見込み 31 人」「平常値(過去の週平均) 25 人」「参加予定 6 人」「増加率 24%」。INS-R05: 「満足の割合 49%」「全体 62%」「回答者 30 人以上」「過去の傾向(キャンペーン全体)」。根拠には `CountCell`・`RateCell` を 12 の `CellText` と同じ規則の文字列にしたものを入れる(少数は判定に使わないため現れない)。
- 並び: ルール ID の順 → 対象週の早い順 → 増加率の大きい順。そのうえで、事業者の種別を含むカードを前に出す(安定ソート)。ルールごとの上限(7.2)を超えた分は、並びの後ろから除く。
- カードが 0 枚のときは「表示中の条件では提案はありません」と表示する。

## 8. 個人非特定の規則のまとめ

| ID | 規則 | 適用箇所 |
|---|---|---|
| INS-P-01 | sample-data の個人レコードをアプリ・設計書に持ち込まない。集計値だけを出力する | ビルド時(4.1) |
| INS-P-02 | 年代は 3 区分だけ | ビルド時・実行時 |
| INS-P-03 | K=5 と補完秘匿をビルド時に適用し、1〜4 の実数を JSON に残さない | ビルド時 |
| INS-P-04 | 実行時の人数・件数は `toCountCell` | 6.3 |
| INS-P-05 | 内訳と合計を並べる表には `suppressBreakdown` | 6.3 |
| INS-P-06 | 見込みに少数の値を加えない(`partial`) | 6.3 |
| INS-P-07 | 提案文・根拠・応答に ID・表示名・グループ名・自由記述を含めない | 7.1、第 10 章 |
| INS-P-08 | 絞り込みは担当エリアの 1 エリアか全体の 2 通りだけ。年代・週・状態の任意の組合せによる再集計をクライアントで行わない | 第 10 章 |

- 既知の制約(見送り。契約書 16.2): エリアの指定を変えた複数回の照会の差分、期間の経過による参加予定の変化の差分から、少数の値を推測できる場合がある。デモはダミーデータのため許容する。

## 9. 型定義(`features/insights/types.ts`)

4.6(集計済みデータ)、3.2(事業者)、7.5(提案カード)に加え、次を定義する。

```ts
import type { Id, DateStr, IsoDateTime } from "@/lib/groups-types";
import type { CountCell, RateCell, CoarseAgeBand } from "@/features/stats/types";

export interface InsightQuery { region: Id | null }          // null = 担当エリアすべて

export interface BusinessScope {
  business: TourismBusiness;
  regions: { id: Id; name: string }[];                        // regionIds の順。名前は db().regions
}

export interface ForecastCell {
  baseline: CountCell;            // 平常値(人/週)
  planned: CountCell;             // 参加予定
  expected: CountCell;            // 見込み
  partial: boolean;               // 少数のセルを見込みに加えていない
  increasePercent: number | null; // 増加率(整数)。平常値が少数・0 のとき null
}
export interface WeekForecast {
  weekStart: DateStr; weekEnd: DateStr; label: string;        // label 例 "11月16日〜11月22日"
  total: ForecastCell;
  byAge: { age: CoarseAgeBand; label: string; cell: ForecastCell }[];   // 3 件(under30, 30to49, 50plus)
  plannedByCertainty: { confirmed: CountCell; tentative: CountCell };
  groups: CountCell;              // 期間が重なるグループ旅行の件数
}
export interface AreaWeekRow {
  regionId: Id; regionName: string;
  weeks: { weekStart: DateStr; expected: CountCell; planned: CountCell; partial: boolean }[];
}
export interface PastAgeProfile {
  age: CoarseAgeBand; label: string;
  weekdayPerDay: number | null;   // T2。平日 1 日あたりの来訪数(小数 1 桁)。少数のセルを含むと null
  weekendPerDay: number | null;   // T2。週末
  eveningShare: RateCell;         // T3
  satisfiedRate: RateCell;        // T5
  topRequest: { theme: RequestTheme; label: string; share: RateCell } | null;  // T7。none を除く最大
}
export interface InsightMeta {
  business: { displayName: string; category: BusinessCategory; categoryLabel: string };
  regions: { id: Id; name: string }[];
  query: InsightQuery;
  weekFrom: DateStr; weekTo: DateStr;
  past: { periodFrom: DateStr; periodTo: DateStr; truncatedFrom: DateStr;
          baselineWeeks: { from: DateStr; to: DateStr }[] };
  minCellCount: number;
  includesDemoTrips: boolean;     // 背景ユーザーが Store にいれば true
  generatedAt: IsoDateTime;       // clock.nowIso()
}
export interface InsightForecastResponse {
  meta: InsightMeta;
  weeks: WeekForecast[];          // 12 件
  areaTable: AreaWeekRow[];       // クエリで 1 エリアを指定したときは 1 行
  pastProfile: PastAgeProfile[];  // 3 件
  limitations: string[];          // 6.5
}
export interface InsightSuggestionsResponse { meta: InsightMeta; cards: SuggestionCard[] }

// 実行時の中間表現(応答に出さない)
export interface PlannedFact {
  regionId: Id; startDate: DateStr; endDate: DateStr;
  certainty: "confirmed" | "tentative";
  ages: CoarseAgeBand[];          // 参加中メンバーの年代(Profile が無いメンバーは除く)
}
```

- Store に追加するコレクションは `businesses` だけ(3.2)。集計済みデータは Store に入れず、静的 JSON として読む。

## 10. インターフェース

### 10.1 関数(`features/insights/`。サーバー側の関数はすべて同期)

| ID | ファイル・署名 | 責務 | 例外 |
|---|---|---|---|
| INS-FN-01 | `access.ts` `resolveBusinessScope(user: DemoUser): BusinessScope` | ロールが `business_owner` で、`db().businesses.get(user.businessId)` があることを確認し、担当エリア(名前は `db().regions`)を返す | `forbidden`(`reason: "not_business_owner"`) |
| INS-FN-02 | `query.ts` `parseInsightQuery(sp: URLSearchParams, scope: BusinessScope): InsightQuery` | クエリの検証(10.3) | `invalid_input`(`fields`)、`forbidden`(`reason: "region_out_of_scope"`) |
| INS-FN-03 | `aggregates.ts` `getAggregates(): InsightAggregates` | `insight-aggregates.json` を import し、初回だけ形を検証してモジュール内に保持する。不正なら `Error`(`internal`) | `Error` |
| INS-FN-04 | `weeks.ts` `forecastWeeks(today: DateStr, count: number): { weekStart: DateStr; weekEnd: DateStr }[]` | `today` の週の月曜から `count` 週。00 の `addDays` を使う | なし |
| INS-FN-05 | `facts.ts` `collectPlanned(scope: BusinessScope, query: InsightQuery): PlannedFact[]` | `db().groups`・`members`・`profiles` から対象のグループの参加予定を作る(6.1) | なし |
| INS-FN-06 | `forecast.ts` `computeForecast(input: { agg: InsightAggregates; planned: PlannedFact[]; regions: { id: Id; name: string }[]; weeks: { weekStart: DateStr; weekEnd: DateStr }[]; k?: number }): Pick<InsightForecastResponse, "weeks" \| "areaTable">` | 6.2・6.3 の計算(純粋関数) | なし |
| INS-FN-07 | `forecast.ts` `buildPastProfile(agg: InsightAggregates): PastAgeProfile[]` | 過去の傾向(純粋関数) | なし |
| INS-FN-08 | `rules.ts` `evaluateRules(input: { forecast: Pick<InsightForecastResponse, "weeks" \| "areaTable">; perArea: Pick<InsightForecastResponse, "weeks">[]; agg: InsightAggregates; business: TourismBusiness; regions: { id: Id; name: string }[]; thresholds?: typeof INSIGHT_THRESHOLDS }): SuggestionCard[]` | 第 7 章のルールの評価(純粋関数)。`perArea` は担当エリアごとの週別の見込み(INS-R01・R02 をエリアごとに判定するため) | なし |
| INS-FN-09 | `messages.ts` `fillTemplate(template: string, params: Record<string, string>): string` | `{key}` の置換。未定義のキーは `Error`(プログラムエラー) | `Error` |
| INS-FN-10 | `service.ts` `getInsightForecast(user: DemoUser, query: InsightQuery): InsightForecastResponse` | INS-FN-01 → 03 → 04 → 05 → 06・07 の統合(INS-FN-02 はハンドラで呼ぶ)。`meta.generatedAt` に `clock.nowIso()` | 上記 |
| INS-FN-11 | `service.ts` `getInsightSuggestions(user: DemoUser, query: InsightQuery): InsightSuggestionsResponse` | 見込みを計算してから INS-FN-08 | 上記 |

ビルド時スクリプトの関数(`app/scripts/lib/`):

| ID | 署名 | 責務 |
|---|---|---|
| INS-BLD-04 | `buildInsightAggregates(input, opts): InsightAggregates` | 4.4 の T1〜T7 |
| INS-BLD-05 | `ageBand3(label: string): "under30" \| "30to49" \| "50plus"` | 6 区分の年代の文字列から 3 区分へ。未知の値は例外 |
| INS-BLD-06 | `classifyRequestThemes(text: string): RequestTheme[]` | 4.5 の辞書による分類(重複なし、辞書の順) |
| INS-GEN-01 | `buildFutureTrips(opts: { seed: number; demoNow: string; tagCatalog: string[] }): FutureTripsSeed` | 第 5 章の生成(純粋関数) |

### 10.2 API

| ID | メソッド・パス | 認可 | 応答 |
|---|---|---|---|
| INS-API-01 | `GET /api/insights` | `business_owner` のみ(`currentUser(req)` から判定) | 200 `InsightForecastResponse` |
| INS-API-02 | `GET /api/insights/suggestions` | 同上 | 200 `InsightSuggestionsResponse` |

- 処理の順序: 00 の `route()`(`currentUser`、`beforeRequest` で 04 の `evaluateAll` が先に実行される。契約書 3.5)→ `resolveBusinessScope(c.user)`(ロールが違えば入力検証より先に 403)→ `parseInsightQuery(c.url.searchParams, scope)` → service → `ok(response)`。13 は `evaluateAll` を呼ばない。
- 応答には `Cache-Control: no-store`(00 の `route()`)。データが無い場合も 200(件数 0)。
- GET 以外のメソッドは 405(Next.js が応答)。

### 10.3 クエリの検証

| パラメータ | 型・範囲 | 既定 | 検証(`fields` のキー) |
|---|---|---|---|
| `region` | 地方 ID(`r-<slug>`) | なし(担当エリアすべて) | 形式は 00 の `isSlugId("r", v)`。形式不正は `invalid_input`(`region`)。形式が正しく担当エリアに無い(存在しない地方を含む)ものは `forbidden`(`reason: "region_out_of_scope"`) |

- クエリは strict(契約書 3.4)。`region` 以外のキーは `invalid_input`(`fields.<key>`)。00 の `c.query` を使う。09 の `rejectProhibitedParams` は呼ばない(契約書 3.4)。
- 同じキーが複数あるときは `invalid_input`(`region`)[案]。
- 検証メッセージ(`messages.ts`): `region`「エリアの指定が正しくありません」、未知キー「使用できない条件です」。

## 11. 画面・UI

| 画面 | docs/design 04 章 | パス |
|---|---|---|
| 需要見込みと提案(観光事業オーナー) | 追加(INS-C-15) | `/[campaign]/business/insights` |

- 新設するフォルダは `app/src/app/[campaign]/business/insights/`(静的セグメントのみ。契約書 2.1)。URL の `[campaign]` は共通レイアウト用で、対象は `TourismBusiness.campaign` で決まる。

### 11.1 コンポーネント構成(INS-UI)

```
app/src/app/[campaign]/business/insights/page.tsx   INS-UI-01  ページ(InsightsDashboard を置くだけ)
features/insights/ui/InsightsDashboard.tsx          INS-UI-02  状態管理と全体レイアウト("use client")
features/insights/ui/use-insights.ts                INS-UI-03  取得フック(2 本)
features/insights/ui/AreaSelect.tsx                 INS-UI-04  エリアの選択
features/insights/ui/WeeklyForecastChart.tsx        INS-UI-05  週別の積み上げ棒(平常値・確定・未確定)
features/insights/ui/AgeForecastTable.tsx           INS-UI-06  週 × 年代の表(見込み・参加予定・増加率)
features/insights/ui/AreaForecastTable.tsx          INS-UI-07  エリア × 週の表
features/insights/ui/PastProfilePanel.tsx           INS-UI-08  過去の傾向(年代別)
features/insights/ui/SuggestionList.tsx             INS-UI-09  提案カードの一覧
features/insights/ui/SuggestionCardView.tsx         INS-UI-10  提案カード 1 枚
features/insights/ui/InsightNotice.tsx              INS-UI-11  モック・ダミー・限界・下限の注意
features/insights/ui/InsightForbidden.tsx           INS-UI-12  権限なしの案内
(12 の features/stats/ui/CellText.tsx・ChartTableToggle.tsx を再利用)
```

```ts
// INS-UI-03
export function useInsightForecast(region: Id | null | undefined): {
  data: InsightForecastResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };
export function useInsightSuggestions(region: Id | null | undefined): {
  data: InsightSuggestionsResponse | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };
// 00 の useGroupsApi を包む。region が undefined のときはクエリなし。
// INS-UI-02: state = { region: Id | null }(初期値 null)。変更で両方を再取得する。
// INS-UI-04
interface AreaSelectProps { regions: { id: Id; name: string }[]; value: Id | null; onChange(next: Id | null): void; disabled?: boolean }
// INS-UI-05
interface WeeklyForecastChartProps { weeks: WeekForecast[]; minCount: number }
// INS-UI-06 / 07 / 08
interface AgeForecastTableProps { weeks: WeekForecast[]; minCount: number }
interface AreaForecastTableProps { rows: AreaWeekRow[]; weeks: WeekForecast[]; minCount: number }
interface PastProfilePanelProps { profiles: PastAgeProfile[]; minCount: number }
// INS-UI-09 / 10
interface SuggestionListProps { cards: SuggestionCard[]; ownCategory: BusinessCategory; minCount: number }
interface SuggestionCardViewProps { card: SuggestionCard; own: boolean; minCount: number }
// INS-UI-11
interface InsightNoticeProps { limitations: string[]; minCount: number; includesDemoTrips: boolean }
```

- 画面構成(上から): ①`InsightNotice`(「モック」「デモ用の未来の旅行日程を含む」「5 人未満は少数と表示」。限界の文言 6.5 は折りたたみで全文)②事業者名・事業種別・`AreaSelect`(先頭に「担当エリアすべて」)③提案カード(`SuggestionList`)④週別の見込み(`WeeklyForecastChart` と `ChartTableToggle` による表の切替)⑤週 × 年代の表(`AgeForecastTable`)⑥エリア別の表(`AreaForecastTable`。1 エリア指定時は出さない)⑦過去の傾向(`PastProfilePanel`)。
- 提案カード(`SuggestionCardView`): 見出し、対象期間、対象の年代、対象エリア、見込み人数(`CellText`)、提案内容、根拠(`<dl>`)、事業種別のバッジ。自分の事業種別を含むカードには「あなたの事業種別」のバッジ。`reference: true` のカードには「参考」のバッジと理由(時刻の記録に疑義)。
- 週別のグラフ: 週ごとに平常値・確定・未確定の 3 段の積み上げ棒。少数のセルは 12 と同じく棒を描かず、ハッチと「少数」の文字。増加率が 20% 以上の週は棒の上に「+N%」を文字で表示する(色だけに頼らない)。
- 数値の表示は 12 の `CellText` の規則(少数は「少数」、`partial` は「(+少数)」を併記)。
- スマホ幅: カードは 1 列。表は列を絞る(週 / 見込み / 参加予定)。グラフは幅 100%。横スクロールを出さない。
- デモ最小実装: ①②③④(グラフの代わりに表でも可)。⑤〜⑦は余力。

### 11.2 アクセシビリティ

- グラフは `role="img"` と要約の `aria-label`(見込みが最大の週と人数)を付け、`ChartTableToggle` で同じ値の表(`<caption>`、`<th scope>`)を出す。
- 提案カードは `<article>` と見出し。事業種別・参考のバッジは文字で示す。
- コントラストは WCAG AA を目安にする。アニメーションは付けない。

## 12. 権限

- 認可の根拠はサーバー側で解決した現在ユーザーだけ(`currentUser(req)`、Cookie `demoUser`)。クエリ・ヘッダー・本文で事業者 ID を受け取る口を作らない(IDOR 対策)。
- 判定の順序: ①`role === "business_owner"`(00 の `requireRole` は `reason` を付けないため、13 が `forbidden` + `reason: "not_business_owner"` を自前で返す。12 の `not_municipal` と同じ扱い)②`user.businessId` の `TourismBusiness` が `db().businesses` にある ③`region` の指定があれば担当エリアに含まれる ④`collectPlanned` が担当エリアで絞ってから数える(集計後に隠す方式にしない)。
- 担当外のエリアの見込み(件数・「少数」を含む)を返さない。担当外の `region` は `forbidden`。例外: 過去の傾向(T2〜T7)はキャンペーン全体の集計で、エリアの区別が無い(第 7.1 節。画面に注記)。
- 旅行者・自治体担当・地元の担い手はこの API・画面を使えない(API は `forbidden`、画面は `InsightForbidden`)。観光事業オーナーは他モジュールの機能で特別な権限を持たない(グループの作成・申請などは旅行者と同じ判定で、デモでは別のユーザーに切り替えて操作する)。
- 自治体担当に本機能を見せるかは INS-Q-03。

## 13. 状態遷移

- なし(状態を持たない読み取り専用)。画面の取得状態(loading / loaded / error)だけ。グループの状態(04 の 8 値)は読むだけで、確定・未確定の区分は 6.1。

## 14. 入力検証・セキュリティ(OWASP Top 10 との対応)

| 項目 | 対処 |
|---|---|
| A01 アクセス制御の不備(IDOR) | 第 12 章。事業者・担当エリアは Cookie から解決した現在ユーザーだけで判定する。担当外のエリアは 403 で、件数・「少数」を返さない。担当エリアで絞ってから集計する |
| A02 暗号化の失敗 | 該当なし(秘密情報を扱わない。認証はモック) |
| A03 インジェクション | クエリは `region` だけで、`isSlugId` と担当エリアとの完全一致で検証する。SQL・ファイルパス・`eval` に入力を渡さない。提案文の差し込みは集計値とラベルだけで、利用者の入力を差し込まない。表示は React のエスケープ。`dangerouslySetInnerHTML` を使わない |
| A04 安全でない設計 | 個人レコードをビルド時に集計してから持ち込む(INS-P-01)。K=5 と補完秘匿をビルド時と実行時の出口で適用し、画面では再計算しない。差分による推測は既知の制約(第 8 章) |
| A05 セキュリティの設定ミス | 00 の `route()` が `Cache-Control: no-store`・`X-Content-Type-Options: nosniff` を付ける。全応答に `next.config.ts` の 3 ヘッダー(契約書 11.2。CSP は設けない)。GET 以外は 405 |
| A06 脆弱で古いコンポーネント | 新規の依存を追加しない(2.1) |
| A07 識別と認証の失敗 | デモはログイン不要で、Cookie `demoUser` は利用者が書き換えられる(00 第 7 章)。画面に「モック」と表示する。実運用では事業者の認証が必要(INS-Q-03 の注記) |
| A08 ソフトウェアとデータの整合性の不備 | 生成済みの JSON(`insight-aggregates.json`、`future-trips.json`)はスクリプトで再現でき、試験で形と規則(K、ID の範囲)を検査する。実行時は検証してから使う(INS-FN-03、00 の `parseSeed`) |
| A09 ログと監視の不備 | 応答本文・クエリ・利用者 ID をログに出さない。想定外の例外は 00 の `route()` が `requestId` と例外だけを出す。ビルド時スクリプトは件数だけを出力する |
| A10 SSRF | 該当なし(外部への通信をしない) |

- 禁止表現(09)は利用者の入力を受けないため適用しない。生成するグループ名・説明は固定の語彙で、09 の検査を通ることを試験で確かめる(INS-T-13)。
- 画面文言・`messages.ts` に恋愛を連想させる語、「相乗り」「マッチング」を使わない(INS-T-44)。

## 15. エラー処理

| コード | HTTP | 発生条件 | 画面での表示・挙動 |
|---|---|---|---|
| `forbidden` | 403 | `reason: "not_business_owner"`: ロールが違う(Cookie なし・不正値で既定の旅行者になった場合を含む)、`businessId` が Store に無い。`reason: "region_out_of_scope"`: 担当外・存在しない `region` | `InsightForbidden`:「観光事業オーナーのみ閲覧できます」と、デモバーで観光事業オーナーを選ぶ案内。`region_out_of_scope` は「このエリアの見込みは表示できません」。集計値は表示しない |
| `invalid_input` | 400 | `region` の形式不正、未知のキー、同じキーの重複 | `AreaSelect` の下に `fields` のメッセージ。画面からは通常発生しない |
| `method_not_allowed` | 405 | GET 以外(Next.js が応答) | 画面からは発生しない |
| `internal` | 500 | 想定外の例外、`insight-aggregates.json` の形が不正 | 00 の `ErrorNotice`(再読み込みの案内)。本文に内部情報を出さない |
| `network` | -(クライアント) | 取得の失敗 | 00 の `ErrorNotice` と「もう一度試す」 |
| (空) | 200 | 担当エリアに参加予定が無い | 見込みは平常値だけで表示。提案カードが 0 枚なら「表示中の条件では提案はありません」 |

- `not_found`・`conflict`・`unavailable_state`・`rate_limited` は発生しない(パスに ID を取らず、状態を変えず、頻度制限の対象にしない)。
- ビルド時スクリプトのエラー(CSV の見出しの欠落、列数の不一致、未知の選択肢、出力の検査の違反)は終了コード 1 と、原因の種類と行番号だけのメッセージ(行の内容は出さない)。

## 16. 実装タスク(INS-TASK)

規模は S(半日以内)/ M(1 日程度)/ L(2 日以上)。

| ID | タスク | 規模 | 前提 |
|---|---|---|---|
| INS-TASK-01 | `types.ts`、`config.ts`(7.2)、`messages.ts`(年代・種別・テーマの表示名、テンプレート、限界の文言、検証メッセージ)、`fillTemplate` | S | (12: `privacy.ts`・`config.ts`・型) |
| INS-TASK-02 | `scripts/lib/csv.mjs`・`privacy.mjs`(INS-T-01・02) | S | (00: Vitest) |
| INS-TASK-03 | `scripts/lib/insight-aggregate.mjs` と `build-seed.mjs` の拡張、`insight-aggregates.json` の生成(INS-T-03〜06) | L | 02 |
| INS-TASK-04 | `scripts/lib/future-trips.mjs`・`build-future-trips.mjs`、`future-trips.json` の生成、`package.json` の `seed`(INS-T-10〜15) | M | (00・01・04・09・11 の型が確定していること) |
| INS-TASK-05 | 00 側の統合: `UserRole`・`DemoUser` の追加項目、`SLUG_PREFIXES` に `biz`、`businesses` コレクション、u-013・u-014・`biz-demo-*` の seed、`future-trips.json` の連結、`listDemoUsers` の除外、`resetForTest({ futureTrips })`、02 の `Region.spotAreas`(INS-C-01〜07) | M | 04、(00) |
| INS-TASK-06 | `aggregates.ts`(読み込みと検証)、`weeks.ts`(INS-T-16・17) | S | 01、03 |
| INS-TASK-07 | `access.ts`・`query.ts`(INS-T-30〜36 のうち関数で確認できるもの) | S | 01、05 |
| INS-TASK-08 | `facts.ts`・`forecast.ts`(`collectPlanned`、`computeForecast`、`buildPastProfile`)(INS-T-18〜24) | M | 05、06 |
| INS-TASK-09 | `rules.ts`(`evaluateRules`)(INS-T-25〜29) | M | 08 |
| INS-TASK-10 | `service.ts`・`handlers.ts`・`route.ts` 2 本(INS-T-30〜38) | S | 07、08、09 |
| INS-TASK-11 | UI 基盤: `use-insights.ts`、`InsightNotice`、`InsightForbidden`、`AreaSelect` | S | 01、(00: `useGroupsApi`、`ErrorNotice`、12: `CellText`) |
| INS-TASK-12 | `InsightsDashboard`・ページ・`SuggestionList`・`SuggestionCardView`・週別の表(デモ最小。INS-T-40〜42) | M | 10、11 |
| INS-TASK-13 | `WeeklyForecastChart`(SVG)・`AgeForecastTable`・`AreaForecastTable`・`PastProfilePanel`(INS-T-43) | M | 12 |
| INS-TASK-14 | AppShell のメニューとデモバーのロール表示(00 側の作業) | S | 05 |
| INS-TASK-15 | 通し確認: u-013 で画面を開き、グループを作成・中止して見込みが変わること、IDOR、スマホ幅(INS-T-45〜47) | S | 12、14 |

推奨順序: 01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 09 → 10 → 11 → 12 → 14 → 15(デモ最小)。13 は余力。

## 17. 試験項目(INS-T)

Vitest(`npm test`)。純粋関数は入力を直接渡す。API は 00 の `resetForTest({ futureTrips: true })`・`callRoute`・`fixtures.ts`。ビルド時スクリプトは `scripts/lib/*.mjs` を import して試験する。試験の出力・失敗メッセージに sample-data の行の内容を出さない。

### 17.1 ビルド時の集計(scripts)

| ID | 検証 | 期待結果 |
|---|---|---|
| INS-T-01 | `privacy.mjs` と 12 の `privacy.ts` に MUN-T-01〜04 と同じ入力を渡す | 全て同じ結果(`toCountCell`、`toRateCell`、`suppressBreakdown`) |
| INS-T-02 | `readCsv` に列数が見出しと違う行、見出しの欠落を含む文字列 | 例外。メッセージに行の内容を含まない |
| INS-T-03 | `buildInsightAggregates` を小さな架空の入力(利用者 12 人)で実行 | T1〜T7 の値が手計算と一致。1〜4 のセルは `{few:true}`、年代の内訳に補完秘匿が掛かる。出力に入力の ID・名前が含まれない |
| INS-T-04 | 本データで `npm run seed` | `insight-aggregates.json` の全 `CountCell` の値が 0 または 5 以上。JSON に 7 桁の数字の並びが無い。キー集合が 4.6 の型と一致。`meta.weeks` の W1・W2 が `useForBaseline: true`、W3 が `false`。2 回実行して同一のファイル |
| INS-T-05 | 本データの要望テーマの件数(`age: "all"` の `respondents`) | 分析報告 5.5 の値(交通・移動 48、特典・景品 42、案内・標識 33、周辺店舗情報 20、休憩 19、アプリ操作 10、スポット説明 10、混雑 5、要望なし 112)と一致(辞書の調整の完了条件) |
| INS-T-06 | 本データの集計値で `evaluateRules` の過去のルール(R03〜R09)を評価 | 7.3 の「本データでの成立の見込み」と一致(R03 は打ち切り前の 15 日の値で確認し、異なれば 7.3 を改める) |

### 17.2 未来日程の生成(scripts)

| ID | 検証 | 期待結果 |
|---|---|---|
| INS-T-10 | `buildFutureTrips` を 2 回呼ぶ | 完全に同一の結果 |
| INS-T-11 | 件数と ID | グループ 100 件(`g-101`〜`g-200`)、背景ユーザー 150 人(`u-101`〜`u-250`、全員 `background: true`・`role: "traveler"`)、メンバーは `m-1001` 以降、記録は `sl-1001` 以降。全 ID が 00 の `isId` を満たし、一意 |
| INS-T-12 | 日付 | `DEMO_NOW` が `group-seed.json` の `meta.demoNow` と一致。全グループの `trip.startDate` が 2026-11-16〜2027-01-31、週 × エリアの件数が 5.3 の表と一致 |
| INS-T-13 | 他モジュールの規則との整合 | 00 の `parseSeed` を通る。全グループで 09 の `assertTextAllowed`(名前・行き先・説明・タグ)が deny・review にならない。名前・タグが `LIMITS` 内。メンバー数 ≤ `capacity`、状態が `recruiting` なら参加中 < `minMembers`、それ以外は ≥ `minMembers`。幹事のメンバー行がある。公式枠 8 件は幹事が u-009 で `Listing` があり 11 の `assertListingInvariants` を通る |
| INS-T-14 | 04 との整合 | `clock.freeze(demoNow)` で 04 の `evaluateAll` を実行しても、未来日程のどのグループも状態・`revision` が変わらない |
| INS-T-15 | 割り当て | 背景ユーザー(公式枠の幹事 u-009 を除く)の旅行日が重ならない。1 人が幹事のグループは 2 件以下。`listDemoUsers` に背景ユーザーが含まれない |

### 17.3 見込み・提案(純粋関数)

| ID | 検証 | 期待結果 |
|---|---|---|
| INS-T-16 | `forecastWeeks("2026-11-09", 12)` / `("2026-11-15", 1)` | 11/09〜11/15 から 2027-01-25〜01-31 の 12 件 / 11/09〜11/15(日曜は前の月曜の週) |
| INS-T-17 | `getAggregates` に形の不正な JSON(`schemaVersion` 違い、`CountCell` の値 3) | `Error` |
| INS-T-18 | `collectPlanned` | `cancelled`・`replanned`・`completed` のグループ、担当外のエリア、別キャンペーンを含まない。`left` のメンバーと `Profile` の無いメンバーを数えない。`confirmed`・`in_progress` は確定、他は未確定 |
| INS-T-19 | 週の重なり | 11/21〜23 の旅行が 11/16 の週と 11/23 の週の両方に数えられる。11/15 に終わる旅行は 11/16 の週に入らない |
| INS-T-20 | `computeForecast`(6.4 の例) | 6.4 の表の値。確定・未確定は両方少数、グループ数は少数、`50plus` の見込みは少数 |
| INS-T-21 | 平常値 | W1・W2 の平均(四捨五入)。W3 を使わない。W1 か W2 が少数なら平常値は少数 |
| INS-T-22 | 複数エリア | 担当エリアすべてのときの平常値は少数でないエリアの和で、少数のエリアがあれば `partial: true`。参加予定はエリアの実数の和に `toCountCell` |
| INS-T-23 | エリア別の表 | 週ごとにエリアの内訳へ補完秘匿。応答に担当外のエリアの行が無い |
| INS-T-24 | `buildPastProfile` | 平日・週末の 1 日あたりの来訪数(小数 1 桁)、`topRequest` が `none` を除く最大のテーマ |
| INS-T-25 | INS-R01 の境界 | 増加率 19% → 不成立、20% → 成立。参加予定 4(少数)→ 不成立。平常値が少数 → 不成立。上限 4 枚 |
| INS-T-26 | INS-R02 の境界 | グループ 4 件 → 不成立、5 件 → 成立(提案文に組数と人数)。上限 2 枚 |
| INS-T-27 | INS-R03〜R09 の境界 | 各しきい値のちょうどの値で成立、1 下(R03 は 1.14)で不成立。分母 29 で不成立。3 区分すべて成立 → 「全年代」の 1 枚 |
| INS-T-28 | カードの内容 | 対象期間・年代・エリア・見込み・根拠・提案内容・事業種別がそろう。過去のルールの対象期間は見込みが最大の週。`action`・`evidence` に `u-`・`g-`・`m-`・`biz-` の ID、表示名、グループ名が含まれない |
| INS-T-29 | 並び | 事業種別 `food` の事業者で評価すると、`food` を含むカード群が先、含まないカード群が後になり、それぞれの群の中はルール ID → 週 → 増加率の順を保つ(安定ソート)。ルールごとの上限を超えたカードは含まれない |

### 17.4 API・権限

| ID | 入力 | 期待結果 |
|---|---|---|
| INS-T-30 | 旅行者(u-001)、Cookie なし、自治体担当(u-009)、地元の担い手(u-012)で `GET /api/insights` | すべて 403 `forbidden`、`reason: "not_business_owner"`。本文に集計値なし |
| INS-T-31 | u-013 で `GET /api/insights` | 200。`meta.regions` が `r-suzukaze`・`r-hoshinagi`、`weeks` が 12 件、`areaTable` が 2 行 |
| INS-T-32 | u-013 で `region=r-nijiho`(他の事業者の担当)、`region=r-zzz`(存在しない) | どちらも 403 `region_out_of_scope`(件数・「少数」を含まない) |
| INS-T-33 | u-013 で `region=<script>`、`region=鈴風高原` | 400 `invalid_input`、`fields.region` |
| INS-T-34 | u-013 で `?foo=1` | 400 `invalid_input`、`fields.foo` |
| INS-T-35 | u-014 で `GET /api/insights/suggestions` | 200。`meta.business.category = "food"`。カードの `regionId` は `r-nijiho` か `null` だけ |
| INS-T-36 | `POST /api/insights` | 405 |
| INS-T-37 | 応答の個人情報 | 応答 JSON を文字列化して、`u-\d+`、`g-\d+`、`m-\d+`、`sl-\d+`、`biz-`、背景ユーザーの表示名、グループ名が含まれない。`Cache-Control: no-store` |
| INS-T-38 | 状態変更の反映 | u-013 で取得 → 担当エリアの未来のグループを 04 の操作で中止 → 再取得で該当週の参加予定が減る。00 の `/api/demo/reset` で元に戻る |

### 17.5 画面

| ID | 検証 | 期待結果 |
|---|---|---|
| INS-T-40 | u-013 でページを開く | 注意(モック・ダミー・下限)、事業者名、提案カード、週別の見込みが出る。「少数」は文字 |
| INS-T-41 | 旅行者でページを開く | `InsightForbidden`。集計値が DOM に無い。メニューに導線が無い |
| INS-T-42 | エリアの選択 | 選択肢は担当エリアと「担当エリアすべて」だけ。選ぶと見込みとカードが再取得される |
| INS-T-43 | グラフと表 | グラフの値が表と一致。少数のセルは棒なし+ハッチ+文字 |
| INS-T-44 | 静的検査 | 画面文言・`messages.ts` に「相乗り」「マッチング」・恋愛を連想させる語・性別の区分が無い |
| INS-T-45 | スマホ幅(375px) | 横スクロールなしでカード・表が読める |
| INS-T-46 | アクセシビリティ | キーボードだけで操作できる。グラフに `role="img"` と `aria-label` |
| INS-T-47 | 通し(手動) | デモバーで u-013 に切り替え → メニューから画面 → 年末年始の週に INS-R01・R02 のカードが出る |

- 見送り(契約書 16.2): 差分による推測の試験、性能の試験、時計を戻したときの表示、CSV の引用符を含む値の試験。

## 18. 他モジュールとの関係

### 18.1 依存の向き

| 呼ぶ側 | 呼ばれる側(実行時の import) | 型だけの参照・データの読み取り |
|---|---|---|
| 13 | 00(`db()`、`currentUser`、`clock`、`route()`、`AppError`、`isSlugId`、`lib/datetime.ts`、`useGroupsApi`、共通 UI)、12(`features/stats/privacy.ts`、`features/stats/config.ts`、UI の `CellText`・`ChartTableToggle`) | 01(`Group`、`GroupMember`)、02(`Region`)、04(`GroupStatus`)、09(`AgeBand`、`Profile`)、12(`CountCell`・`RateCell`・`CoarseAgeBand`)。`db()` で `groups`・`members`・`profiles`・`regions`・`businesses`・`users` を読む |

- 13 はどのモジュールからも import されない(画面と API だけ)。12 は 13 を import しないため循環しない(12 → 00・11)。
- 01・04 の未来グループは `db()` で読むだけで、01・04 の関数を呼ばない(状態の評価は 00 の `beforeRequest` で 04 が済ませている)。
- ビルド時スクリプト(`app/scripts/`)はアプリのモジュールを import しない。試験だけが両方を import して突き合わせる(INS-T-01、13、14)。

### 18.2 13 が提供するもの

| 名前 | 利用者 |
|---|---|
| `GET /api/insights`、`GET /api/insights/suggestions` | 13 の画面のみ |
| 型 `TourismBusiness`、`BusinessCategory` | 00(`Store`・`Db` の型、`groups-types.ts` の再エクスポート) |
| `app/src/data/future-trips.json` | 00(seed の連結) |

### 18.3 他モジュールへの要望(他ファイルは編集していない)

第 22 章の INS-C の各項目を、該当モジュールの担当が反映する。

## 19. データの限界(設計への反映)

| 限界(分析報告 6 章) | 本書での扱い |
|---|---|
| 期間が 20 日・1 か月だけ。月・季節の差が分からない | 平常値は全週に同じ値(6.1)。季節の文言を提案に使わない。限界の文言 1 |
| 10/16 以降の件数の減少(打ち切り) | 平常値・曜日・時間帯から除く(4.3)。限界の文言 2 |
| 時刻の品質(0〜5 時が約 18%) | INS-R04 を参考扱い(`reference: true`)。限界の文言 6 |
| 来訪はスタンプ取得で代用 | 「来訪者」の定義を注記。限界の文言 3 |
| 同行者・消費額・宿泊の列が無い | 見込みは人数だけ。消費額・客室数の見込みは出さない |
| アンケート回答者が全員スタンプ 3 個以上(早期の離脱者の声が無い) | 限界の文言 7。満足度のルールの根拠に「回答者はスタンプ 3 個以上の方」と書く |
| 要望は定型文 26 種 | 辞書で分類(4.5)。文章は保持しない |
| スポット・発地・曜日の差が小さい(一様な生成の可能性) | しきい値を超えたときだけ提案する。スポット別・発地別の表は作らない |
| 細かいクロスで少数セルが多発 | 年代 3 区分・週・エリア(4 地方)に限定し、日別・6 区分・性別・職業を持たない |

## 20. 未決・要判断(INS-Q)

オーナーの判断が必要な事項。各項目に最も単純な推奨案を書く。推奨案は本書の設計の前提にしている。

| ID | 論点 | 推奨案 |
|---|---|---|
| INS-Q-01 | 既存の `build-seed.mjs` は、sample-data の実データ 1 名分のユーザー情報(ID・ユーザー名・年代・地域・スタンプと特典の履歴)を `seed.json` の `user`・`history`・`rewardHistory` にそのまま入れている。競技ルール(個人レコードを持ち込まない、実在個人を識別できる情報を使わない)に触れるおそれがある | `build-seed.mjs` を改め、`user` を架空の固定値(ID・名前は架空、年代・地域は選択肢の値)にし、`history`・`rewardHistory` を架空の固定の履歴(spots・rewards の値から組み立てる)にする。既存画面の表示に必要な形は変えない。本モジュールの設計は集計済みデータだけを生成し、この判断に依存しない [未決] |
| INS-Q-02 | データの限界(アンケート回答者の偏り、10/16 以降の減少、時刻の品質)をどこまで提案に使うか | 打ち切り後は使わない、時間帯のルール(INS-R04)は「参考」として残す、アンケートの偏りは注記する(第 19 章)。INS-R04 を出さない選択もあるが、推奨は残す [未決] |
| INS-Q-03 | 自治体担当に本画面を見せるか | 見せない(観光事業オーナーだけ)。自治体は 12 の集計を使う [未決] |
| INS-Q-04 | 未来日程 100 件が 02 の一覧(公開グループ)と 12 の集計(担当地方の活動中データ)に加わる | そのまま加える(一覧・集計の見た目が実際の利用に近くなる)。手書きの seed のグループの見本は ID で直接開く導線(デモの手順書)で補う [未決] |
| INS-Q-05 | スポット → エリア(地方)の対応(02 の `Region.spotAreas` は [未決]) | 4.3 の表(00 の seed のグループ名と地方の組合せに合わせたもの)。02 の seed の `spotAreas` を同じ値にする(INS-C-06) [未決] |
| INS-Q-06 | 平常値に季節差を反映しない | 反映しない(データが 10 月だけ)。12 か月分のデータが得られたら月別の平常値に改める [未決] |

## 21. 実装メモ(デモ範囲)

- 最小: INS-TASK-01〜12、14、15(提案カード、週別の見込み(表でも可)、エリアの選択。K の規則と権限は省略しない)。グラフ・年代別の表・エリア別の表・過去の傾向(INS-TASK-13)は余力。
- 作成する主なファイル: `app/scripts/lib/{csv,privacy,insight-aggregate,future-trips}.mjs`、`app/scripts/build-future-trips.mjs`、`app/src/data/{insight-aggregates,future-trips}.json`(生成物)、`app/src/features/insights/{types,config,messages,aggregates,weeks,access,query,facts,forecast,rules,service,handlers}.ts`、`features/insights/ui/*.tsx`、`app/src/app/api/insights/route.ts`、`app/src/app/api/insights/suggestions/route.ts`、`app/src/app/[campaign]/business/insights/page.tsx`。
- 既存ファイルの変更: `app/scripts/build-seed.mjs`(出力の追加)、`app/package.json`(`seed` スクリプト)。00 側の変更(型、seed、AppShell、デモバー)は 00 の担当が行う。
- 見送り(契約書 16.2): 第 8 章の差分による推測への対策、月別・季節別の平常値、スポット別・発地別の表、分析報告 R9(特典の到達率)・R10(認知経路)のルール、未来日程の中止・完了・非公開・申請中のバリエーション、複数キャンペーン、事業者の登録・編集、提案の保存・既読管理、CSV の引用符への対応、性能の試験。

## 22. 契約への追加事項

契約書(`_unified-contracts.md`)に追記が必要な内容。契約書は本書では編集しない。反映先の節は契約書の現行の番号。

| ID | 反映先 | 追加・変更の内容 |
|---|---|---|
| INS-C-01 | 3.6 DemoUser とロール | `UserRole` に `"business_owner"` を追加(4 ロール)[決定 31]。`DemoUser` に `businessId?: string`(`role = "business_owner"` のとき必須。`TourismBusiness.id`)と `background?: boolean`(未来日程の背景ユーザー。`listDemoUsers` に出さない)を追加。画面上の名称は「観光事業オーナー」 |
| INS-C-02 | 3.2 ID | `SLUG_PREFIXES` に `"biz"` を追加し、形式を `^(r\|mun\|host\|biz)-[a-z0-9-]{1,30}$` にする。採番する ID の接頭辞(`ID_PREFIXES`)は追加しない |
| INS-C-03 | 3.1 Store | コレクション `businesses`(型 `TourismBusiness`、所有 13、ID `biz-<slug>`、seed のみ)を追加。00 の `Store`・`Db`・型の所在一覧にも追加。型の定義は `features/insights/types.ts` |
| INS-C-04 | 2.2 API の一覧、画面のパス | 13: GET `/api/insights`(需要見込み)、GET `/api/insights/suggestions`(提案)。画面 `/[campaign]/business/insights`。`/api/insights` の子は静的セグメントだけ(R-2) |
| INS-C-05 | 3.3 エラー | 新しいエラーコードは作らない。13 の `reason`: `not_business_owner`(`forbidden`)、`region_out_of_scope`(`forbidden`。12 と同じ値) |
| INS-C-06 | 11.4 seed、7.3(地方) | (1) デモユーザー u-013(カオル、`business_owner`、`biz-demo-a`、40s、verified)、u-014(シオリ、`business_owner`、`biz-demo-b`、50s、verified)と、その `Profile`・`Verification`。(2) `businesses` 2 件(`biz-demo-a` そよかぜ荘・宿泊・`r-suzukaze`/`r-hoshinagi`、`biz-demo-b` 虹帆食堂・飲食・`r-nijiho`)。(3) 02 の `regions[].spotAreas` を、`r-suzukaze` = 鈴風高原、`r-hoshinagi` = 星凪諸島・星綴港・白波離島、`r-nijiho` = 虹帆町、`r-mizukoto` = 月灯集落・雫森谷 にする |
| INS-C-07 | 11.4 seed、3.7(試験用の関数)、11.3 | 未来日程(第 5 章): `app/src/data/future-trips.json`(生成物)を 00 の `group-seed.ts` が `group-seed.json` に連結して `parseSeed` で検査する。内容は背景ユーザー `u-101`〜`u-250`(150 人)と `Profile`・`Verification`、グループ `g-101`〜`g-200`(100 件、全て公開、状態は `recruiting`・`min_reached`・`withdrawal_period`・`confirmed`、うち公式枠 8 件)、メンバー `m-1001`〜、`groupStatusLogs` `sl-1001`〜、公式枠の `listings` 8 件。00 の「seed の JSON は手書き」に、生成物の例外として本ファイルを加える。実行時の `newId("g")` は `g-201` から。`resetForTest(opts?: { futureTrips?: boolean })` を追加し、既定は `false`(他モジュールの試験の期待値 `g-014` などは変わらない) |
| INS-C-08 | (新設)静的データ | `app/scripts/build-seed.mjs` を拡張し、`app/src/data/insight-aggregates.json`(集計済みデータ。個人レコードを含まない。K=5 適用済み)を出力する。`app/scripts/build-future-trips.mjs` を新設。`app/package.json` の `seed` を `node scripts/build-seed.mjs && node scripts/build-future-trips.mjs` にする。生成物はリポジトリに置き、`npm run build` では再生成しない |
| INS-C-09 | 10.3 LIMITS | 追加なし(13 は利用者の文字入力を受け付けない)。13 のしきい値・週数は 13 の `config.ts` の定数とする(12 の `config.ts` と同じ扱い) |
| INS-C-10 | 4.6 依存の向き、10.5 少数の扱い | 依存表に「13 → 00、12(`privacy.ts`・`config.ts`・`CellText`・`ChartTableToggle`)。型と `db()` の読み取りは 01・02・04・09・12」を追加。12 の `privacy.ts` は Store を import しない純粋関数のファイルとして公開し続ける。10.5 の「集計の下限は 12 の関数に一本化」に、13 も同じ関数を使うこと、ビルド時スクリプトは同じ規則の `scripts/lib/privacy.mjs` を使い試験で同一性を確かめることを追記 |
| INS-C-11 | 6.1 アクセス判定、7.10 09 | 09 の SAF-RULE-44(Cookie が無効なら管理系の権限を与えない)の対象に `business_owner` を加える。観光事業オーナーは他モジュールで特別な権限を持たない。u-013・u-014・背景ユーザーの `Profile`・`Verification` を seed に置く |
| INS-C-12 | 7.12 12 | 12 の集計の活動中データに未来日程 100 件が加わる(担当地方のもの)。12 の試験は `resetForTest` の既定(未来日程なし)を使う |
| INS-C-13 | 00(画面) | デモバーのロール表示に「観光事業オーナー」。AppShell のメニューに `/[campaign]/business/insights` を `business_owner` のときだけ表示 |
| INS-C-14 | 11.3 fixtures | `BUSINESS_OWNER`(u-013)、`OTHER_BUSINESS_OWNER`(u-014)、`BUSINESSES`(`biz-demo-a`、`biz-demo-b`)を追加 |
| INS-C-15 | 第 12 章 docs/design の更新 | 01・02: 利用者を 4 ロールに(観光事業オーナーを追加)、柱の追加(需要見込みと提案)。04: 画面の追加(`/[campaign]/business/insights`)。05: `TourismBusiness`、集計済みデータ(`insight-aggregates.json`)、未来日程のダミー。07: K=5 の適用範囲に 13 を追加。08: OSS の追加なし。10: 13 の試験観点。README: モジュール一覧に 13、依存図に 13 → 00・12 |
| INS-C-16 | 第 16 章 見送りの範囲 | 13 の見送り: 差分による推測への対策(エリアの切替・期間の経過)、月別・季節別の平常値、スポット別・発地別・認知経路の集計、特典到達率のルール、未来日程の中止・完了・非公開・申請中のバリエーション、事業者の登録・編集、提案の保存、CSV の引用符への対応、性能の試験 |
| INS-C-17 | 第 1 章 | オーナー判断 31〜34(4 ロール、予測の方式、ビルド時の集計と未来日程 100 件、認証モック)の反映先として本章の各節を加える |
