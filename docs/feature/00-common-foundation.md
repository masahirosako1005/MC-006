# 00 共通基盤

状態の凡例: [事実]/[推定]/[決定]/[統一]/[案]/[未決]/[要確認]。docs/design と矛盾する場合は docs/design を正とする。モジュール間で共有する定義は [_unified-contracts.md](_unified-contracts.md)(以下「統一仕様」)を正とし、本書はそれに合わせて改訂した([統一] は統一仕様で確定した事項)。本書の ID 接頭辞は `CMN`(CMN-FN: 関数、CMN-API: API、CMN-UI: 画面部品、CMN-T: 試験、CMN-TASK: 実装タスク、CMN-D: データ)。本書の型・署名は **全モジュールの契約**であり、変更は本書の改訂とあわせて行う(第 14 章)。

## 1. 概要と責務 / 対応する柱
- 全モジュールが使う次の土台を提供する。柱の直接対応なし(全体)。 [案]
  1. インメモリストア(globalThis)とトランザクション相当の排他、ID 採番、リセット
  2. ダミーデータ `group-seed.json`(デモユーザー、グループ、各状態のバリエーション。各モジュールの seed 断片を統合)
  3. 現在ユーザー(Cookie `demoUser` によるデモユーザー切替)
  4. 時計 `clock`(デモ用に日付を進める。試験で固定)
  5. 検証・サニタイズ(自前)、エラー型とレスポンス形式、Route Handler 共通ラッパー(前処理フック `beforeRequest` を含む)
  6. ページネーション・ソート・日時・権限ヘルパー、フックとドメインイベント(`lib/events.ts`)、共通 UI、テスト基盤
- 本モジュールは業務ルール(実行条件、公開範囲、禁止語)を持たない。それらは 04・09 等が持ち、本モジュールは型・共通関数・共通部品だけを置く。エンティティの形は所有モジュールが定義し、00 は基本型・`DemoUser`・Store の枠だけを持つ(統一仕様 3.1)。 [決定(方針)]

## 2. 既存機能との関係
- 並置: 既存 `app/src/lib/server-store.ts`(globalThis `__raundMock`、seed.json から初期化、再起動で初期化)と**同じ方式**の `groups-store.ts` を別ファイル・別キー(`__groupsStore`)で新設する。既存の `/api/v2` モックと `server-store.ts`、`src/lib/api.ts` は**変更しない**。 [案]
- 流用: `seed.json`(campaign、spots、rewards。読み取りのみ)、Mantine・dayjs(クライアント側の表示。Zustand は本モジュールでは使わない。利用ライブラリの一覧は第 10.2)。既存 `api.ts` の `api()` は `body.error` しか保持せず `message`/`fields` を捨てるため、新規に `groups-api.ts` を作る(第 5.9)。
- 既存ファイルの変更は次の 4 つ: `AppShell.tsx`(デモバーの差し込み 1 箇所。CMN-TASK-11)、`package.json`(テスト用 devDependency とスクリプト。CMN-TASK-12)、`eslint.config.mjs`(規則の追加。CMN-TASK-17)、`next.config.ts`(セキュリティヘッダーの追加。CMN-TASK-19。統一仕様 11.2 [決定 2])。
- [事実] 既存コードから読み取れる Next.js 16 の作法: Route Handler の第 2 引数 `ctx.params` は `Promise`。`next.config.ts` は `cacheComponents: true`、`partialPrefetching: true`。
- [事実] `_` で始まるフォルダはルーティングの対象外(Next.js 16.4.5 のガイド `next/dist/docs/01-app/01-getting-started/02-project-structure.md`「Private folders」。統一仕様 2.1 R-1)。[要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)] キャッシュ(`cacheComponents`)と Route Handler の関係、`cookies()` の扱いは実装前に該当ガイドを読む(AGENTS.md 1)。

## 3. 画面・UI
| 画面/部品 | 04 章の項目 | パス・場所 |
|---|---|---|
| デモバー(「デモ用モック」表示、デモユーザー切替、日付表示と「日付を進める」、リセット) | UI 方針「モックを画面上で明示」 | `AppShell` のヘッダ直下に常時表示(`components/groups/common/DemoBar.tsx`) |
| 共通 UI(ErrorNotice、LoadingBlock、StatusBadge、MockBadge) | 06 章(原因と次の行動) | `components/groups/common/` |

### 3.1 DemoBar(CMN-UI-01)
- 表示: 左に `MockBadge`(「モック」)、現在ユーザー名(`displayName`)とロール(旅行者/自治体担当/地元の担い手)、右に「日付: 2026-11-09」。年代帯・地方は 09 の `Profile` に移ったため DemoBar には出さない。 [案]
- 操作: ユーザー選択(Mantine `Select`、選択肢は `GET /api/demo/users`)→ `POST /api/demo/me` → 成功したら `window.location.reload()`(画面全体のデータを取り直す。クライアント側にキャッシュを持たないため、この方式が最も単純。 [案])。「日付を進める」(+1 日、+3 日、+7 日)→ `POST /api/demo/clock` → reload。「デモを初期化」(確認ダイアログ付き)→ `POST /api/demo/reset` → reload。
- props: なし(自己完結)。state: `me`(`useGroupsApi<MeResponse>("/api/demo/me")`。`MeResponse` は第 4.2)、`users`、`busy`、`error`。操作が失敗したときは再読み込みせず、`error` を DemoBar 内の `ErrorNotice` で表示する。
- `DEMO_TOOLS=off` のとき `GET /api/demo/me` は `tools: false` を返し、DemoBar は「モック」表示のみとし操作を隠す。

### 3.2 共通 UI の方針(CMN-UI-02〜06)
| ID | 部品 | props | 方針 |
|---|---|---|---|
| CMN-UI-02 | `ErrorNotice` | `error: ApiError \| Error \| null`, `onRetry?: () => void`, `backHref?: string`, `backLabel?: string` | Mantine `Alert`(`role="alert"`)。見出し=原因(`message`)、本文=次の行動(`code` ごとの定型の助言。下表)、`fields` があるときは項目別の一覧を出す。`onRetry` があれば「もう一度試す」。`internal` と `network` には「画面を再読み込み」「デモを初期化」の案内を足す(06 章の未決の暫定)。`not_found`/`forbidden` は `backHref`(既定: グループ一覧)への導線。`ApiError` 以外の `Error` は `internal` として表示する。`reason` による文言の出し分けは各モジュールの画面が行う(`ErrorNotice` はサーバーの `message` をそのまま出す) |
| CMN-UI-03 | `LoadingBlock` | `lines?: number`(既定 3), `label?: string` | Mantine `Skeleton` を行数分。`aria-busy="true"`、`aria-label`(既定「読み込み中」)。画面全体のスピナーは使わない |
| CMN-UI-04 | `StatusBadge` | `kind: "group" \| "joinRequest"`, `value: string`, `label: string`, `size?: "sm" \| "md"` | 状態の見た目(色)を一元化(下表)。表示名は呼び出し側が渡す(グループは 04 の `statusLabel(status)`、申請は 03 の文言)。00 は上位モジュールを import しないため、ラベルを自前で持たない。色だけで区別せず**必ずテキストを併記**。未知の値は例外にせず、灰色で `label` を表示する。グループの状態は 04 の `GroupStatusBadge({ status, full?, size? })`(本部品に `kind="group"` と `statusLabel(status)` を渡す薄い部品。`size` はそのまま渡す)を 02・05〜08 の画面が使い、03 は申請の状態に本部品を `kind="joinRequest"` で使う(統一仕様 4.1) |
| CMN-UI-05 | `MockBadge` | `label?: string`(既定「モック」) | 本人確認・通知・決済相当など実在しない機能に付ける。DemoBar と各モック機能で共用 |
| CMN-UI-06 | `useFormErrors` | `(err: unknown) => { fields: Record<string,string>; general: string \| null }` | `ApiError.fields` を各入力欄の `error` に渡す形へ変換する。`fields` が無いときは `message` を `general` に入れる |

`ErrorNotice` の `code` 別助言(06 章の「原因と次の行動」)[案]:

| code | 見出しの既定 | 次の行動 |
|---|---|---|
| invalid_input | 入力内容を確認してください | 項目ごとの指摘を直して再送信 |
| forbidden | この操作はできません | 権限の説明(幹事のみ等)と戻る導線 |
| not_found | 見つかりませんでした | 一覧へ戻る(非公開・存在しないを区別しない) |
| conflict | 状況が変わったため実行できません | 画面を更新して最新の状態を確認 |
| unavailable_state | 現在の状態では実行できません | `detail.allowedActions` があれば「できる操作」を列挙(例: 再企画) |
| rate_limited | 操作の回数が上限に達しました | 時間をおいて再試行。`detail.retryAfterSec` の秒数の表示は見送り(統一仕様 16.2。見送り中は `message` だけを表示する) |
| blocked | 操作できません | ブロックの有無を示さない一般的な文言のみ(09 に従う) |
| internal / network | 問題が発生しました | 再読み込み、デモ初期化 |

`StatusBadge` の色の対応表(色は `StatusBadge.tsx` の定数。表示名は参考で、正はグループが統一仕様 10.1・04 の `statusLabel`、申請が 03 の文言) [案]:

| kind | value | 表示名(参考) | Mantine color |
|---|---|---|---|
| group | recruiting | 募集中 | blue |
| group | min_reached | 最少人数到達 | teal |
| group | withdrawal_period | 辞退期間 | yellow |
| group | confirmed | 実行確定 | green |
| group | in_progress | 実施中 | cyan |
| group | completed | 完了 | gray |
| group | cancelled | 中止 | red |
| group | replanned | 再企画済み | grape |
| joinRequest | pending | 申請中 | blue |
| joinRequest | approved | 承認 | green |
| joinRequest | rejected | 見送り | gray |
| joinRequest | withdrawn | 取り下げ | gray |
| joinRequest | expired | 受付終了 | gray |

- 「却下」の画面表記は「見送り」とする案を 03 に要望する(断りを穏当な表現で伝える 06 章の方針 [案]。内部値は `rejected`。R-03-1)。
- 禁止: `dangerouslySetInnerHTML` の使用(eslint `react/no-danger` を error にする。CMN-TASK-17、CMN-T-36)。

## 4. データ

### 4.1 ファイル・ディレクトリ(本モジュールが作るもの)
パスは `app/` からの相対。 [案]

```
app/
  vitest.config.ts                          テスト設定(CMN-TASK-12)
  next.config.ts                            (既存)headers() を追加(CMN-TASK-19)
  .data/                                    (任意。見送り)永続化ファイル。.gitignore に追加(CMN-TASK-15)
  src/
    data/group-seed.json                    ダミーデータ(手書き。各モジュールの断片を統合。第 4.4)
    lib/
      groups-types.ts                       基本型、DemoUser、UserRole、共通 DTO、各モジュールの型の再エクスポート(第 4.2)
      errors.ts                             AppError、エラーコード、toResponse(第 5.4)
      messages.ts                           共通の利用者向け文言(検証メッセージ等。第 5.4)
      ids.ts                                ID 接頭辞、newId、isId、isSlugId、newToken(第 5.1)
      datetime.ts                           ISO 8601 / JST 日付ヘルパー、formatJst(第 5.11)
      limits.ts                             文字数・件数・範囲の共通上限(第 4.3)
      validation.ts                         検証 DSL `v`、parse、sanitizeText(第 5.10)
      groups-store.ts                       ストア本体、Repo、tx、resetStore(第 5.1)
      group-seed.ts                         seed の読み込み・検証(parseSeed)
      clock.ts                              時計(第 5.3)
      current-user.ts                       Cookie 解決(第 5.2)
      authz.ts                              権限ヘルパー(第 5.7)
      api-route.ts                          Route Handler 共通ラッパー、ok/created/noContent(第 5.5)
      query.ts                              parsePage/paginate、parseSort/sortBy(第 5.6)
      hooks.ts                              beforeRequest/afterClockChange/afterReset フック登録(第 5.8)
      events.ts                             ドメインイベント emit/on(第 5.12)
      groups-api.ts                         クライアント fetch、ApiError、useGroupsApi(第 5.9)
    features/
      bootstrap.ts                          各モジュールのフック・イベント購読の登録を import する 1 行集約(第 5.8)
    app/api/demo/
      me/route.ts   users/route.ts   clock/route.ts   reset/route.ts
    components/groups/common/
      ErrorNotice.tsx  LoadingBlock.tsx  StatusBadge.tsx  MockBadge.tsx  DemoBar.tsx  useFormErrors.ts
    test/
      setup.ts  helpers.ts  fixtures.ts     テスト基盤(第 9.1)
    **/*.test.ts                            単体・結合試験(同じ階層に置く)
```

- 状態の表示名は 04 の `statusLabel` に一本化したため、00 は `features/groups/labels.ts` を作らない(統一仕様 4.1)。
- ルーティング [統一](統一仕様 2.1): **Route Handler は `[...path]` のキャッチオールではなくリソースごとの `route.ts`** とする(12 モジュールが並行で別ファイルを作れ、マージ競合が出ないため)。各モジュールは `features/<m>/handlers.ts` に `route()` で包んだハンドラを置き、`app/api/.../route.ts` は再エクスポートだけを書く(第 5.5 の例)。ハンドラ登録表・ディスパッチャは作らない。
- 複数モジュールを合成するハンドラ(グループの作成 `POST /api/groups` と詳細 `GET /api/groups/[groupId]`)は、合成層 `features/groups/compose/handlers.ts`(所有 01)に置く。合成層は 01・02・04・09 を import してよいが、どのモジュールからも import されない。`route.ts` は合成層のハンドラも再エクスポートだけで書く [統一](統一仕様 2.1、4.6)。
- 動的セグメント名はグループが `[groupId]`、子資源は `[requestId]`、`[itemId]`、`[messageId]`、`[expenseId]`、`[photoId]`、`[userId]`。`[id]` は使わない。次の 2 規則を全モジュールに適用する。
  - R-1: `_` で始まるフォルダを作らない(第 2 章の [事実])。デモ用 API は **`/api/demo/*`** に置く(README・骨子の `/api/groups/_reset` は使わない)。
  - R-2: 本機能で新設するフォルダでは、同じ階層に静的セグメントと動的セグメントを並べない(Next.js の解決順に依存しないため。解決順は実装着手時に確認するが、結果にかかわらず設計は変わらない。統一仕様 14.2)。既存のフォルダ(`app/src/app` 直下の `api` と `[campaign]`、`[campaign]` 直下の既存画面)は対象外で、変更しない。新設するフォルダを既存の動的セグメントの下(`[campaign]/groups` など)に置くことは R-2 に反しない [統一](統一仕様 2.1)。
- API のパスの一覧は統一仕様 2.2 が正。00 が所有するのは `/api/demo/me`、`/api/demo/users`、`/api/demo/clock`、`/api/demo/reset`。`/api/demo/reports` は 09 が所有する(`demoOnly`)。

### 4.2 型定義(`src/lib/groups-types.ts`)と型の所在一覧
00 が定義するのは基本型、`DemoUser`・`UserRole`、共通 DTO だけ。エンティティの形は所有モジュールの `features/<m>/types.ts` が定義し、`groups-types.ts` はそれを `export type` で再エクスポートする(実行時の依存は作らない)。型の変更は所有モジュールの設計書の改訂で行う。 [統一](統一仕様 3.1)

```ts
// ---- 基本型 ----
export type Id = string;            // "g-001" 形式。ids.ts の接頭辞表に従う。seed で決める ID は "r-<slug>" 等(第 4.3)
export type DateStr = string;       // "YYYY-MM-DD"(JST の暦日)
export type IsoDateTime = string;   // ISO 8601 オフセット付き。例 "2026-11-09T09:00:00+09:00"
export { ID_PREFIXES, SLUG_PREFIXES } from "./ids";   // 定義は ids.ts(第 5.1)
export type { IdPrefix, SlugPrefix } from "./ids";

// ---- ユーザー(所有: 00。プロフィールは 09 の Profile、本人確認は 09 の Verification) ----
export type UserRole = "traveler" | "municipal" | "host";  // municipal=自治体担当者、host=地元の担い手
export interface DemoUser {
  id: Id;                       // "u-001"
  displayName: string;          // 1〜20 字。架空の名(ひらがな/カタカナの名のみ)
  role: UserRole;
  municipalityId?: string;      // role=municipal のとき必須。Municipality.id(mun-<slug>)
  hostId?: string;              // role=host のとき必須。LocalHost.id(host-<slug>)
}

// ---- 共通 DTO(00 の API・クライアント・他モジュールの一覧が使う) ----
export interface Page<T> { items: T[]; total: number; limit: number; offset: number; hasMore: boolean; }
export interface CursorPage<T> { items: T[]; nextCursor: string | null; }   // 時系列の追記型(06 チャット、10 通知)のみ
export type DemoUserSummary = Pick<DemoUser, "id" | "displayName" | "role">;
export interface ClockInfo { nowIso: IsoDateTime; today: DateStr; mode: "live" | "frozen"; shiftedDays: number; }
export interface MeResponse { user: DemoUserSummary; clock: ClockInfo; tools: boolean; }

// ---- 各モジュールの型の再エクスポート(型の所在は下表) ----
export type { Group, GroupMember, MemberStatus, MemberRole, Trip, InviteCode } from "@/features/groups/types";
export type { GroupStatus, GroupLifecycle, CancelReasonCode, OrganizerCancelReason, Withdrawal, GroupStatusLog } from "@/features/groups/lifecycle/types";
export type { AgeBand, Profile, Verification, Block, Report } from "@/features/safety/types";
// 以下同様に下表の型を再エクスポートする(02 Region、03 JoinRequest、05 GroupPlan、06 GroupMessage・ChatReadMark、
// 07 ExpenseNote、08 の 5 型、10 GroupNotification、11 の 4 型)
```

型の所在一覧(Store のコレクション。統一仕様 3.1 の表と一致させる):

| コレクション | 型 | 所有 | 定義ファイル(`app/src/` から) | ID |
|---|---|---|---|---|
| `users` | `DemoUser` | 00 | `lib/groups-types.ts` | `u-NNN` |
| `profiles` | `Profile` | 09 | `features/safety/types.ts` | userId |
| `verifications` | `Verification` | 09 | 同上 | userId |
| `blocks`、`reports` | `Block`、`Report` | 09 | 同上 | `bl-NNN`、`rp-NNN` |
| `regions` | `Region` | 02 | `features/groups/discovery/types.ts` | `r-<slug>`(seed のみ) |
| `groups`、`members` | `Group`、`GroupMember` | 01(`lifecycle` は 04) | `features/groups/types.ts` | `g-NNN`、`m-NNN` |
| `joinRequests` | `JoinRequest` | 03 | `features/groups/join/types.ts` | `jr-NNN` |
| `withdrawals`、`groupStatusLogs` | `Withdrawal`、`GroupStatusLog` | 04 | `features/groups/lifecycle/types.ts` | `wd-NNN`、`sl-NNN` |
| `notifications` | `GroupNotification` | 10 | `features/notify/types.ts` | `n-NNN` |
| `plans` | `GroupPlan` | 05 | `features/groups/plan/types.ts` | groupId |
| `messages`、`chatReads` | `GroupMessage`、`ChatReadMark` | 06 | `features/groups/chat/types.ts` | `msg-NNN`、`${groupId}:${userId}` |
| `expenses` | `ExpenseNote` | 07 | `features/groups/expense/types.ts` | `ex-NNN` |
| `groupStamps`、`rallyMemos`、`rallySurveys`、`rallyPhotos`、`rallyRewardGrants` | 08 の型 | 08 | `features/groups/rally/types.ts` | `gs-NNN`、`rm-NNN`、`rs-NNN`、`ph-NNN`、`rg-NNN` |
| `municipalities`、`hosts`、`listings` | `Municipality`、`LocalHost`、`Listing` | 11 | `features/official/types.ts` | `mun-<slug>`、`host-<slug>`(seed のみ)、groupId |
| `funnelEvents` | `FunnelEvent` | 11 | `features/entry/types.ts` | `fe-NNN` |

コレクション以外の共有型の所在: `GroupStatus`・`CancelReasonCode`・`OrganizerCancelReason`(04)、`AgeBand`・`MemberSummary`・`TextContext`(09)、通知の種類 `NotificationKind`(10)、`DomainEvent`(00 `lib/events.ts`、第 5.12)。

- 状態は 04 の `GroupStatus`(8 値、snake_case)、項目は `group.lifecycle.status`。00 の旧定義(`GroupState`、`GROUP_STATES`、`CancelReason`)は削除した。中止理由は 04 の `CancelReasonCode`(5 値)。
- 年代帯は 09 の `AgeBand`(`"18-19" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+"`)。00 の旧 `AGE_BANDS` は削除した。地方は 02 の `Region`(`r-<slug>`)で、00 の旧 `REGIONS`(日本語名の列挙)は削除した。
- `MemberStatus` は 01 の `"active" | "left"`(辞退・退会の区別は 04 の `withdrawals` の記録で行う。統一仕様 4.5)。
- 個人情報: DemoUser は**全員架空**。氏名は名のみ(姓なし)、メール・電話・住所・性別の項目は**型に存在させない**(性別での絞り込み禁止、07 章。CMN-T-35)。年代帯・ひとこと・旅の目的・公開設定は 09 の `Profile` に置く。
- 表示名: 画面に出す利用者の表示名は 09 の `Profile.displayName` を正とし、09 の `visibleProfile` の結果から得る。`DemoUser.displayName` はデモの視点切替(DemoBar、`/api/demo/users`)だけで使う。09 の `PUT /api/me/profile` は同じ `tx` で `Profile.displayName` と `DemoUser.displayName` の両方を更新し、2 つの値を常に一致させる。seed も同じ値にする(CMN-T-34) [統一](統一仕様 3.6)。
- API 応答に `DemoUser`/`Group` の内部オブジェクトをそのまま返さない。各モジュールが DTO(公開範囲を適用した形。例: `inviteCode` を除く、`organizerId` を表示名に変換)を作る。唯一の例外は `/api/demo/users`(デモの視点切替専用。返すのは `DemoUserSummary` の 3 項目。第 5.2)。 [決定(方針)]
- Repo に入れるエンティティは必ず `id` 項目を持つ。1 対 1 の資源(`plans`、`listings`、`profiles`、`verifications`)は `id` に親の ID(groupId・userId)をそのまま入れ、親の ID の項目(`groupId`・`userId`)も残す(統一仕様 3.1)。`chatReads` の `id` は `${groupId}:${userId}` で、3.2 の ID 形式の例外とする(型は `id: string`。`isId` の検査の対象にせず、API のパスや本文では受け取らない)。08 の振り返りメモ・アンケート(`rallyMemos`・`rallySurveys`)は採番 ID(`rm-NNN`、`rs-NNN`)を `id` に持ち、`(groupId, userId)` で一意にする(一意性の検査は 08 が行う)。
- Store にコレクションを足す場合は「統一仕様 3.1 の表 + 本表 + `Store`・`Db` の型 + seed(空配列で可)」を 1 回の小さな変更で行い、00 の担当が確認する(第 14 章)。

`groups-store.ts` 内部の Store の形(公開しない。`db()` の Repo からだけ触る):

```ts
interface Store {
  users: DemoUser[]; profiles: Profile[]; verifications: Verification[]; blocks: Block[]; reports: Report[];
  regions: Region[]; groups: Group[]; members: GroupMember[]; joinRequests: JoinRequest[];
  withdrawals: Withdrawal[]; groupStatusLogs: GroupStatusLog[]; notifications: GroupNotification[];
  plans: GroupPlan[]; messages: GroupMessage[]; chatReads: ChatReadMark[]; expenses: ExpenseNote[];
  groupStamps: GroupStamp[]; rallyMemos: ReviewMemo[]; rallySurveys: SurveyAnswer[]; rallyPhotos: PhotoPost[];
  rallyRewardGrants: RallyRewardGrant[];
  municipalities: Municipality[]; hosts: LocalHost[]; listings: Listing[]; funnelEvents: FunnelEvent[];
  counters: Record<IdPrefix, number>;   // ID 採番の最終値(接頭辞ごと)
}
type CollectionName = Exclude<keyof Store, "counters">;
```

(08 の型名 `ReviewMemo`・`PhotoPost` は 08 の現行の名前。08 の改訂で名前が変わった場合は 08 の名前に合わせる。)

### 4.3 共通の取り決め
| 項目 | 決定 |
|---|---|
| ID 形式 | 採番する ID は `<接頭辞>-<3〜8 桁の 10 進連番>`。正規表現 `^(u\|g\|m\|jr\|wd\|sl\|n\|pi\|msg\|ex\|gs\|rm\|rs\|ph\|rg\|rp\|bl\|fe)-\d{3,8}$`。接頭辞は `ids.ts` の `ID_PREFIXES` に登録されたものだけ。連番は接頭辞ごとの `counters` で採番(seed の最大値の次から)。各モジュールの個別の正規表現は使わず、検証は `isId(prefix, v)`(パスは `c.id(name, prefix)`、本文は `v.id(prefix)`)だけを使う [統一](統一仕様 3.2) |
| seed で決める ID | 地方 `r-<slug>`、自治体 `mun-<slug>`、地元の担い手 `host-<slug>`。形式 `^(r\|mun\|host)-[a-z0-9-]{1,30}$`。検証は `isSlugId(prefix, v)`。1 対 1 の資源は親の ID を使う(第 4.2) [統一] |
| ID 形式不正の扱い | パスの ID は `not_found`(404。存在を隠す)、本文・クエリの ID は `invalid_input`(400) [統一] |
| ID 以外のトークン | 推測困難な値が必要な場合は `newToken(bytes=8)`(Node `crypto.randomBytes`、Crockford Base32 の大文字。8 バイトで 13 文字)。招待コードの形式(10 文字、32 文字集合)と生成は 01 が持つ(統一仕様 7.2) |
| 日時 | 保存・API とも ISO 8601 のオフセット付き(`+09:00` 固定)。保存する日時は `clock.nowIso()` で作り、`toISOString()`(UTC)は使わない。暦日だけの項目は `YYYY-MM-DD`(JST)。表示はクライアントが dayjs で整形し、サーバー側の文面(10 の通知本文)は `formatJst` を使う。サーバーの現在時刻は `clock` 経由のみ(`new Date()`/`Date.now()` を直接呼ばない。eslint の `no-restricted-properties`(`Date.now`)と `no-restricted-syntax`(引数なしの `new Date()`)で警告し、`clock.ts` と試験ファイルは対象外にする [案]) |
| タイムゾーン | デモは JST(UTC+9、夏時間なし)固定。サーバーの TZ 設定に依存しない |
| 金額 | 整数の円。`LIMITS.AMOUNT`(1〜1,000,000。統一仕様 10.3) |
| 文字数 | コードポイント数で数える(絵文字 1 字)。上限は `limits.ts` の `LIMITS` を唯一の定義とし、モジュールごとに別の値を持たない(統一仕様 3.4) |
| HTTP メソッド | 取得は GET、作成は POST(201)、全置換は PUT、部分更新は PATCH、削除は DELETE(本文なし、204)。削除で再計算値を返す場合だけ 200。状態遷移の操作は POST の動詞サブパス(`approve`、`withdraw`、`cancel` など) [統一](統一仕様 2.3) |
| 楽観ロック | 版は `version: number`(作成時 1)。入力は `baseVersion`(DELETE はクエリ `?baseVersion=`)。不一致は `conflict` + `reason: "version_mismatch"` + `detail.current`(最新の DTO)。05 の並び順だけは一覧の版 `itemsRevision` と入力 `baseRevision` を使い、不一致の `reason` は同じ `version_mismatch`。01 の `applyLifecyclePatch` の `revision` 不一致も `version_mismatch` とする(`revision_mismatch` は使わない) [統一](統一仕様 2.3) |
| ページネーション | `?limit=`(整数 1〜50、既定 20。`LIMITS.PAGE`)と `?offset=`(整数 0 以上、既定 0)。エンドポイントごとに既定を変える場合は `parsePage(q, { defaultLimit })` で指定する(02 の一覧は 12)。応答は `Page<T>`(第 4.2)。時系列の追記型(06 チャット、10 通知)だけ `CursorPage<T>`(カーソルの形式は各モジュールが決める) [統一] |
| ソート | `?sort=<キー>:<asc\|desc>`(1 つのみ)。キーはエンドポイントごとの許可リスト。同値は `id` 昇順で安定化 |
| JSON | 文字コード UTF-8、キーは lowerCamelCase。PATCH は「省略 = 変更なし、`null` = 消去」。PUT の任意項目は、文字列の項目が「省略 = `""`」、それ以外(数値・日付・ID など)が「省略 = `null`」。`null` を受け付ける項目は `v.nullable(schema)` で宣言する(第 5.10) [統一](統一仕様 3.4) |
| 空配列・空文字 | 応答では `[]` と `""` を返し `null` にしない(文字列項目)。未設定の日時は省略せず `null` |
| 本文の上限 | 64KB。超過は 413 `payload_too_large`(`route()` が判定)。モジュールごとの上限は設けない [統一](統一仕様 3.4) |
| 未知のキー | 本文の未知キーは捨てる(`v.object`。拒否はしない。性別・細かい年齢のキーも捨てられるため保存されない)。クエリの未知キーは `c.query` が `invalid_input`(strict。`fields.<key>`)にする。例外は 02 の lenient(画面の初期化と入口B 用。02 が `c.url.searchParams` を自前で解釈する)。性別・細かい年齢のキーを専用の文言で拒否するため、絞り込みのクエリを受ける 02(lenient を含む)と 03 の一覧だけが 09 の `rejectProhibitedParams(c.url.searchParams)` をハンドラの先頭(`c.query(schema)` の前)で呼ぶ。他のモジュールと 00 の `route()` は呼ばない [統一](統一仕様 3.4) |

`limits.ts`(共通上限。`export const LIMITS = {...} as const`)。キーと値は統一仕様 10.3 の確定値。値の形: 文字数・数値の範囲は `{ min, max }`、行数の上限は `maxLines`、件数の上限は `maxItems`(ほかは表の記載どおり)。文字数はコードポイント数。モジュールは値を再定義せず、このキーを参照する(`LIMITS.<キー>`。数値を直書きしない)。09 の文脈表(`TextContext` の上限)はこの値と一致させる。 [統一]

| キー | 値 | 用途(所有) |
|---|---|---|
| `GROUP_NAME` | `{ min: 1, max: 30 }` | グループ名(01、04 の再企画) |
| `DESTINATION` | `{ min: 1, max: 40 }` | 行き先(01、04 の再企画) |
| `DATE_NOTE` | `{ min: 0, max: 40 }` | 日程メモ(01) |
| `DESCRIPTION` | `{ min: 0, max: 200 }` | グループの説明(01・02) |
| `TAG` | `{ min: 1, max: 16, maxItems: 5 }` | タグ(01。02 の検索語も 16 字) |
| `CAPACITY` | `{ min: 2, max: 6 }` | 定員 |
| `MIN_MEMBERS` | `{ min: 2, max: 6 }` | 最少人数(定員以下、幹事を含む。定員との比較は 01・04) |
| `JOIN_NOTE` | `{ min: 0, max: 200, maxLines: 3 }` | 申請のひとこと(03) |
| `REJECT_REASON_FREE` | `{ min: 0, max: 100 }` | 却下理由の自由記入(03。自由記入を使う場合のみ。既定は定型選択で使わない) |
| `PLAN_ITEM_TITLE` | `{ min: 1, max: 60 }` | 旅程の項目名(05) |
| `PLAN_ITEM_NOTE` | `{ min: 0, max: 300, maxLines: 5 }` | 旅程の項目メモ(05) |
| `MEETING` | `{ min: 0, max: 500 }` | 集合場所(05) |
| `SCHEDULE_MEMO` | `{ min: 0, max: 2000 }` | 日程メモ(05) |
| `PLAN_ITEMS` | `{ maxItems: 40, maxPerDate: 15 }` | 旅程の項目数(05) |
| `CHAT` | `{ min: 1, max: 500, maxLines: 10 }` | チャット(06) |
| `EXPENSE_TITLE` | `{ min: 1, max: 40 }` | 費用の項目名(07) |
| `EXPENSE_MEMO` | `{ min: 0, max: 200, maxLines: 3 }` | 費用のメモ(07) |
| `AMOUNT` | `{ min: 1, max: 1_000_000 }` | 費用の金額(円。07) |
| `EXPENSES` | `{ maxItems: 100 }` | 1 グループの費用メモの件数(07) |
| `RALLY_MEMO` | `{ min: 1, max: 500 }` | 振り返りメモ(08) |
| `PHOTO_CAPTION` | `{ min: 0, max: 80 }` | 写真の説明(08) |
| `PHOTOS` | `{ maxPerUser: 3, maxItems: 12 }` | 写真の件数(1 人・1 グループ。08) |
| `DISPLAY_NAME` | `{ min: 1, max: 20 }` | 表示名(00 の seed 検証、09) |
| `PROFILE_BIO` | `{ min: 0, max: 200, maxLines: 3 }` | プロフィールのひとこと(09) |
| `TRAVEL_PURPOSES` | `{ maxItems: 3 }` | 旅の目的の件数(09) |
| `REPORT_BODY` | `{ min: 0, max: 500 }` | 通報本文(09) |
| `OFFICIAL_SUMMARY` | `{ min: 0, max: 200 }` | 公式枠の要約(11) |
| `OFFICIAL_HIGHLIGHT` | `{ min: 1, max: 40, maxItems: 5 }` | 公式枠の見どころ(11) |
| `PAGE` | `{ defaultLimit: 20, maxLimit: 50 }` | `Page<T>` の既定(`parsePage`) |
| `BODY_BYTES` | `65_536` | リクエスト本文の上限(00) |

- 件数上限の超過は `conflict` + `reason: "limit_exceeded"`(07・08)。05 の項目数の超過は 05 の既存の扱い(`invalid_input`、`fields.items`)とする(統一仕様 10.3)。
- 業務上の数(03 の申請総数 3 件、01 の作成上限 5 件、06 の保持件数 500、カーソル一覧の既定・最大、ポーリング間隔)は `LIMITS` に入れず、各モジュールの定数に置く。

### 4.4 ダミーデータ `group-seed.json`(CMN-D-01〜04)

**CMN-D-01 スキーマ**(トップレベルは Store のコレクションと同名の配列 + メタ):

```ts
export type GroupSeed = {
  schemaVersion: 2;
  meta: {
    demoNow: IsoDateTime;           // デモの初期の現在時刻。"2026-11-09T09:00:00+09:00" [案]
    defaultUserId: Id;              // Cookie が無いときの現在ユーザー。"u-001"
    campaign: string;               // "nttw-demo"
    tagCatalog: string[];           // タグの候補(入力補助用。自由入力も可)
  };
} & { [K in CollectionName]: Store[K] };   // 第 4.2 の全コレクション(空配列可)
```
- JSON は手書き(`sample-data/` は使わない。ユーザー情報を含むため。AGENTS.md 5)。読み込みは `parseSeed(raw: unknown): GroupSeed`(`group-seed.ts`)が `validation.ts` で型・列挙・参照整合を検査し、不正なら起動時に例外(fail-fast)。JSON の文字列リテラルは列挙型に推論されないため、`import` した値を直接 Store に代入せず必ず `parseSeed` を通す。各コレクションの形の検査は所有モジュールの型に従い、00 は ID の形式・一意性・参照整合を検査する。
- 各モジュールの seed 断片(06 のメッセージ、09 のプロフィールと本人確認、11 の公式枠・自治体・地元の担い手など)は本ファイルに統合する。断片は各モジュールが用意し、00 が統合と整合検査(CMN-T-34)を行う(統一仕様 11.4)。
- 日付は `meta.demoNow` を基準にした絶対値で書く(相対指定の仕組みは持たない)。 [案]
- 暦の根拠: [推定] 本日 2026-11-09 をデモ開始日とした。デモ実施日が決まったら `meta.demoNow` と各日付を一括でずらす(件数が少ないため、スクリプトは作らず手作業で直す)。 [要確認]

**CMN-D-02 デモユーザー(12 人。全員架空。氏名は名のみ)** [案]。年代帯は 09 の `Profile.ageBand`、本人確認は 09 の `Verification.status`(統一仕様 11.4)。

| id | 表示名 | role | 所属 | 年代帯(Profile) | 本人確認 | 視点としての役割 |
|---|---|---|---|---|---|---|
| u-001 | ミサキ | traveler | - | 30s | verified | 既定ユーザー(10 章のデモで主に使う視点)。g-001 の幹事 |
| u-002 | ケンタ | traveler | - | 20s | verified | 承認済みメンバー。g-009 の幹事(1 対 1) |
| u-003 | ユイ | traveler | - | 40s | verified | g-003・g-011 の幹事 |
| u-004 | ダイスケ | traveler | - | 50s | verified | 申請者の視点(g-001 に申請中)。g-006・g-007 の幹事 |
| u-005 | ハルカ | traveler | - | 60s | verified | 非公開グループ g-008 の幹事 |
| u-006 | ソウタ | traveler | - | 20s | verified | g-004 の辞退者(wd-001、`phase: withdrawal_period`)、g-011 の退会者(wd-002、`phase: confirmed`。元メンバーの表示の見本)、ブロックされる側(u-001 がブロック) |
| u-007 | ナナミ | traveler | - | 30s | verified | g-004・g-012・g-013 の幹事 |
| u-008 | ヒナタ | traveler | - | 18-19(注) | underage | 18 歳未満(モック)。作成・申請に進めないことの試験用 |
| u-009 | タナカ | municipal | `mun-demo-a` | 40s | verified | 自治体担当者。公式枠(g-002、g-005)の幹事。12 の閲覧者 |
| u-010 | リク | traveler | - | 20s | unverified | 未確認の成人。「申請前に本人確認(モック)へ誘導される」試験の対象。どのグループにも属さない |
| u-011 | アオイ | municipal | `mun-demo-b` | 30s | verified | 別の自治体の担当者(12 の IDOR 試験用) |
| u-012 | ゲン | host | `host-demo-a` | 50s | verified | 地元の担い手(11 の同行枠の作成) |

- (注)09 の `AgeBand` は 18 歳未満の帯を持たないため、u-008 の `Profile.ageBand` は `18-19` とし、18 歳未満であることは `Verification.status = "underage"` だけで表す。旧 [要確認: 09 の Profile の扱い] は解消(統一仕様 6.3、11.4)。u-008 は作成・申請ができないため、グループの概要と集計には現れない。
- `Profile.displayName` は `DemoUser.displayName` と同じ値にする(第 4.2。統一仕様 3.6)。公開設定(`Profile.visibility`)の初期値は 09 の既定値とし、u-006 は `ageBand` を `members`、u-008 は `displayName` 以外を `self` にする(公開範囲の試験用)。
- `Verification`: `method` は `"mock_self_declaration"`。`verified` の `confirmedAt` は `2026-11-01T10:00:00+09:00`、それ以外は `null`。
- 地方 `regions`(02 の `Region`。4 件): `r-mizukoto`(水琴地方)、`r-suzukaze`(鈴風高原)、`r-hoshinagi`(星凪諸島)、`r-nijiho`(虹帆町)。`spotAreas` は 02 が用意する。
- 自治体 `municipalities`(11 の `Municipality`。2 件): `mun-demo-a`(担当 `r-nijiho`、`r-hoshinagi`、`r-suzukaze`)、`mun-demo-b`(担当 `r-mizukoto`)。地元の担い手 `hosts`(1 件): `host-demo-a`。表示名は架空で、11・12 が用意する。

**CMN-D-03 サンプルグループ(13 件。公開 12、非公開 1、公式 2)**。`demoNow`=2026-11-09 時点。状態は 04 の `evaluate` が「変化なし」を返す整合した値にする(04 への要望 R-04-1)。締切は `lifecycle.deadlineDate`(その日を含む)と、派生値 `lifecycle.deadlineAt`(翌日 00:00+09:00)の両方を書く。 [案]

| id | 名称の方向性(架空) | 地方 | 公開 | 状態 | 定員/最少 | 現在人数(active) | 締切 | 旅行日 | 特記(試験での用途) |
|---|---|---|---|---|---|---|---|---|---|
| g-001 | 鈴風高原のんびり歩き | r-suzukaze | public | recruiting | 4/3 | 2(u-001 幹事、u-002) | 11-20 | 12-05〜06 | u-004 の申請中(pending、最少人数への同意あり)。既定ユーザーが幹事の標準例 |
| g-002 | 虹帆町 夜市めぐり(公式) | r-nijiho | public | recruiting | 6/4 | 3(u-009 幹事、u-003、u-005) | 11-25 | 12-12〜13 | 公式枠(`official: true`、Listing あり)。幹事が自治体担当者 |
| g-003 | 星綴港 朝市さんぽ | r-hoshinagi | public | min_reached | 4/3 | 3(u-003 幹事、u-002、u-007) | 11-14 | 11-30 | 最少人数到達・締切前 |
| g-004 | 雫森谷 紅葉ハイク | r-mizukoto | public | withdrawal_period | 4/3 | 3(u-007 幹事、u-001、u-005) | 11-07 | 11-29〜30 | 辞退期間(`withdrawalEndsAt` 11-11)。u-006 が辞退済み(wd-001、`phase: withdrawal_period`、メンバー行は `left`)。締切で失効した申請 1 件 |
| g-005 | 星凪諸島 島時間(公式) | r-hoshinagi | public | confirmed | 6/4 | 5(u-009 幹事、u-001、u-002、u-004、u-005) | 11-01 | 11-28〜29 | 実行確定・公式枠。チャット・旅程メモ・通知あり |
| g-006 | 月灯集落 灯りの夕べ | r-mizukoto | public | replanned | 4/4 | 2(u-004 幹事、u-006) | 11-05 | 11-22 | 自動中止(`cancelReason: min_not_reached`)の後に再企画済み。`replannedToGroupId: g-007` |
| g-007 | 月灯集落 灯りの夕べ(再企画) | r-mizukoto | public | recruiting | 4/3 | 1(u-004 幹事) | 11-30 | 12-20 | 再企画。`replanOfGroupId: g-006`。u-006 の再エントリー申請(`reentryOfGroupId: g-006`) |
| g-008 | 白波離島 少人数の島旅 | r-hoshinagi | **private** | recruiting | 3/2 | 1(u-005 幹事) | 11-27 | 12-08 | 招待コード(01 の形式のダミー値、seed に直書き)。一覧に出ない |
| g-009 | 星凪諸島 灯台めぐり(1 対 1) | r-hoshinagi | public | recruiting | 2/2 | 1(u-002 幹事) | 11-22 | 12-02 | 定員 2・最少 2 |
| g-010 | 鈴風高原 音楽堂の朝 | r-suzukaze | public | completed | 4/3 | 3(u-001 幹事、u-003、u-007) | 10-10 | 10-18〜19 | 完了。グループ・スタンプ、振り返り(メモ・アンケート・写真)、個人特典の試験用 |
| g-011 | 虹帆町 夜明けの港 | r-nijiho | public | in_progress | 4/3 | 3(u-003 幹事、u-004、u-002) | 10-30 | 11-08〜10 | 実施中。u-006 は実行確定のときに退会した元メンバー(wd-002、`phase: confirmed`、メンバー行は `left`)。費用メモ 2 件(うち 1 件は u-006 が退会前に記録したもの。07 の「元メンバー」表示の見本)、グループ・スタンプ 2 件、振り返りメモ 1 件 |
| g-012 | 雫森谷 小さな森歩き | r-mizukoto | public | min_reached | 3/2 | 3(u-007 幹事、u-001、u-006)(満員) | 11-18 | 12-01 | 満員。申請が `conflict`(満席)になる試験用 |
| g-013 | 星凪諸島 夕暮れの浜歩き | r-hoshinagi | public | cancelled | 4/3 | 2(u-007 幹事、u-002) | 11-06 | 11-23 | 自動中止(`min_not_reached`、`cancelledAt` 11-07T00:00+09:00)。未再企画(`replannedToGroupId: null`)。幹事が再企画できる状態の見本 |

(日付は 2026 年。人数は seed 上の status=`active` のメンバー数。g-004 と g-011 の u-006 は status=`left` で人数に含めない。8 状態すべてを含む。状態ごとの見本の対応は第 9.1 の `GROUP_BY_STATUS`。)

**CMN-D-04 その他の seed 内容**(件数の目安): 参加申請 6〜7 件(pending 1、approved 数件、rejected 1、withdrawn 1、expired 1(g-004)、再エントリー 1)、辞退・退会 2 件(wd-001: g-004 の u-006 の辞退、`phase: withdrawal_period`。wd-002: g-011 の u-006 の退会、`phase: confirmed`。どちらもメンバー行は `left`)、状態遷移の記録(`groupStatusLogs`。各グループの seed の状態に至る遷移。04 が用意)、通知 5〜8 件(u-001 宛を中心に未読・既読混在。種類は統一仕様第 9 章の必須 12 種から選ぶ)、旅程 2 件(g-005、g-011)、チャット 4〜6 件(g-005、g-011。定型文、自由入力、システムメッセージを含む)、費用メモ 2 件(g-011。うち 1 件は u-006 が退会前に記録したもの)、グループ・スタンプ 2〜4 件(g-010、g-011。spotId は seed.json の 1〜7)、振り返り(g-010・g-011 のメモ、g-010 のアンケート・写真)、個人特典の付与記録(08 の規則と整合する件数)、公式枠の `listings` 2 件(g-002、g-005)、計測イベント `funnelEvents` 数件(11)、通報 1 件、ブロック 1 件(u-001 が u-006 をブロック)。**本文はすべて架空で、定型の短文**(個人名・連絡先・実在の店名を含めない。実在の地名ではなく seed.json の架空の地名のみ)。

`meta.tagCatalog` 例: `["温泉", "食べ歩き", "写真", "ハイキング", "歴史", "離島", "ゆっくり", "朝活"]`。

JSON の抜粋(形式の例。u-001 と g-001 の関連レコード。項目の形は所有モジュールの型が正):

```json
{
  "schemaVersion": 2,
  "meta": { "demoNow": "2026-11-09T09:00:00+09:00", "defaultUserId": "u-001", "campaign": "nttw-demo",
            "tagCatalog": ["温泉", "食べ歩き", "写真", "ハイキング", "歴史", "離島", "ゆっくり", "朝活"] },
  "users": [
    { "id": "u-001", "displayName": "ミサキ", "role": "traveler" },
    { "id": "u-009", "displayName": "タナカ", "role": "municipal", "municipalityId": "mun-demo-a" }
  ],
  "verifications": [
    { "id": "u-001", "userId": "u-001", "status": "verified", "method": "mock_self_declaration", "confirmedAt": "2026-11-01T10:00:00+09:00" }
  ],
  "groups": [
    { "id": "g-001", "name": "鈴風高原のんびり歩き", "campaign": "nttw-demo", "region": "r-suzukaze",
      "trip": { "destination": "雪雫の音楽堂", "startDate": "2026-12-05", "endDate": "2026-12-06", "dateNote": "" },
      "capacity": 4, "visibility": "public", "tags": ["ハイキング", "ゆっくり"],
      "description": "ゆっくり歩いて音楽堂へ向かいます。", "official": false, "organizerId": "u-001", "inviteCode": null,
      "lifecycle": { "status": "recruiting", "minMembers": 3, "deadlineDate": "2026-11-20", "deadlineAt": "2026-11-21T00:00:00+09:00",
        "deadlineExtendedCount": 0, "withdrawalStartedAt": null, "withdrawalEndsAt": null, "confirmedAt": null,
        "startedAt": null, "completedAt": null, "cancelledAt": null, "cancelReason": null, "organizerCancelReason": null,
        "replanOfGroupId": null, "replannedToGroupId": null, "replannedAt": null,
        "deadlineSoonNoticeSent": false, "withdrawalEndingNoticeSent": false, "revision": 1 },
      "createdAt": "2026-11-01T10:00:00+09:00", "updatedAt": "2026-11-01T10:00:00+09:00" }
  ],
  "members": [
    { "id": "m-001", "groupId": "g-001", "userId": "u-001", "role": "organizer", "status": "active", "joinedAt": "2026-11-01T10:00:00+09:00", "leftAt": null }
  ]
}
```

(`trip.destination` は seed.json の spots の `stampName` と一致させておくと 08 がスポットに紐づけやすい [案]。実在しない架空名。`profiles` などの他のコレクションは所有モジュールの型の形で書く。)

## 5. インターフェース

凡例: 例外は `AppError`(第 5.4)。全関数は**同期**(ストアがメモリのため)。Route Handler のみ非同期。

### 5.1 ストア(`lib/groups-store.ts`)・ID(`lib/ids.ts`)

方式 [決定(方針)/案(細部)]:
- アクセスは `db()`/`Repo<T>`/`tx()` だけ。生の Store オブジェクトと `store()` は公開しない(直接変更による不変条件違反を防ぐ)。各モジュールは `Record`・`Map` 形式のコレクションを持たず、`Repo` を使う [統一](統一仕様 3.1)。
- `globalThis.__groupsStore = { schemaVersion, db }`。Next.js の dev ではルートごとに別バンドルになりモジュール変数が共有されない/HMR で消えるため、既存 `server-store.ts` と同様 globalThis に置く。`schemaVersion` はコード側の定数 `STORE_SCHEMA_VERSION`(seed の `schemaVersion` とは別)で、globalThis 上の値と違えば作り直す(型変更後の HMR で旧い形のデータが残るのを防ぐ)。
- 初期化: 初回アクセスで `parseSeed(groupSeedJson)` → `structuredClone` して Store を作る。`counters` は seed の各接頭辞の最大連番で初期化する(seed に無い接頭辞は 0)。seed で決める ID(`r-`、`mun-`、`host-`)、1 対 1 の資源(`plans`、`listings`、`profiles`、`verifications`)、`chatReads` は採番しない。
- Store に置かないもの: レート制限の計数(09 の `checkRate` が globalThis の Map に持つ。`afterReset` フックで初期化)。06 の `chatSeq`、03・01 の `inviteAttempts`・`inviteIndex`、12 の `entryEvents` は作らない(統一仕様 3.1)。
- 永続化: **既定は永続化しない**(再起動で seed に戻る。デモの再現性、既存モックと同じ。ファイル書き込みの失敗要因を持たない)。 [案] 次の JSON 永続化は見送り(統一仕様 16.2)。任意機能として `GROUPS_PERSIST=file` のとき、`tx` のコミット後に `app/.data/groups-store.json`(固定パス。ユーザー入力は使わない)へ同期書き出しし、起動時に存在し `schemaVersion` が一致すれば読み込む(CMN-TASK-15。デモ範囲外の任意機能。見送り)。SQLite は採らない(ネイティブ依存・ライセンス確認の工数、競技規模に対して過大。 [案]、03・05 章の「DB 有無」は未決のまま)。

```ts
// lib/ids.ts
export const ID_PREFIXES = [
  "u", "g", "m", "jr", "wd", "sl", "n", "pi", "msg", "ex", "gs", "rm", "rs", "ph", "rg", "rp", "bl", "fe",
] as const;                                        // 統一仕様 3.2
export type IdPrefix = (typeof ID_PREFIXES)[number];
export const SLUG_PREFIXES = ["r", "mun", "host"] as const;   // seed で決める ID
export type SlugPrefix = (typeof SLUG_PREFIXES)[number];

// lib/groups-store.ts
export interface Repo<T extends { id: Id }> {
  list(): readonly Readonly<T>[];                              // 全件(挿入順)。配列を直接変更しないこと
  get(id: Id): Readonly<T> | undefined;
  getOrThrow(id: Id, label?: string): Readonly<T>;             // 無ければ AppError("not_found")
  find(pred: (x: Readonly<T>) => boolean): Readonly<T> | undefined;
  filter(pred: (x: Readonly<T>) => boolean): Readonly<T>[];
  count(pred?: (x: Readonly<T>) => boolean): number;
  insert(entity: T): Readonly<T>;                              // id 重複は Error(プログラムエラー。ids.ts の newId を使う)
  update(id: Id, patch: Partial<Omit<T, "id">>): Readonly<T>;  // 無ければ not_found。undefined のキーは無視
  remove(id: Id): boolean;
}
export type Db = { [K in CollectionName]: Repo<Store[K][number]> };   // 第 4.2 の全コレクション
```

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-01 | `db()` | `() => Db` | 現在のストアの Repo 群を返す(読み取り用。書き込みも可能だが**書き込みは `tx` 内のみ**とする規約) |
| CMN-FN-02 | `tx` | `<T>(fn: (db: Db) => T) => T` | **同期**関数 `fn` を原子的に実行する。例外が出たら開始前の状態(counters を含む)に巻き戻して再 throw。入れ子は外側に合流(巻き戻しは最外のみ)。`fn` が Promise を返したら `Error`(プログラムエラー)。**`fn` 内で `await` しない** |
| CMN-FN-03 | `resetStore` | `() => void` | seed から Store を作り直し、`clock.reset()` を呼ぶ。`afterReset` フック(第 5.8)を実行。`afterClockChange` は実行しない(seed の状態は `demoNow` 時点で整合しているため。R-04-1)。永続化ファイルがあれば削除 |
| CMN-FN-04 | `newId` | `(prefix: IdPrefix) => Id` | `counters[prefix]` を +1 し `"${prefix}-${String(n).padStart(3,"0")}"`。未登録の接頭辞は Error。`tx` の巻き戻しで counters も戻る |
| CMN-FN-05 | `newToken` | `(bytes?: number) => string` | 推測困難なトークン。`crypto.randomBytes` を Crockford Base32 大文字に変換。既定 8 バイト(13 文字)。`Math.random` を使わない |
| CMN-FN-06 | `isId` | `(prefix: IdPrefix, v: unknown) => v is Id` | 採番 ID の形式検査 `^<prefix>-\d{3,8}$`(存在確認はしない) |
| CMN-FN-07 | `isSlugId` | `(prefix: SlugPrefix, v: unknown) => v is Id` | seed で決める ID の形式検査 `^<prefix>-[a-z0-9-]{1,30}$`(存在確認はしない) |
| CMN-FN-08 | `idSeq` | `(id: Id) => number` | 採番 ID の連番部分を数値で返す(06 の `sinceId`・`before` の比較と `seq` の導出に使う。統一仕様 3.2)。形式不正は Error(呼び出し前に `isId` で検査する) |

排他の考え方 [案]: Node.js はシングルスレッドで、`tx` 内に `await` が無ければ他のリクエストは割り込めない。よって「確認してから更新(定員チェック→メンバー追加、状態確認→遷移)」は `tx` 内で一括して行えば競合しない。ロック機構・キューは持たない。`tx` の巻き戻しは「開始時にコレクション配列と counters を `structuredClone`」で実現(seed 規模は数百件以下で十分軽い)。 [案]

例外規約: 業務エラーは `AppError`、不変条件違反・プログラムエラーは通常の `Error`(ラッパーが `internal` にする)。

### 5.2 現在ユーザー(`lib/current-user.ts`)

方式 [案]: ログイン不要のため、Cookie `demoUser=<DemoUser.id>` で「誰の視点か」を表す。属性: `Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000`(30 日。localhost の http のため `Secure` は付けない)。値は `isId("u", v)` を満たし、かつ `db().users` に存在するときだけ受理する。それ以外(Cookie なし、不正値、存在しない ID)は **`meta.defaultUserId` のユーザーを返す**(エラーにしない。Cookie の状態にかかわらずデモ操作を続けられるようにするため)。権限は常にこの結果で判定し、クライアントの申告(本文・クエリの `userId` 等)を信用しない。 [決定(方針)]

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-10 | `currentUser` | `(req: Request) => Readonly<DemoUser>` | Cookie ヘッダを自前で解析(依存なし)。常に DemoUser を返す |
| CMN-FN-11 | `userCookieHeader` | `(userId: Id) => string` | `Set-Cookie` の値を組み立てる(`POST /api/demo/me` が使用) |
| CMN-FN-12 | `listDemoUsers` | `() => DemoUserSummary[]` | 切替用(id 昇順)。`DemoUserSummary` は第 4.2(`id`、`displayName`、`role` の 3 項目) |

- ユーザーの取得は `db().users.get(id)` を使う(12 の要望 `getDemoUser(id)` は Repo で満たす)。自治体・地元の担い手の担当範囲は `DemoUser.municipalityId`/`hostId` から 11 の `Municipality`/`LocalHost` を引く(統一仕様 7.11)。
- サーバーコンポーネントから使う場合は `next/headers` の `cookies()`(非同期 [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)])を使うが、**画面は既存どおりクライアントコンポーネント + API 取得**を基本とし、サーバーコンポーネントでのユーザー依存の描画は行わない。 [案]

### 5.3 時計(`lib/clock.ts`)

方式 [案]: 状態は `globalThis.__groupsClock = { mode: "live" | "frozen", offsetMs: number, frozenAt: number }`。`live` は「実時刻 + offsetMs」、`frozen` は固定。初期状態(および `reset()`)は `live` で、`offsetMs = Date.parse(meta.demoNow) - 実時刻` とする(デモ開始時刻が `demoNow` で、その後は実時間で進む。締切判定は日付単位のため、デモ中の実時間の経過は日付をまたがない限り判定に影響しない)。試験では `freeze()` で固定する。`clock` 内部だけが `Date.now()` を呼んでよい。

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-20 | `clock.now` | `() => Date` | 現在のデモ時刻 |
| CMN-FN-21 | `clock.nowIso` | `() => IsoDateTime` | `+09:00` 付き ISO 8601(秒精度)。保存する日時はこれを使う |
| CMN-FN-22 | `clock.today` | `() => DateStr` | JST の暦日。締切・辞退期間の判定に使う |
| CMN-FN-23 | `clock.advanceDays` | `(days: number) => ClockInfo` | 整数 1〜365。`live` は offsetMs に加算、`frozen` は固定時刻に加算。後戻りは `set` のみ |
| CMN-FN-24 | `clock.set` | `(iso: IsoDateTime) => ClockInfo` | その時刻を「今」にする(`live` のまま offset を再計算)。過去への設定も許す。不正な形式は `invalid_input` |
| CMN-FN-25 | `clock.freeze` | `(iso?: IsoDateTime) => ClockInfo` | 時刻を固定(省略時は現在値で固定)。試験用 |
| CMN-FN-26 | `clock.unfreeze` | `() => ClockInfo` | `live` に戻す(固定時刻を現在として継続) |
| CMN-FN-27 | `clock.reset` | `() => ClockInfo` | seed の `demoNow` からの `live` に戻す |
| CMN-FN-28 | `clock.info` | `() => ClockInfo` | `ClockInfo` は第 4.2。`shiftedDays` は `daysBetween(jstDate(meta.demoNow), clock.today())` |

- 時計を変えても状態遷移は時計の操作の中では実行しない。04 が `beforeRequest` フック(各 API の前)と `afterClockChange` フック(時計の操作の後)に `evaluateAll` を登録して反映する(第 5.5、5.8。統一仕様 3.5、7.5)。通知の生成は 04 → 10 の責務。 [統一]
- デモの日付操作は本モジュールの `POST /api/demo/clock` だけ(04 の `advanceDemoClock`・`/_demo/clock` は作らない)。デモ用 API が有効かどうかは `GET /api/demo/me` の `tools` で判定する。
- `clock.set`/`advanceDays` は `DEMO_TOOLS=off` で API 経由を拒否(第 5.5 の demoOnly)。関数自体は試験から常に使える。
- `clock.set` で時刻を過去に戻しても、グループ等の状態は戻らない(04 も巻き戻さない)。状態を戻すには `POST /api/demo/reset` を使う(既知の制約)。時計の後戻り時の状態の扱いは見送り(統一仕様 16.2)。`clock.set` が過去の時刻を受け付けることだけを残す。

### 5.4 エラー(`lib/errors.ts`)

[統一](統一仕様 3.3)

```ts
export type ErrorCode =
  | "invalid_input" | "forbidden" | "blocked" | "not_found" | "method_not_allowed"
  | "conflict" | "unavailable_state" | "rate_limited"
  | "payload_too_large" | "unsupported_media_type" | "internal";

export interface ErrorBody {
  error: ErrorCode;
  reason?: string;                    // モジュールの下位コード(snake_case)
  message: string;                    // 利用者向けの日本語。常に付ける
  fields?: Record<string, string>;    // 項目パス → メッセージ。値は文字列 1 つ
  detail?: Record<string, unknown>;   // 構造化データ
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;                       // STATUS_BY_CODE から決まる
  readonly reason?: string;                      // 下位コード。値は各モジュールのエラー表で定める
  readonly fields?: Record<string, string>;      // invalid_input の項目別メッセージ。キーは "name"、"tags.2" のようなパス
  readonly detail?: Record<string, unknown>;     // 画面が次の行動を出すための補足(例: { state: "cancelled", allowedActions: ["replan"] })
  constructor(code: ErrorCode, message: string, opts?: {
    reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown>; cause?: unknown;
  });
}
// 生成ヘルパー(例外は throw する側が使う)
type ErrOpts = { reason?: string; detail?: Record<string, unknown> };
export const invalidInput: (fields: Record<string,string>, message?: string, opts?: ErrOpts) => AppError;
export const forbidden:    (message?: string, opts?: ErrOpts) => AppError;
export const blocked:      (message?: string) => AppError;          // 既定文言はブロックの有無を示さない一般的な文
export const notFound:     (label?: string) => AppError;            // 「<label>が見つかりません」
export const conflict:     (message: string, opts?: ErrOpts) => AppError;
export const unavailableState: (message: string, opts?: ErrOpts) => AppError;
export const rateLimited:  (retryAfterSec: number, message?: string, opts?: { reason?: string }) => AppError; // detail.retryAfterSec を付ける
// 変換
export function toErrorBody(e: unknown, requestId?: string): { status: number; body: ErrorBody }; // AppError 以外は internal(本文に内部情報を出さない)。internal のときは detail: { requestId } を付ける
export function toResponse(e: unknown, requestId?: string): Response;                                // JSON + no-store。rate_limited は Retry-After ヘッダも付ける
```

| code | HTTP | 使う場面 | 備考 |
|---|---|---|---|
| invalid_input | 400 | 検証失敗、JSON 不正、クエリ不正(未知キーを含む)、本文・クエリの ID 形式不正、禁止表現(09) | `fields` 必須(全体の不備は `fields` なし)。禁止表現の違反は `reason: "text_denied"`、要確認は `reason: "text_review_required"` + `detail.reviewRequired: true` |
| forbidden | 403 | 権限なし(幹事のみ、メンバーのみ、未確認・18 歳未満(09。`reason` は `not_verified`/`underage`)) | 存在を隠したいときは `notFound` を使う |
| blocked | 403 | ブロック関係(09) | 文言は一般的に |
| not_found | 404 | 存在しない、**参照できない(非公開・非メンバーに隠す)**、パスの ID 形式不正 | 「存在しない」と「見えない」を区別しない |
| method_not_allowed | 405 | `route.ts` が export していないメソッドへの要求(Next.js が 405 を返す [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)])。本書のラッパーは生成しない | 本文が `ErrorBody` 形式になるかは [要確認: 同上]。画面操作では発生しない(デモ範囲外) |
| conflict | 409 | 重複申請、定員超過、同時操作による不整合(楽観ロック)、件数上限の超過 | 画面を更新して再確認。版の不一致は `reason: "version_mismatch"` + `detail.current`。件数上限の超過は `reason: "limit_exceeded"` |
| unavailable_state | 409 | 現在の状態で不可(確定済み、中止済み、締切後) | `detail.state`、`detail.allowedActions` を推奨。申請の受付終了の `reason` は統一仕様 4.3 |
| rate_limited | 429 | 頻度制限の超過(09 の `checkRate`) | `detail.retryAfterSec` 必須。応答に `Retry-After` ヘッダ(秒) |
| payload_too_large | 413 | 本文が 64KB 超 | |
| unsupported_media_type | 415 | 変更系で Content-Type が `application/json` でない | CSRF 対策(第 7 章) |
| internal | 500 | 想定外 | 本文は固定の一般文と `detail.requestId`。詳細は `console.error` にのみ出す |

画面での表示・挙動を含むエラー一覧は第 8 章。

- 応答形式(全エラー共通): `{ "error": "<code>", "reason"?: "<下位コード>", "message": "<利用者向け日本語>", "fields"?: {...}, "detail"?: {...} }`。README 4.3 の `{error, message?, fields?}` に対し、`message` は**常に付ける**(画面にそのまま出せるように)。既存 `/api/v2` は `{error}` のみで別系統のまま。 [統一]
- `reason` の値は各モジュールのエラー表に書く。複数モジュールにまたがる値は統一仕様で決める: 受付終了(`closed_deadline`・`closed_withdrawal_period`・`closed_confirmed`・`closed_cancelled`。統一仕様 4.3)、本人確認(`not_verified`・`underage`。7.10)、禁止表現(`text_denied`・`text_review_required`。6.2)、楽観ロック(`version_mismatch`。2.3)、件数上限(`limit_exceeded`。10.3)。
- 禁止表現の要確認(`text_review_required`)の再送は、画面が利用者の確認後に本文の最上位のキー `ackReview: true` を付けて送る。本文の未知キーは捨てられる(第 4.3)ため、禁止表現を検査する本文のスキーマには `ackReview: v.boolean({ optional: true })` を宣言する(統一仕様 6.2)。モジュール固有のエラーコードは作らない(例: 08 の `invalid_code` は `invalid_input` + `reason: "invalid_code"`)。
- `detail` に置くもの: `current`(楽観ロック・08 の取得済み情報)、`state`、`allowedActions`、`retryAfterSec`、`reviewRequired`、`existingRequestId`、`acquired`、`requestId`(internal のみ)。最上位には置かない。
- `fields` の値は文字列 1 つ(配列にしない)。
- `message` は利用者向け日本語で、原因と次の行動を 1〜2 文で書く(06 章、rule.md 9.1)。文言は `features/<module>/messages.ts` に集約する(README 4.4)。共通の文言(検証メッセージ等)は `lib/messages.ts`(CMN-TASK-03 に含める)。
- 検証メッセージの定型(`fields[...]` の値): 必須「入力してください」/ 長さ「{min}〜{max}字で入力してください」/ 範囲「{min}〜{max}の整数で入力してください」/ 列挙「選択肢から選んでください」/ 日付「YYYY-MM-DD 形式の日付で入力してください」/ 件数「{max}件までです」/ 行数「{max}行までです」/ 制御文字「使用できない文字が含まれています」。

### 5.5 API 共通ラッパー(`lib/api-route.ts`)

```ts
export type RouteParams = Record<string, string | string[]>;
export interface ApiContext<P extends RouteParams = Record<string, never>> {
  req: Request;
  url: URL;
  user: Readonly<DemoUser>;                 // currentUser(req)。auth:"none" のときに参照すると Error(プログラムエラー)
  requestId: string;                        // crypto.randomBytes(4) の 16 進 8 桁。エラーログと突合する
  /** パスの ID を検証して返す。形式不正は not_found(存在を隠す) */
  id(name: keyof P & string, prefix: IdPrefix): Promise<Id>;
  /** JSON 本文を読み、スキーマで検証して返す。サイズ上限・JSON 不正・検証失敗は AppError */
  body<S extends Schema>(schema: S): Promise<Infer<S>>;
  /** クエリを strict に検証して返す。schema に無いキー(limit・offset・sort を除く)は invalid_input(fields.<key>)。
   *  本文用の v.object(未知キーを捨てる)とは扱いを分ける。文字列→数値/真偽へは schema の coerce 指定 */
  query<S extends Schema>(schema: S): Infer<S>;
}
export interface RouteOptions {
  auth?: "demoUser" | "none";               // 既定 "demoUser"
  demoOnly?: boolean;                       // true なら DEMO_TOOLS=off のとき 404
  skipHooks?: boolean;                      // true なら beforeRequest フックを実行しない(/api/demo/reset のみ)
}
declare const API_RESULT: unique symbol;  // ok/created/noContent だけが付ける識別子(実装は Symbol)
export type ApiResult = { [API_RESULT]: true; status: number; body?: unknown; headers?: Record<string, string> };
export const ok: (body: unknown, headers?: Record<string, string>) => ApiResult;      // 200
export const created: (body: unknown, location?: string) => ApiResult;                // 201
export const noContent: () => ApiResult;                                              // 204
export function route<P extends RouteParams = Record<string, never>>(
  handler: (c: ApiContext<P>) => Promise<ApiResult | unknown> | ApiResult | unknown,
  opts?: RouteOptions,
): (req: Request, ctx: { params: Promise<P> }) => Promise<Response>;
```

動作 [案]:
1. `import "@/features/bootstrap"`(フック・イベント購読の登録の副作用。第 5.8)。
2. **`req.headers` を最初に読む**(動的な Route Handler として扱われ、ビルド時にキャッシュ・事前生成されないようにする。`cacheComponents: true` 対策 [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)])。
3. 変更系メソッド(POST/PUT/PATCH/DELETE)では次の順に検査する(第 7 章)。
   - (a) `Origin` ヘッダがあり、`new URL(origin).host` が `Host` ヘッダと異なる、または `Origin` を URL として解釈できない(`null` 等)→ `forbidden`。`Origin` が無い要求(試験・curl)は許可する。
   - (b) `Content-Type` が `application/json`(charset 指定可)でない → `unsupported_media_type`。本文の有無にかかわらず必須とし、クライアント(第 5.9)は常にこのヘッダを付ける。本文が空でもこの段階では許可し、内容は `c.body()` を呼んだときだけ要求する(空なら `invalid_input`)。
   - (c) `Content-Length` が `LIMITS.BODY_BYTES`(64KB)を超えれば本文を読む前に `payload_too_large`。`c.body()` で読んだ本文のバイト数(`TextEncoder`)が超えた場合も同じ。上限はモジュールごとに変えない(統一仕様 3.4)。
4. `skipHooks` でなければ `runHooks("beforeRequest")` を実行する(04 が `evaluateAll(clock.now())` を登録し、締切・辞退期間の遷移をハンドラの前に反映する)。各モジュールは `evaluateAll` を自分で呼ばない。フックの例外は `internal` になる。 [統一](統一仕様 3.5)
5. `auth:"demoUser"` なら `currentUser(req)` を解決。
6. `handler` を実行。戻り値が `ApiResult`(`API_RESULT` 識別子付き)でなければ、戻り値をそのまま本文として `200` + JSON。DTO が `status` 項目を持っていても `ApiResult` とは扱わない。`undefined` は `204` ではなく `{}`(クライアントの `res.json()` を単純にするため。204 は `noContent()` を明示したときのみ)。
7. 例外は `toResponse` へ。`AppError` 以外は `console.error("[<requestId>]", method, path, e)` を出力して `internal`。本文・Cookie・招待コードはログに出さない(第 7 章)。
8. すべての応答に `Cache-Control: no-store`、`Content-Type: application/json; charset=utf-8`、`X-Content-Type-Options: nosniff`。

使い方の例(他モジュールのハンドラと `route.ts`。統一仕様 2.1 の形):

```ts
// app/src/features/groups/join/handlers.ts
import { route, created } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { LIMITS } from "@/lib/limits";
import { requestJoin } from "@/features/groups/join/service";

const Body = v.object({
  note: v.string({ max: LIMITS.JOIN_NOTE.max, maxLines: LIMITS.JOIN_NOTE.maxLines, multiline: true, optional: true }),
  consentMinMembers: v.boolean(),
  consentedMinMembers: v.int({ min: LIMITS.MIN_MEMBERS.min, max: LIMITS.MIN_MEMBERS.max }),
  inviteCode: v.string({ max: 20, optional: true }),
  ackReview: v.boolean({ optional: true }),   // 禁止表現の要確認の再送(第 5.4。統一仕様 6.2)
});

export const postJoinRequestHandler = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(Body);
  return created(requestJoin(c.user, groupId, input));   // service は同期・フレームワーク非依存
});

// app/src/app/api/groups/[groupId]/join-requests/route.ts(再エクスポートだけを書く)
export { postJoinRequestHandler as POST } from "@/features/groups/join/handlers";
```

(本文の項目名は 03 の `RequestJoinInput` が正。上は書き方の例。)

#### デモ用 API(`app/src/app/api/demo/`)
| ID | メソッド・パス | リクエスト | 成功応答 | エラー |
|---|---|---|---|---|
| CMN-API-01 | `GET /api/demo/me` | なし | `200 { user: DemoUserSummary, clock: ClockInfo, tools: boolean }` | - |
| CMN-API-02 | `POST /api/demo/me` | `{ userId: Id }`(`v.id("u")`) | `200 { user: DemoUserSummary }` + `Set-Cookie: demoUser=<id>; Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000` | 400 invalid_input(形式不正・存在しない ID。`fields.userId`)、404(`DEMO_TOOLS=off`) |
| CMN-API-03 | `GET /api/demo/users` | なし | `200 { items: DemoUserSummary[] }` | 404(`DEMO_TOOLS=off`) |
| CMN-API-04 | `GET /api/demo/clock` | なし | `200 ClockInfo` | - |
| CMN-API-05 | `POST /api/demo/clock` | `{ action: "advanceDays", days: 1..365 }` / `{ action: "set", at: IsoDateTime }` / `{ action: "reset" }` | `200 ClockInfo`。3 種の action のいずれでも `afterClockChange` フックを実行 | 400 invalid_input、404(`DEMO_TOOLS=off`) |
| CMN-API-06 | `POST /api/demo/reset` | `{}`(本文を省略してもよいが、`Content-Type: application/json` は必須) | `200 { ok: true, clock: ClockInfo }`。`resetStore()` 実行。`skipHooks: true`(リセット前の状態を評価しない) | 404(`DEMO_TOOLS=off`) |

- `DEMO_TOOLS`: 環境変数。既定は有効(未設定=on)。`off` で `me` の POST、`users`、`clock` の POST、`reset` を 404 にする。`NODE_ENV=production`(`next start`)でも既定で有効(09 章の起動方式が未決で、本番ビルドでのデモ初期化が必要になりうるため)。画面は常に「モック」「デモ用」と明示する。 [案] README・骨子の「production では無効」案からの変更(第 16 章)。
- 表のエラーに加え、POST はすべて第 5.5 の入口検査による 403・413・415 を返しうる。変更系(POST・PUT・PATCH・DELETE)は、本文の有無にかかわらず `Content-Type: application/json` を必須とする(本文のない POST と DELETE を含む。統一仕様 2.3)。
- `me` の GET は `DEMO_TOOLS=off` でも返す(視点の表示用)が、`tools:false` を付けて DemoBar の操作を隠す。
- 09 の `GET /api/demo/reports`(受け付けた通報の確認)も `/api/demo/` 配下に置き、`demoOnly: true` で同じ規則に従う(所有は 09)。

### 5.6 ページネーション・ソート(`lib/query.ts`)
| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-30 | `parsePage` | `(q: URLSearchParams, opts?: { defaultLimit?: number; maxLimit?: number }) => { limit: number; offset: number }` | 既定 limit 20、最大 50、offset 0 以上の整数。不正は `invalid_input`(`fields.limit`/`fields.offset`) |
| CMN-FN-31 | `paginate` | `<T>(items: readonly T[], page: { limit: number; offset: number }) => Page<T>` | `total` は絞り込み後の全件数。範囲外の offset は空配列 + `hasMore:false` |
| CMN-FN-32 | `parseSort` | `<K extends string>(q: URLSearchParams, opts: { allowed: readonly K[]; default: { key: K; dir: "asc" \| "desc" } }) => { key: K; dir: "asc" \| "desc" }` | `?sort=deadline:asc`。許可外のキーは `invalid_input`(`fields.sort`) |
| CMN-FN-33 | `sortBy` | `<T extends { id: Id }, K extends string>(items: readonly T[], sort: { key: K; dir: "asc"\|"desc" }, get: Record<K, (x: T) => string \| number>) => T[]` | 比較は文字列/数値。同値は `id` 昇順で安定化。元配列は変更しない |

- 02 の `page`/`pageSize` は画面側の表示単位とし、API は `limit`/`offset` で受ける(統一仕様 2.3)。
- `CursorPage<T>`(第 4.2)は型だけを提供する。カーソルの作り方(06 はメッセージ ID の連番、10 は通知 ID など)は各モジュールが決める。

### 5.7 権限ヘルパー(`lib/authz.ts`)
「幹事/メンバー」の判定は 00 が実装し、01 は再エクスポートだけを行う(01 は同名の関数を実装しない。統一仕様 6.1)。`UserRef = Id | { id: Id }`、`GroupRef = Id | { id: Id }`。

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-40 | `isMember` | `(user: UserRef, group: GroupRef) => boolean` | `members` に status=`active` の行がある(幹事も含む)。退会・辞退者(`left`)は false |
| CMN-FN-41 | `isOrganizer` | `(user: UserRef, group: GroupRef) => boolean` | active かつ role=`organizer` |
| CMN-FN-42 | `memberRole` | `(user: UserRef, group: GroupRef) => MemberRole \| null` | 非メンバーは null |
| CMN-FN-43 | `activeMembers` | `(group: GroupRef) => Readonly<GroupMember>[]` | active のメンバー(参加日時昇順)。人数は `.length` |
| CMN-FN-44 | `requireGroup` | `(id: Id) => Readonly<Group>` | 無ければ `not_found`。**公開範囲(非公開の隠蔽)は適用しない**(02・09 の責務) |
| CMN-FN-45 | `requireMember` | `(user: UserRef, group: GroupRef) => Readonly<GroupMember>` | 非メンバーは `forbidden`(隠したい文脈では呼び出し側で `not_found` に差し替える) |
| CMN-FN-46 | `requireOrganizer` | `(user: UserRef, group: GroupRef) => Readonly<GroupMember>` | 幹事以外は `forbidden`(「幹事のみができる操作です」) |
| CMN-FN-47 | `requireRole` | `(user: Readonly<DemoUser>, role: UserRole) => void` | role が異なれば `forbidden`。例: 12 の `requireRole(user, "municipal")`。`"host"` も指定できる |

- グループの素の取得は `requireGroup(id)`(無ければ `not_found`)と 01 の `getGroupById(id)`(`undefined`)の 2 つだけ(統一仕様 6.1)。
- 05〜08 の API でのグループ取得と権限判定(非公開・ブロックの隠蔽を含む)は 09 の `assertGroupAccess(userId, groupId, need)` を使う。本節の関数はその内部や、隠蔽が不要な判定に使う部品である。

### 5.8 フック(`lib/hooks.ts`、`features/bootstrap.ts`)
- 目的: 00 が上位モジュール(04 の `evaluateAll` など)を import せずに、API の前処理・時計変更・リセット時に上位の処理を呼べるようにする(依存の向きを「上位 → 00」の一方向に保つ)。 [案]
- CMN-FN-60 `registerHook(name: HookName, key: string, fn: () => void): void`(`type HookName = "beforeRequest" | "afterClockChange" | "afterReset"`)— `globalThis.__groupsHooks` に `key` で登録(同じ key は上書き。HMR の二重登録を防ぐ)。CMN-FN-61 `runHooks(name: HookName): void`(登録順に実行。1 つが例外でも残りを実行し、最初の例外を再 throw)。
- `features/bootstrap.ts` は各モジュールが 1 行ずつ追記する import 集約(例: `import "@/features/groups/lifecycle/register";`)。各モジュールの `register.ts` がフックの登録とドメインイベントの購読(第 5.12)を行う。`route()`(`api-route.ts`)と `src/test/setup.ts` から import する。`groups-store.ts` からは import しない(`register` → service → `groups-store` の循環 import を避けるため)。追記の衝突を避けるため**1 モジュール 1 行・アルファベット順**とする。
- 使う予定 [統一]:
  - `beforeRequest`: 04 が `registerHook("beforeRequest", "lifecycle", () => evaluateAll(clock.now()))`(第 5.5 の手順 4)。
  - `afterClockChange`: 04 が `evaluateAll` を登録(締切・辞退期間の遷移を実行して通知を生成)。
  - `afterReset`: 09 がレート制限の計数の初期化(`resetRateBuckets`)を登録。その他、各モジュールの Store 外の補助状態の初期化用。

### 5.9 クライアント(`lib/groups-api.ts`)
既存 `api.ts` を変更せず、同じ形で新設する(`"use client"`)。モジュール固有のクライアント(03 `joinApi`、05 `planApi`、06・09 `groupsApi`、08 `rally/client.ts`)は作らず、必要なら本節の関数を呼ぶ薄い関数にする [統一](統一仕様 3.5)。

```ts
export class ApiError extends Error {
  code: ErrorCode | "network"; status: number; reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown>;   // network のとき status は 0
  constructor(code: ErrorCode | "network", status: number, message: string, opts?: { reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown> });
}
export async function gapi<T>(path: string, init?: RequestInit): Promise<T>;           // path は "/api/groups/..." など完全なパス。cache:"no-store"、credentials は同一オリジンの既定
export const gpost: <T>(path: string, data?: unknown) => Promise<T>;                    // POST + JSON
export const gput: <T>(path: string, data?: unknown) => Promise<T>;                     // PUT + JSON(全置換)
export const gpatch: <T>(path: string, data?: unknown) => Promise<T>;
export const gdelete: <T>(path: string) => Promise<T>;                                  // 204 のときは undefined を返す
export function useGroupsApi<T>(path: string | null): { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };
export function useCurrentUser(): { user: DemoUserSummary | null; loading: boolean };   // GET /api/demo/me
export const NTF_REFRESH_EVENT = "ntf:refresh";
```
- 本文が JSON でない/ネットワーク失敗は `code:"network"` の `ApiError`。`error` は `{error, reason, message, fields, detail}` をそのまま保持(`message` を画面に出せる)。
- `gpost`/`gput`/`gpatch`/`gdelete` は本文の有無にかかわらず `Content-Type: application/json` を付ける(第 5.5 の入口検査)。`data` を省略したときは `{}` を送る(`gdelete` は本文を送らない)。
- `gpost`/`gput`/`gpatch`/`gdelete` が成功したら `window.dispatchEvent(new Event("ntf:refresh"))` を発火する(10 の通知バッジの即時再取得。10 の要望 R-5)。DemoBar の日付操作(`POST /api/demo/clock`)も `gpost` を使うため同じく発火する。失敗時は発火しない。
- `useGroupsApi` は既存 `useApi` と同じ形(`path === null` で取得しない、`reload()`)で、`error` が `ApiError`。ユーザー切替後は DemoBar が全体を再読み込みするため、フック側にキャッシュ無効化は持たない。
- パス組み立ての注意: ID は `encodeURIComponent` を通す。クエリは `URLSearchParams`。

### 5.10 検証(`lib/validation.ts`)
**自前実装(依存追加なし)**。第 10.2 で確定。理由: 必要な型は文字列・整数・列挙・日付・配列・オブジェクト程度で、zod(MIT)を追加すると直接依存と OSS 一覧の項目が増え、クライアントのバンドルも大きくなる。型推論は小さなジェネリクスで足りる。各モジュールは `v` 経由でのみ検証し、zod 等を直接 import しない(将来差し替える場合も `v.*` の内部だけを変える)。

```ts
export const INVALID: unique symbol;                     // Schema.parse が失敗を返すときの番兵値
export type Issues = Record<string, string>;              // 項目パス → メッセージ(同じパスは最初の 1 件だけ記録)
export interface Schema<T = unknown> { parse(input: unknown, path: string, issues: Issues): T | typeof INVALID; }
export type Infer<S extends Schema> = S extends Schema<infer T> ? T : never;
export function parse<S extends Schema>(schema: S, input: unknown): Infer<S>;      // 失敗は invalidInput(fields) を throw。全項目の問題を集める(最初の 1 件で止めない)
export function safeParse<S extends Schema>(schema: S, input: unknown): { ok: true; value: Infer<S> } | { ok: false; fields: Record<string,string> };

export const v: {
  string(o?: { min?: number; max?: number; maxLines?: number; multiline?: boolean; pattern?: RegExp; optional?: boolean; default?: string }): Schema<string>;
  int(o?: { min?: number; max?: number; coerce?: boolean; optional?: boolean; default?: number }): Schema<number>;
  boolean(o?: { coerce?: boolean; optional?: boolean; default?: boolean }): Schema<boolean>;
  enum<T extends string>(values: readonly T[], o?: { optional?: boolean; default?: T }): Schema<T>;
  id(prefix: IdPrefix, o?: { optional?: boolean }): Schema<Id>;
  slugId(prefix: SlugPrefix, o?: { optional?: boolean }): Schema<Id>;      // r-/mun-/host-(第 4.3)
  date(o?: { optional?: boolean }): Schema<DateStr>;                         // 実在する暦日(2026-02-30 は不可)
  datetime(o?: { optional?: boolean }): Schema<IsoDateTime>;                 // オフセット必須(Z も可)。出力は +09:00 に正規化した値
  array<S extends Schema>(item: S, o?: { min?: number; max?: number; unique?: boolean; optional?: boolean }): Schema<Infer<S>[]>;
  object<Shape extends Record<string, Schema>>(shape: Shape, o?: { optional?: boolean }): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }>;
  csv<S extends Schema>(item: S, o?: { max?: number; optional?: boolean }): Schema<Infer<S>[]>;   // クエリ "a,b,c" 用
  nullable<S extends Schema>(schema: S): Schema<Infer<S> | null>;                                  // null を受け付ける(統一仕様 3.4、3.7)
};
export function sanitizeText(s: string, o?: { multiline?: boolean }): string;
```

規則:
- **型は厳密**: 文字列に数値、`"3"` を `int` に渡す等は `coerce` 指定がない限り不可。`NaN`/`Infinity`/`MAX_SAFE_INTEGER` 超は不可。`null` は `v.nullable(schema)` で包んだ項目だけが受け付ける(それ以外は `optional` でも不可で、省略のみ許可)。`v.nullable(v.string({ optional: true }))` のように `optional` と組み合わせると、省略・`null`・値の 3 通りを受け付ける。PATCH は「省略 = 変更なし、`null` = 消去」、PUT の任意項目は文字列が「省略 = `""`」(`default: ""`)、それ以外が「省略 = `null`」とする(第 4.3。統一仕様 3.4)。各モジュールは自前の `nullable` を作らない。
- **本文の未知キーは捨てる**(マスアサインメント防止。`official`、`lifecycle`、`organizerId` を本文で受け取らない)。`object` の出力は shape のキーだけを新しいオブジェクトへ写したもの(`__proto__`・`constructor` 等の未知キーを取り込まない)。本文の性別・細かい年齢のキーも未知キーとして捨てる。クエリは `c.query` が strict に検証し、未知キーを `invalid_input` にする(第 5.5)。09 の `rejectProhibitedParams` はクエリだけを対象とし、02・03 の一覧のハンドラが先頭で呼ぶ(第 4.3。00 は 09 を import しない)。
- 本文・クエリの ID の形式不正は `invalid_input`(`v.id`/`v.slugId`)。パスの ID は `c.id()` が `not_found` にする(第 4.3)。
- `string`: 入力を `sanitizeText` に通してから長さを数える。既定は `min:1`(必須)、`optional:true` なら空/省略を許可(`default` があれば補う)。`maxLines` は `\n` で区切った行数の上限(06 のチャット 10 行)。`pattern` は sanitize 後に適用。
- `sanitizeText`: ① Unicode NFC に正規化、② 改行を `\n` に統一、③ 制御文字(U+0000〜001F。ただし `multiline` のとき `\n` `\t` を除く、U+007F〜009F)、ゼロ幅・双方向制御文字(U+200B〜200F、U+202A〜202E、U+2066〜2069、U+FEFF)を除去、④ 前後の空白を除去、⑤ `multiline:false` で `\n` を含む場合は `invalid_input`(除去ではなく拒否)。HTML は**入力時に除去・エスケープしない**(出力側のエスケープに一本化。入力時の変形は文字化けと二重エスケープの原因)。文字列の正規化は全モジュールでこの関数だけを使う(09・10 は自前の正規化を作らない。統一仕様 3.4)。
- 禁止表現(09)は 00 に含めない。各 service が parse の後で 09 の `assertTextAllowed(text, context, field, { ackReview })` を呼ぶ(違反は `invalid_input` + `reason: "text_denied"` + `fields[field]`、要確認は `invalid_input` + `reason: "text_review_required"` + `fields[field]` + `detail.reviewRequired: true`。`ackReview` は本文の最上位のキーで、スキーマに `v.boolean({ optional: true })` として宣言する。統一仕様 6.2)。
- 項目パスは `name`、`tags.2`、`trip.destination` の形。配列の問題は `tags`(件数)と `tags.2`(要素)。
- 数値クエリは `v.int({ coerce: true })`。真偽は `"true"`/`"false"` のみ。

### 5.11 日時ヘルパー(`lib/datetime.ts`)
依存なしの Date 演算で実装する(JST は +09:00 固定、夏時間なし)。`DateStr` は文字列の大小比較で前後を判定できる(`"2026-11-09" < "2026-11-20"`)。 [案]

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-50 | `toJstIso` | `(d: Date) => IsoDateTime` | `+09:00` 付き ISO 8601(秒精度)に変換 |
| CMN-FN-51 | `jstDate` | `(d: Date \| IsoDateTime) => DateStr` | JST の暦日を返す |
| CMN-FN-52 | `addDays` | `(date: DateStr, days: number) => DateStr` | 暦日を加減算(負数可)。月末・うるう年を考慮 |
| CMN-FN-53 | `daysBetween` | `(from: DateStr, to: DateStr) => number` | `to - from` の日数(整数。`to` が前なら負) |
| CMN-FN-54 | `isDateStr` | `(v: unknown) => v is DateStr` | `YYYY-MM-DD` 形式かつ実在する暦日 |
| CMN-FN-55 | `parseIso` | `(s: string) => Date \| null` | オフセット付き(`Z` 可)の ISO 8601 を解釈。オフセットなし・不正は `null` |
| CMN-FN-56 | `formatJst` | `(value: IsoDateTime \| DateStr, pattern?: string) => string` | JST での表示文字列。トークンは `YYYY`、`M`、`MM`、`D`、`DD`、`H`、`HH`、`mm`。既定は `IsoDateTime` なら `"M月D日 H:mm"`、`DateStr`(JST の暦日として扱う)なら `"M月D日"`(統一仕様 3.7)。10 の通知本文の締切などの日付も本関数で整形する。サーバー側(10 の通知本文)でも使えるよう dayjs に依存しない(10 の要望 R-2) |
| CMN-FN-57 | `startOfNextJstDay` | `(date: DateStr) => IsoDateTime` | `date` の翌日 00:00+09:00。04 の `deadlineAt`(`deadlineDate` の派生値)の計算と seed の整合検査に使う |

### 5.12 ドメインイベント(`lib/events.ts`)
- 目的: 発行側(01・04)が購読側(03・06・07)を import せずに処理を連動させ、循環依存(01↔06、04↔06、03↔04)をなくす。同期のイベントバスとする。 [統一](統一仕様 4.6)

```ts
import type { GroupStatus, CancelReasonCode } from "@/features/groups/lifecycle/types";   // 型のみ

export type DomainEvent =
  | { type: "group_created"; groupId: Id; organizerId: Id; at: IsoDateTime }
  | { type: "member_joined"; groupId: Id; userId: Id; at: IsoDateTime }
  | { type: "member_left"; groupId: Id; userId: Id; phase: GroupStatus; withdrawalId: Id; at: IsoDateTime }
  | { type: "status_changed"; groupId: Id; from: GroupStatus; to: GroupStatus;
      cancelReason: CancelReasonCode | null; revision: number; at: IsoDateTime };

export function emit(e: DomainEvent): void;                                     // CMN-FN-62
export function on<T extends DomainEvent["type"]>(                              // CMN-FN-63
  type: T, key: string, handler: (e: Extract<DomainEvent, { type: T }>) => void): void;
```

- `emit` は登録順に同期で呼び、呼び出し元の `tx` の中で動く(購読側の更新も同じ `tx` で巻き戻る)。`on` は `globalThis.__groupsEvents` に `(type, key)` で登録し、同じ key は上書きする(HMR の二重登録を防ぐ)。
- 購読側は例外を外へ出さない(自分で捕捉し、`console.error` に ID とコードだけを残す)。規約に反して購読側から例外が出た場合、`emit` は捕捉せずに再 throw し、`tx` 全体が巻き戻る(プログラムエラーとして `internal`)。
- 登録はフックと同じく各モジュールの `register.ts` から行い、`features/bootstrap.ts` で読み込む(第 5.8)。
- 発行と購読の対応(統一仕様 4.6 の表): `group_created` は 01 の `createGroup`・`createGroupInternal` が発行し 06 が購読、`member_joined` は 01 の `addMember` が承認によるメンバー追加のときだけ発行し(作成時の幹事の登録では発行しない)06 が購読、`member_left` は 04 の `withdraw` が `Withdrawal` の作成後に発行し(`withdrawalId` はその ID)06・07 が購読、`status_changed` は 04 の状態が変わるすべての遷移(`applyDue`、`onMembershipChanged`、`changeConditions` の後の評価、`withdraw`、`organizerCancel`、`replan`)が発行し 06・03 が購読する。01 の `markMemberLeft` は記録の受け口で、イベントを発行しない。
- 作成(T1)は状態の変化ではないため `status_changed` を発行しない。そのため `status_changed.from` は常に値を持つ(非 null)。作成の記録は 04 の `recordCreated` が `GroupStatusLog` に書く(統一仕様 4.6、5.1)。

## 6. 状態遷移・主要シーケンス
- 本モジュールにエンティティの状態遷移はない(グループは 04、申請は 03)。
- 状態を持つのは `clock`(live ⇄ frozen)と、ストアの `tx`(開始 → コミット/巻き戻し)のみ。
- シーケンス: ある変更系 API の呼び出し [案]

```
Client → route(): Origin/Content-Type/本文サイズの検査 → runHooks("beforeRequest")(04 の evaluateAll) → currentUser(Cookie) → handler
  handler: c.body(schema)   … 検証・サニタイズ(失敗なら 400)
           service(user, input)
             tx(db => { 権限確認(09 assertGroupAccess 等) → 状態確認 → 更新 → newId → 通知作成(10 notify) → emit(DomainEvent) })  … 同期・原子的(通知を先にする順序は統一仕様 5.3)
  → ok/created(DTO)   または  AppError → {error,reason,message,fields,detail} + ステータス
Client(gpost 等): 成功時に window へ "ntf:refresh" を発火
```

## 7. 入力検証・セキュリティ
OWASP Top 10(2021)の分類のうち、本モジュールに関係するものを示す。業務上の権限・公開範囲の判定は各モジュールが持ち、本モジュールは判定に使う共通部品を提供する。 [案]

| 分類 | 対処 | 実装箇所・試験 |
|---|---|---|
| A01 アクセス制御の不備・IDOR | 権限は常に `currentUser(req)`(Cookie)から判定し、本文・クエリ・パスの `userId` を根拠にしない。ID は連番で推測できる前提とし、ID を知っていることを権限の根拠にしない(各 service が操作ごとに 09 の `assertGroupAccess` や `requireMember` 等で確認する)。非メンバーに見せない対象は `not_found` で存在を隠す(判断は呼び出し側)。API 応答は DTO とし、`inviteCode` 等の内部項目を除く | `authz.ts`、`api-route.ts`、CMN-T-22、30、36 |
| A01 CSRF | Cookie で利用者を識別するため、(1) `SameSite=Lax`、(2) 変更系は `Content-Type: application/json` 必須(フォーム POST・`text/plain` を拒否する。別オリジンからの JSON 送信は CORS のプリフライトが必要になり、本アプリは CORS ヘッダを返さないためブラウザは送信しない)、(3) `Origin` が `Host` と異なれば拒否、の 3 点。CORS ヘッダは付けない(localhost 完結)。検査は `route()` に一本化し、09 は別の検査関数(`assertSafeRequest`)を作らない | `api-route.ts`、CMN-T-13 |
| A03 インジェクション・入力検証 | サーバー側で必ず検証する(クライアント検証は補助)。長さ・範囲・列挙・日付の実在・配列件数を `LIMITS` で検査する。未知キーを捨てる(マスアサインメント防止)。ID は `isId`・`isSlugId` の許可文字のみ。SQL を使わないため SQLi は該当しない。ユーザー入力から正規表現やコード(`eval`、`new Function`)を組み立てない | `validation.ts`、CMN-T-01〜10、51 |
| A03 XSS | 出力は React の既定エスケープに一本化し、`dangerouslySetInnerHTML` を禁止する(eslint `react/no-danger`)。入力は制御文字・ゼロ幅/双方向制御文字を除去するが HTML は加工しない。JSON API に `X-Content-Type-Options: nosniff` を付ける。URL を表示するモジュールは `http`/`https` スキームのみ許可する(`javascript:` を拒否)。通知本文はテンプレート + 変数とし、ユーザー入力を埋め込まない(10) | CMN-T-14、36、38 |
| A07 認証・セッション(デモ) | ログイン不要(rule.md)のため認証は持たない。`demoUser` Cookie は `HttpOnly`・`SameSite=Lax`・`Path=/` とし、値は形式と存在を検証して、不正値は既定ユーザーに置き換える。Cookie は利用者が書き換えられる(他のデモユーザーになれる)ことを既知の制約とし、実運用では認証が必要と 11 章に記載する [案] | `current-user.ts`、CMN-T-22、23 |
| A05 セキュリティ設定 | 全 API 応答に `Cache-Control: no-store` と `nosniff` を付ける。全ページ・全応答に `next.config.ts` の `headers()` で `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` を付ける(CSP は設けない [決定 2]。統一仕様 11.2)。エラー本文にスタックトレース・ファイルパスを出さない(`internal` は固定文)。`/api/demo/*` は `DEMO_TOOLS=off` で無効化できる。画面に「モック」「デモ用」を常時表示する | `api-route.ts`、`errors.ts`、`next.config.ts`、CMN-T-12、14、27、29、53 |
| A04 安全でない設計(過剰な操作) | 頻度制限は 09 の `checkRate` が判定し、00 は `rate_limited`(429)と `detail.retryAfterSec`・`Retry-After` ヘッダの形式を提供する | `errors.ts`、CMN-T-52 |
| A02 機密データの扱い | seed はすべて架空。DemoUser の公開は `/api/demo/users` の 3 項目(id、表示名、role)に限る。メール・電話・住所・性別の項目を型に持たない。推測困難な値は `crypto.randomBytes` で生成し、招待コードは DTO とログに出さない。`.env*` を読まず、秘密情報を設定に持たない | `groups-types.ts`、`ids.ts`、CMN-T-24、35 |
| A09 ログ | `console.error` に出すのは `internal` の例外と、購読側が捕捉したイベント処理の失敗(ID とコードのみ)とし、内容は `requestId`・メソッド・パス・例外に限る。本文・Cookie・招待コード・表示名は出さない。ログファイルは作らない | `api-route.ts`、`events.ts`、CMN-T-12 |
| パストラバーサル・過大入力 | ユーザー入力をファイルパスに使わない(永続化ファイルは固定パス)。本文 64KB 上限、配列件数の上限、`limit` 最大 50 | CMN-T-13、15、31 |

既知の制約(対処はデモ範囲外): 連番 ID による件数の推測、招待コード比較の処理時間の差と総当たり(照合は試行回数に数えない [決定 8])、Cookie の書き換えによる別ユーザーへの切替、CSP なし(インラインスクリプトの注入を防ぐ仕組みは React のエスケープと `dangerouslySetInnerHTML` の禁止のみ)、メモリストアの肥大や大量リクエストによる負荷には対処しない(デモはリセット API で復旧する)。

## 8. エラー処理
エラー一覧。コードと HTTP ステータスの対応は第 5.4 の表が正。画面の表示は `ErrorNotice`(第 3.2)と `useFormErrors` が行う。

| コード | HTTP | 本モジュールでの発生条件 | 他モジュールでの主な発生条件 | 画面での表示・挙動 |
|---|---|---|---|---|
| invalid_input | 400 | 検証失敗(項目パス付き)、JSON 不正、本文が空で `c.body()` を呼んだ、クエリ不正(`limit`・`offset`・`sort`、`c.query` の未知キー)、本文・クエリの ID 形式不正、`POST /api/demo/me` の形式不正・存在しない `userId`、`POST /api/demo/clock` の範囲外の値 | 禁止表現(09。`reason` は `text_denied`/`text_review_required`)、業務上の入力不備 | 項目ごとのメッセージを入力欄に表示する(`useFormErrors`)。`fields` が無いときは `ErrorNotice` に `message` を表示 |
| forbidden | 403 | `Origin` が `Host` と異なる変更系要求、`requireMember`・`requireOrganizer`・`requireRole` の不一致 | 幹事のみ・メンバーのみの操作、本人確認未了・18 歳未満(09。`reason` は `not_verified`/`underage`) | `ErrorNotice` で権限の説明と戻る導線を表示。Origin 不一致は通常の画面操作では起きない |
| blocked | 403 | なし(09 が使う) | ブロック関係(09) | ブロックの有無を示さない一般的な文言のみ表示 |
| not_found | 404 | パスの ID 形式不正、`requireGroup`・`getOrThrow` で対象なし、`DEMO_TOOLS=off` のときの `/api/demo/*`(GET の `me`・`clock` を除く) | 存在しない、参照できない(非公開・非メンバー) | `ErrorNotice` で一覧へ戻る導線を表示(存在しないと見えないを区別しない) |
| conflict | 409 | なし(各モジュールが使う) | 重複申請、定員超過、同時操作による不整合(`reason: "version_mismatch"` + `detail.current`)、件数上限の超過(`reason: "limit_exceeded"`。07・08) | 「画面を更新して最新の状態を確認」を表示し、`onRetry` で再取得 |
| unavailable_state | 409 | なし(各モジュールが使う) | 確定済み・中止済み・締切後など、現在の状態では実行できない | 原因と `detail.allowedActions` の操作を表示 |
| rate_limited | 429 | なし(09 の `checkRate` が使う) | チャットの投稿(60 秒に 10 件)、申請・通報・ブロック等の頻度超過 | 「しばらく待ってから再試行してください」を表示。`detail.retryAfterSec` の秒数の表示は見送り(統一仕様 16.2) |
| payload_too_large | 413 | 本文が 64KB を超える | 同左 | 「入力を短くしてください」。入力欄の上限があるため通常の画面操作では起きない |
| unsupported_media_type | 415 | 変更系で `Content-Type` が JSON でない | 同左 | 通常の画面操作では起きない。「画面を再読み込みしてやり直してください」 |
| method_not_allowed | 405 | `route.ts` が export していないメソッド(Next.js が応答 [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)]) | 同左 | 画面操作では発生しない(デモ範囲外) |
| internal | 500 | 想定外の例外、フック(`runHooks`)内の例外、イベント購読側の規約違反の例外 | 同左 | 「問題が発生しました」と「画面を再読み込み」「デモを初期化」の案内。`detail.requestId` を表示 [案] |
| (client) network | - | fetch 失敗・非 JSON 応答(`gapi` が生成) | 同左 | 「サーバーに接続できません。起動していることを確認して再試行してください」。ローカル保存・読込の失敗に相当(06 章) |

- DemoBar の操作(ユーザー切替・日付・初期化)が失敗したときは再読み込みせず、DemoBar 内に `ErrorNotice` を表示する。
- データ不整合(seed 検証失敗)は初回のストアアクセス時に例外とし、メッセージにファイル名と項目パスを含める(復旧は seed の修正と再起動。06 章の未決の暫定)。

## 9. 試験観点・試験項目

### 9.1 テスト基盤 [決定 11]
- ツール: **Vitest**(MIT。devDependency のみで成果物には含まれない。第 10.2)。全モジュールが Vitest を使い、`node --test` と「相対 import 必須」の制約は設けない(統一仕様 11.3)。環境は `node`(サーバー側の純粋関数・Route Handler を直接呼ぶ)。コンポーネントの表示確認は手動(第 9.3)とし、jsdom によるコンポーネントの自動試験は行わない(デモ範囲外)。導入時に、Vitest が要求する Node.js のバージョンと実行環境の Node.js(Next.js 16 は 20.9 以上)が合うことを確認する [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2 と同じ扱い)]。OSS 一覧(docs/design/08)への追記は CMN-TASK-16。
- 実行コマンド(`app/` で): `npm test`(= `vitest run`)、`npm run test:watch`(= `vitest`)、型検査 `npx tsc --noEmit`、`npm run lint`、`npm run build`(package.json の `build` に `--webpack` 指定済み。ルートが動的になっているかの確認を含む)。
- `vitest.config.ts`: `test.environment: "node"`、`resolve.alias: { "@": "<app>/src" }`、`test.setupFiles: ["src/test/setup.ts"]`、`include: ["src/**/*.test.ts"]`。`setup.ts` は先頭で `@/features/bootstrap` を import し(フック・イベント購読の登録。第 5.8)、各テストの前に `resetStore()` と `clock.freeze(seed の demoNow)` を行う(テスト間の独立)。
- `src/test/helpers.ts`:

```ts
export function resetForTest(opts?: { now?: IsoDateTime }): void;                 // resetStore() + clock.freeze(opts.now ?? demoNow)
export function asUser(userId: Id): { cookie: string };                            // "demoUser=u-002"
export interface CallOptions { method?: string; body?: unknown; user?: Id; headers?: Record<string, string>; params?: Record<string, string>; rawBody?: string; }
export async function callRoute(handler: (req: Request, ctx: { params: Promise<any> }) => Promise<Response>, path: string, opts?: CallOptions): Promise<{ status: number; body: any; headers: Headers }>;
// path は "/api/groups/g-001?limit=5" 形式。Request("http://localhost:3000"+path) を作り、変更系は本文の有無にかかわらず Content-Type: application/json を付与する
export function insertGroup(partial?: Partial<Omit<Group, "trip" | "lifecycle">> & { trip?: Partial<Trip>; lifecycle?: Partial<GroupLifecycle> }): Readonly<Group>;
// seed ファイルを変更せずストアに追加する(テスト専用)。ID は partial.id で受け取る(900 番台の固定 ID。例 "g-901")。
// trip・lifecycle は既定値と項目単位で合成し、幹事メンバー行も作る
export function insertMember(groupId: Id, userId: Id, role?: MemberRole, id?: Id): Readonly<GroupMember>;   // id の例 "m-901"
export function insertBlock(blockerId: Id, blockedId: Id, id?: Id): Readonly<Block>;                       // id の例 "bl-901"。09 の Block を有効(releasedAt: null)で追加
```
- 試験用データの ID [統一](統一仕様 3.2、3.7、11.3): `insertGroup`・`insertMember`・`insertBlock` は ID を引数で受け取り、900 番台の固定 ID(`g-901`、`u-901`、`m-901`、`bl-901` など)を使う。seed の採番(`g-014` 以降)と重ならない。固定 ID を入れても `counters` は変えない(後続の `newId("g")` は `g-014` のまま)。ID を省略した場合は `newId` で採番する。`g-t06`・`u-new`・`u-minor`・`g-pub` のような形式外の ID は使わない。
- `src/test/fixtures.ts`: seed の ID 定数。試験に ID 文字列を直書きしない。 [統一](統一仕様 11.3)
  - `USER = { misaki: "u-001", kenta: "u-002", ..., unverified: "u-010", municipalB: "u-011", host: "u-012" }`、`REGION`、`MUNICIPALITY`、`HOST`。
  - 状態ごとの見本 `GROUP_BY_STATUS: Record<GroupStatus, Id>` = `{ recruiting: "g-001", min_reached: "g-003", withdrawal_period: "g-004", confirmed: "g-005", in_progress: "g-011", completed: "g-010", cancelled: "g-013", replanned: "g-006" }`(`replanned` の再企画先は g-007)。旧定数 `GROUP`(`reached`・`ongoing` などの独自名)は `GROUP_BY_STATUS` に置き換えた。
  - 状態以外の見本: `OFFICIAL_GROUPS = ["g-002", "g-005"]`、`PRIVATE_GROUP = "g-008"`(招待コードは seed のダミー値)、`BLOCK_SAMPLE = { blockerId: "u-001", blockedId: "u-006" }`、`LEFT_MEMBER_SAMPLE = { groupId: "g-011", userId: "u-006", withdrawalId: "wd-002" }`、`UNVERIFIED_USER = "u-010"`、`UNDERAGE_USER = "u-008"`。統一仕様 11.3 に無い見本(再企画先 g-007、定員 2 の g-009、満員の g-012)は `REPLAN_TARGET_GROUP`、`ONE_TO_ONE_GROUP`、`FULL_GROUP` とする [案]。
- 試験の置き場所: 各モジュールは自分の `features/<m>/*.test.ts` に書く。共通基盤の試験は `lib/*.test.ts`。

### 9.2 試験項目(自動。単体・結合。docs/design/10 の「状態の反映」「入力検証」を支える)
| ID | 対象 | 入力・操作 | 期待結果 |
|---|---|---|---|
| CMN-T-01 | v.string 必須 | `parse(v.object({name: v.string({max:30})}), {name: ""})` | `invalid_input`、`fields.name` = 「入力してください」 |
| CMN-T-02 | v.string 整形・長さ・行数 | `"  旅  "` → `"旅"`。`max:30` で 31 字 → 失敗。`"😀"×30` → 成功(コードポイントで数える)。`{multiline:true, maxLines:10}` で 11 行 → 失敗(「10行までです」) | 左記どおり |
| CMN-T-03 | sanitizeText | `"a\u0000b\u202Ec\u200B"` → `"abc"`。`multiline:false` で `"a\nb"` → 失敗。`multiline:true` で `"a\r\nb"` → `"a\nb"` | 左記どおり |
| CMN-T-04 | v.int | `2.5`、`"3"`、`NaN`、`2**53` → 失敗。`{min:2,max:6}` で 1 と 7 は失敗、2 と 6 は成功。`coerce:true` で `"3"` → 3 | 左記どおり |
| CMN-T-05 | v.enum / v.boolean | 列挙外 `"x"` → `fields.<key>` = 「選択肢から選んでください」。`boolean` に `"true"` → 失敗(coerce なし) | 左記どおり |
| CMN-T-06 | v.array | `tags` 6 件 → `fields.tags`「5件までです」。要素 3 番目が空 → `fields["tags.2"]`。`unique:true` で重複 → 失敗 | 左記どおり |
| CMN-T-07 | object の未知キー除去 | `{name:"x", official:true, lifecycle:{status:"confirmed"}, organizerId:"u-002"}` を `{name}` のスキーマで parse | 結果は `{name:"x"}` のみ |
| CMN-T-08 | v.date / v.datetime | `"2026-02-30"` 失敗、`"2026-12-05"` 成功。`"2026-12-05T10:00:00"`(オフセットなし)失敗、`"...+09:00"`・`Z` 成功し `+09:00` に正規化 | 左記どおり |
| CMN-T-09 | v.id / isId | `v.id("g")`: `"g-001"` 成功、`"../etc"`、`"u-001"`、`"g-1"`、`"g-001 "`、`"g-123456789"` 失敗。`isId("msg","msg-001")`、`isId("pi","pi-010")`、`isId("fe","fe-001")` は true。`isId("m","msg-001")` は false | 左記どおり |
| CMN-T-10 | 複数エラーの集約 | 3 項目が不正な本文 | `fields` に 3 キーすべて(最初の 1 件で止まらない) |
| CMN-T-11 | toResponse の対応表 | 各 `ErrorCode` の AppError(`reason` 付きを含む) | ステータス 400/403/403/404/405/409/409/429/413/415/500、本文に `error`・`message` が必ずあり、`reason` を渡したときは最上位に `reason` がある |
| CMN-T-12 | internal の秘匿 | `throw new Error("secret path C:\\x")` | 500 `{error:"internal"}`、本文に "secret" を含まず `detail.requestId` がある。`console.error` が呼ばれる |
| CMN-T-13 | ラッパーの入口検査 | POST を (a) `Content-Type: text/plain` (b) `Origin: http://evil.example`(Host は localhost:3000) (c) 本文 70KB (d) 不正 JSON `{` で送る | (a) 415 (b) 403 forbidden (c) 413 (d) 400 invalid_input |
| CMN-T-14 | ラッパーの共通ヘッダ | 任意の GET/POST/エラー応答 | `Cache-Control: no-store`、`Content-Type: application/json`、`X-Content-Type-Options: nosniff` |
| CMN-T-15 | パスの ID 検証 | `c.id("groupId","g")` に `"..%2Fx"`、`"u-001"` | 404 not_found |
| CMN-T-16 | tx の巻き戻し | `tx` 内で `groups.insert` と `newId("g")` の後に throw | 例外が再 throw、`groups.count()` と `counters.g` が開始前と同じ |
| CMN-T-17 | tx の入れ子・非同期禁止 | 入れ子の内側で throw → 外側も巻き戻る。`tx(async () => {})` | 前者は全体が戻る。後者は Error |
| CMN-T-18 | ホットリロード耐性(見送り。統一仕様 16.2) | `vi.resetModules()` の後に `groups-store` を再 import して `db()` で取得 | 再 import 前に挿入したデータが残る(globalThis 共有) |
| CMN-T-19 | resetStore | グループ追加・時計進行・ユーザー変更後に `resetStore()` | seed の件数と `demoNow` の時刻に戻り、`newId("g")` は `g-014` |
| CMN-T-20 | newId / newToken / idSeq | 連続 2 回、未登録接頭辞 `"zz"`、`newToken()` を 100 回、`idSeq("msg-012")` | 連番で重複なし、`zz` は Error、トークンは長さ・文字集合が一定で重複なし、12 |
| CMN-T-21 | Repo | `update("g-999", {})`、`getOrThrow("g-999")`、`insert` で既存 id、`update` で `id` 変更を試みる | not_found、not_found、Error、id は変更されない(型で禁止 + 実行時に無視) |
| CMN-T-22 | currentUser の解決 | Cookie なし / `demoUser=u-002` / `demoUser=u-999` / `demoUser=../x` / 長さ 1000 の値 | u-001(既定)/ u-002 / u-001 / u-001 / u-001 |
| CMN-T-23 | POST /api/demo/me | `{userId:"u-002"}`、`{userId:"u-999"}`、`{}` | 200 + `Set-Cookie: demoUser=u-002` に `HttpOnly`・`SameSite=Lax`・`Path=/`。u-999 は 400(`fields.userId`)。`{}` も 400 |
| CMN-T-24 | 視点の切替 | 同じ `GET /api/demo/me` を Cookie `u-001` と `u-004` で | `user.id` が異なる。`GET /api/demo/users` は 12 件で各要素が `id`・`displayName`・`role` の 3 項目のみ(`municipalityId`・Profile の項目を含まない) |
| CMN-T-25 | clock の基本 | `freeze("2026-11-09T09:00:00+09:00")`、`advanceDays(3)` | `today()`=`"2026-11-12"`、`nowIso()` が `+09:00` で終わる、`info().shiftedDays`=3 |
| CMN-T-26 | clock の JST 境界 | `freeze("2026-11-09T00:30:00+09:00")`(UTC では 11-08)、`freeze("2026-11-09T23:59:59+09:00")` | `today()` は両方 `"2026-11-09"`。`advanceDays(1)` で 11-10 |
| CMN-T-27 | clock API の入力 | `POST /api/demo/clock` に `days:0`、`days:366`、`days:1.5`、`action:"x"`、`at:"2026-11-09"` | すべて 400 invalid_input。`days:3` は 200 で `ClockInfo`。`DEMO_TOOLS=off` で 404 |
| CMN-T-28 | clock.reset / unfreeze | (a) 進めた後 `reset()`。(b) `freeze("2026-11-10T09:00:00+09:00")` の後 `unfreeze()` | (a) `mode`=`live`、`nowIso()` が `demoNow` から 5 秒以内。(b) `mode`=`live`、`nowIso()` が 2026-11-10T09:00:00+09:00 から 5 秒以内 |
| CMN-T-29 | POST /api/demo/reset | 変更後に呼ぶ。`beforeRequest` に記録用のフックを登録しておく | 200 `{ok:true}`、データと時計が seed に戻る。`beforeRequest` フックは呼ばれない(`skipHooks`)。`DEMO_TOOLS=off` で 404 |
| CMN-T-30 | authz | `isOrganizer(u-001,g-001)`、`isOrganizer(u-002,g-001)`、`isMember(u-006,g-004)`(辞退)、`isMember(u-004,g-001)`(申請中)、`requireOrganizer(u-002,g-001)`、`requireGroup("g-999")`、`activeMembers("g-012").length`、`requireRole(u-001,"municipal")`、`requireRole(u-012,"host")` | 順に true、false、false、false、forbidden、not_found、3、forbidden、例外なし |
| CMN-T-31 | parsePage / paginate | `limit=0`、`51`、`abc`、`offset=-1`、省略。25 件で `limit=10&offset=20`、`offset=100` | 不正は 400(`fields.limit`/`fields.offset`)。省略は 20/0。`items` 5 件・`hasMore:false`・`total:25`。範囲外は空・`total` 不変 |
| CMN-T-32 | parseSort / sortBy | `sort=deadline:asc`、`sort=password:asc`、`sort=deadline`、同値の 2 件 | 許可外・形式不正は 400(`fields.sort`)。同値は `id` 昇順 |
| CMN-T-33 | datetime ヘルパー | `addDays("2026-11-30",1)`、`addDays("2028-02-28",1)`、`daysBetween("2026-11-09","2026-12-05")`、`toJstIso(new Date("2026-11-09T00:00:00Z"))`、`jstDate("2026-11-08T15:30:00Z")`、`isDateStr("2026-02-30")`、`parseIso("2026-11-09T09:00:00")`、`formatJst("2026-11-09T09:05:00+09:00")`、`formatJst("2026-11-08T15:30:00Z","YYYY-MM-DD HH:mm")`、`formatJst("2026-11-20")`(`DateStr`)、`startOfNextJstDay("2026-11-20")` | `"2026-12-01"`、`"2028-02-29"`、26、`"2026-11-09T09:00:00+09:00"`、`"2026-11-09"`、false、null、`"11月9日 9:05"`、`"2026-11-09 00:30"`、`"11月20日"`、`"2026-11-21T00:00:00+09:00"` |
| CMN-T-34 | seed の整合 | `parseSeed(groupSeedJson)` と整合検査 | 成功。ID が一意で、採番 ID は `isId`、seed で決める ID は `isSlugId` を満たす。外部キー(groupId、userId、spotId、`region`、`lifecycle.replanOfGroupId`・`replannedToGroupId`、`reentryOfGroupId`、`municipalityId`、`hostId`、`Municipality.regionIds`)がすべて存在。`lifecycle.minMembers ≤ capacity ≤ 6`、`lifecycle.deadlineAt = startOfNextJstDay(deadlineDate)`。active 人数 ≤ capacity。各グループに active な幹事がちょうど 1 人で `organizerId` と一致。8 状態すべて、再企画の連鎖(g-006 が `replanned` で `replannedToGroupId: g-007`、g-007 の `replanOfGroupId: g-006`)、非公開 1、公式 2(`listings` あり)、定員 2 が存在。全ユーザーに Profile と Verification がある。`role=municipal` は `municipalityId`、`role=host` は `hostId` を持つ。幹事・active メンバー・申請者はすべて `verified`(09 の `requireVerified` と矛盾しない)。g-013 が `cancelled` で `replannedToGroupId: null`。`withdrawals` の wd-001(g-004、`phase: withdrawal_period`)・wd-002(g-011、`phase: confirmed`)と、対応するメンバー行(u-006)の `status: "left"` が一致する。全ユーザーで `Profile.displayName === DemoUser.displayName`。`notifications` の `kind` がすべて必須 12 種(統一仕様 9.1)に含まれる |
| CMN-T-35 | seed の衛生 | seed 全文字列を検査 | 「相乗り」「マッチング」「恋」「出会い」を含まない。`gender`/`sex`/`email`/`phone` のキーなし。メール・電話番号らしいパターンなし。`displayName` は 1〜20 字で姓を含まない(目視 + パターン) |
| CMN-T-36 | 静的検査 | `src/**/*.{ts,tsx}` と `src/app/` のフォルダ構成を走査 | `dangerouslySetInnerHTML` が 0 件。`/api/groups` の Route Handler に `userId` を本文から受ける定義がない(`body`/`query` スキーマに `userId`/`actorId` キー不在)。`src/app/` 配下に `_` で始まるフォルダがない(R-1)。新設したフォルダで、同じ階層に静的セグメントと動的セグメントが並ばない(R-2。既存の `src/app/api` と `src/app/[campaign]` は対象外) |
| CMN-T-37 | クライアント ApiError | `gapi` を fetch モックで `{error:"invalid_input",reason:"invalid_code",message:"x",fields:{a:"b"}}`(400)と、非 JSON 応答、reject で | 1 つめは `code`・`status`・`reason`・`fields` を保持。残りは `code:"network"` |
| CMN-T-38 | サニタイズの非破壊 | 本文 `"<script>alert(1)</script>"` を `v.string` で parse | `<script>...` が**そのまま**返る(入力時に加工しない。出力側のエスケープが責務) |
| CMN-T-39 | 既存 API の無影響 | `/api/v2/user`、`/api/v2/spots` の GET と、`POST /api/demo/reset` の後の再 GET | 既存の応答が変わらない(既存ストアを変更していない) |
| CMN-T-40 | ビルドの動的扱い | `npm run build` の出力 | `/api/demo/*` が動的ルート(ビルド時に事前生成されない)。型エラー・lint エラーなし [要確認: `cacheComponents` 下の表示形式。実装着手時に確認する事項(判断は不要。統一仕様 14.2)] |
| CMN-T-46 | フック | `registerHook("afterClockChange","a",f1)` を 2 回(二重登録の部分は見送り。統一仕様 16.2)、例外を投げる f2 を key `"b"`、f3 を key `"c"` で登録して `runHooks("afterClockChange")` | f1 は 1 回だけ実行(見送り)、f3 も実行され、f2 の例外が再 throw される |
| CMN-T-47 | ApiResult の識別 | handler が `{ id: "jr-001", status: "pending" }`(DTO)を返す | 200 で本文がその DTO。`status` 項目を HTTP ステータスとして扱わない |
| CMN-T-48 | beforeRequest フック | `beforeRequest` に呼び出し順を記録するフックを登録し、`route()` のハンドラを GET で呼ぶ。フックが例外を投げる場合も試す | フックがハンドラより前に 1 回呼ばれる。フックの例外は 500 internal でハンドラは呼ばれない。入口検査で 415 になる要求ではフックが呼ばれない |
| CMN-T-49 | ドメインイベント | `on("status_changed","a",h1)` を 2 回(二重登録の部分は見送り。統一仕様 16.2)、`on("member_left","b",h2)` を登録し、`tx` 内で `emit({type:"status_changed", from:"recruiting", to:"min_reached",...})`。続いて例外を投げる購読を登録して `tx` 内で `emit` | h1 は 1 回だけ(見送り)、h2 は呼ばれない。例外を投げる購読では `emit` が再 throw し、`tx` 内の更新が巻き戻る |
| CMN-T-50 | クライアントの gput と ntf:refresh | fetch モックで `gput`(200)、`gpost`(201)、`gdelete`(204)、`gpatch`(409)を呼び、`window` の `ntf:refresh` を数える | `gput` は PUT + `Content-Type: application/json`。成功した 3 件で `ntf:refresh` が 3 回、409 では発火しない。`gdelete` の 204 は `undefined` を返す |
| CMN-T-51 | isSlugId / v.slugId | `isSlugId("r","r-mizukoto")`、`isSlugId("mun","mun-demo-a")`、`isSlugId("host","host-demo-a")`、`isSlugId("r","r-Mizukoto")`、`isSlugId("r","g-001")`、31 字の slug | true、true、true、false、false、false |
| CMN-T-52 | rate_limited | `rateLimited(30)` を投げるハンドラ | 429、本文 `{error:"rate_limited", message, detail:{retryAfterSec:30}}`、`Retry-After: 30` ヘッダ |
| CMN-T-53 | セキュリティヘッダー | `next.config.ts` の `headers()` を呼ぶ(Vitest)。手動で `npm run build && npm start` の後、任意のページを `curl -I` | `source: "/:path*"` に `X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` の 3 つ。`Content-Security-Policy` は無い。`cacheComponents`・`partialPrefetching` が残っている |
| CMN-T-54 | v.nullable | `v.object({ a: v.nullable(v.string({ optional: true })), b: v.string({ optional: true }) })` に `{a: null}`、`{a: "x"}`、`{}`、`{b: null}` | `{a: null}` は `a` が `null`、`{a:"x"}` は `"x"`、`{}` は成功(`a` は省略のまま)、`{b: null}` は失敗(`fields.b`。nullable でない項目は `null` 不可) |
| CMN-T-55 | c.query の strict 検証 | `c.query(v.object({ region: v.slugId("r", { optional: true }) }))` に `?region=r-mizukoto&limit=10&offset=0&sort=deadline:asc`、`?foo=1`、`?gender=x` | 1 つめは成功(`limit`・`offset`・`sort` は許可)。`foo`・`gender` は 400 invalid_input(`fields.foo`・`fields.gender`) |
| CMN-T-56 | 試験用データの投入 | `insertGroup({ id: "g-901" })`、`insertMember("g-901","u-002",undefined,"m-901")`、`insertBlock("u-002","u-003","bl-901")` の後に `newId("g")` | 3 件が入り、g-901 には幹事メンバー行がある。`newId("g")` は `g-014`(`counters` を変えない) |

(CMN-T-41〜45 は手動確認のため第 9.3 に置く。)

### 9.3 手動確認(スマホ幅・表示)
| ID | 確認 | 期待 |
|---|---|---|
| CMN-T-41 | DemoBar の表示(幅 360px) | 「モック」バッジ、現在ユーザー、日付が 1〜2 行に収まり横スクロールなし。操作は 44px 以上のタップ領域 |
| CMN-T-42 | ユーザー切替 | 切替後に再読み込みされ、同じ画面の内容が視点に応じて変わる(例: g-001 で幹事ボタンの有無) |
| CMN-T-43 | 日付を進める → リセット | 日付表示が進み、リセットで初期日付に戻る。確認ダイアログが出る |
| CMN-T-44 | ErrorNotice | 400/404/409/429/500/ネットワーク断それぞれで、原因と次の行動が表示され、色だけに依存しない(スクリーンリーダーで `alert` として読まれる)。429 の残り秒数の表示は見送り(統一仕様 16.2) |
| CMN-T-45 | StatusBadge | 全状態(グループ 8 値、申請 5 値)の色が第 3.2 の表と一致し、渡したラベルが表示される。未知の値でも例外にならず、灰色で表示する |

## 10. 依存するモジュール・利用ライブラリ

### 10.1 依存するモジュール
- 自前モジュールへの実行時の依存: なし(最下層)。上位モジュールの処理は `hooks.ts` の登録機構と `events.ts` の購読で呼ぶ(第 5.8、5.12)。例外として `api-route.ts` と `src/test/setup.ts` が `features/bootstrap.ts` を import する。
- 型だけの参照: `groups-types.ts` の再エクスポートと `groups-store.ts` の `Db` の型、`events.ts` の `DomainEvent` は、所有モジュールの `types.ts` を `import type` で参照する(第 4.2。統一仕様 4.6 の「型だけの相互参照は許す」)。
- 呼ばれる側: 全モジュール(第 14 章)。

### 10.2 利用ライブラリ・モジュール
採否は本節で確定する(推奨案。変更は本書の改訂で行う)。既存の依存は `app/package.json` の指定を維持し、新規に追加するのは Vitest だけで、導入時点の最新の安定版を使う(統一仕様 11.1)。ライセンスは導入時に `npm ls` と各パッケージの `license` 項目で確認し、OSS 一覧(docs/design/08)に載せる(CMN-TASK-16)。

| 名前 | 種別 | 本モジュールでの用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | 既存 dependency | App Router、Route Handler(`/api/demo/*`、共通ラッパー)、`next.config.ts` の `headers()` | MIT | 16.4.5 を維持 |
| react / react-dom | 既存 dependency | 共通 UI・DemoBar | MIT | 19.3.0 を維持 |
| @mantine/core | 既存 dependency | `Alert`、`Skeleton`、`Badge`、`Select`、`Modal`(初期化の確認ダイアログ)、`Button` | MIT | ^9.7.5 を維持 |
| dayjs | 既存 dependency | クライアントでの日時表示の整形のみ。サーバー側では使わない(サーバーの整形は `formatJst`) | MIT | ^1.11.23 を維持 |
| typescript | 既存 devDependency | 型検査(`tsc --noEmit`) | Apache-2.0 | ^5 を維持 |
| eslint / eslint-config-next | 既存 devDependency | lint。`react/no-danger` は eslint-config-next が導入する eslint-plugin-react の規則、`no-restricted-properties`・`no-restricted-syntax` は ESLint 本体の規則 | MIT | ^9 / 16.4.5 を維持。eslint-plugin-react は直接追加しない |
| @types/node | 既存 devDependency | Node 標準モジュールの型 | MIT | ^20 を維持 |
| vitest | 新規 devDependency | 単体・結合試験(第 9 章) | MIT | 最新の安定版を使う |
| node:crypto | Node 標準 | `randomBytes`(`newToken`、`requestId`) | Node.js に同梱 | 実行環境の Node.js に従う |
| node:fs / node:path | Node 標準 | 任意の JSON 永続化(CMN-TASK-15)のみ | Node.js に同梱 | 同上 |
| Web 標準 API | 実行環境 | `Request`・`Response`・`URL`・`URLSearchParams`、`structuredClone`(`tx` の巻き戻し)、`TextEncoder`(本文のバイト数)、`String.prototype.normalize`(NFC)、`fetch`・`window.dispatchEvent`(クライアント) | - | Node.js 20.9 以上(Next.js 16 の要件。[事実] package-lock.json の engines)とブラウザに従う |

自前で実装するもの:

| 対象 | ファイル | 理由 |
|---|---|---|
| 検証 DSL `v` | `validation.ts` | 必要な型が少なく、zod 等の直接依存と OSS 一覧の項目を増やさないため(第 5.10) |
| Cookie の解析 | `current-user.ts` | 読むのは `demoUser` の 1 キーだけで、数行で書けるため |
| 日時ヘルパー・`formatJst` | `datetime.ts` | JST(+09:00 固定、夏時間なし)だけを扱うため、Date 演算で足りるため |
| Crockford Base32 | `ids.ts` | 数行の変換で済むため |
| ストア・トランザクション・時計・フック・イベントバス | `groups-store.ts`、`hooks.ts`、`events.ts` ほか | 既存 `server-store.ts` と同じ globalThis 方式で、デモ規模ではライブラリが不要なため |
| セキュリティヘッダー | `next.config.ts` | Next.js の `headers()` で設定できるため(helmet は使わない) |

採らないもの:

| 名前 | 理由 |
|---|---|
| zod | 自前の `v` で足りるため。[事実] package-lock.json には間接依存として zod 4.6.7 が入っているが、直接依存ではないため import しない |
| Zustand(既存 dependency) | 本モジュールはクライアント側の共有状態を持たないため使わない(他モジュールでの利用は妨げない) |
| SWR | `useGroupsApi` と `ntf:refresh` で足りるため |
| SQLite(better-sqlite3 等) | ネイティブ依存とライセンス確認の工数が競技規模に対して大きいため。既定は永続化なし(第 5.1) |
| helmet | Next.js の `headers()` で足りるため |
| jsdom、@testing-library/react | コンポーネントは手動で確認し(第 9.3)、自動試験はデモ範囲外とするため |
| node:test + tsx | 試験ツールは Vitest に統一するため [決定 11] |
| Cookie 解析・UUID・イベントエミッタ等の小さなライブラリ | Node 標準と数行の自前実装で足りるため |

## 11. 未決事項
| 項目 | 内容 | 暫定 |
|---|---|---|
| 永続化(03・05 章) | JSON ファイル/SQLite の要否 | 既定は永続化なし。JSON 書き出しは任意機能(CMN-TASK-15)。SQLite は採らない(第 10.2) |
| 利用者識別(05 章) | ダミーユーザー ID で足りるか | 足りるとして進める。キャンペーン横断はスコープ外 [案] |
| DEMO_TOOLS の既定 | production でデモ用 API を有効にするか | 既定で有効。09 章の起動方式(`next start` 標準か)が決まったら再検討 |
| デモの現在日 | `meta.demoNow` の値 | 2026-11-09 [推定]。デモ実施日が決まったら更新 |
| i18n(02 章) | 多言語の要否 | 日本語のみ。文言は `messages.ts` に集約 [案] |
| 18 歳未満のユーザーの年代帯 | 09 の `AgeBand` に 18 歳未満の帯がない | 解消(統一仕様 6.3、11.4)。帯は追加せず、u-008 の `Profile.ageBand` は `18-19`、18 歳未満であることは `Verification.status = "underage"` だけで表す(第 4.4) |

次の項目は統一仕様で確定したため本表から除いた: 検証ライブラリとテストツール(第 10.2、[決定 11])、年代帯の区分(09 の `AgeBand`)、通知の種類(10。統一仕様第 9 章)、辞退と退会の区別(`MemberStatus` と 04 の `withdrawals`)、締切の型(`deadlineDate` と `deadlineAt`)。

## 12. 実装メモ(デモ範囲)
- 最小(デモ必須): 型・エラー・ID・日時(TASK-01〜02)、検証(03)、ストアと seed(04〜05)、clock(06)、現在ユーザーと権限(07)、フック(14)、イベント(18)、ラッパーとデモ API(08〜09)、クライアント(10)、DemoBar と ErrorNotice/StatusBadge(11)、セキュリティヘッダー(19)。
- 見送り(統一仕様 16.2): 永続化(15)、`ErrorNotice` の 429 の秒数表示、フック・イベントの二重登録の試験(CMN-T-18、46・49 の該当部分)、時計の後戻り時の状態の扱い。jsdom によるコンポーネントの自動試験は行わない(第 10.2)。
- 注意: (a) Next.js のドキュメント(`node_modules/next/dist/docs/`)の Route Handler・キャッシュ・Cookie の節を、`npm ci` 後に TASK-08 の着手前に読む。(b) `tx` 内で `await` しない規約を各モジュールのレビュー観点に入れる。(c) seed の状態は 04 の `evaluate` と整合させる(seed を書き換えたら CMN-T-34 と 04 の整合試験を通す)。(d) `next.config.ts` の変更は既存の `cacheComponents`・`partialPrefetching` を残し、`headers()` だけを足す。

## 13. 実装タスク(順序つき)
規模: S=半日以下、M=1 日程度、L=2 日以上。**マイルストーン G0 は他モジュールの着手条件**。

| ID | タスク | 規模 | 前提 | 完了条件 |
|---|---|---|---|---|
| CMN-TASK-01 | 骨組み: `groups-types.ts`(第 4.2 の基本型・`DemoUser`・共通 DTO・再エクスポート)、`errors.ts`(AppError・ヘルパー・toResponse)、`ids.ts`(接頭辞表・`newId`/`isId`/`isSlugId`/`idSeq`/`newToken` の署名)、`limits.ts`、`events.ts` の型を実装し、他の公開関数は署名のみのスタブ(`throw new Error("not implemented")`)で置く | S | 各モジュールの `types.ts`(型だけ) | `npx tsc --noEmit` が通る。**G0: これと各モジュールの `types.ts` をマージすれば、他モジュールが型と署名に対して実装できる**(再エクスポートと `Db` の型は所有モジュールの `types.ts` を参照するため、G0 は両方がそろった時点とする) |
| CMN-TASK-02 | `datetime.ts`(`toJstIso`、`jstDate`、`addDays`、`daysBetween`、`isDateStr`、`parseIso`、`formatJst`、`startOfNextJstDay`)。依存なしの Date 演算 | S | 01 | CMN-T-33 |
| CMN-TASK-03 | `validation.ts`(`v`(`v.nullable` を含む)、`parse`、`safeParse`、`sanitizeText`)と `messages.ts` | M | 01、02 | CMN-T-01〜10、38、51、54 |
| CMN-TASK-04 | `groups-store.ts`(globalThis、Repo、`tx`、`resetStore`、counters)と `group-seed.ts`(`parseSeed`)。空の seed(users 1 件のみ)で先に動かす | M | 01、02、03 | CMN-T-16〜21 |
| CMN-TASK-05 | `group-seed.json` を第 4.4 のとおり作成(12 ユーザー、13 グループ、関連レコード)し、各モジュールの seed 断片(06、08、09、11 など)を統合する | L | 04(スキーマ)。04 の本体と並行可。各モジュールの断片 | CMN-T-34、35。**G1 の一部** |
| CMN-TASK-06 | `clock.ts` | S | 02、04(demoNow) | CMN-T-25、26、28 |
| CMN-TASK-07 | `current-user.ts` と `authz.ts` | S | 04 | CMN-T-22、30 |
| CMN-TASK-14 | `hooks.ts`(`beforeRequest`・`afterClockChange`・`afterReset`)と `features/bootstrap.ts` | S | 04 | CMN-T-46 |
| CMN-TASK-18 | `events.ts`(`emit`・`on`) | S | 01、04 | CMN-T-49 |
| CMN-TASK-12 | テスト基盤: `vitest`(最新の安定版)を devDependency に追加、`vitest.config.ts`、`npm test`/`test:watch`、`test/setup.ts`・`helpers.ts`(`insertGroup`・`insertMember`・`insertBlock` を含む)・`fixtures.ts`(`GROUP_BY_STATUS` ほか第 9.1 の定数) | M | 04 | 試験が 0 件でも `npm test` が成功する。`resetForTest`/`callRoute` が使える。CMN-T-56。**G1: ここまでで他モジュールが試験を書ける** |
| CMN-TASK-08 | `api-route.ts`(`route`、`ok/created/noContent`、入口検査、`beforeRequest` の実行と `skipHooks`、`c.id/body/query`。`c.query` は strict)と `query.ts`(ページ・ソート) | M | 03、04、07、14 | CMN-T-11〜15、31、32、47、48、52、55 |
| CMN-TASK-09 | デモ API 4 本(`/api/demo/me` `users` `clock` `reset`)と `DEMO_TOOLS` | S | 06、07、08 | CMN-T-23、24、27、29、39 |
| CMN-TASK-10 | `groups-api.ts`(`gapi`・`gpost`・`gput`・`gpatch`・`gdelete`・`ApiError`・`ntf:refresh`・`useGroupsApi`・`useCurrentUser`) | S | 01 | CMN-T-37、50 |
| CMN-TASK-11 | 共通 UI(`ErrorNotice`、`LoadingBlock`、`StatusBadge`、`MockBadge`、`useFormErrors`、`DemoBar`)と `AppShell` への DemoBar 差し込み(既存ファイルの変更は 1 箇所) | M | 09、10 | CMN-T-41〜45。**G2: HTTP・クライアント・共通 UI が揃い、他モジュールの画面が作れる** |
| CMN-TASK-19 | `next.config.ts` に `headers()` を追加(X-Frame-Options、X-Content-Type-Options、Referrer-Policy。CSP なし)と試験 | S | 12 | CMN-T-53 |
| CMN-TASK-13 | 共通基盤の単体試験の仕上げ(上表のうち未実装の CMN-T) | M | 02〜11、14、18、19 | `npm test` がすべて成功する |
| CMN-TASK-15 | (任意。見送り。統一仕様 16.2)JSON 永続化(`GROUPS_PERSIST=file`、`.data/` を `app/.gitignore` に追加、`resetStore` で削除) | S | 04 | 再起動後にデータが残る手動確認。無効時の挙動が変わらない |
| CMN-TASK-16 | OSS 一覧(docs/design/08)に Vitest を追記する依頼メモ、README に起動・試験コマンドを追記する依頼メモを窓口へ(docs の編集は窓口/担当が行う) | S | 12 | メモが提出される |
| CMN-TASK-17 | 品質ゲート: eslint に `react/no-danger`(error)と `Date.now`・引数なし `new Date()` の警告規則、`tsc --noEmit`、`npm run build`、CMN-T-36、40 | S | 全体 | lint・型・build が通る |

実装順序の全体像(他モジュールの着手に必要な順):
1. **TASK-01 を各モジュールの `types.ts` と同時にマージ(G0)**。以降、各モジュールは型・署名に対して service と試験(スタブの上)を書き始められる。
2. 02(日時)→ 03(検証)→ 04(ストア+空 seed)の順に進め、04 の後に 06(clock)、07、14、18、12(テスト基盤)を並行で進める。→ **G1: service 層の実装と単体試験が可能**(ストア部分が動く)。
3. 05(本 seed)を 04 と並行で用意。G1 までに最小 seed(u-001〜u-004、g-001〜g-003)を先に入れ、各モジュールの断片がそろったら完成版で置き換える。
4. 08(ラッパー)→ 09(デモ API)→ 11(共通 UI)。10(クライアント)は 01 の後いつでも着手でき、11 の前に終える。19(ヘッダー)は 12 の後いつでも着手できる。→ **G2: Route Handler と画面の実装が可能**。
5. 13・17 で仕上げ。15 は見送り(統一仕様 16.2)。
- 目安の工数: S×12 + M×6 + L×1。S を 0.5 日、M を 1 日、L を 2 日とすると約 14 人日(見送りの 15 を除くと約 13.5 人日)。直列の必須経路は 01 → 02 → 03 → 04 → 07 → 08 → 09(約 5 日)で、G2(11 まで)は約 6 日。

## 14. 他モジュールとの契約(呼ばれる関数・使い方)
本書の署名が正(統一仕様と食い違う場合は統一仕様に合わせて本書を改訂する)。旧骨子・README の名前と対応づけた箇所を ◎ で示す。

| 区分 | 名称 | 使うモジュール |
|---|---|---|
| ストア | `db()`、`tx(fn)`、`resetStore()`、`newId(prefix)` ◎(README の `store()`/`resetStore()`/`newId` に対応。`store()` は `db()` に改称し、生の Store は公開しない) | 全 service |
| ID | `isId(prefix, v)`、`isSlugId(prefix, v)`、`idSeq(id)`、`ID_PREFIXES`、`newToken()` | 全モジュール(06 は `idSeq`) |
| 現在ユーザー | `currentUser(req)` ◎、`c.user`(ラッパー経由)、`db().users.get(id)` | 全 Route Handler、11・12 |
| 時計 | `clock.now()` ◎、`clock.today()`、`clock.nowIso()`、`clock.set(iso)` ◎、`clock.advanceDays(n)` | 04(締切評価)、10(通知の日時)、06(送信日時)、各 `createdAt`/`updatedAt` |
| 検証 | `v.*`、`parse(schema, input)` ◎(README の `validate(schema, input)` に対応)、`sanitizeText`、`LIMITS` | 全 Route Handler・service |
| エラー | `AppError`(`reason` 付き)、`invalidInput`、`forbidden`、`notFound`、`conflict`、`unavailableState`、`rateLimited`、`blocked`、`toResponse(e)` ◎ | 全モジュール(09 の `requireVerified`・`checkRate` 等) |
| ラッパー | `route()`(`skipHooks`)、`ok`/`created`/`noContent` | 全モジュールの `handlers.ts` |
| 権限 | `isMember`、`isOrganizer`、`activeMembers`(01 は再エクスポートのみ)、`requireMember`、`requireOrganizer`、`requireGroup`、`requireRole` | 全モジュール(05〜08 の API は 09 の `assertGroupAccess` を経由) |
| ページ・ソート | `parsePage`、`paginate`、`parseSort`、`sortBy`、`Page<T>`、`CursorPage<T>` | 02(一覧)、06(チャット)、10(通知一覧)、12 |
| 日時 | `addDays`、`daysBetween`、`toJstIso`、`jstDate`、`isDateStr`、`parseIso`、`formatJst`、`startOfNextJstDay`(第 5.11) | 04(締切・辞退期間)、01(日程検証)、10(通知本文)、12 |
| フック | `registerHook("beforeRequest" \| "afterClockChange" \| "afterReset", key, fn)`、`features/bootstrap.ts` への 1 行追記 | 04(`evaluateAll`)、09(`resetRateBuckets`) |
| イベント | `emit(e)`、`on(type, key, handler)`、`DomainEvent` | 発行: 01(`group_created`・`member_joined`)・04(`member_left`・`status_changed`)。購読: 03・06・07 |
| クライアント | `gapi`、`gpost`、`gput`、`gpatch`、`gdelete`、`ApiError`(`reason` 付き)、`useGroupsApi`、`useCurrentUser`、`ntf:refresh` | 全画面(10 は `ntf:refresh` を購読) |
| 共通 UI | `ErrorNotice`、`LoadingBlock`、`StatusBadge`、`MockBadge`、`useFormErrors` | 全画面(グループの状態は 04 の `GroupStatusBadge` 経由。第 3.2) |
| テスト | `resetForTest`、`callRoute`、`asUser`、`insertGroup`、`insertMember`、`insertBlock`、`fixtures`(`GROUP_BY_STATUS` ほか。第 9.1) | 全モジュールの試験 |

本モジュールが**呼ぶ**もの: なし(上位への依存は `hooks.ts` の登録機構と `events.ts` の購読で逆転)。型は第 10.1 のとおり `import type` で参照する。

変更手続き: 00 が定義する型・署名の変更は (1) 統一仕様と本書の該当箇所を更新、(2) `lib/` のファイルを変更、(3) 影響する他モジュール担当へ窓口経由で連絡、の順。エンティティの形の変更は所有モジュールの設計書で行い、00 は型の所在一覧(第 4.2)と seed を合わせる。

## 15. 他モジュールへの要望(他ファイルは編集していない)
統一仕様で確定した事項は除き、00 の実装に必要な点だけを挙げる。

| ID | 宛先 | 要望 |
|---|---|---|
| R-01-1 | 01 | `isMember`/`isOrganizer`/`activeMembers` は 00 の `authz.ts` を再エクスポートする(重複実装しない)。`addMember`/`markMemberLeft` で `GroupMember` の不変条件を満たす。01 が発行するイベントは `group_created`(`createGroup`・`createGroupInternal`)と `member_joined`(`addMember`。承認によるメンバー追加のときだけ)の 2 つ。`markMemberLeft` はイベントを発行しない(`member_left` は 04 の `withdraw` が発行する。統一仕様 4.5、7.1)。`Group.inviteCode` を DTO に出さない |
| R-01-2 | 01 | 作成 API の本文スキーマに `official`、`lifecycle`、`organizerId` を含めない(幹事は `c.user`)。含めても `v.object` が捨てる |
| R-02-1 | 02 | 一覧は `parsePage`/`parseSort`/`paginate`/`sortBy` を使い、応答を `Page<T>` に合わせる。許可キーは各自で決める。`evaluateAll` を呼ばない(`beforeRequest` で評価済み) |
| R-03-1 | 03 | 申請の状態ラベル(5 値)を `messages.ts` に置き、`StatusBadge` に渡す。「却下」の画面表記を「見送り」とする案の採否を決める |
| R-04-1 | 04 | seed の各グループ状態(第 4.4 表)が `evaluate` で変化しないこと、または変化する場合の期待を 04 の試験で保証する。`features/groups/lifecycle/register.ts` で `beforeRequest`・`afterClockChange` に `evaluateAll` を登録し、`bootstrap.ts` に 1 行追記する。`withdraw` で `Withdrawal` を作成した後に `member_left` を、状態が変わるすべての遷移で `status_changed`(`from` は非 null)を発行する。seed の `groupStatusLogs` と `withdrawals`(wd-001、wd-002。第 4.4)の断片を用意する |
| R-09-1 | 09 | `afterReset` にレート制限の計数の初期化を登録する。seed の `profiles`・`verifications` の断片を第 4.4 の表(年代帯・本人確認)に合わせて用意する。u-008 の年代帯の扱い(第 11 章)を確認する。解消(統一仕様 6.3。`ageBand: "18-19"`、18 歳未満は `Verification` だけで表す) |
| R-11-1 | 11 | seed の `municipalities`・`hosts`・`listings`・`funnelEvents` の断片を第 4.4 の ID(`mun-demo-a`、`mun-demo-b`、`host-demo-a`、公式枠 g-002・g-005)で用意する |
| R-ALL-1 | 全モジュール | (a) ハンドラは `features/<m>/handlers.ts` に `route()` で置き、`route.ts` は再エクスポートだけにする。service は同期・フレームワーク非依存にする。(b) 変更は `tx` 内で完結し `await` しない。(c) 時刻は `clock` のみ。保存は `clock.nowIso()`。(d) ユーザーは `c.user`。本文の `userId` を権限に使わない。(e) 日時は `IsoDateTime`/`DateStr`。(f) メッセージは `features/<m>/messages.ts`。(g) 上限は `LIMITS` だけを使う。(h) API 応答に内部エンティティを直接返さず DTO を作る。(i) 試験は Vitest、`fixtures.ts` の ID 定数(`GROUP_BY_STATUS` ほか)と `resetForTest` を使い、試験の中で作るデータは `insertGroup`・`insertMember`・`insertBlock` と 900 番台の ID で作る。(j) ID の検証は `isId`/`isSlugId` だけを使い、個別の正規表現を書かない。(k) エラーは `AppError` の `reason`・`detail` を使い、最上位に独自の項目を置かない。(l) 禁止表現を検査する本文のスキーマに `ackReview: v.boolean({ optional: true })` を宣言する(統一仕様 6.2) |
| R-ALL-2 | 全モジュール | Store にコレクションを足す場合は 00 の担当へ連絡(統一仕様 3.1・型の所在一覧・seed・`Db` の 4 点をそろえる)。seed の断片は所有モジュールの型の形で用意する |

## 16. 設計上の確認事項(docs/design・README・他骨子との差異。本書では直さず記録)
1. **デモ用 API のパス**: README・00 骨子は `POST /api/groups/_reset`。`_` で始まるフォルダはルーティングの対象外([事実] Next.js 16.4.5 のガイド。統一仕様 2.1 R-1)のため、`/api/demo/reset` ほかに変更した。README 4.1・00 骨子の更新が必要。
2. **Route Handler の構成**: README 4.1 は `api/groups/[...path]/route.ts`(キャッチオール)。本書と統一仕様 2.1 はリソースごとの `route.ts` と `handlers.ts` の再エクスポート。README の更新が必要(統一仕様第 12 章)。
3. **`DEMO_TOOLS` の扱い**: 00 骨子の「production では `clock.set`/`_reset` を無効化または明示」を、「既定で有効、環境変数 `DEMO_TOOLS=off` で無効、画面で常時『モック』明示」に変更。09 章の起動方式(`next start` を標準にするか)が決まるまで暫定。
4. **エラー本文の `message`**: README 4.3 は `message?`(任意)。本書は常に付ける。既存 `/api/v2` は `{error}` のみで別系統。
5. **`store()` の名称**: README・骨子は `store()`。本書は Repo を返す `db()` に変更し、「生の Store オブジェクト」は公開しない(直接変更による不変条件違反を防ぐ)。
6. **`validate(schema, input)`**: README・骨子の名称に対し、本書は `parse(schema, input)`(失敗時 `AppError`)と `safeParse`。名称のみの差。
7. **締切の型**: 統一仕様 4.2 で `lifecycle.deadlineDate`(日付。docs/design 05 と一致)を正とし、`deadlineAt`(翌日 00:00+09:00)を派生値として同時に保存すると確定した。解決済み。
8. **状態名**: 統一仕様 4.1 で 04 の `GroupStatus`(snake_case の 8 値。`replanned` を含む [決定 5])に確定した。docs/design 04 の状態遷移図の更新が必要(統一仕様第 12 章)。
9. **年代帯**: 統一仕様 6.3 で 09 の `AgeBand`(7 区分)に確定した。18 歳未満のユーザーの年代帯の値は解消(統一仕様 6.3。u-008 は `18-19`、18 歳未満は `Verification` だけで表す。第 11 章)。
10. **辞退と退会の区別**: 統一仕様 4.5 で `MemberStatus = "active" | "left"` と 04 の `withdrawals` の記録に確定した。解決済み。
11. **ID 形式**: README 4.4 は `^[a-z0-9-]{1,40}$`。本書と統一仕様 3.2 は接頭辞 + 連番形式と、seed で決める `r-`/`mun-`/`host-` 形式。招待コードは 01 の別形式。README の更新が必要。
12. **既存 `api.ts` との差**: 既存 `api()` は `message`/`fields` を保持しない。新規 `groups-api.ts` を作る方針(既存は変更しない)。
13. **`cacheComponents: true`**: `next.config.ts` に有効。Route Handler の動的扱い、サーバーコンポーネントでの時刻・Cookie 参照の制約は Next.js 16 のドキュメント確認が必要 [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)]。本書は「ラッパーが最初に `req.headers` を読む」「画面は API 取得」で回避する前提。
14. **docs/design/08(OSS 一覧)**: Vitest(devDependency)の追加で一覧の更新が必要(統一仕様第 12 章)。本モジュールの利用ライブラリは第 10.2。
15. **本人確認と seed の整合**: 旧 seed は u-004 が未確認のまま申請中・幹事だった。統一仕様 11.4 に従い u-004 を確認済みにし、未確認の成人の試験用に u-010 を追加した。解決済み(CMN-T-34 で検査)。
16. **既存のルート構成と R-2**: 既存の `src/app/` には静的な `api` と動的な `[campaign]` が同じ階層に並んでいる(既存のまま動作している)。R-2 は新設するフォルダに適用する(CMN-T-36)。統一仕様 2.1 で確定した。解決済み。
