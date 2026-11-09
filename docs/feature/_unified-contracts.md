# 詳細設計 統一仕様(モジュール間の契約)

状態の凡例は README に従う。本書は 00〜12 の詳細設計と結合整合レビュー([_review-integration.md](_review-integration.md))の指摘を受け、モジュール間で共有する定義を 1 つに決めたもの。

- 根拠: 00〜12 の現行版(2026-11-09 時点。第 2 回の修正後)、_review-integration.md、オーナー判断(`.work/review.md` 第 9〜11 章の論点 1〜30)、実装方針(同 第 12 章)。
- 本書と各モジュールの記述が食い違う場合は本書を正とし、各モジュールを本書に合わせて改訂する(第 13 章・第 17 章)。docs/design と本書が食い違う場合は docs/design を正とするが、本書で docs/design の更新を求めている箇所(第 12 章)はその更新を前提とする。
- 本書が決めるのは「モジュールの境界をまたぐもの」だけ。モジュール内部の設計は各モジュールに残す。
- [決定] はオーナー判断、[統一] は本書で選んだ案(各モジュールの既存案から選択、根拠を併記)、[案] は本書で新たに置いた案。
- 第 2 回の更新(2026-11-09)で、各モジュールの「契約書への指摘」を解消した。指摘と結論の対応は第 15 章、見送ってよいエッジケースは第 16 章、各モジュールに残る修正は第 17 章。

## 1. オーナー判断の反映先

| # | 判断 | 本書の反映先 |
|---|---|---|
| 1 | 通知は参加申請の受付・承認・却下だけを追加。チャット新着・締切接近は余力 | 第 9 章 |
| 2 | セキュリティヘッダーは X-Frame-Options、X-Content-Type-Options、Referrer-Policy のみ。CSP は見送り | 第 11 章 |
| 3 | 費用の分担メモは実行確定以降のみ | 4.4 |
| 4 | チャットの投稿頻度は 60 秒に 10 件 | 10.4 |
| 5 | 再企画は独立した状態(8 状態) | 4.1、4.4 |
| 6 | グループのスタンプはグループ専用の記録 | 7.8 |
| 7 | 入口B は無視した項目があるときだけ着地ページ | 7.11 |
| 8 | 招待コードの照合は試行回数に数えない。終了状態では発行不可 | 7.2 |
| 9 | 幹事による中止を設ける | 4.3 |
| 10 | 確定後の辞退で 2 人未満になったら中止 | 4.3 |
| 11 | 試験基盤は Vitest | 11.3 |
| 12 | 流入集計の期間の既定値は直近 3 か月(暦月) | 7.11、7.12 |
| 13 | 特典はメンバー全員に個人特典も付与 | 7.8 |
| 14 | 1 人が押せばグループとして取得済み | 7.8 |
| 15 | 写真はダミー投稿 | 7.8 |
| 16 | 振り返りは実施中から書ける | 4.4、7.8 |
| 17 | 集計の下限 K=5 | 10.5 |
| 18 | 退会者の記録は残して「元メンバー」と表示 | 10.6 |
| 19 | アンケートは 5 項目 | 7.8 |
| 20 | 入口B の計測値は固定の列挙値のみ | 7.11 |
| 21 | 個人特典は新ストア `rallyRewardGrants` に記録し、既存の特典機能(`/api/v2`)と連動させない | 7.8 |
| 22 | 締切で辞退期間に移るとき、申請中の人に `join_expired` を送る。通知は必須 12 種 | 5.3、7.4、第 9 章 |
| 23 | 完了後も費用メモを編集できる | 4.4 |
| 24 | 11 の `GET /api/entry/stats` は 12 の集計に統合して廃止 | 2.2、7.12 |
| 25 | アンケートの追加 2 項目は「地元の人との交流があったか」「滞在中にいろいろな場所を回れたか」(各 5 段階) | 7.8 |
| 26 | 作成画面と招待コード入力画面のパスは `/[campaign]/new-group` と `/[campaign]/invite` | 2.2 |
| 27 | 招待はコード入力方式(URL にコードを残さない) | 7.2 |
| 28 | 通報の対象はメッセージ・グループ・ユーザーのみ | 6.3 |
| 29 | 幹事の中止は実行確定の前まで(募集中・最少人数到達・辞退期間) | 4.3、4.4 |
| 30 | 禁止表現の新カテゴリ `official_hint` は採用しない | 6.2 |
| 方針 | メインルートの動作に集中し、エッジケースの作り込みは見送ってよい(`.work/review.md` 第 12 章) | 第 16 章 |

- 13 追補 [INS-C-17、13 §22]: undefined

## 2. ルーティング

### 2.1 方式 [統一]

- リソースごとの `route.ts` とする(00 案)。キャッチオール `[...path]` とハンドラ登録表・ディスパッチャは作らない。
- 各モジュールは `features/<m>/handlers.ts` に 00 の `route()` で包んだハンドラを置き、`app/api/.../route.ts` は再エクスポートだけを書く。

```ts
// app/src/app/api/groups/[groupId]/plan/route.ts
export { getPlanHandler as GET } from "@/features/groups/plan/handlers";
```

- 複数モジュールを合成するハンドラ(グループの作成 `POST /api/groups` と詳細 `GET G`)は、合成層 `features/groups/compose/handlers.ts`(所有 01)に置く。合成層は 01・02・04・09 を import してよいが、どのモジュールからも import されない(4.6)。`route.ts` は合成層のハンドラも再エクスポートだけで書く。
- 動的セグメント名はグループが `[groupId]`。子資源は `[requestId]`、`[itemId]`、`[messageId]`、`[expenseId]`、`[photoId]`、`[userId]`。`[id]` は使わない。
- 次の 2 つの規則で、Next.js の解決順に依存しないようにする。
  - R-1: `_` で始まるフォルダを作らない。[事実] Next.js 16.4.5 のガイド(`next/dist/docs/01-app/01-getting-started/02-project-structure.md`「Private folders」)に、`_` 始まりのフォルダはルーティングの対象外と書かれている。`_invite`、`_meta`、`_me`、`_demo`、`_dev`、`_reset` はすべて廃止する。
  - R-2: 本機能で新設するフォルダでは、同じ階層に静的セグメントと動的セグメントを並べない。既存のフォルダ(`app/src/app` 直下の `api` と `[campaign]`、`[campaign]` 直下の既存画面)は対象外で、変更しない。新設するフォルダを既存の動的セグメントの下(`[campaign]/groups` など)に置くことは R-2 に反しない。

### 2.2 API の一覧 [統一]

`G` は `/api/groups/[groupId]`。メソッドの方針は 2.3。

| 所有 | メソッド・パス | 内容 | 旧パス(廃止) |
|---|---|---|---|
| 00 | GET/POST `/api/demo/me`、GET `/api/demo/users`、GET/POST `/api/demo/clock`、POST `/api/demo/reset` | デモユーザー切替・時計・初期化 | 04 `_demo/clock`、02・06 `_reset` |
| 09 | GET `/api/demo/reports` | 受け付けた通報の確認(開発用) | 09 `_dev/reports` |
| 02 | GET `/api/regions?campaign=` | 地方マスタ | 01 `_meta`、02 `groups/regions` |
| 02 | POST `/api/invites/lookup`(本文 `{ code }`) | 招待コードからの参加前プレビュー(照合は 01) | 01 `_invite/verify`、02 `groups/invite-lookup`、03 `_invite/resolve` |
| 02/01 | GET `/api/groups`(02 一覧)、POST `/api/groups`(合成層。作成) | 一覧・作成 | - |
| 01 | GET `G`(合成層。5.5 の振り分け)、PATCH `G`(01) | 詳細・設定変更 | 02 `groups/[id]` |
| 01 | GET `G/members` | メンバー一覧 | - |
| 01 | GET・POST `G/invite-code`、POST `G/invite-code/reissue` | 招待コード | - |
| 03 | GET・POST `G/join-requests`、GET `G/my-join-request` | 申請一覧・申請・自分の申請 | 03 `G/join-requests/mine`(R-2 違反) |
| 03 | POST `G/join-requests/[requestId]/approve`、`/reject`、`/withdraw` | 判断・取り下げ | - |
| 04 | GET `G/lifecycle`、POST `G/withdraw`、POST `G/cancel`、PATCH `G/conditions`、GET `G/replan-draft`、POST `G/replan`、GET `G/status-log`(余力。第 16 章) | 状態・辞退/退会・中止・条件変更・再企画 | 01 `G/leave` |
| 05 | GET `G/plan`、PUT `G/plan/meeting`、PUT `G/plan/memo`、GET・POST `G/plan/items`、PATCH・DELETE `G/plan/items/[itemId]`、PUT `G/plan/order` | 旅程 | 05 `plan/items/reorder`(R-2 違反) |
| 06 | GET・POST `G/messages`、POST `G/messages/[messageId]/report`、POST `G/chat/read` | チャット | 06 `groups/chat/templates`(定型文はクライアント定数) |
| 07 | GET・POST `G/expenses`、PUT・DELETE `G/expenses/[expenseId]`、GET `G/expense-summary` | 費用 | 07 `expenses/summary`(R-2 違反) |
| 08 | GET `G/rally`、POST `G/stamps`、GET `G/review`、PUT `G/review/memo`、PUT `G/review/survey`、POST `G/review/photos`、DELETE `G/review/photos/[photoId]` | ラリー・振り返り | 08 `photos/[photoId]/delete` |
| 09 | GET・PUT `/api/me/profile`、GET・POST `/api/me/blocks`、DELETE `/api/me/blocks/[userId]`、GET `/api/me/reports`、GET・POST `/api/me/verification` | 本人の設定 | 09 `groups/me/*`、`blocks/[userId]/unblock` |
| 09 | GET `/api/users/[userId]/profile?context=&groupId=`、POST `/api/reports` | 他人のプロフィール・通報 | 09 `groups/users/*`、`groups/reports` |
| 03 | GET `/api/me/join-requests` | 自分の申請一覧(非公開グループの申請を含む) | 03 `_me/join-requests` |
| 10 | GET `/api/me/notifications`、GET `/api/me/unread-count`、POST `/api/me/notifications/read`(本文 `{id}`)、POST `/api/me/notifications/read-all`(本文 `{groupId?}`。余力。第 16 章) | 通知 | 10 `groups/notifications/*` |
| 11 | GET `/api/entry/resolve`、POST `/api/entry/events`、POST `/api/official`、POST `/api/hosts/slots` | 入口B・公式枠の作成 | 11 GET `/api/official`(02 の `official=1` で代替)、GET `/api/official/[groupId]`(02 の一覧・詳細にバッジを含める)、GET `/api/entry/stats`(12 に統合 [決定 24]) |
| 12 | GET `/api/stats` | 自治体向け集計 | 12 `groups/stats` |

- `/api/groups` 直下の子は `[groupId]` だけ、`G` 直下の子は静的セグメントだけ、`G/join-requests` の子は `[requestId]` だけ、`G/plan/items` の子は `[itemId]` だけ、`G/expenses` の子は `[expenseId]` だけにした(R-2)。
- 画面のパス [決定 26/統一]: 一覧 `/[campaign]/groups`、詳細 `/[campaign]/groups/[groupId]`、作成 `/[campaign]/new-group`、招待コード入力 `/[campaign]/invite`(照合・プレビュー・申請を同じ画面で行う。7.2)、通知 `/[campaign]/notifications`、入口B `/[campaign]/entry`、ダミー外部リンク集 `/[campaign]/external-links`、集計 `/[campaign]/admin/stats`。`groups/new` は R-2 に反するため使わない。グループ詳細の子画面は `/[campaign]/groups/[groupId]/edit`、`/members`、`/review`、`/replan` など静的セグメントだけとし、タブは `?tab=` で切り替える。

- 13 追補 [INS-C-04、13 §22]: undefined

### 2.3 メソッドと応答 [統一]

- 取得は GET、作成は POST(201)、全置換は PUT、部分更新は PATCH、削除は DELETE(本文なし)。状態遷移の操作は POST の動詞サブパス(`approve`、`withdraw`、`cancel` など)。
- 変更系(POST・PUT・PATCH・DELETE)は、本文の有無にかかわらず `Content-Type: application/json` を必須とする(00 の `route()` の入口検査。CSRF 対策)。本文のない POST と DELETE もこのヘッダーを付ける。クライアントの `gpost`・`gput`・`gpatch`・`gdelete` と試験の `callRoute` は常に付ける。
- 削除の応答は 204。削除で再計算値を返す必要がある場合だけ 200(05 の `{ itemsRevision }`)。
- 楽観ロック: 版は `version: number`(作成時 1)。入力は `baseVersion`(DELETE はクエリ `?baseVersion=`)。不一致は `conflict` + `reason: "version_mismatch"` + `detail.current`(最新の DTO)。05 の並び順は一覧の版 `itemsRevision` と入力 `baseRevision` を使い、不一致の `reason` は同じ `version_mismatch`。01 の `applyLifecyclePatch` の `revision` 不一致も `version_mismatch` とする(`revision_mismatch` は使わない)。
- 一覧は 00 の `Page<T>`(`limit`・`offset`)。`limit` の既定は 20、最大 50(00 の `parsePage`)。エンドポイントごとに既定を変える場合は `parsePage(q, { defaultLimit })` で指定する(02 の一覧は 12)。時系列の追記型(06 チャット、10 通知)だけ `CursorPage<T>` を使い、既定・最大はモジュールの定数で決める(06 は 50/100、10 は 10 の定数)。02 の `page`/`pageSize` は画面側の表示単位とし、API は `limit`/`offset` で受ける。
- 並び順の指定は 00 の形式 `?sort=<キー>:<asc|desc>`(`parseSort`)に統一する。02 の `deadline_asc` などの列挙値は `deadline:asc` の形に改める。

## 3. 共通基盤の契約(00)

### 3.1 Store [統一]

- アクセスは 00 の `db()`/`Repo<T>`/`tx()` だけ。`store()` と生の Store オブジェクトは使わない。`Record`・`Map` 形式のコレクションは `Repo` に置き換える。
- Repo に入れる型は必ず `id: Id` を持つ。1 対 1 の資源は `id` に親の ID を入れ、親の ID の項目(`userId`・`groupId`)も残す。`Profile`・`Verification` は `id = userId`、`GroupPlan`・`Listing` は `id = groupId`、`ChatReadMark` は `id = "${groupId}:${userId}"`(3.2 の ID 形式の例外。型は `id: string` で、`isId` の検査の対象にしない。API のパスや本文では受け取らない)。08 の振り返りメモ・アンケートは採番 ID(`rm-NNN`、`rs-NNN`)を `id` に持ち、`(groupId, userId)` で一意にする。
- 全コレクション(00 の `Db`):

| コレクション | 型(所有) | ID |
|---|---|---|
| `users` | `DemoUser`(00) | `u-NNN` |
| `profiles` | `Profile`(09) | userId |
| `verifications` | `Verification`(09) | userId |
| `blocks`、`reports` | `Block`、`Report`(09) | `bl-NNN`、`rp-NNN` |
| `regions` | `Region`(02) | `r-<slug>`(seed のみ) |
| `groups`、`members` | `Group`、`GroupMember`(01。lifecycle は 04) | `g-NNN`、`m-NNN` |
| `joinRequests` | `JoinRequest`(03) | `jr-NNN` |
| `withdrawals`、`groupStatusLogs` | `Withdrawal`、`GroupStatusLog`(04) | `wd-NNN`、`sl-NNN` |
| `notifications` | `GroupNotification`(10) | `n-NNN` |
| `plans` | `GroupPlan`(05) | groupId |
| `messages`、`chatReads` | `GroupMessage`、`ChatReadMark`(06) | `msg-NNN`、`${groupId}:${userId}` |
| `expenses` | `ExpenseNote`(07) | `ex-NNN` |
| `groupStamps`、`rallyMemos`、`rallySurveys`、`rallyPhotos`、`rallyRewardGrants` | 08 | `gs-NNN`、`rm-NNN`、`rs-NNN`、`ph-NNN`、`rg-NNN` |
| `municipalities`、`hosts`、`listings`、`funnelEvents` | `Municipality`、`LocalHost`、`Listing`、`FunnelEvent`(11) | `mun-<slug>`、`host-<slug>`(seed のみ)、groupId、`fe-NNN` |

- Store に置かないもの: レート制限の計数(09 の `checkRate` が globalThis の Map に持つ)、06 の `chatSeq`(廃止)、03 の `inviteAttempts` と 01 の `inviteIndex`・`inviteAttempts`(廃止。7.2)、12 の `entryEvents`(作らない。7.12)。
- 型の定義場所: エンティティの形は所有モジュールの `features/<m>/types.ts` に置く。00 の `lib/groups-types.ts` は基本型(`Id`、`DateStr`、`IsoDateTime`)、`DemoUser`、`UserRole`、共通 DTO(`Page<T>`、`CursorPage<T>` ほか)だけを持ち、それ以外は各モジュールの型を再エクスポートする。

- 13 追補 [INS-C-03、13 §22]: undefined

### 3.2 ID [統一]

- 採番する ID は 00 の形式 `<接頭辞>-<3〜8 桁の連番>`、`newId(prefix)` で作る。

```ts
export const ID_PREFIXES = [
  "u", "g", "m", "jr", "wd", "sl", "n", "pi", "msg", "ex", "gs", "rm", "rs", "ph", "rg", "rp", "bl", "fe",
] as const;
```

- 採番しない ID(seed で決める): 地方 `r-<slug>`、自治体 `mun-<slug>`、地元の担い手 `host-<slug>`。形式は `^(r|mun|host)-[a-z0-9-]{1,30}$`(ハイフン可)。検証は 00 の `isSlugId(prefix, v)` だけを使う。02 の `^r-[a-z0-9]{1,30}$` などの個別の正規表現は廃止する。
- 1 対 1 の資源(`plans`、`listings`、`profiles`、`verifications`)は親の ID をそのまま使う(3.1)。
- 検証は 00 の `isId(prefix, v)`(パスは `c.id(name, prefix)`、本文は `v.id(prefix)`)だけを使う。各モジュールの個別の正規表現は削除する。
- 形式不正の扱い: パスの ID は `not_found`(404)、本文・クエリの ID は `invalid_input`(400)。
- 06 のメッセージ ID は `newId("msg")` とし、`sinceId`・`before` の比較は 00 の `idSeq(id)`(連番部分の数値)で行う。`seq` 項目は連番部分から導出する(保存しない)。
- 試験だけで使うデータの ID も同じ形式にする(例: `g-901`、`u-901`)。`g-t06`、`u-new`、`u-minor`、`g-pub` のような形式外の ID は使わない(11.3)。

- 13 追補 [INS-C-02、13 §22]: undefined

### 3.3 エラー [統一]

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
  constructor(code: ErrorCode, message: string, opts?: {
    reason?: string; fields?: Record<string, string>; detail?: Record<string, unknown>; cause?: unknown;
  });
}
```

- `rate_limited` は 429(`detail.retryAfterSec` を付ける)。HTTP ステータスはコードから一意に決まる。
- `detail` に置くもの: `current`、`state`、`allowedActions`、`retryAfterSec`、`reviewRequired`、`existingRequestId`、`acquired`。最上位には置かない。
- `fields` の値は文字列。
- モジュール固有のコードは作らない。08 の `invalid_code` は `invalid_input` + `reason: "invalid_code"`、`already_acquired` は `conflict` + `reason: "already_acquired"`。
- 複数モジュールにまたがる `reason` の値は本書で決める: 受付終了(4.3)、本人確認(7.10)、禁止表現(6.2)、楽観ロック `version_mismatch`(2.3)、件数上限 `limit_exceeded`(10.3)。それ以外は各モジュールのエラー表に書く。

- 13 追補 [INS-C-05、13 §22]: undefined

### 3.4 入力の規則 [統一]

| 項目 | 規則 |
|---|---|
| 本文の上限 | 64KB、超過は 413 `payload_too_large`(00 の `route()`)。モジュールごとの上限は設けない |
| Content-Type | 変更系は `application/json` 必須(本文なしの POST・DELETE を含む。2.3)。違反は 415 |
| 本文の未知のキー | 捨てる(00 の `v.object`)。拒否はしない。性別・細かい年齢のキーも捨てられるため保存されない |
| クエリの未知のキー | `invalid_input`(strict)。例外は 02 の lenient(画面の初期化と入口B 用。未知キーは `ignored` に積んで無視する。7.3) |
| 性別・細かい年齢の条件 | 本文では未知キーとして捨てる。クエリでは strict の検証が未知キーとして `invalid_input` にするため、追加の処理は要らない。絞り込みのクエリを受ける 02(lenient を含む)と 03 の一覧だけは、専用の文言で拒否するために 09 の `rejectProhibitedParams(c.url.searchParams)` をハンドラの先頭(`c.query(schema)` の前)で呼ぶ。他のモジュール(12 を含む)は呼ばない。00 の `route()` は 09 を import しない |
| null の受け付け | 00 の `v` に `v.nullable(schema)` を追加する。PATCH は「省略 = 変更なし、`null` = 消去」。PUT の任意項目は、文字列の項目が「省略 = `""`」(00 の JSON 規約で文字列は `null` にしない)、それ以外(数値・日付・ID など)が「省略 = `null`」。05 の自前の `nullable` は作らない |
| 文字列の正規化 | 00 の `sanitizeText` だけを使う(09・10 の自前の正規化は作らない) |
| 日時 | 保存は `clock.nowIso()`(`+09:00`)。`toISOString()`(UTC)は使わない |
| 上限値 | 00 の `LIMITS` を唯一の定義とする(10.3)。モジュールは値を再定義しない |

### 3.5 route() の追加機能 [統一]

- 前処理フック `beforeRequest`: `route()` がハンドラの前に `runHooks("beforeRequest")` を呼ぶ。04 が `registerHook("beforeRequest", "lifecycle", () => evaluateAll(clock.now()))` を登録する。`/api/demo/reset` は対象外(`RouteOptions.skipHooks`)。各モジュールは `evaluateAll` を自分で呼ばない。
- ドメインイベント(4.6)の `emit`/`on` を `lib/events.ts` に置く。
- クライアント `lib/groups-api.ts` に `gput` を追加し、`ApiError` に `reason` を追加する。`gpost`/`gpatch`/`gput`/`gdelete` が成功したら `window.dispatchEvent(new Event("ntf:refresh"))` を発火する。モジュール固有のクライアント(03 `joinApi`、05 `planApi`、06・09 `groupsApi`、08 `rally/client.ts`)は作らず、必要なら 00 の関数を呼ぶ薄い関数にする。

### 3.6 DemoUser とロール [統一]

```ts
export type UserRole = "traveler" | "municipal" | "host";
export interface DemoUser {
  id: Id;
  displayName: string;          // 1〜20 字
  role: UserRole;
  municipalityId?: string;      // role=municipal のとき必須。Municipality.id
  hostId?: string;              // role=host のとき必須。LocalHost.id
}
```

- 年代帯・ひとこと・旅の目的・公開設定は 09 の `Profile` に置く。本人確認は 09 の `Verification`。
- 表示名: 画面に出す利用者の表示名は 09 の `Profile.displayName` を正とし、`visibleProfile` の結果から得る。`DemoUser.displayName` はデモの視点切替(DemoBar、`/api/demo/users`)だけで使う。09 の `PUT /api/me/profile` は同じ `tx` で `Profile.displayName` と `DemoUser.displayName` の両方を更新し、2 つの値を常に一致させる。seed も同じ値にする。

- 13 追補 [INS-C-01、13 §22]: undefined
- 13 追補 [INS-C-13、13 §22]: undefined

### 3.7 00 が公開する補助関数・型 [統一]

各モジュールが自前で作らず、00 のものを使う。

| 名前 | 署名・内容 | 主な利用 |
|---|---|---|
| `idSeq` | `(id: Id) => number`。採番 ID の連番部分 | 06 |
| `formatJst` | `(value: IsoDateTime \| DateStr, pattern?: string) => string`。既定は `IsoDateTime` なら `"M月D日 H:mm"`、`DateStr`(JST の暦日として扱う)なら `"M月D日"`。dayjs に依存しない | 10(通知本文。締切などの日付も同じ関数で整形する。10 の `format.ts` は作らない) |
| `startOfNextJstDay` | `(date: DateStr) => IsoDateTime`。翌日 00:00+09:00 | 04(`deadlineAt`) |
| `CursorPage<T>` | `{ items: T[]; nextCursor: string \| null }`。`lib/groups-types.ts` に置く | 06、10 |
| `v.nullable` | `(schema) => Schema<T \| null>`(3.4) | 05、08 |
| `parsePage`・`parseSort` | 2.3 の既定値・形式 | 02、03、07、09 |
| `c.query(schema)` | クエリを strict に検証する。schema に無いキー(`limit`・`offset`・`sort` を除く)は `invalid_input`(`fields.<key>`)。本文用の `v.object`(未知キーを捨てる)とは扱いを分ける(3.4)。02 の lenient は `c.url.searchParams` を自前で解釈する | 全モジュールの GET |
| `insertGroup`・`insertMember`・`insertBlock`(試験用) | 試験専用データを入れる。ID を引数で受け取り(省略時は `newId`)、900 番台の固定 ID(`g-901` など)を使う。seed の採番(`g-014` 以降)と重ならない。入れた後も `counters` は変えない | 全モジュールの試験 |
| `fixtures.ts` | 試験の ID 定数(11.3) | 全モジュールの試験 |

- 13 追補 [INS-C-07、13 §22]: 内容は 11.4 の同 ID の追補を参照。

## 4. グループの形と状態(01・04)

### 4.1 GroupStatus [決定(8 状態)/統一(値)]

```ts
// features/groups/lifecycle/types.ts(所有 04)
export type GroupStatus =
  | "recruiting"         // 募集中
  | "min_reached"        // 最少人数到達
  | "withdrawal_period"  // 辞退期間
  | "confirmed"          // 実行確定
  | "in_progress"        // 実施中
  | "completed"          // 完了
  | "cancelled"          // 中止
  | "replanned";         // 再企画済み(中止したグループを幹事が再企画した後の元グループ)
```

- 型名は `GroupStatus`、項目は `group.lifecycle.status`。00 の camelCase、04 の `reached`・`withdrawal`、00 の `GroupState`・`state`、03 の `group.status` は廃止する。
- 終端状態は `completed` と `replanned`。`cancelled` は再企画されるまでの状態で、再企画すると `replanned` になる。新グループは `recruiting` から始まる [決定 5]。
- 表示名は 04 の `statusLabel(status: GroupStatus): string` だけを使う(10.1)。
- 状態のバッジ: 00 の `StatusBadge`(`kind: "group" | "joinRequest"`、`value`、`label`。色の一元化)を土台とし、グループの状態は 04 の `GroupStatusBadge({ status, full?, size? })` を使う(`full` は満員の併記、`size` は 00 の `StatusBadge` にそのまま渡す)。`GroupStatusBadge` は `StatusBadge kind="group"` に `statusLabel(status)` を渡す薄い部品。02・05〜08 の画面はグループの状態に `GroupStatusBadge` を使い、03 は申請の状態に `StatusBadge kind="joinRequest"` を使う。

### 4.2 Group の形 [統一]

01 の入れ子(`trip`、`lifecycle`)を正とする。

```ts
// features/groups/types.ts(所有 01)
export interface Trip { destination: string; startDate: DateStr; endDate: DateStr; dateNote: string }

export interface Group {
  id: Id;                        // g-NNN
  name: string;
  campaign: string;
  region: Id;                    // Region.id(r-<slug>)
  trip: Trip;
  capacity: number;              // 2〜6
  visibility: "public" | "private";
  tags: string[];
  description: string;           // 0〜200 字
  official: boolean;             // 公式枠(自治体主催)
  organizerId: Id;
  inviteCode: InviteCode | null; // 01 の形。DTO に出さない
  lifecycle: GroupLifecycle;     // 04 が書く
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}
```

- 01 の `officialHost` は削除する(主催者名は 11 の `Listing` から表示)。02 は `group.trip.*` を読む。
- `GroupLifecycle` は 04 の定義を正とする。

```ts
export interface GroupLifecycle {
  status: GroupStatus;
  minMembers: number;
  deadlineDate: DateStr;              // 正。締切日(その日を含む)
  deadlineAt: IsoDateTime;            // 派生値。startOfNextJstDay(deadlineDate)
  deadlineExtendedCount: number;
  withdrawalStartedAt: IsoDateTime | null;
  withdrawalEndsAt: IsoDateTime | null;
  confirmedAt: IsoDateTime | null;
  startedAt: IsoDateTime | null;
  completedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  cancelReason: CancelReasonCode | null;
  organizerCancelReason: OrganizerCancelReason | null;
  replanOfGroupId: Id | null;         // 再企画で作ったグループの元
  replannedToGroupId: Id | null;      // 再企画した元グループの先
  replannedAt: IsoDateTime | null;
  deadlineSoonNoticeSent: boolean;
  withdrawalEndingNoticeSent: boolean;
  revision: number;
}
```

- 締切は `deadlineDate`(日付)を正とし、`deadlineAt` を同時に保存する。DTO と通知は両方を返し、画面は日付を表示する。
- 項目名の対応(旧名は廃止): `replanOfId`/`replannedToId`/`replannedFromId`/`replanSourceId` → `replanOfGroupId`/`replannedToGroupId`。`canceledAt` → `cancelledAt`。`maxMembers` → `capacity`、`group.minMembers` → `lifecycle.minMembers`。
- 未設定の日時は省略せず `null`。
- 遷移で日時を消さない: 確定後に中止しても `confirmedAt` を残す。再企画で `replanned` にしても `cancelledAt`・`cancelReason` を残す。`completed` に遷移したら `completedAt` を設定する(12 の集計が依存する)。

### 4.3 遷移・中止理由・受付終了 [決定 9・10・29/統一]

- 遷移は 04 の T1〜T12 を正とし、T13 を次に改める: `cancelled` → `replanned`(元の幹事が再企画したとき。新グループを作成)。
- 幹事の中止(T11)を設ける [決定 9]。中止できる状態は `recruiting`・`min_reached`・`withdrawal_period` だけ [決定 29]。04 の `organizerCancelStates` から `confirmed` を外す。理由の選択(`OrganizerCancelReason`)を必須とし、参加者と申請中の申請者に `cancelled` を通知する。
- 実行確定後の中止は、辞退で 2 人未満になる場合(T8、`below_floor`)だけ [決定 10]。通知の本文で再企画できることを案内する。
- 中止理由は 04 の 5 値を正とし、10・12・02 はこの型を import する。

```ts
export type CancelReasonCode =
  | "min_not_reached" | "below_min_in_withdrawal" | "below_floor" | "organizer_cancelled" | "organizer_left";
```

| 利用側 | 扱い |
|---|---|
| 10 | `cancelled` の本文テンプレートを 5 値に用意。`organizer_cancelled` の本文に幹事が選んだ理由(`OrganizerCancelReason`)は含めない(画面で表示する。04 の `GET G/lifecycle` の応答 `LifecycleView` に `organizerCancelReason: OrganizerCancelReason \| null` を含め、ラベルは 04 の `messages.ts` に置く) |
| 12 | 自動 = `min_not_reached`、`below_min_in_withdrawal`、`below_floor`。幹事 = `organizer_cancelled`、`organizer_left`。M-05 の内訳 `deadline_unmet` は `min_not_reached`、`other` は残りの自動 2 値 |
| 02 | `cancelKind: "auto" \| "organizer"` を上の区分で導出 |

- `organizer_left`(T12。幹事の不在による中止)は型と遷移表に残すが、幹事は退会できないため(4.5)、デモでは発生しない。04 の `onOrganizerLeft` は受け口のみ(見送り。第 16 章)。
- 申請の受付終了の `reason`(`unavailable_state`): `closed_deadline`、`closed_withdrawal_period`、`closed_confirmed`、`closed_cancelled` の 4 値。04 が `notAcceptingReason(g: GroupLike, now?: Date): NotAcceptingReason | null` を公開し、03 はこれを使う(`canAcceptRequests` は boolean のまま)。状態との対応は次のとおり。

| 状態 | `notAcceptingReason` |
|---|---|
| `recruiting`・`min_reached`(締切前) | `null`(受付中) |
| `recruiting`・`min_reached`(締切後で未評価) | `closed_deadline` |
| `withdrawal_period` | `closed_withdrawal_period` |
| `confirmed`・`in_progress`・`completed` | `closed_confirmed` |
| `cancelled`・`replanned` | `closed_cancelled` |

### 4.4 状態ごとの可否 [決定 3・16・23・29/統一]

関数はすべて 04 が公開し、戻り値は boolean。

| 関数 | 使う側 | recruiting | min_reached | withdrawal_period | confirmed | in_progress | completed | cancelled | replanned |
|---|---|---|---|---|---|---|---|---|---|
| `canAcceptRequests`(締切前のみ) | 03 | ○ | ○ | × | × | × | × | × | × |
| `canEdit` | 05 | ○ | ○ | ○ | ○ | ○ | × | × | × |
| `canChat` | 06 | ○ | ○ | ○ | ○ | ○ | × | × | × |
| `canReadHistory` | 05・06 | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| `canEditExpenses` [決定 3・23] | 07 | × | × | × | ○ | ○ | ○ | × | × |
| `canCollectStamps` | 08 | × | × | × | × | ○ | × | × | × |
| `canReview` [決定 16] | 08 | × | × | × | × | ○ | ○ | × | × |
| `canWithdraw`(幹事を除く) | 04 | ○ | ○ | ○ | ○ | × | × | × | × |
| `canOrganizerCancel` [決定 29] | 04 | ○ | ○ | ○ | × | × | × | × | × |
| `canChangeConditions` | 04 | ○ | ○ | × | × | × | × | × | × |
| `canReplan`(元の幹事) | 04 | × | × | × | × | × | × | ○ | × |

- 07 の `canEditExpenses(g): {ok, reason}` の形は採らない。完了後の編集は可 [決定 23]。
- 08 の `canStamp` は `canCollectStamps` に改名。08 の `reviewReason` は `in_progress` で `null`。
- 01 の `canLeave` と `editableFields` の退会列は削除する(退会の可否は `canWithdraw`)。

### 4.5 退会・辞退の経路 [統一]

- 利用者が抜ける API は 04 の `POST G/withdraw` だけ。04 が状態に応じて「辞退」(`withdrawal_period` まで)か「退会」(`confirmed`)を判定し、`in_progress` 以降は `unavailable_state`。幹事は抜けられず、中止を使う。
- `MemberStatus = "active" | "left"`。辞退・退会の記録は 04 の `withdrawals`(型 `Withdrawal`。`phase` が `confirmed` なら退会、それ以外は辞退)。
- 01 は記録の受け口 `markMemberLeft(groupId: Id, userId: Id, at: IsoDateTime): Readonly<GroupMember>` だけを持つ。状態の判定とイベントの発行はしない。
- 04 の `withdraw` の処理順(`tx` の中): (1) `canWithdraw` と権限の確認 → (2) 01 `markMemberLeft` → (3) `Withdrawal` を追加(`newId("wd")`) → (4) 10 `notify(withdrawal_received)`(`eventKey: wd:<Withdrawal.id>`) → (5) `emit({ type: "member_left", groupId, userId, phase, withdrawalId, at })` → (6) 人数による遷移(T3・T7・T8)があれば 4.6 の共通処理で `status_changed`。
- 退会確認ダイアログ(04 の `WithdrawButton`)は、画面が 07 の `GET G/expense-summary` を取得し、自分の差額が 0 でなければ表示する。04 のサーバー関数は 07 を呼ばない。07 の `unsettledBalanceOf` は公開しない(07 の内部関数とする)。
- 03 の申請の取り下げ関数は `withdrawRequest`。

### 4.6 依存の向きとドメインイベント [統一]

00 の `lib/events.ts` に同期のイベントバスを置き、循環依存を解消する。

```ts
export type DomainEvent =
  | { type: "group_created"; groupId: Id; organizerId: Id; at: IsoDateTime }
  | { type: "member_joined"; groupId: Id; userId: Id; at: IsoDateTime }
  | { type: "member_left"; groupId: Id; userId: Id; phase: GroupStatus; withdrawalId: Id; at: IsoDateTime }
  | { type: "status_changed"; groupId: Id; from: GroupStatus; to: GroupStatus;
      cancelReason: CancelReasonCode | null; revision: number; at: IsoDateTime };

export function emit(e: DomainEvent): void;
export function on<T extends DomainEvent["type"]>(
  type: T, key: string, handler: (e: Extract<DomainEvent, { type: T }>) => void): void;
```

- `emit` は登録順に同期で呼び、呼び出し元の `tx` の中で動く。購読側は例外を外へ出さない(自分で捕捉して `console.error` に ID とコードだけを残す)。登録は `features/bootstrap.ts` から。

| イベント | 発行 | 購読 |
|---|---|---|
| `group_created` | 01 `createGroup`・`createGroupInternal` | 06(システムメッセージ) |
| `member_joined` | 01 `addMember`(承認によるメンバー追加のみ。作成時の幹事の登録では発行しない) | 06 |
| `member_left` | 04 `withdraw`(4.5 の手順 5。`withdrawalId` は手順 3 で採番した値) | 06、07(`onGroupMemberLeft`) |
| `status_changed` | 04 の状態が変わるすべての遷移(`applyDue`、`onMembershipChanged`、`changeConditions` の後の評価、`withdraw`、`organizerCancel`、`replan`) | 06(システムメッセージ)、03(申請の失効と `join_expired`) |

- 作成(T1)は状態の変化ではないため `status_changed` を発行しない(`from` は常に値を持つ)。作成の記録は 04 の `recordCreated` が `GroupStatusLog` に書く。
- 発行側は 06・07 を import しない。`postSystemMessage` は 06 の内部関数。
- 申請の失効: 03 が `status_changed` を購読し、`to` が `canAcceptRequests` の対象外の状態なら、そのグループの `pending` を `expired` にする(`decidedBy: "system"`)。`to === "withdrawal_period"` のときだけ、失効した申請者へ `join_expired` を送る(5.3)。
- 締切は `beforeRequest` の `evaluateAll` で評価されるため、03 の各関数の入口では状態は評価済み。

依存の向き(実行時の import):

| 呼ぶ側 | 呼ばれる側 | 型だけの参照(`import type`)・データの読み取り |
|---|---|---|
| 01 | 00、09 | 04(`GroupLifecycle` ほかの型) |
| 02 | 00、01、03(`hasPendingRequest`。画面は `JoinRequestPanel`・`consentText`)、04、09、11(`getOfficialBadges`、任意で `recordFunnelEvent`) | - |
| 03 | 00、01、04、09、10、11(任意で `recordFunnelEvent`) | - |
| 04 | 00、01、09、10 | 03(`JoinRequest` の型。再企画の案内先を `db().joinRequests` から読む) |
| 05 | 00、04、09 | 01(型) |
| 06 | 00、04、09、10 | 01(型) |
| 07 | 00、04、09 | 01(型) |
| 08 | 00、04、09 | 01(型) |
| 09 | 00 | 01(`Group` の型。`db().groups`・`db().members` を読む)。`PUT /api/me/profile` で `db().users` の `displayName` を書く(3.6) |
| 10 | 00、09 | 04(`CancelReasonCode` の型)。宛先の解決で `db()` の `groups`・`members`・`joinRequests`・`users` を読む |
| 11 | 00、01、02(`discovery/query.ts`・`discovery/regions.ts` のみ)、04、09 | - |
| 12 | 00、11(`aggregateFunnel`、`ENTRY_SOURCES`) | 01・02・03・04・08・09 の型。`db()` で `groups`・`members`・`joinRequests`・`groupStamps`・`rallySurveys`・`profiles`・`municipalities`・`regions` を読む |
| 合成層(`features/groups/compose`。所有 01) | 00、01、02(`getPublicGroup`)、04(`validateLifecycleInput`・`buildInitialLifecycle`・`recordCreated`)、09 | どのモジュールからも import されない |

- 02 → 11(`getOfficialBadges`)と 11 → 02 は、11 が import する 02 のファイルを、ストアと 11 に依存しない `query.ts`・`regions.ts` に限ることで循環を避ける。03 → 11 は 11 が 03 を import しないため循環しない。
- 01 は 02・04 を実行時に import しない。作成と詳細の合成は合成層が行う(5.1、5.5)。
- 画面からの API 利用は import の依存に数えない。04 の退会確認ダイアログは 07 の `GET G/expense-summary` を取得する(4.5)。

- 13 追補 [INS-C-10、13 §22]: undefined

## 5. 主要な処理の流れ

### 5.1 グループの作成 [統一]

合成層の `createGroupHandler`(`POST /api/groups`)が次の順に行う。

1. 09 `requireVerified(user.id, "create_group")`、`checkRate("group_create", user.id)`。
2. 本文を 01 のスキーマで検証し(未知キーは捨てる)、09 `assertTextAllowed` を項目ごとに通す(6.2)。
3. 04 `validateLifecycleInput(input, ctx)` → `buildInitialLifecycle(input, now)`。`fields` のキーは `minMembers`、`deadlineDate`。
4. 01 `createGroup(user, input, lifecycle)`(01 は受け取った lifecycle を保存し、幹事を `members` に登録する)。`group_created` を発行する(`member_joined` は発行しない)。
5. 04 `recordCreated(groupId)`(`GroupStatusLog` に作成を記録。`status_changed` は発行しない)。

### 5.2 申請・承認 [統一]

- 申請: 03 `requestJoin` → 存在を隠す検査を先頭に置く(グループが無い、または非公開でコードが無い・一致しない → `not_found`。非公開は 01 `assertInviteCode(groupId, inviteCode)`) → 09 `requireVerified(user.id, "request_join")`、`assertNotBlocked`、`checkRate("join_request")`、`assertTextAllowed(note, "join_note", "note")` → 04 `canAcceptRequests`/`notAcceptingReason` → 保存 → 10 `notify(join_requested)`。招待コード経由の申請も action は `request_join`(`join_by_invite_code` は使わない)。
- 承認: 03 `approve` → 01 `addMember`(`member_joined` を発行) → 04 `onMembershipChanged(groupId)`(人数による T2・T3) → 10 `notify(join_approved)`。03 は `evaluate(group, now)` を呼ばない。
- 却下: 03 `reject` → 10 `notify(join_rejected)`。却下理由は通知に入れず、申請者の画面(申請パネル)で表示する。

### 5.3 状態遷移の通知と申請の失効の順序 [決定 22/統一]

04 の遷移の共通処理は、`tx` の中で (a) revision の確認 → (b) 01 `applyLifecyclePatch` → (c) `GroupStatusLog` の追記 → (d) 10 `notify`(第 9 章の種類) → (e) `emit(status_changed)` の順に行う。通知を先にするのは、中止の通知を申請中の申請者に届けてから 03 が申請を失効させるため。

| 遷移 | 04 の通知(手順 d) | 03 の処理(手順 e の購読) |
|---|---|---|
| 締切で辞退期間へ(T5) | `withdraw_period_started`(参加中メンバー) | 申請中を `expired` にし、失効した申請者それぞれに `join_expired` を送る(宛先は申請者のみ、`eventKey: je:<requestId>`) |
| 中止(T4、T7、T8、T11、T12) | `cancelled`(参加中メンバーと申請中の申請者 `{type:"pendingApplicants"}`) | 申請中を `expired` にする。`join_expired` は送らない(`cancelled` と重複するため) |
| その他で受付が終わる遷移 | 第 9 章のとおり | 残っている申請中を `expired` にする(通常は T5 で失効済み) |

### 5.4 再企画 [決定 5/統一]

1. 04 `replan(user, groupId, input)`: 元が `cancelled`、実行者が元の幹事、`replannedToGroupId` が未設定であることを確認。09 `requireVerified(user.id, "create_group")`・`assertTextAllowed` を先に通す。
2. 01 `createGroupInternal({ ...引き継ぐ項目, organizerId: user.id, lifecycle })`(作成上限の検査はしない)。`lifecycle.replanOfGroupId` に元を入れる。`group_created` を発行。
3. 元グループを `applyLifecyclePatch` で `replanned`(`replannedToGroupId`、`replannedAt`)にし、`status_changed`(`cancelled` → `replanned`)を発行。
4. 10 `notify(replan_invited)`(中止時の参加者と、中止で失効した申請者。辞退者と幹事を除く。申請者は `db().joinRequests` から求める)。
5. 再エントリーは 03 の通常の申請。申請に `reentryOfGroupId: Id | null`(元グループ)を持つ。
- 05 の旅程は引き継がない。

### 5.5 グループ詳細の振り分け [統一]

合成層の `getGroupDetailHandler`(`GET G`)が次の順に判定する。「関係者」は、そのグループの `members` に `status: "active"` の行がある利用者(幹事を含む)とする。

1. グループが無い → `not_found`。
2. 閲覧者が関係者 → 01 `getGroup`(`kind: "member"`)。
3. 09 `isGroupVisibleTo(viewerId, group)` が真(公開かつブロック関係なし) → 02 `getPublicGroup`(`kind: "public"`)。申請中・退会済みの利用者もこの経路。
4. それ以外(非公開の非メンバー、ブロック関係) → `not_found`(存在を隠す)。

## 6. 安全機能の契約(09)

### 6.1 アクセス判定 [統一]

- 05〜08 のグループ取得と権限判定は 09 `assertGroupAccess(userId, groupId, need: "view" | "member" | "organizer"): GroupRecord` を使う。01 の `getGroup`(DTO を返す)は 01 の API と合成層専用。
- 素の取得は 00 `requireGroup(id)` と 01 `getGroupById(id)` の 2 つだけ。
- `isMember`、`isOrganizer`、`activeMembers` は 00 の `authz.ts` を正とし、01 は再エクスポートだけ。
- 資源の所属確認は 09 `assertInGroup(item, groupId)`。
- 09 の `GroupRecord` は本書の `Group` を読む。
- 公開判定は 09 `isGroupVisibleTo(viewerId: Id, group: GroupRecord, opts?: { inviteVerified?: boolean }): boolean`。公開グループはブロック関係がなければ真。非公開グループは関係者、または `inviteVerified: true` のときだけ真(ブロック関係があれば偽)。招待コードの照合は 01 が行い、照合済みのときだけ呼び出し側(02 の `POST /api/invites/lookup`)が `inviteVerified: true` を渡す(09 は 01 を import しない)。

- 13 追補 [INS-C-11、13 §22]: undefined

### 6.2 禁止表現 [統一/決定 30]

- 保存する入力は 09 `assertTextAllowed(text, context, field, { ackReview })` を通す。違反(deny)は `invalid_input` + `reason: "text_denied"` + `fields[field]`。要確認(review)で未確認のときは `invalid_input` + `reason: "text_review_required"` + `fields[field]` + `detail.reviewRequired: true`。画面は確認後に本文の最上位のキー `ackReview: true` を付けて再送する。本文の未知キーは捨てられる(3.4)ため、禁止表現を検査する本文のスキーマには必ず `ackReview: v.boolean({ optional: true })` を宣言する。画面のライブ警告は `checkText(text, context)`。
- `TextContext` と呼び出しの対応(上限値は 00 の `LIMITS` と一致させる):

| 呼び出し | context | field |
|---|---|---|
| 01 グループ名・行き先・日程メモ・タグ・説明 | `group_name`・`group_destination`・`group_date_note`・`group_tag`・`group_description` | `name`、`trip.destination`、`trip.dateNote`、`tags.N`、`description` |
| 03 申請のひとこと・却下理由の自由記入(使う場合) | `join_note`・`reject_reason_free` | `note`、`reasonText` |
| 05 旅程項目名・項目メモ・集合場所・日程メモ | `plan_item_title`・`plan_note` | `title`、`note`、`text` |
| 06 チャット | `chat_message` | `body` |
| 07 項目名・メモ | `expense_item`・`expense_memo` | `title`、`memo` |
| 08 振り返りメモ・写真の説明 | `rally_memo`・`rally_photo_caption` | `body`、`caption` |
| 09 表示名・ひとこと | `profile_display_name`・`profile_bio` | `displayName`、`bio` |
| 11 公式枠の要約・見どころ | `official_summary`・`official_highlight` | `summary`、`highlights.N` |
| 04 再企画の名称・行き先 | `group_name`・`group_destination` | `name`、`destination` |
| 09 通報本文 | `report_body`(禁止表現の検査はしない。文脈は長さの上限の確認だけに使う) | `body` |

- 禁止表現のカテゴリに `official_hint` を設けない [決定 30]。「公式」「自治体」を一般の利用者の入力で警告する仕組みは作らない(公式枠であることは 11 のバッジで示す)。

### 6.3 プロフィール・概要・ブロック・通報 [統一/決定 28]

- `visibleProfile(viewer: { id: Id }, targetId: Id, ctx: ProfileContext): PublicProfile`(09)。呼び出し側は `{ kind: "member", groupId }`、`{ kind: "request", groupId }`、`{ kind: "list" }` を渡す。
- 年代帯は 09 の `AgeBand`(`"18-19" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+"`)を正とする。18 歳未満の帯は設けない。18 歳未満と申告した利用者(seed の u-008)の `Profile.ageBand` は `"18-19"` とし、18 歳未満であることは `Verification.status = "underage"` だけで表す。u-008 は作成・申請ができないため、グループの概要と集計には現れない。
- メンバー概要は 09 の `memberSummary(members: ReadonlyArray<{ ageBand: AgeBand }>): MemberSummary`(`{count, buckets, hiddenReason}`、4 人未満は年代を出さない)。入力は 09 の `ageBandsOf(userIds: readonly Id[]): { ageBand: AgeBand }[]`(参加中メンバーの userId から `Profile.ageBand` を読む。公開設定にかかわらず概要の材料として使う)で作る。02・10 はこの 2 つを組み合わせ、`db().profiles` を直接読まない。
- 09 の `formatMemberSummary(s: MemberSummary): string` で 10 の確定通知の `summaryText` を作る。04 の `summarizeParticipants` は削除。
- 02 の年代の絞り込み: クエリキーは `ageBuckets`(カンマ区切り、値は 09 の `AgeBucket` の 4 値)。`buckets` が `null` のグループは一致しない。09 の `rejectProhibitedParams` が拒否するキーは性別・細かい年齢(`gender`、`sex`、`age`、`ageMin`、`ageMax`、`birthYear`、`birthday` など 09 の定義)だけで、`ageBuckets` と `ageBand` は拒否しない。
- ブロックの方向: 一覧・申請・プロフィールは双方向(`isBlocked`、`hasBlockAmong`、`assertNotBlocked`)、チャットは自分がブロックした相手だけを隠す(`filterVisibleMessages<T extends { senderId: Id | null }>`。システムメッセージ(`senderId: null`)は残す)。06 の `chat_new` の宛先から外すのは `isBlockedByMe(recipient, sender)` が真の受信者。
- 通報: 09 `createReport(user, { targetType, targetId, reason, body?, groupId?, alsoBlock? })`。通報の対象は次の 3 種だけ [決定 28]。

```ts
export type ReportTargetType = "message" | "group" | "user";
```

  - `plan_item`、`expense`、`rally_memo`、`rally_photo`、`join_request`、`text_check` は採らない。05・07・08 は通報の導線を置かない。申請のひとことに問題がある場合は、申請者を `user` として通報する。
  - 誤検知の報告(`text_check`、`reason: "false_positive"`)は作らない。そのため辞書の `ruleId` を利用者の入力として受け付ける箇所は無い(`ruleId` はログと `TextFinding` にだけ出る)。
  - `targetId` の形式は `message` = `msg`、`group` = `g`、`user` = `u` の `v.id(prefix)`。`snapshot` は `message` のときだけ保存する。

## 7. モジュール別の確定事項

### 7.1 01 グループ中核

```ts
createGroup(user: DemoUser, input: CreateGroupInput, lifecycle: GroupLifecycle): Group;           // 幹事を members に登録。group_created を発行
createGroupInternal(input: CreateGroupInput & { official?: boolean; organizerId: Id; lifecycle: GroupLifecycle }): Group;
getGroup(user: DemoUser, id: Id): GroupDetailView;                                                 // 01 の API と合成層専用
getGroupById(id: Id): Readonly<Group> | undefined;
listAllGroups(): readonly Readonly<Group>[];
countActiveMembers(groupId: Id): number;
addMember(groupId: Id, userId: Id, role?: MemberRole): Readonly<GroupMember>;     // conflict: group_full / already_member。member_joined を発行
markMemberLeft(groupId: Id, userId: Id, at: IsoDateTime): Readonly<GroupMember>;  // イベントを発行しない
applyLifecyclePatch(groupId: Id, expectedRevision: number, patch: Partial<GroupLifecycle>): GroupLifecycle; // 不一致は conflict + version_mismatch。04 だけが呼ぶ
normalizeInviteCode(raw: string): string | null;                                   // 大文字化、ハイフン・空白の除去。形式不正は null
findGroupByInviteCode(rawCode: string): Readonly<Group> | undefined;              // 02 が使う
assertInviteCode(groupId: Id, rawCode: string): void;                              // 03 が使う
```

- 作成上限(幹事として進行中 5 件)は残す。作成時の本人確認は必須(09 `requireVerified(user.id, "create_group")`)。
- 04 の `GroupForm mode="replan"` の送信処理は 04 の `ReplanPage` が渡す。

### 7.2 招待コード [決定 8・27/統一]

- 形式は 01 の 10 文字(`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`、表示 `ABCDE-FGHJK`、入力は `normalizeInviteCode` で大文字化してハイフン・空白を除く)。
- 照合は試行回数に数えない [決定 8]。総当たり耐性が無いことは 01・09 の既知の制約に書く。
- 終了状態(`completed`、`cancelled`、`replanned`)では発行・再発行しない(`unavailable_state`)[決定 8]。
- 方式はコード入力方式 [決定 27]。コードを URL(クエリ・パス)、`sessionStorage`、ログに残さない。`/[campaign]/groups/[groupId]?code=` の形の画面と、`GET G` の `code` クエリは作らない。
  1. 利用者は招待コード入力画面 `/[campaign]/invite` でコードを入力する。
  2. 画面は `POST /api/invites/lookup`(本文 `{ code }`)を呼ぶ。02 が 01 `findGroupByInviteCode` で照合し、09 `isGroupVisibleTo(viewerId, group, { inviteVerified: true })` を通したうえで `PrivateGroupPreview` を返す。不一致・終了状態・ブロック関係はすべて同じ `not_found`。
  3. 同じ画面で、プレビューと 03 の申請パネル(`JoinRequestPanel`)を表示する。コードは画面のコンポーネントの状態にだけ保持する。申請前のパネルは `G/my-join-request` を呼ばず(自分の申請が無いと `not_found` のため)、`PrivateGroupPreview` の `headcount.min`・`applyState` を props で受け、同意文言は 03 の `consentText(minMembers)` で作る。
  4. 申請は `POST G/join-requests` の本文に `inviteCode` を入れて送る。03 は非公開グループのとき 01 `assertInviteCode` を呼ぶ。
  5. 申請後の状態は、`GET /api/me/join-requests`(非公開グループの申請も含む)と `GET G/my-join-request` で確認する。`G/my-join-request` は、閲覧者がそのグループに自分の申請を持つ場合は非公開でも返し、持たない場合は `not_found`。
  6. 承認されて関係者になった後は、通常の `GET G`(5.5)で詳細を表示する。
- 02 の試験フィクスチャの招待コードは 32 文字集合だけの値(例 `TESTC-DE2X5`、`TESTC-DE2X2`)にする。

### 7.3 02 グループ探索

- 一覧の条件キーは 02 の `GroupListFilter` を正とする(公式枠は `official`、値は `1`。11 の `officialOnly` は廃止)。
- `GroupSummary` の公式表示は `badge: OfficialBadgeView | null`(11 の型)。
- `deadline` は `deadlineDate` と `deadlineAt` の両方を返す。
- 一覧・既定の状態フィルタに `cancelled`・`replanned` を含めない(`status` 指定時のみ)。`ApplyBlockReason` は `replanned` を `cancelled` と同じ扱いにする。
- 地方は 02 の `Region`(`r-<slug>`)を正とし、seed に `regions` を置く。
- 11 が使う純粋関数(`parseGroupListQuery(params, mode, ctx)`、`serializeFilter`)は `features/groups/discovery/query.ts` に分け、ストアに触れない。`ctx` は 02 の `QueryContext = { campaigns: string[]; defaultCampaign: string; regions: Region[]; today: DateStr }` とし、呼び出し側が `listRegions`・`getCampaign`・`clock.today()` から作る。地方の存在確認は `ctx.regions` で行う。
- 過去の日付: `dateFrom`・`dateTo` が `ctx.today` より前なら、strict は `invalid_input`(400)、lenient は無視して `ignored` に積む。
- lenient の `ignored` の `reason` は `"unknown_key" | "invalid_value"` の 2 値とし、型 `IgnoredReason` を `query.ts` から公開する(存在しない地方 ID と過去の日付は `invalid_value`)。11 は同名の型を作らない(11 自身の無視理由は別名にする)。
- 一覧の `limit` の既定は 12(`parsePage(q, { defaultLimit: 12 })`)、並び順は `?sort=<キー>:<asc|desc>`(2.3)。
- `evaluateAll` は呼ばない(3.5)。

- 13 追補 [INS-C-06、13 §22]: 内容は 11.4 の同 ID の追補を参照。

### 7.4 03 参加申請・承認

- `JoinRequest` は 03 の形を正とし、`reentryOfGroupId: Id | null` を持つ。状態は `pending | approved | rejected | withdrawn | expired` の 5 値。
- 本人確認の理由コードは 09 の `not_verified`、`underage`。action は `request_join` だけ。
- 試行回数の制限は設けない(7.2)。申請の頻度制限は 09 `checkRate("join_request")`(429)。
- 通知は 10 の形で `join_requested`、`join_approved`、`join_rejected`、`join_expired` を送る [決定 1・22]。`join_withdrawn` は送らない。`join_expired` は 5.3 のとおり、`status_changed` の `to === "withdrawal_period"` のときだけ、失効した申請者に送る(`params` は `groupTitle` のみ、`eventKey` は `je:<requestId>`)。
- 自分の申請の取得は `GET G/my-join-request`(7.2 の 5)。非公開グループの申請状態の取得に `inviteCode` クエリは使わない。
- 02 向けは `hasPendingRequest(userId, groupId): boolean`。

### 7.5 04 実行条件・状態遷移

- 4.1〜4.6、5.3〜5.5 のとおり。通知は 10 の形で第 9 章の種類だけを送る。04 の `lc_*` の名前、`notify` の位置引数と `opts.dedupeKey` は廃止(冪等は 10 の `eventKey`)。
- `organizerCancelStates` は `recruiting`・`min_reached`・`withdrawal_period` [決定 29]。
- T3(最少人数を割って募集中に戻る)は通知せず、状態表示で知らせる。
- デモの日付操作は 00 の `/api/demo/clock`。04 は `afterClockChange` と `beforeRequest` で `evaluateAll` を登録する。時計の後戻りは 00 の `set` で許し、04 は状態を巻き戻さない(既知の制約)。

### 7.6 05 旅程・集合場所メモ

- 型は 05 の定義を正とする。`plans` は `Repo<GroupPlan>`(id = groupId)。
- 並び替えは `PUT G/plan/order`(本文 `{ date, orderedIds, baseRevision }`)。
- null の扱いは 00 の `v.nullable`(3.4)。上限は 00 の `LIMITS`(10.3)。
- 通報の導線は置かない [決定 28]。

### 7.7 06 グループチャット

- 型は 06 の定義を正とし、ID を `newId("msg")` に、`seq` を `idSeq` からの導出にする。
- 投稿頻度は 60 秒に 10 件 [決定 4]。09 `checkRate("chat_post", userId, groupId)` を使う。超過は 429 `rate_limited`。
- システムメッセージは 4.6 のイベント購読で作る(`group_created`、`member_joined`、`member_left`、`status_changed`。`state_replanned` を含む)。
- 既読位置の API は `POST G/chat/read`。定型文は API を作らずクライアントの定数とする。
- 通知 `chat_new` は余力 [決定 1]。送る場合は 6.3 の宛先除外で、集約は 10 が行う。`chat_new` の通知の既読化は 10 の通知画面で行う(項目を開いたときに `POST /api/me/notifications/read`)。チャットを開いても通知は既読にしない。

### 7.8 08 グループ・スタンプラリー [決定 6・13〜16・19・21・25]

- グループ専用の記録(`groupStamps`)を持ち、既存の `server-store.ts` の個人スタンプは変更しない [決定 6]。1 人が押せばグループとして取得済み [決定 14]。写真はダミー投稿 [決定 15]。
- `GroupStamp = { id, groupId, spotId, acquiredBy, method, at }`。12 は `at` を読む。
- 振り返りは `in_progress` と `completed` で読み書きできる [決定 16]。
- アンケートは 5 項目 [決定 19・25]。

```ts
export interface SurveyAnswer {
  id: Id; groupId: Id; userId: Id;
  satisfaction: 1 | 2 | 3 | 4 | 5;       // 旅全体の満足度
  planClarity: 1 | 2 | 3 | 4 | 5;        // 旅程・集合のわかりやすさ
  wantAgain: "yes" | "maybe" | "no";     // また旅行したいか
  localInteraction: 1 | 2 | 3 | 4 | 5;   // 地元の人との交流があったか
  localExploration: 1 | 2 | 3 | 4 | 5;   // 滞在中にいろいろな場所を回れたか
  answeredAt: IsoDateTime;
}
```

- 個人特典 [決定 13・21]:

```ts
export interface RallyRewardGrant { id: Id; userId: Id; rewardId: number; groupId: Id; at: IsoDateTime } // rg-NNN
```

  - グループの取得数が特典の必要数に達したとき、その時点の参加中メンバー全員に付与記録を作る。`(userId, rewardId)` で一意。
  - 保存先は `rallyRewardGrants` で、既存の `server-store.ts` と `/api/v2` の特典には連動しない。
  - 押印に同行しなかったメンバーにも付与される。画面に「グループの達成で全員に付与」と明記する。通知(`rally_reward`)は送らない。
- 写真の `spotId` は省略可(省略 = スポットなし、応答は `null`)。`v.nullable` で `null` を受けてもよい。
- 削除は `DELETE G/review/photos/[photoId]`(204)。メモ・アンケートは `PUT`(上書き)。
- エラーは 3.3 に合わせる。12 向けの集計関数は作らない(12 は `groupStamps`・`rallySurveys` を直接集計する)。
- 通報の導線(メモ・写真)は置かない [決定 28]。

### 7.9 07 費用の分担メモ

- 利用は実行確定以降、完了後も編集可 [決定 3・23]。可否は 04 `canEditExpenses(g): boolean`。
- 楽観ロックは `baseVersion`。不一致は `conflict` + `reason: "version_mismatch"` + `detail.current`。件数上限は `conflict` + `reason: "limit_exceeded"`。
- 集計は `GET G/expense-summary`(04 の退会確認ダイアログも使う。4.5)。
- 退会者の扱いは 4.6 の `member_left` 購読と 10.6 の表示語。
- 通報の導線は置かない [決定 28]。

### 7.10 09 安全

- 本人確認: `requireVerified(userId, action: "create_group" | "request_join")`。`forbidden` の理由は最上位の `reason`(`not_verified`、`underage`)。
- `RATE_LIMITS.chat_post = { limit: 10, windowMs: 60_000 }` [決定 4]。計数は固定ウィンドウ(10.4)。
- API は 2.2 のパス。`DELETE /api/me/blocks/[userId]` で解除する。
- `PUT /api/me/profile` は全置換で、編集できる全項目(`displayName`、`ageBand`、`bio`、`travelPurposes`、`visibility`)を必須とする。部分更新(PATCH)は設けない。表示名の扱いは 3.6。
- `suppressSmallCell`、`assertSafeRequest`、`official_hint`(6.2)、通報対象の 3 種以外(6.3)は削除する。
- `sanitizeText`・`isId` は 00 を使う。
- seed に全デモユーザーの Profile と Verification を置く(00 が統合)。

- 13 追補 [INS-C-11、13 §22]: 内容は 6.1 の同 ID の追補を参照。

### 7.11 11 入口B・公式枠

- `Municipality`・`LocalHost` は 11 が所有し、12 はそれを読む。担当者は `DemoUser.municipalityId`/`hostId` から引く。

```ts
export interface Municipality { id: string; campaign: string; displayName: string; regionIds: Id[] }
export interface LocalHost { id: string; campaign: string; displayName: string; intro: string }
```

- `resolveSponsor(user, type)` は `user.role` と `user.municipalityId`/`hostId` で判定する。
- 公式枠・同行枠の作成は本人確認を求める(09 `requireVerified(user.id, "create_group")`。seed の u-009・u-011・u-012 は確認済み)。作成は `createGroupInternal({ official: true, organizerId: user.id, lifecycle })` と `Listing` の追加を 00 の `tx` で一括して行う。作成上限の検査はしない。
- 公式枠の要約・見どころの上限は `LIMITS.OFFICIAL_SUMMARY`・`LIMITS.OFFICIAL_HIGHLIGHT`(10.3)。
- 作成 API の本文は `{ group: <01 の CreateGroupInput と 04 の LifecycleInput>, summary, highlights }` の入れ子とし、`fields` のキーは本文の項目パスに合わせる(`group.name`、`group.trip.destination`、`group.minMembers`、`group.deadlineDate`、`summary`、`highlights.N`)。01・04 の検証関数が返す `fields` のキーに、11 が接頭辞 `group.` を付ける。
- 着地ページは無視した項目があるときだけ出す [決定 7]。
- 計測は 11 の `FunnelEvent` を正とし、`type`・`channel`・`source` は 11 の列挙値だけを受け付ける [決定 20]。`POST /api/entry/events` が受け付ける `type` は `list_viewed`、`official_viewed` の 2 値。
- 一覧への引き継ぎキーは 02 の `GroupListFilter`(`official`、`dateFrom`、`dateTo`、`vacancy`、`region`)で、遷移先は 02 の `serializeFilter` で作る。入口B の解釈は 02 の `parseGroupListQuery(params, "lenient", ctx)` に委譲し、`ignored.reason`(7.3 の 2 値)を 11 の無視理由の表示に対応させる。
- 集計の期間の既定は直近 3 か月(暦月。当月を含む)[決定 12]。
- 02・03 から `recordFunnelEvent` を呼ぶ(`list_viewed`、`official_viewed`、`official_requested`)のはデモ範囲では任意。

### 7.12 12 自治体向け集計

- API は `GET /api/stats`。期間の既定は直近 3 か月(暦月)[決定 12]。
- 集計対象のグループ: 担当自治体の `Municipality.regionIds` に含まれる地方のグループ。公開・非公開を問わず全グループを数える(個人を特定しない件数のみ。K=5 の規則を適用)。年代の集計は、`Profile.visibility.ageBand` の公開設定にかかわらず `Profile.ageBand` を 3 区分の人数として使う(個人の値は出さず、K=5 で秘匿する)。
- 権限: 00 の `requireRole` は `reason` を付けないため、12 は自治体ロールでない利用者に `forbidden` + `reason: "not_municipal"` を自前で返す。
- クエリは strict(3.4)。未知キーは `invalid_input`。
- 担当地方(seed。00 の 4.4 と同じ値): `mun-demo-a` = `r-nijiho`、`r-hoshinagi`、`r-suzukaze`。`mun-demo-b` = `r-mizukoto`。12 は地方 ID をコードに固定せず seed から読む。
- 流入(M-08)は 11 の `aggregateFunnel` の結果を使い、区分は 11 の `source`。`FunnelQuery` に地方の条件は追加しない。M-08 は担当自治体のキャンペーン全体の件数とし、画面にその旨を注記する。12 の `EntryEvent`・`EntryChannel`・`entryEvents` は廃止。
- 読む項目は本書の名前: `group.official`、`lifecycle.confirmedAt`、`lifecycle.cancelledAt`、`lifecycle.cancelReason`、`lifecycle.replanOfGroupId`、`GroupStamp.at`、09 の `Profile.ageBand`。再企画率は元グループの状態 `replanned` で数える。
- 年代の集計区分(3 区分)は 09 の `AgeBand` から変換する(`18-19`・`20s` → `under30`、`30s`・`40s` → `30to49`、`50s`・`60s`・`70s+` → `50plus`)。
- アンケートの指標(満足度・再訪意向・地元との交流・滞在中の回遊)は `completed` のグループの回答だけを対象にし、余力の扱いとする(12 の時系列・ファネルと同じ優先度)。
- 自治体と担当地方は `db().municipalities` から読む(`features/stats/municipalities.ts` は廃止)。

- 13 追補 [INS-C-12、13 §22]: undefined

## 8. 01・04 の lifecycle 書き込みの規則

- `group.lifecycle` を書くのは 04 だけで、書き込み口は 01 の `applyLifecyclePatch(groupId, expectedRevision, patch)` だけ。成功すると `revision` を +1 して新しい lifecycle を返す。不一致は `conflict` + `reason: "version_mismatch"`。
- 01 の作成・設定変更は lifecycle を変更しない(作成時は 04 が作った lifecycle をそのまま保存する)。
- 01 の設定変更で `capacity` を変える場合、`lifecycle.minMembers` との整合(`minMembers <= capacity`)は 01 が検査する。

## 9. 通知(10)[決定 1・22/統一]

### 9.1 種類

| kind | 区分 | 発行元 | docs/design 05 |
|---|---|---|---|
| `min_reached` | 必須 | 04(T2) | 8 種の 1 |
| `withdraw_period_started` | 必須 | 04(T5) | 8 種の 2 |
| `withdraw_period_ending` | 必須 | 04 | 8 種の 3 |
| `confirmed` | 必須 | 04(T6) | 8 種の 4 |
| `cancelled` | 必須 | 04(T4、T7、T8、T11、T12) | 8 種の 5 |
| `replan_invited` | 必須 | 04(再企画) | 8 種の 6 |
| `withdrawal_received` | 必須 | 04(`withdraw`) | 8 種の 7 |
| `conditions_changed` | 必須 | 04(`changeConditions`) | 8 種の 8 |
| `join_requested`、`join_approved`、`join_rejected` | 必須 | 03 | 追加 [決定 1] |
| `join_expired` | 必須 | 03(T5 の `status_changed` の購読) | 追加 [決定 22] |
| `chat_new` | 余力 | 06 | 追加(余力) |
| `deadline_near` | 余力 | 04 | 追加(余力) |

- 必須 12 種、余力 2 種(計 14 種)。それ以外(04 の `lc_min_lost`・`lc_headcount_changed`・`lc_capacity_full`、03 の `join_withdrawn`、08 の `rally_reward`)は作らない。
- `join_expired`: 宛先は失効した申請者のみ。本文は「申請が受け付けられなくなった」旨で、個人を特定できる情報を含めない。`params` は `groupTitle` のみ。`eventKey` は `je:<requestId>`。
- `join_rejected`: `params` は `groupTitle` のみ。却下理由は含めない。
- 呼び出しは 10 の `notify(input: NotifyInput)` だけ。
- `cancelled.params.reason` は `CancelReasonCode`(4.3)。10 は 5 値の本文を持つ。
- `confirmed` の `summaryText` は 10 が 09 の `ageBandsOf`・`memberSummary`・`formatMemberSummary` から作る。
- `withdrawal_received` の `eventKey` は `wd:<Withdrawal.id>`。
- `conditions_changed` の宛先は、幹事を除く参加中メンバーと申請中の申請者(最少人数への同意に関わるため)。04 が `recipients: [{type:"groupMembers", excludeOrganizer: true}, {type:"pendingApplicants"}]` で指定する。
- `deadline_near` を作る場合は 04 の評価で発行する。
- 通知の日時は `clock.nowIso()`、本文の日時は 00 の `formatJst`。

### 9.2 API と画面

- API は 2.2 のとおり。一覧は `CursorPage<NotificationDto> & { unreadCount: number }`。
- 画面は案A(別画面 `/[campaign]/notifications` と、グループ系ページのヘッダーのベル)。通知の既読化はこの画面で項目を開いたときに行う。既存の `/api/v2/notifications` と `news` 画面は変更しない。

## 10. 値の統一

### 10.1 状態のラベル

| 値 | ラベル |
|---|---|
| recruiting | 募集中 |
| min_reached | 最少人数到達 |
| withdrawal_period | 辞退期間 |
| confirmed | 実行確定 |
| in_progress | 実施中 |
| completed | 完了 |
| cancelled | 中止 |
| replanned | 再企画済み |

### 10.2 中止理由のラベル(10 の本文と 04 の画面で共通)

| 値 | ラベル |
|---|---|
| min_not_reached | 締切までに最少人数に達しなかった |
| below_min_in_withdrawal | 辞退期間中の辞退で最少人数を下回った |
| below_floor | 実行確定後の辞退で 2 人未満になった |
| organizer_cancelled | 幹事が中止した |
| organizer_left | 幹事が不在になった |

### 10.3 上限値(00 の `LIMITS`)

`app/src/lib/limits.ts` の `LIMITS` のキーと値を次に確定する。値の形は、文字数・数値の範囲が `{ min, max }`、行数の上限が `maxLines`、件数の上限が `maxItems`(ほかは表の記載どおり)。文字数はコードポイント数。モジュールは値を再定義せず、このキーを参照する。09 の文脈表(`TextContext` の上限)もこの値と一致させる。

| キー | 値 | 用途(所有) |
|---|---|---|
| `GROUP_NAME` | `{ min: 1, max: 30 }` | グループ名(01、04 の再企画) |
| `DESTINATION` | `{ min: 1, max: 40 }` | 行き先(01、04 の再企画) |
| `DATE_NOTE` | `{ min: 0, max: 40 }` | 日程メモ(01) |
| `DESCRIPTION` | `{ min: 0, max: 200 }` | グループの説明(01・02) |
| `TAG` | `{ min: 1, max: 16, maxItems: 5 }` | タグ(01。02 の検索語も 16 字) |
| `CAPACITY` | `{ min: 2, max: 6 }` | 定員 |
| `MIN_MEMBERS` | `{ min: 2, max: 6 }` | 最少人数(定員以下、幹事を含む。04) |
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

- 05 の仮の名前 `PLAN_MEETING_TEXT`・`PLAN_MEMO` は `MEETING`・`SCHEDULE_MEMO` に、08 の提案 `RALLY_PHOTO_CAPTION` は `PHOTO_CAPTION` に改める。03 の `NOTE_MAX_LINES`、05 の `noteLinesMax`・`itemsPerGroupMax`・`itemsPerDateMax`、07 の件数 100、08 の写真の件数は `LIMITS` に移す。
- 件数上限の超過は `conflict` + `reason: "limit_exceeded"`(07・08)。05 の項目数の超過は 05 の既存の扱い(`invalid_input`、`fields.items`)のままでよい。
- 業務上の数(03 の申請総数 3 件、01 の作成上限 5 件、06 の保持件数 500、カーソル一覧の既定・最大、ポーリング間隔)は各モジュールの定数に残す。

- 13 追補 [INS-C-09、13 §22]: undefined

### 10.4 レート制限(09 の `RATE_LIMITS`)

- `chat_post` は 10 件/60 秒 [決定 4]。他(`join_request`、`report`、`block`、`profile_update`、`group_create`)は 09 の値のまま。招待コードの照合は数えない [決定 8]。
- 計数は固定ウィンドウ(ウィンドウの開始時刻から `windowMs` の間の件数。09 の実装)。スライディングウィンドウにはしない。

### 10.5 少数の扱い [決定 17]

- 集計(12)の最小セル K = 5。12 の `MIN_CELL_COUNT`・`toCountCell`・`toRateCell`・`suppressBreakdown` に一本化する。内訳の補完秘匿(`suppressBreakdown`。合計から 1 セルを逆算できないようにする)は残す。第 16 章で見送るのは、期間や条件を変えた複数回の照会の差分による推測への対策だけ。
- 09 の `suppressSmallCell` と 08 の集計関数は作らない。
- グループ内のメンバー概要(09 の `memberSummary`、4 人未満は年代を出さない)は別の規則として残す。

- 13 追補 [INS-C-10、13 §22]: 内容は 4.6 の同 ID の追補を参照。

### 10.6 退会者の表示 [決定 18]

退会・辞退したメンバーの記録は残し、表示名を「元メンバー」とする。

## 11. 実装基盤

### 11.1 利用ライブラリ

- 既存の依存はバージョンを維持する。新規に追加するのは Vitest(devDependency、最新の安定版)だけ。
- zod、SWR、DOMPurify、helmet、SQLite、WebSocket、グラフライブラリ、`@mantine/form` は採らない。

### 11.2 セキュリティヘッダー [決定 2]

`app/next.config.ts` の `headers()` に次を追加する(既存の `cacheComponents`・`partialPrefetching` は残す)。

```ts
async headers() {
  return [{
    source: "/:path*",
    headers: [
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
    ],
  }];
}
```

- CSP は設けない。09 の既知の制約に「CSP なし(インラインスクリプトの注入を防ぐ仕組みは React のエスケープと `dangerouslySetInnerHTML` の禁止のみ)」と書く。
- API の応答は 00 の `route()` が引き続き `X-Content-Type-Options`・`Cache-Control: no-store` を付ける。

### 11.3 試験 [決定 11]

- Vitest(00 の `vitest.config.ts`、`npm test`)。各モジュールは `node --test` を使わない。
- API 試験は 00 の `callRoute`(変更系は `Content-Type: application/json` を付ける)、前提データは 00 の `resetForTest` と `fixtures.ts`。
- `fixtures.ts` は seed の ID 定数を公開する。状態ごとの見本は次の `GROUP_BY_STATUS`(`Record<GroupStatus, Id>`)とする。00 の旧定数 `GROUP`(`recruiting`・`reached`・`ongoing` などの独自名)は `GROUP_BY_STATUS` に置き換え、状態以外の見本(公式枠 `OFFICIAL_GROUPS = [g-002, g-005]` など)は別の定数にする。

| 状態 | グループ |
|---|---|
| `recruiting` | g-001 |
| `min_reached` | g-003 |
| `withdrawal_period` | g-004 |
| `confirmed` | g-005 |
| `in_progress` | g-011 |
| `completed` | g-010 |
| `cancelled` | g-013 |
| `replanned` | g-006(再企画先は g-007) |

- 状態以外の見本: 非公開グループは `PRIVATE_GROUP`(g-008。招待コードは seed のダミー値)、ブロック関係は `BLOCK_SAMPLE`(u-001 が u-006 をブロック)、元メンバーは `LEFT_MEMBER_SAMPLE`(g-011 の u-006、wd-002)、未確認の成人は `UNVERIFIED_USER`(u-010)、18 歳未満は `UNDERAGE_USER`(u-008)。
- 試験の中だけで作るデータは 00 の `insertGroup`・`insertMember`・`insertBlock` を使い、ID は 3.2 の形式で 900 番台(`g-901`、`u-901` など)とする(3.7)。

- 13 追補 [INS-C-14、13 §22]: undefined

### 11.4 seed

- 本人確認: u-004 は確認済み。u-010 は未確認の成人。u-008 は 18 歳未満(`underage`、`Profile.ageBand: "18-19"`)。自治体担当者 u-009(`mun-demo-a`)・u-011(`mun-demo-b`)と地元の担い手 u-012(`host-demo-a`)は確認済み。
- 8 状態の見本(11.3 の表): g-006 は `replanned`(`cancelReason: min_not_reached`、`replannedToGroupId: g-007`)、g-007 は `replanOfGroupId: g-006` の `recruiting`。g-013 は未再企画の `cancelled`(`min_not_reached`、`replannedToGroupId: null`)。
- 辞退と退会の見本: g-004 の u-006 は辞退(wd-001、`phase: withdrawal_period`。メンバー行は `left`)。g-011 に、実行確定のときに退会した元メンバー(u-006、wd-002、`phase: confirmed`、メンバー行は `left`)を置き、u-006 が退会前に記録した費用メモ 1 件を含める(07 の「元メンバー」表示の見本)。
- 通知の seed は必須 12 種から選ぶ。
- 各モジュールの seed 断片は 00 の `group-seed.json` に統合する。

- 13 追補 [INS-C-06、13 §22]: undefined
- 13 追補 [INS-C-07、13 §22]: undefined
- 13 追補 [INS-C-08、13 §22]: undefined

## 12. docs/design の更新

| 章 | 更新内容 |
|---|---|
| 02 | 柱 18 の要件に、通知 12 種(第 9 章)を反映 |
| 03 | ディレクトリ構成、ルーティング方式(2.1。合成層を含む)、Vitest |
| 04 | 状態遷移図: 再企画を `中止 → 再企画済み` とし新グループは募集中から(判断 5)、幹事の中止は辞退期間まで(判断 9・29)、確定後に 2 人未満で中止(判断 10)、最少人数を割ったときの到達 → 募集中。画面: 入口B の着地ページ(判断 7)、ダミー外部リンク集、通知画面、招待コード入力画面(判断 27)、プロフィール・本人確認画面 |
| 05 | 通知の種類(8 → 12)、JoinRequest の失効、GroupMember の状態(参加中/退会)と辞退記録、締切(日付+派生の日時)、再エントリーの参照先(グループ ID)、PlanItem と版番号、ExpenseNote の日付・メモ・版番号、振り返り(メモ・アンケート 5 項目・写真)、個人特典の付与記録、Profile、Listing・Municipality・LocalHost・FunnelEvent、GroupStatusLog |
| 07 | 年代帯(09 の 7 区分)、集計の最小単位 K=5、ブロックの効果の方向、通報の対象(メッセージ・グループ・ユーザー。判断 28)、招待はコード入力方式(判断 27)、CSP を設けない既知の制約 |
| 08 | OSS 一覧に Vitest |
| 10 | Vitest の採用と実行方法 |
| 12 | 判断済み事項の反映(第 1 章) |

- docs/feature の README: 依存図(4.6。合成層を含む)、ルーティング方式(2.1)、`features/entry`・`features/official`・`features/groups/compose` の追加、「写真投稿・アンケートは既存流用」の訂正(app/ に実装がない)、柱番号(04 は 18)。

- 13 追補 [INS-C-15、13 §22]: undefined

## 13. 各モジュールの改訂項目(第 1 回。反映済み)

第 1 回の統一(2026-11-09)で各モジュールに求めた改訂。13 モジュールの修正で反映済み。第 2 回の更新で追加になった修正は第 17 章。

| モジュール | 改訂項目 |
|---|---|
| 00 | ID 接頭辞(3.2)、`isSlugId`、Store のコレクション(3.1)、§4.2 を型の所在一覧に縮小、`DemoUser`・`UserRole`(3.6)、`ErrorCode` に `rate_limited`・`AppError` に `reason`(3.3)、`beforeRequest` フック・`skipHooks`(3.5)、`lib/events.ts`(4.6)、`gput`・`ApiError.reason`・`ntf:refresh`、`CursorPage<T>`、`LIMITS`(10.3)、seed(11.4)、`features/groups/labels.ts` の削除、`REGIONS`・`AgeBand`・`GroupState`・`CancelReason` の削除、next.config のヘッダー(11.2) |
| 01 | Group の項目名(4.2)、7.1 の公開関数、`leaveGroup`・`usecases.ts`・`canLeave`・`requireMember`・`_invite`・`_meta`・`officialHost` の削除、招待コード(7.2)、`markMemberLeft`、`gm` → `m`、イベントの発行、本文上限・未知キー(3.4) |
| 02 | `[groupId]`、`/api/regions`・`/api/invites/lookup`、09 の `AgeBand`・`MemberSummary`、`badge`、`Page<T>`、`replanned` の扱い、`discovery/query.ts`、`evaluateAll` を呼ばない、試験フィクスチャの招待コード |
| 03 | `onMembershipChanged`、`status_changed` の購読による失効、`settleRequestsIfClosed` の削除、`notify` の形、`_invite`・`_me` の廃止、`reentryOfGroupId`、理由コード(4.3、7.4)、試行回数の削除、`withdrawRequest` への改名、`joinApi` の削除 |
| 04 | `GroupStatus` 8 値、`deadlineDate`、T13 の改定、`displayStatus` の削除、`statusLabel`・`notAcceptingReason` の公開、可否表(4.4)、`withdraw` を唯一の退会経路に、イベントの発行、03 への直接呼び出しの削除、通知の種類(第 9 章)、`summarizeParticipants` の削除、`advanceDemoClock`・`_demo` の削除、`beforeRequest` の登録 |
| 05 | `assertGroupAccess`、`assertTextAllowed`(`plan_item_title`)、`PUT G/plan/order`、エラー・上限(3.3、3.4)、POST 読み替えの削除、`handlePlanRoute` の削除、元メンバーの表示 |
| 06 | `msg` ID、`filterVisibleMessages`、`checkRate("chat_post")`(10 件/60 秒)、イベント購読によるシステムメッセージ(`state_replanned` を含む)、`G/chat/read`、定型文 API の削除、パス ID の 404、`notify` の形 |
| 07 | `canEditExpenses` の可否と型、`baseVersion`、`reason` の値、`G/expense-summary`、`member_left` の購読、`expense_memo`、元メンバーの表示 |
| 08 | `canCollectStamps`・`canReview`(実施中から)、アンケート 5 項目、個人特典(7.8)、DELETE・PUT、エラーコードの置換、`rallyAggregate` の削除、`rally_memo`・`rally_photo_caption` |
| 09 | `TextContext` の追加、`formatMemberSummary`、`RATE_LIMITS.chat_post`、API のパス、`reason` の位置、`suppressSmallCell`・`assertSafeRequest` の削除、CSP の削除と既知の制約、上限値(10.3) |
| 10 | 通知の種類(第 9 章)、`CancelReasonCode` の import、API のパス、`evaluateGroupsForUser` の削除、`formatMemberSummary` の利用、日時の形式、自前の `sanitizeText` の削除 |
| 11 | `Municipality`・`LocalHost` の形、`resolveSponsor`、`createGroupInternal`、`official` キー、`badge`、GET `/api/official`・`/api/official/[groupId]`・`/api/entry/stats` の削除、期間の既定、`type` の制限 |
| 12 | `/api/stats`、期間の既定、`aggregateFunnel` による M-08、項目名(7.12)、年代の変換元、`municipalities.ts` の削除 |

## 14. 確認事項の状態

### 14.1 オーナー判断で確定した事項

第 1 版の第 14 章で確認を求めた事項と、修正作業中に出た論点は、すべて確定した。

| 旧項目 | 論点 | 結論 | 反映先 |
|---|---|---|---|
| 1 | 08 の個人特典の持ち方 | 新ストア `rallyRewardGrants`、既存の特典機能と連動させない [決定 21] | 7.8 |
| 2 | 08 のアンケートの追加 2 項目の文言 | 「地元の人との交流があったか」「滞在中にいろいろな場所を回れたか」(各 5 段階)[決定 25] | 7.8 |
| 3 | 締切で辞退期間に移るときの申請者への通知 | 通知する。`join_expired` を必須に追加し、必須 12 種 [決定 22] | 5.3、7.4、第 9 章 |
| 4 | 完了後の費用メモの編集 | 編集できる [決定 23] | 4.4、7.9 |
| 5 | 11 の `GET /api/entry/stats` | 12 に統合して廃止 [決定 24] | 2.2、7.12 |
| 6 | 画面のパス | `/[campaign]/new-group`、`/[campaign]/invite` [決定 26] | 2.2 |
| - | 招待の方式 | コード入力方式 [決定 27] | 7.2 |
| - | 通報の対象 | メッセージ・グループ・ユーザーのみ [決定 28] | 6.3 |
| - | 幹事の中止ができる状態 | 実行確定の前まで [決定 29] | 4.3、4.4 |
| - | 禁止表現の `official_hint` | 採用しない [決定 30] | 6.2 |

- オーナーの判断を待つ事項は残っていない。

### 14.2 実装着手時に確認する事項(判断は不要)

次は Next.js・Mantine の仕様の確認で、設計の判断ではない。本 worktree に `app/node_modules` が無いため、実装の担当が `npm ci` の後に `app/node_modules/next/dist/docs/` などで確認し、結果に応じて実装を合わせる。

- 静的セグメントと動的セグメントの解決順(R-2 で並べないため、結果にかかわらず設計は変わらない)。
- Route Handler と `cacheComponents` の挙動(00 の `route()` が最初に `req.headers` を読む前提)。
- `<Suspense>` 内の `redirect()`(11)、Mantine 9 の `DateInput` のロケール指定(02)、`@mantine/hooks` v9 の関数名(10)。

## 15. 指摘と結論の対応表

第 2 回の修正で各モジュールが挙げた「契約書への指摘」と、各モジュールの確認事項・未決のうち契約書で決めるべきものの結論。出どころは指摘を挙げたモジュールと節。

| # | 指摘(出どころ) | 結論 | 反映 |
|---|---|---|---|
| 1 | R-2 が `G/join-requests/mine` と `[requestId]` で自己矛盾(03 §16-9) | 自分の申請は `GET G/my-join-request` に移す | 2.2、7.4 |
| 2 | R-2 が既存アプリ(`api` と `[campaign]`)に当てはまらない(00 §16-16) | R-2 は本機能で新設するフォルダにだけ適用する | 2.1 |
| 3 | `GET G` の振り分けの位置が 2.1・2.2・5.1 で食い違う。依存表に 01→02 が無い(01 GRP-Q-05・16、02 §16-7) | 合成層 `features/groups/compose/handlers.ts`(所有 01)に置く。01 は 02 を import しない | 2.1、4.6、5.5 |
| 4 | 作成の合成を `route.ts` に書くと 2.1 に反する(01 GRP-Q-16) | 作成も合成層に置き、`route.ts` は再エクスポートだけ | 2.1、5.1 |
| 5 | 依存表に 02・03→11(`recordFunnelEvent`)が無い(11 §10.2) | 追加。03→11 は循環しない | 4.6 |
| 6 | 依存表に 04→03(`db().joinRequests` の読み取り)が無い(04 §12.1) | 型だけの参照とデータの読み取りとして追加。実行時の import はしない | 4.6 |
| 7 | 04→07(退会確認の差額)が依存表に無い。`unsettledBalanceOf` は画面から呼べない(07 §13-10、04) | 画面が `GET G/expense-summary` を取得する。import の依存にしない。`unsettledBalanceOf` は 07 の内部関数 | 4.5、4.6、7.9 |
| 8 | 依存表の 12 が実態と違う(12 §16.1・§17-3) | 実行時は 00・11、型と `db()` の読み取りは 01・02・03・04・08・09 | 4.6 |
| 9 | 照合後の `?code=` 付き詳細の取得経路が無い(01 GRP-Q-17、02 §16-3、03 §16-12) | コード入力方式 [決定 27]。`/[campaign]/invite` で照合・プレビュー・申請を行い、`?code=` は廃止 | 7.2 |
| 10 | 非公開グループの自分の申請状態を取得できない(03 の `inviteCode` クエリ案) | `G/my-join-request` は自分の申請があれば非公開でも返す。`/api/me/join-requests` も非公開を含む | 7.2、7.4 |
| 11 | `isGroupVisibleTo` の署名。09 は 01 を import できない(09 SAF-REQ-08) | `(viewerId, group, opts?: { inviteVerified?: boolean })`。照合済みのときだけ 02 が `inviteVerified: true` を渡す | 6.1、7.2 |
| 12 | `member_left` の `withdrawalId` を `markMemberLeft` が受け取れない(01 GRP-Q-15、04 LCY-REQ-02) | `member_left` は 04 の `withdraw` が `Withdrawal` 作成後に発行する。01 は発行しない | 4.5、4.6 |
| 13 | 作成時に幹事の `member_joined` を発行するか(06 §16 の 01 への要望) | 発行しない。06 は `group_created` で作成のメッセージを作る | 4.6、5.1 |
| 14 | 作成時の `status_changed`(`from: null`)を発行するか | 発行しない。`from` は非 null の型にする | 4.6、5.1 |
| 15 | 04 が `status_changed` を発行する遷移の範囲(06 §16 の 04 への要望) | 状態が変わるすべての遷移(`onMembershipChanged` を含む) | 4.6 |
| 16 | 通知の必須が 11 種のまま(03 §16-10、10 §17-1・2、04 §16-5) | 必須 12 種 [決定 22]。5.3・7.4・9.1・11.4・12・14 章を改めた | 5.3、7.4、第 9 章 |
| 17 | `join_expired` の発火元・宛先・`eventKey`(03 §15、04 LCY-REQ-07、10) | 03 が T5 の `status_changed` を購読して送る。宛先は申請者のみ、`je:<requestId>`、中止時は送らない | 5.3、7.4、9.1 |
| 18 | 幹事の中止ができる状態(04 `organizerCancelStates`) | 実行確定の前まで [決定 29] | 4.3、4.4、7.5 |
| 19 | `notAcceptingReason` の `in_progress`・`completed`・`replanned` の値(03 §16-6) | `closed_confirmed`(実施中・完了)、`closed_cancelled`(再企画済み) | 4.3 |
| 20 | `StatusBadge`(00)と `GroupStatusBadge`(04)の分担(02 §15-5、00) | 00 が土台、04 の `GroupStatusBadge` が `statusLabel` を渡す薄い部品 | 4.1 |
| 21 | `request_join` と `join_by_invite_code`(03 §16-7) | `request_join` だけ | 5.2、7.10 |
| 22 | 通報の対象(05 PLN-T-57、07 §12、08 RLY-TASK-14、09) | `message`・`group`・`user` のみ [決定 28] | 6.3 |
| 23 | 禁止表現の `official_hint`(09 §8.2、11 §10.3) | 採用しない [決定 30] | 6.2 |
| 24 | `Repo<T>` の `id` が無い型がある(09、06、11、08) | Repo の型は必ず `id` を持つ。1 対 1 は親の ID | 3.1 |
| 25 | `v` が null を受け付けない(05 §16-18、08 §11.3-5) | 00 に `v.nullable` を追加 | 3.4、3.7 |
| 26 | 本文なしの DELETE と JSON の Content-Type 必須 | 変更系は本文の有無にかかわらず必須 | 2.3、3.4 |
| 27 | `rejectProhibitedParams` の呼び出し位置。`c.body` は生の本文を返さない(03 §16-8) | クエリだけに、ハンドラの先頭で呼ぶ。本文は未知キーとして捨てる | 3.4 |
| 28 | `formatJst`・`idSeq`・`startOfNextJstDay` の所在(10 §17-5、06、04) | 00 が公開。10 の `format.ts` は作らない | 3.7、9.1 |
| 29 | `CursorPage` を置くファイル | 00 の `lib/groups-types.ts` | 3.1、3.7 |
| 30 | `LIMITS` のキー名と値(05 §15、06 §16、08 RLY-REQ-02、11 §10.3、09 §8.5) | 全キーと値を確定 | 10.3 |
| 31 | slug の正規表現(02 と契約書) | `^(r\|mun\|host)-[a-z0-9-]{1,30}$`、`isSlugId` だけを使う | 3.2 |
| 32 | `Profile.displayName` と `DemoUser.displayName` の重複(09 SAF-CHK-16) | 画面は `Profile.displayName`。プロフィール更新で両方を同時に更新 | 3.6 |
| 33 | `AgeBand` に 18 歳未満の帯が無く u-008 の値が決まらない(00 §11、09 SAF-CHK-17) | 帯は追加しない。u-008 は `18-19`、18 歳未満は `Verification` で表す | 6.3、11.4 |
| 34 | 年代絞り込みのクエリキーと `rejectProhibitedParams` の許可キー(02 §16-11、09) | キーは `ageBuckets`。拒否するのは性別・細かい年齢のキーだけ | 6.3 |
| 35 | `memberSummary` に渡す年代帯を得る関数の所在(02 §15-3) | 09 の `ageBandsOf(userIds)` | 6.3、9.1 |
| 36 | 担当地方の表と地方 ID の値(12 §17-12、MUN-REQ-11) | seed の値を 7.12 に記載 | 7.12 |
| 37 | `FunnelQuery` の地方指定と M-08 を担当地方に絞るか(12 §17-2) | 地方の条件は追加しない。M-08 はキャンペーン全体の件数 | 7.12 |
| 38 | 非公開グループを集計に含めるか(12 §17-5) | 含める(件数のみ、K=5) | 7.12 |
| 39 | アンケートの指標を 12 に加えるか(08 RLY-REQ-08) | 加える(完了グループの回答のみ、余力) | 7.12 |
| 40 | 中止の見本 g-013、g-006 の扱い(00、04 LCY-REQ-10) | g-013 は未再企画の `cancelled`、g-006 は `replanned` | 11.3、11.4 |
| 41 | 確定後に退会した元メンバーの見本(07、08 §11.3-4) | g-011 に u-006(wd-002、`phase: confirmed`)と費用メモ 1 件 | 11.4 |
| 42 | fixtures の ID と状態名(02・09 の試験 ID) | `GROUP_BY_STATUS` の 8 値。試験専用データも ID 形式に従う | 3.2、11.3 |
| 43 | 公式枠の作成で本人確認をするか(11 §5.4・§11) | する(`create_group`)。作成上限は検査しない | 7.11 |
| 44 | 「60 秒に 10 件」の計数方式(09 §10) | 固定ウィンドウ | 10.4 |
| 45 | 禁止表現の `reason` の値 | `text_denied`、`text_review_required` | 6.2 |
| 46 | `ackReview` を送るキー | 本文の最上位の `ackReview: boolean` | 6.2 |
| 47 | `PUT /api/me/profile` の形(09 SAF-CHK-18) | 全置換。編集できる全項目を必須 | 7.10 |
| 48 | `requireVerified` の action 名 | `create_group`・`request_join` の 2 値 | 7.10 |
| 49 | 通報の `ruleId` の検証(09 §4.3) | `text_check` を削除したため利用者入力として受けない | 6.3 |
| 50 | 楽観ロックの `reason`(01 `revision_mismatch`) | `version_mismatch` に統一 | 2.3、7.1、第 8 章 |
| 51 | 一覧の `limit` の既定(00 は 20、02 は 12) | 共通の既定は 20。02 は `parsePage(q, { defaultLimit: 12 })` | 2.3、7.3 |
| 52 | 並び順の形式(02 §16-8) | `?sort=<キー>:<asc\|desc>` | 2.3、7.3 |
| 53 | クエリの未知キー(02 §16-9) | クエリは strict(400)、本文は捨てる。02 の lenient は例外 | 3.4 |
| 54 | lenient の `ignored.reason` の列挙(11 §13-7) | `unknown_key`・`invalid_value` | 7.3 |
| 55 | 地方の存在確認の所在(11 §13-6) | `parseGroupListQuery` の `ctx`(地方 ID の一覧)で行う | 7.3 |
| 56 | `chat_new` の既読化の手段(06 §17-4) | 10 の通知画面で項目を開いたときに既読化 | 7.7、9.2 |
| 57 | 「関係者」の範囲 | `status: "active"` のメンバー(幹事を含む) | 5.5 |
| 58 | `filterVisibleMessages` が `senderId: null` を受けない(06 §17-5) | 09 の型は `senderId: Id \| null` を受け、システムメッセージを残す | 6.3 |
| 59 | `join_rejected` に却下理由を入れるか(10 §16、03 §16-11) | 入れない | 5.2、9.1 |
| 60 | `organizer_cancelled` の本文に幹事の理由を入れるか(10 §16) | 入れない(画面で表示) | 4.3 |
| 61 | ブロック関係にある取得者・更新者の表示(08 §11.3-6、05 §15 の 09 への要望) | 見送り(各モジュールの現行の案のまま実装し、試験しない) | 第 16 章 |
| 62 | 公式枠の `LIMITS`(09 §8.5 の [要確認]) | `OFFICIAL_SUMMARY`・`OFFICIAL_HIGHLIGHT` | 10.3 |
| 63 | 遷移で日時を消さない(12 MUN-REQ-04) | `confirmedAt`・`cancelledAt`・`cancelReason` を残し、`completedAt` を設定 | 4.2 |
| 64 | `getGroup` の戻り値の型名・`normalizeInviteCode` の形式不正(01) | `GroupDetailView`。`normalizeInviteCode` は形式不正で `null` | 7.1 |
| 65 | クエリの strict 検証の実装位置(00) | 00 の `c.query` が未知キーを `invalid_input` にする | 3.7 |
| 66 | 試験用データの ID の採番(00) | `insertGroup` 等は ID を引数で受け、900 番台を使う。`counters` は変えない | 3.7、11.3 |
| 67 | 05 の並び順の `itemsRevision` の不一致・`changeConditions` 後の遷移(04・05) | `version_mismatch`。`status_changed` は `changeConditions` 後の評価でも発行 | 2.3、4.6 |
| 68 | 幹事の中止理由を画面へ返す経路(04) | `LifecycleView.organizerCancelReason` | 4.3 |
| 69 | `GroupStatusBadge` の props(04) | `{ status, full?, size? }` | 4.1 |
| 70 | `EXPENSE_MEMO` の行数・PUT の文字列の省略(07) | `maxLines: 3`。PUT の文字列の省略は `""` | 10.3、3.4 |
| 71 | 非公開グループ・ブロック関係の試験データ(06・08) | `PRIVATE_GROUP`(g-008)、`BLOCK_SAMPLE`、`insertBlock` | 3.7、11.3 |
| 72 | `ChatReadMark` の ID が 3.2 の形式外(06) | 3.2 の例外と明記 | 3.1 |
| 73 | 非公開グループの申請の検査順で存在が漏れる(03) | 存在を隠す検査(コード照合)を先頭にする | 5.2 |
| 74 | 申請前のパネルが `G/my-join-request` を使えない(03) | `PrivateGroupPreview` の値を props で渡す。02 → 03 の画面部品の import を依存表に追加 | 7.2、4.6 |
| 75 | 過去の日付・`ctx` の形(02・11) | `QueryContext = { campaigns, defaultCampaign, regions, today }`。過去の日付は strict で 400、lenient で無視 | 7.3 |
| 76 | 11 の作成本文の入れ子と `fields` のキー(11) | `group.` の接頭辞を付ける | 7.11 |
| 77 | `rejectProhibitedParams` を呼ぶモジュール(12) | 02・03 の一覧だけ。他は strict の未知キーで拒否 | 3.4 |
| 78 | 年代帯の公開設定と集計・`requireRole` の reason(12) | 公開設定にかかわらず 3 区分の人数に使う(K=5)。`not_municipal` は 12 が返す | 7.12 |
| 79 | 補完秘匿と差分推測の見送りの境界(12) | 補完秘匿は残す。見送るのは複数回の照会の差分だけ | 10.5 |
| 80 | fixtures の旧定数 `GROUP`(00) | `GROUP_BY_STATUS` に置き換え | 11.3 |
| 81 | `read-all` の扱い(10) | 余力(見送り)と 2.2 に明記 | 2.2、16.2 |
| 82 | 10 の通知の保持件数 100 件・14 日(10) | 見送りの範囲に含める | 16.2 |
| 83 | `conditions_changed` の宛先(04・10) | 幹事を除く参加中メンバーと申請中の申請者 | 9.1 |
| 84 | `ackReview` が未知キーとして捨てられる(09) | 本文スキーマに `ackReview` を宣言する | 6.2 |
| 85 | 09 が `db().users` を書く(09) | 依存表に明記 | 4.6 |
| 86 | `travelPurposes` の上限(09) | `LIMITS.TRAVEL_PURPOSES` | 10.3 |
| 87 | u-010・u-008 の fixtures 名(09) | `UNVERIFIED_USER`・`UNDERAGE_USER` | 11.3 |

## 16. 見送りの範囲

実装方針(`.work/review.md` 第 12 章)により、メインルートの動作を優先し、次のエッジケースの作り込みは見送ってよい。各モジュールは、この範囲に当たる試験・タスク・記述に「見送り」と印をつける(削除はしない。デモ範囲外の印と同じ扱い)。

### 16.1 優先する主ルート

- グループ作成 → 一覧・検索 → 参加申請 → 幹事の承認 → 最少人数到達 → 締切 → 辞退期間 → 実行確定 → 実施(旅程メモ・チャット・費用メモ・スタンプ・振り返り) → 完了 → 自治体向け集計。
- 中止 → 再企画の基本の流れ(再企画の作成、`replan_invited`、再エントリーの申請)。
- 必須 12 種の通知(第 9 章)。
- 安全の基本: 公開範囲(非公開・年代帯の公開設定・メンバー概要)、禁止表現(deny と review)、通報(3 種)・ブロック(一覧・申請・チャットの効果)、本人確認(モック)、00 の `route()` の入口検査(Origin・Content-Type・本文サイズ)、セキュリティヘッダー。
- 招待コード(コード入力 → プレビュー → 申請)。

### 16.2 見送ってよいエッジケース

| 区分 | 見送る内容 | 残すもの |
|---|---|---|
| 同時操作の競合 | 競合ダイアログの差分表示・3 択(05 PLN-T-51 など)、同時リクエストの試験(`Promise.all` による試験など)、HMR での二重登録の試験 | `baseVersion` の照合と 409 `version_mismatch` の応答、画面は最新を再取得して再入力を促す |
| レート制限 | 429 の画面表示(残り秒数)、各モジュールの 429 の試験 | 09 の `checkRate`(固定ウィンドウ)の実装と単体試験 1 件 |
| 不正値への細かい応答 | 形式不正・境界値の網羅的な試験、項目ごとの細かい修正案の文言、改行の正規化などの細部 | 00 の `v` による検証と `invalid_input` + `fields`、00 の `route()` の共通試験 |
| ブロック関係の細かい表示 | 取得者・更新者・作成者の表示名をブロック関係で出し分ける処理(05・07・08)、振り返りのメモ・写真の除外の向き | 一覧・申請・プロフィールの双方向、チャットの一方向の効果 |
| 通信失敗時の細かい表示 | ポーリングの段階的な間隔延長、オフライン表示、再送の自動化 | 失敗時に `ErrorNotice` で `message` を表示し、入力を保持する |
| 再企画の細部 | 再企画フォームの引き継ぎ項目の細部、`reopen_once` の分岐、`onOrganizerLeft`、再エントリーの優先扱い | 5.4 の基本の流れ |
| 差分・推測への対策 | 集計の差分による推測、メンバー概要の人数変化による推測、タイミング攻撃、招待コード・合言葉の総当たり | 既知の制約として各モジュールに 1 行で記載 |
| 時計・永続化 | 時計の後戻り時の状態の扱い、JSON 永続化(00 CMN-TASK-15)、保持件数・保持期間の上限による削除(06 の 500 件、10 の 100 件・14 日、11 の FunnelEvent 1,000 件) | 00 の `clock` と `/api/demo/clock`、`/api/demo/reset` |
| 余力の機能 | `chat_new`・`deadline_near` の通知、`read-all`、通知の保持期間、`status-log` API、変更履歴(05)、地図表示、ページネーションの UI | - |
| 性能・網羅試験 | 性能の目安(02 DSC-T-73)、ランダム操作による不変条件の試験(01 GRP-T-42) | - |
| 方針の切替 | 09 の `minorPolicy: "deny_all"`、`sameGroupOnBlock: "leave"`、03 の `INVITE_POLICY`・`CONSENT_POLICY` の別案 | 既定値での動作 |

- 13 追補 [INS-C-16、13 §22]: undefined

## 17. 追補修正表

第 2 回の更新(第 1〜16 章)により、各モジュールの設計書に追加で必要になる修正。後続の担当は、この表と本書の該当節だけで修正する。

- 節番号・ID・行番号は 2026-11-09 時点の各設計書の目安。行がずれていたら ID と文言で探す。
- 全モジュール共通の作業(17.0)を先に行い、そのあとモジュール別の項目(17.1 以降)を行う。
- 「解消済みにする」は、[要確認]・確認事項・要望の項目を削除せず、「解消(契約書 X.Y)」と結論を書き添えること。

### 17.0 全モジュール共通

| # | 修正 | 根拠 |
|---|---|---|
| C-1 | 「契約書 X.Y」「統一仕様(書) X.Y」の参照を、本書の現在の節番号で確認する。第 14 章(確認事項)への参照は 14.1(判断済み)か 14.2(実装着手時の確認)に分ける | 第 14 章 |
| C-2 | Next.js・Mantine の [要確認] は「実装着手時に確認する事項(判断は不要。契約書 14.2)」と注記する | 14.2 |
| C-3 | 第 16 章に当たる試験・タスク・記述に「見送り(契約書 16.2)」の印を付ける。削除しない。既存の「デモ範囲外」の印には「見送り」を併記する | 16.2 |
| C-4 | 試験の前提データは `GROUP_BY_STATUS` と 11.3 の見本(`PRIVATE_GROUP`、`BLOCK_SAMPLE`、`LEFT_MEMBER_SAMPLE`、`UNDERAGE_USER`、`UNVERIFIED_USER`)を使う。試験の中で作るデータは 900 番台の ID(`g-901`、`u-901`)。`g-t06`・`u-new`・`u-minor`・`g-pub` など形式外の ID は使わない | 3.2、11.3 |
| C-5 | 上限値は `LIMITS.<キー>` で参照し、数値を直書きしない | 10.3 |
| C-6 | 本文なしの POST・DELETE も `Content-Type: application/json` が必須と書く(該当する API があるモジュールのみ) | 2.3 |
| C-7 | 作成・詳細の合成は「Route Handler 層」「route 層」「`app/api/groups/route.ts` の POST」ではなく、合成層 `features/groups/compose/handlers.ts`(所有 01)と書く | 2.1、5.1、5.5 |
| C-8 | 禁止表現を検査する本文のスキーマに `ackReview: v.boolean({ optional: true })` を宣言する(01・03・04・05・06・07・08・09・11) | 6.2 |

### 17.1 00 共通基盤

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 00-1 | §4.1(R-2) | R-2 は本機能で新設するフォルダだけに適用し、既存の `api`・`[campaign]` は対象外。新設フォルダを既存の動的セグメントの下に置くのは可 | 2.1 |
| 00-2 | §4.1 | 合成層 `features/groups/compose/handlers.ts`(所有 01)を追記 | 2.1 |
| 00-3 | §4.2 | 「F-12」の参照を削除。Repo の `id` 規則の参照を 3.1 にし、08 の `rm`・`rs` は `(groupId, userId)` で一意、`ChatReadMark` の ID は 3.2 の例外と追記 | 3.1 |
| 00-4 | §4.2(DemoUser) | 画面の表示名は 09 の `Profile.displayName`(`visibleProfile` 経由)が正。`DemoUser.displayName` は DemoBar・`/api/demo/users` 専用。09 の `PUT /api/me/profile` が同じ `tx` で両方を更新 | 3.6 |
| 00-5 | §4.3(楽観ロック) | 05 の並び順と 01 の `applyLifecyclePatch` の不一致も `version_mismatch` | 2.3 |
| 00-6 | §4.3(JSON・未知キー) | PATCH は省略 = 変更なし・`null` = 消去。PUT の省略は文字列 `""`、それ以外 `null`。本文の未知キーは捨てる。クエリの未知キーは `invalid_input`(02 の lenient を除く)。`rejectProhibitedParams` は 02・03 の一覧のクエリだけ | 3.4 |
| 00-7 | §5.5(`c.query`) | `c.query` は strict(schema に無いキーは `invalid_input`、`fields.<key>`)。`limit`・`offset`・`sort` は許可 | 3.7 |
| 00-8 | §5.10(`v`) | `v.nullable(schema)` を追加し、「`null` は optional でも不可」を書き換える。CMN-TASK-03 の完了条件に nullable の試験を加える。`rejectProhibitedParams` の記述はクエリ限定にする | 3.4、3.7 |
| 00-9 | §4.3(LIMITS の表) | 10.3 の表に合わせる。追加: `PLAN_ITEMS`、`EXPENSES`、`PHOTOS`、`OFFICIAL_SUMMARY`、`OFFICIAL_HIGHLIGHT`、`REJECT_REASON_FREE`。`maxLines` の追加: `JOIN_NOTE` 3、`PLAN_ITEM_NOTE` 5、`EXPENSE_MEMO` 3、`PROFILE_BIO` 3。`PAGE` は `{ defaultLimit: 20, maxLimit: 50 }`。「所有モジュールの案」を「確定値」に改める | 10.3 |
| 00-10 | §5.4(エラー) | 本書で決める `reason` に `version_mismatch`・`limit_exceeded`・`text_denied`・`text_review_required` を加える。禁止表現の再送は本文最上位の `ackReview: true` | 3.3、6.2 |
| 00-11 | §5.12(イベント) | `status_changed.from` は非 null。作成(T1)では発行しない。`member_left` は 04 の `withdraw` が発行。`member_joined` は 01 `addMember`(承認時のみ。作成時は発行しない) | 4.5、4.6 |
| 00-12 | §15 R-01-1 | `markMemberLeft` はイベントを発行しない。01 が発行するのは `group_created`・`member_joined` | 4.5、7.1 |
| 00-13 | §3.2(StatusBadge) | グループは 04 の `GroupStatusBadge({ status, full?, size? })` を 02・05〜08 が使い、03 は `StatusBadge kind="joinRequest"` | 4.1 |
| 00-14 | §3.7 の関数(`formatJst`) | 引数を `IsoDateTime \| DateStr` にし、`DateStr` の既定は `"M月D日"` | 3.7 |
| 00-15 | §4.4 CMN-D-02・03・04 | u-006 に「g-011 の退会者(wd-002、`phase: confirmed`)」を追加。g-004 の wd-001 は `phase: withdrawal_period`。g-011 に u-006(`left`)と u-006 作成の費用メモ 1 件。CMN-D-04 は辞退・退会 2 件、通知は必須 12 種から | 11.4 |
| 00-16 | §4.4・§11・§16-9・R-09-1(u-008) | 解消済みにする(`ageBand: "18-19"`、18 歳未満は `Verification` だけ) | 6.3 |
| 00-17 | §9.1(fixtures) | `GROUP` を `GROUP_BY_STATUS` に置き換え、`PRIVATE_GROUP`・`BLOCK_SAMPLE`・`LEFT_MEMBER_SAMPLE`・`OFFICIAL_GROUPS` を追加。`insertGroup`・`insertMember`・`insertBlock` は ID を引数で受け、900 番台を使い、`counters` を変えない | 3.7、11.3 |
| 00-18 | §9.2 CMN-T-34 | 検査を追加: g-013 が `cancelled`・`replannedToGroupId: null`、wd-001・wd-002 とメンバー行の `left` の一致、`Profile.displayName === DemoUser.displayName`、通知 seed の kind が必須 12 種に含まれる | 3.6、11.4 |
| 00-19 | 見送り | CMN-TASK-15(JSON 永続化)、ErrorNotice の 429 の秒数表示、CMN-T-18・46・49 の二重登録の部分、時計の後戻り | 16.2 |

### 17.2 01 グループ中核

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 01-1 | §1・mermaid・§2.1・§5.2・§6.3 S1/S5・§7.1・§11.1・§11.3・§12.1・§12.2(TASK-12) | C-7 のとおり合成層に書き換える。§12.1 のファイル一覧に `features/groups/compose/handlers.ts`(`createGroupHandler`、`getGroupDetailHandler`)を追加し、`route.ts` は再エクスポートだけ | 2.1、5.1、5.5 |
| 01-2 | §6.3 S5(詳細の振り分け) | 5.5 の 4 段の判定(不在 → 関係者 → `isGroupVisibleTo` → `not_found`)に改める。`assertGroupAccess(…, "view")` による振り分けは削除 | 5.5 |
| 01-3 | §2.1・§5.2・GRP-VAL-11・GRP-ERR-01・§6.3 S1・§11.1・GRP-TASK-12 | 本文の性別・年齢キーは未知キーとして捨てる。`rejectProhibitedParams` の呼び出しを削除 | 3.4 |
| 01-4 | GRP-T-10 | 期待結果を「201。`gender` は保存されない」に改める | 3.4 |
| 01-5 | GRP-FN-01・§5.1 イベント表・GRP-T-16 | 作成は `group_created` だけを発行し、`member_joined`・`status_changed` は発行しない。試験の期待結果に追記 | 4.6、5.1 |
| 01-6 | GRP-FN-07・イベント表・GRP-T-38・GRP-TASK-10 | `markMemberLeft` はイベントを発行しない。`member_left` の行は「04 が発行(参考)」に移す。GRP-T-38 は「イベントは発行されない」。GRP-TASK-10 の保留(GRP-Q-15)を解除 | 4.5 |
| 01-7 | GRP-FN-13・GRP-ERR-09・GRP-T-40 | `revision_mismatch` を `version_mismatch` に | 2.3 |
| 01-8 | §3.1〜§3.2・§7.1・GRP-ERR-01 | 禁止表現の `reason`(`text_denied`・`text_review_required`)と、`GroupForm` が本文最上位に `ackReview: true` を付けて再送すること | 6.2 |
| 01-9 | §6.3・§7.3 | `?code=` への遷移と [要確認] を削除し、コード入力方式(`/[campaign]/invite` で照合・プレビュー・申請)にする。コードは URL・`sessionStorage`・ログに残さない | 7.2 |
| 01-10 | §3 | R-2 の参照を 2.1 にし、「本機能で新設するフォルダに適用」を加える | 2.1 |
| 01-11 | GRP-API-06・07 | 本文なしの POST でも `Content-Type: application/json` が必須 | 2.3 |
| 01-12 | §13 | 解消済みの要望(04 ① withdrawalId、04 ③ fields のキー、09 の context 追加)を削除 | 4.5、5.1、6.2 |
| 01-13 | §14 GRP-Q-05・15・16・17 | 解消済みにする(合成層、04 が `member_left` を発行、コード入力方式) | 2.1、4.5、7.2 |
| 01-14 | GRP-T-21・34 | 状態の見本は `GROUP_BY_STATUS` を使うと明記 | 11.3 |
| 01-15 | 見送り | GRP-T-42・GRP-TASK-19(ランダム操作)、GRP-T-12(429)、GRP-ERR-11 の待ち時間表示。境界値の網羅(GRP-T-02・06〜08)は代表 1 件を残して見送り | 16.2 |

### 17.3 02 グループ探索

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 02-1 | §3.4・DSC-API-01/02・DSC-FN-03・§12・§14.2・TASK-09/11 | C-7 のとおり合成層に書き換える。`app/api/groups/route.ts` は 02 の GET と合成層の POST を再エクスポート | 2.1、5.5 |
| 02-2 | DSC-RULE-08・DSC-API-02・§8 の not_found | 非公開グループは関係者以外なら申請中でも `not_found`。申請中の本人の状態確認は 03 の `G/my-join-request`。`viewerRelation = "requested"` は公開グループだけ | 5.5、7.2 |
| 02-3 | DSC-T-51・52 | DSC-T-52 は 404 に改め、申請状態は 03 の試験で確かめると注記。DSC-T-51 は公開グループで確かめる | 5.5 |
| 02-4 | §1・DSC-SCR-03/04・§3.5・§7.4・`InvitePreviewPanel`・DSC-API-03・DSC-T-72・TASK-17・§15-2(b) | コード入力方式に書き換える。`/[campaign]/invite` の同じ画面にプレビューと 03 の `JoinRequestPanel` を置き、コードは `InviteCodeScreen` の state にだけ持つ。`?code=` と「URL が履歴に残る」既知の制約を削除 | 7.2 |
| 02-5 | DSC-FN-04・§10・§14.1 | 照合後に 09 `isGroupVisibleTo(viewer.id, group, { inviteVerified: true })` を通す(偽なら `not_found`) | 6.1、7.2 |
| 02-6 | `SORT_KEYS`・§5.5・DSC-T-27〜29・73・§12.1・§14.1 | 並び順を `?sort=<キー>:<asc\|desc>`(`parseSort`)にする。値は `deadline:asc`(既定)、`start:asc`、`created:desc`、`vacancy:desc`。`?sort=deadline_asc` は 400 | 2.3 |
| 02-7 | DSC-FN-01・`limit` の行 | `parsePage(q, { defaultLimit: 12 })` と明記 | 2.3、7.3 |
| 02-8 | `official` の行・§5.6・DSC-T-23 | 値は `1`。`serializeFilter` は `official=1` を出す | 7.3 |
| 02-9 | `ParsedListQuery`・§5.6・DSC-T-64 | `IgnoredReason = "unknown_key" \| "invalid_value"` を `query.ts` から公開。未知キーは `unknown_key`、不正値・存在しない地方・過去の日付は `invalid_value`。DSC-T-64 に `reason` の期待値を加える | 7.3 |
| 02-10 | `QueryContext` | `{ campaigns, defaultCampaign, regions: Region[], today }` とし、過去の日付は strict で 400、lenient で `ignored`(試験を 1 件追加) | 7.3 |
| 02-11 | §4.1・`ViewContext.ageBandOf`・§10・§14.1・§15-3(b) | 09 の `ageBandsOf(userIds)` → `memberSummary`。`db().profiles` を読まない | 6.3 |
| 02-12 | 状態バッジの記述(§3・§10・TASK-13・§14.1・§15-5) | 04 の `StatusBadge` を `GroupStatusBadge` に。§15-5 は解消済み | 4.1 |
| 02-13 | §15・§16 | 解消済みにする: 15-1(c)、15-2(a)(c)、15-4、16-3、16-7、16-8、16-9、16-11 | 第 15 章 |
| 02-14 | 見送り | DSC-T-73(性能)、ページネーションの UI(§3.2・§3.8・TASK-15・16-5)。境界値の網羅(DSC-T-07・09・12・16・22・32・56・59)は代表(DSC-T-03・06)を残して見送り | 16.2 |

### 17.4 03 参加申請・承認

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 03-1 | ファイル一覧・§7.4・JOIN-API-03・JOIN-FN-07・`joinPaths`・`useMyJoinRequest` | `G/join-requests/mine` と `inviteCode` クエリを廃止し、`GET G/my-join-request`(クエリなし。自分の申請があれば非公開でも 200、無ければ 404)。R-2 違反の注記を削除 | 2.2、7.2、7.4 |
| 03-2 | JOIN-FN-08 | `GET /api/me/join-requests` は非公開グループの申請を含むと明記 | 7.2 |
| 03-3 | §7.1・§8(検査順) | 存在を隠す検査(グループの有無、非公開のコード照合)を先頭に置く | 5.2 |
| 03-4 | JOIN-UI-01・§11.3・§14.1・JOIN-TASK-13・§15 | コード入力方式に書き換える。`JoinRequestPanel` は 02 の `/[campaign]/invite` にも置き、コードと `PrivateGroupPreview` の `headcount.min`・`applyState` を props で受ける。申請前は `G/my-join-request` を呼ばない。`?code=` と「履歴に残る」記述を削除 | 7.2 |
| 03-5 | JOIN-T-33・試験の追加 | JOIN-T-33 を「lookup → 申請(本文に `inviteCode`)201 → `G/my-join-request` 200」に改める。追加: 自分の申請が無い非公開グループの `G/my-join-request` は 404、`/api/me/join-requests` に非公開の申請が含まれる | 7.2 |
| 03-6 | `constants.ts`・§7.4・§14.2 | `NOTE_MAX_LINES` を削除し `LIMITS.JOIN_NOTE`(`maxLines: 3`)を参照 | 10.3 |
| 03-7 | §7.4(`rejectProhibitedParams`) | クエリを持つハンドラ(JOIN-API-02・07)の先頭、`c.query` の前で呼ぶ。本文には呼ばない | 3.4 |
| 03-8 | §1・JOIN の `join_expired` の節・§16-10 | 「論点 22」を [決定 22] に。`je:<requestId>` を [統一] に。§16-10 は解消済み(必須 12 種、中止時は送らない) | 5.3、9.1 |
| 03-9 | §14 | 申請の状態の表示は 00 の `StatusBadge kind="joinRequest"` | 4.1 |
| 03-10 | 依存の表 | 11(任意で `recordFunnelEvent`、`official_requested`)を追加 | 4.6 |
| 03-11 | §15.3・§16 | 解消済みにする: 00(1)、01、04(1)(2)、09(1)、10、16-6、16-7、16-8、16-9、16-11、16-12 | 第 15 章 |
| 03-12 | 試験データ | 中止のグループは `GROUP_BY_STATUS.cancelled`(g-013)。JOIN-T-13 は g-013 を使う | 11.3 |
| 03-13 | 見送り | `CONSENT_POLICY`・`INVITE_POLICY` の別案と JOIN-TASK-16、JOIN-T-40(429)、JOIN-ERR-17 と §14.2 の `retryAfterSec` の表示 | 16.2 |

### 17.5 04 実行条件・状態遷移

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 04-1 | §4.3 `organizerCancelStates`・§5.5 図・T11・§5.8 #25・§6.1 可否表・LCY-E-10・§16-2 | 幹事の中止から `confirmed` を外す(`recruiting`・`min_reached`・`withdrawal_period`)。注記は [決定 29]。LCY-E-10 の発生条件に「実行確定」を加える | 4.3、4.4 |
| 04-2 | LCY-T-47・48 | LCY-T-47 に `confirmed` を加え 409 `cannot_cancel`。LCY-T-48 は `min_reached`・`withdrawal_period` だけ | 4.4 |
| 04-3 | §1.1・§2・§5.5 辞退の処理順・§12.2・§5.3・LCY-T-39・LCY-REQ-02 | `member_left` は 04 の `withdraw` が発行。処理順は 4.5 の 6 手順。04 が発行するのは `status_changed` と `member_left`。`status_changed` の発行元に `onMembershipChanged` と `changeConditions` 後の評価を明記。LCY-REQ-02 は解消済み | 4.5、4.6 |
| 04-4 | §5.7・T1・LCY-T-01 | T1 はログだけで `status_changed` を発行しない。`GroupStatusLog.from` は null のままでよい | 4.6、5.1 |
| 04-5 | LCY-FN-24・§5.3・LCY-E-15・§12.1・LCY-REQ-01 | `revision_mismatch` を `version_mismatch` に。LCY-REQ-01 は解消済み | 2.3 |
| 04-6 | §1.1・LCY-FN-18・§10・§12.2 | C-7 のとおり合成層に書き換える | 2.1、5.1、5.5 |
| 04-7 | LCY-N-09 | `params` は `groupTitle` のみ、`eventKey` は `je:<requestId>` と確定値を書く | 9.1 |
| 04-8 | LCY-N-05・T11・LCY-T-46 | `organizer_cancelled` の通知に理由を入れない。LCY-T-46 に「params に `organizerCancelReason` を含まない」を追加 | 4.3 |
| 04-9 | §4.1 `LifecycleView`・§9 `LifecyclePanel`・`messages.ts` | `organizerCancelReason: OrganizerCancelReason \| null` を追加し、パネルで表示。`ORGANIZER_CANCEL_REASON_LABEL` を追加 | 4.3 |
| 04-10 | LCY-REQ-05・07・§16-5 | LCY-REQ-05 に理由を含めない旨と `join_expired` の値を追記、LCY-REQ-07 は統一済み、§16-5 の「8 → 11 は 12 になる」の括弧を削除 | 5.3、9.1、第 12 章 |
| 04-11 | LCY-UI-01 | `GroupStatusBadge({ status, full?, size? })` は 00 の `StatusBadge kind="group"` に `statusLabel(status)` を渡す部品。色の表は 00 に一元化し、`messages.ts` の色の表は削除 | 4.1 |
| 04-12 | §2.1・§4.5・LCY-FILE-03・§12.1 | `deadlineAt` は 00 の `startOfNextJstDay(deadlineDate)` で作る。自前の `endOfDayExclusive` は削除 | 3.7 |
| 04-13 | LCY-REQ-10・LCY-TASK-17 | `GROUP_BY_STATUS` の 8 値、g-013 は未再企画の `cancelled`、g-004 の wd-001(`withdrawal_period`)、g-011 の wd-002(`confirmed`)を追記 | 11.3、11.4 |
| 04-14 | §7.1 | 上限は `LIMITS.MIN_MEMBERS`・`GROUP_NAME`・`DESTINATION` で参照 | 10.3 |
| 04-15 | §12.1(差額・申請者の読み取り) | [案] を確定にする | 4.5、4.6 |
| 04-16 | 見送り | `reopen_once`(T7' ほか)、`onOrganizerLeft`(T12・LCY-FN-21 ほか)、LCY-T-19(時計の後戻り)、LCY-T-72(HMR)、`status-log` API(LCY-API-07・LCY-T-67)、`deadline_near`(LCY-N-10・LCY-T-20)、`revision` 不一致(LCY-E-15)。§18 の「余力」を「見送り」に | 16.2 |

### 17.6 05 旅程・集合場所メモ

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 05-1 | §9.2 `ItineraryItemRow`・§10.1・§11.3・PLN-TASK-11・PLN-T-57・§14 受け入れ条件・§15 | 通報の導線(`ReportDialog`、`plan_item`)を削除。PLN-T-57 を削除し、受け入れ条件は PLN-T-49〜56。§15 の 09(2) は「不採用 [決定 28]」 | 6.3 |
| 05-2 | §4.1 `PLAN_LIMITS`・§7.1 PLN-VAL | `PLAN_MEETING_TEXT` → `MEETING`、`PLAN_MEMO` → `SCHEDULE_MEMO`、`noteLinesMax` → `LIMITS.PLAN_ITEM_NOTE.maxLines`、`itemsPerGroupMax`・`itemsPerDateMax` → `LIMITS.PLAN_ITEMS.maxItems`・`maxPerDate`。[案] の注記を削除。§15 の 00(1) は解消済み | 10.3 |
| 05-3 | PLN-FN-13・PLN-VAL-06〜08・§9.1・§11.4・PLN-TASK-02・§15 00(3)・§16-18 | 自前の `nullable` を削除し 00 の `v.nullable`。§15 00(3) と §16-18 は解消済み | 3.4、3.7 |
| 05-4 | PLN-FN-08・PLN-T-45 | `itemsRevision` の不一致は `conflict` + `reason: "version_mismatch"` | 2.3 |
| 05-5 | §6.2・`UsePlan.resolveConflict`・`ConflictDialog`・PLN-UI-08・PLN-TASK-12・PLN-T-51・§18 | 差分表示・3 択は見送り。残すのは 409 の後に最新を再取得し、入力を残して再入力を促すこと。§18 の最小実装・デモ手順も合わせる | 16.2 |
| 05-6 | §15 09(1) | ブロック関係の更新者表示は見送り(「メンバー」表示のまま実装し、試験しない) | 16.2 |
| 05-7 | 見送り | 変更履歴(§12・PLN-TASK-17・PLN-Q-07)、PLN-T-42(同時 PUT)、境界値の網羅(PLN-T-22・23・26・34・35 は代表を残す)、PLN-ERR-04 の「(現在 72 文字)」などの細かい文言 | 16.2 |
| 05-8 | §10.1(任意) | タブで状態を表示する場合は 04 の `GroupStatusBadge` を使う | 4.1 |

### 17.7 06 グループチャット

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 06-1 | CHT-TYPE-04・§11.1・§12.2 | 自前の `seqOf` を削除し 00 の `idSeq` | 3.2、3.7 |
| 06-2 | §6.6・§17-5 | `filterVisibleMessages` に全メッセージを渡す(システムメッセージは 09 が残す)。回避策を削除し、§17-5 は解消済み | 6.3 |
| 06-3 | §6.7 イベント表・§11.2 | `member_left` の発行元は 04 の `withdraw`。`group_created`・`member_joined` は 01、`member_left`・`status_changed` は 04 | 4.6 |
| 06-4 | §6.7(作成時) | 作成時は `group_created` だけ(幹事の `member_joined` は無い)と確定し、条件付きの重複回避を削除 | 4.6、5.1 |
| 06-5 | §6.7・CHT-FN-14・§11.1・§12.2 | 表示名は 09 の `visibleProfile(…, { kind: "member", groupId })` から得る(`DemoUser.displayName` は使わない) | 3.6 |
| 06-6 | §7.1・§9.4 | 通報の `reason` の「`false_positive` を除く」の但し書きを削除 | 6.3 |
| 06-7 | §4.3 | 通報本文の上限は `LIMITS.REPORT_BODY`。`CHAT` は `{ min: 1, max: 500, maxLines: 10 }` | 10.3 |
| 06-8 | §8.2・§17-4 | 通知の既読化は `POST /api/me/notifications/read` だけを書き、`read-all` は見送り。§17-4 は解消済み(10 の画面で既読化) | 7.7、9.2 |
| 06-9 | §10 前提データ | `GROUP_BY_STATUS`・`PRIVATE_GROUP`・`BLOCK_SAMPLE`・`LEFT_MEMBER_SAMPLE` を使い、それ以外は `insertGroup`・`insertMember`・`insertBlock`(900 番台)。「00 に seed の追加を依頼する」を削除 | 11.3 |
| 06-10 | §16 | 解消済みにする: 00(2)、00(5)(11.3 の方式)、01(1)、04 | 第 15 章 |
| 06-11 | 見送り | 保持件数 500(§4.2・§4.3・§6.3 手順 6・CHT-T-36・CHT-TASK-17)、ポーリングの段階的延長(§4.3・§5.3・CHT-ERR-10・CHT-TASK-08。CHT-T-39 は固定間隔の再試行だけを確認)、429 の残り秒数表示(CHT-ERR-06)と CHT-T-15・16、`chat_new`(§8.2・CHT-TASK-15・CHT-T-33・34)、連続改行の圧縮(CHT-FN-10・CHT-T-08)、境界値の網羅(CHT-T-06・07・09・23・50 は代表を残す)。CHT-TASK-03 の完了条件は「`checkRate` を呼ぶこと」 | 16.2 |

### 17.8 07 費用の分担メモ

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 07-1 | EXP-DEC-04 | `member_left` の発行元は 04 の `withdraw` | 4.6 |
| 07-2 | EXP-FN-07・§10.2 の 04 の行・EXP-API-05・§10.3-2・§12・§13-10・EXP-TASK-16 | `unsettledBalanceOf` は 07 の内部関数。04 の退会確認ダイアログは画面から `GET G/expense-summary` を取得して自分の `net` を読む。07 は API を提供するだけ。該当の未決・確認事項は解消済み | 4.5、7.9 |
| 07-3 | §10.2 の 09 の行・§12 | 通報対象 `expense` を削除。導線は置かない | 6.3 |
| 07-4 | §4.1・`EXPENSE_LIMITS`・§7.1 | `LIMITS.EXPENSE_TITLE`・`EXPENSE_MEMO`(`maxLines: 3`)・`AMOUNT`・`EXPENSES.maxItems` で参照。`perGroupMax`・`memoMaxLines` は削除。§10.3-1(a) は解消済み | 10.3 |
| 07-5 | `pageLimit`・EXP-API-01 | `parsePage(q, { defaultLimit: 50 })` と明記 | 2.3 |
| 07-6 | `ExpenseUpdateInput`(PUT) | `memo` の省略は `""`(PUT の文字列の規則) | 3.4 |
| 07-7 | §4.2・§10.3-1(b)・§13-9(c)・§9 の前提 | 元メンバーの見本は g-011 の u-006(wd-002)と u-006 作成の費用メモ 1 件。状態は `GROUP_BY_STATUS` で引く | 11.3、11.4 |
| 07-8 | §1・§6.2・§13-5 | 完了後も編集可は [決定 23] で確定 | 4.4 |
| 07-9 | §10.3-3 | `expense_memo` の追加は解消済み。辞書と静的検査の要望だけ残す | 6.2 |
| 07-10 | EXP-API-04 | 本文なしの DELETE でも `Content-Type: application/json` が必須 | 2.3 |
| 07-11 | §7.4 | 「ブロック関係による表示名の出し分けは見送り」を 1 行追加 | 16.2 |
| 07-12 | 見送り | 境界値の網羅(EXP-T-15〜18・20・35・43・44 の `limit=51` は代表を残す)。EXP-T-28・29(順番に送る競合)は残す | 16.2 |

### 17.9 08 グループ・スタンプラリー

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 08-1 | §4.1 `ReviewMemo.id`・§5.3・§10・RLY-TASK-14・RLY-REQ-06 | 通報対象 `rally_memo`・`rally_photo` を削除。RLY-TASK-14 は「廃止 [決定 28]」。RLY-REQ-06 は「`TextContext` は確定、`ReportTargetType` への追加は不採用」 | 6.3 |
| 08-2 | §7.1・RLY-FN-07・§7.5・RLY-ERR-07・RLY-REQ-02 | `LIMITS.RALLY_MEMO`・`PHOTO_CAPTION`・`PHOTOS.maxPerUser`・`PHOTOS.maxItems` で参照。RLY-REQ-02 は確定(`RALLY_PHOTO_CAPTION` は不採用) | 10.3 |
| 08-3 | §7.1 写真の `spotId`・RLY-FN-07・RLY-T-37・§11.3-5 | `v.nullable` で `null` を受ける。入力型は `spotId?: number \| null`、RLY-T-37 の `spotId: null` は 201。§11.3-5 は解消済み | 3.4、7.8 |
| 08-4 | §7.3・`ReviewDto`・RLY-T-41・§11.3-6 | ブロック関係の取得者表示とメモ・写真の除外は見送り(現行の案のまま実装し、試験しない)。§11.3-6 は解消済み | 16.2 |
| 08-5 | RLY-REQ-08・§4.7・§5.3・§10・§11.3-2 | アンケートの指標は 12 が扱う(完了グループの回答のみ、余力)。「アンケートを指標にする場合は」を削除。§4.7 の見出しは [決定 19・25] | 7.8、7.12 |
| 08-6 | §4.5・§9 の記号・RLY-T-10・RLY-T-26 | `GROUP_BY_STATUS` を使う。`REP` は `replanned`(g-006)、`STOP` は `cancelled`(g-013)、退会者は `LEFT_MEMBER_SAMPLE`(g-011 の u-006) | 11.3 |
| 08-7 | §2.1 | 「契約第 14 章」を 14.2 に | 14.2 |
| 08-8 | RLY-API-07 | 本文なしの DELETE でも `Content-Type: application/json` が必須 | 2.3 |
| 08-9 | 見送り | RLY-T-15(`Promise.all`)、境界値の網羅(RLY-T-05・06・34・36・37 の一部・59)、メモの改行圧縮。冒頭の凡例に「見送り」の意味を追加 | 16.2 |

### 17.10 09 安全

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 09-1 | §4.2 `ReportTargetType`・`ReportReason`・`Report` のコメント・§4.3 の report 行・`CreateReportInput.groupId` | 通報対象を `"message" \| "group" \| "user"` に限定。`false_positive` を削除。`targetId` は `msg`・`g`・`u` の `v.id(prefix)` だけ。`snapshot` は message のみ。`targetUserId` は `Id` に狭めてよい | 6.3 |
| 09-2 | §7.1 判定表・§7 の [要確認]・`alsoBlock`・snapshot の対象 | join_request・plan_item・expense・rally_memo・rally_photo・text_check の行を削除し、「申請のひとことは申請者を user として通報する」と注記。05・07・08 の型照合の [要確認] を削除 | 6.3 |
| 09-3 | `check-text.ts`・SAF-FN-22・SAF-RULE-38・SAF-TASK-05・§17.2 の isSafeId 行・`DictRule.id`・§8 の「誤検知報告」・§8.7 の誤検知への対処(3)・`TextRejectNotice`・エラー表・余力 | `isKnownRuleId` と誤検知報告の導線を削除。ruleId はログと `TextFinding` だけに出る | 6.3 |
| 09-4 | §9 `ReportDialog` を開く場所(SAF-UI) | ユーザー(メンバー一覧・承認画面の申請者を含む)、グループ、メッセージだけ | 6.3 |
| 09-5 | SAF-TASK-09・SAF-T-40・SAF-T-47 | 「対象 9 種」→「3 種」。SAF-T-40 の text_check の例を削除。SAF-T-47 を削除し、「対象外の targetType は 400」の 1 件に置き換えてよい | 6.3 |
| 09-6 | `TextCategory`・§8.2 カテゴリ行・§8.5 の `official_hint` 列と注記・SAF-TASK-04 | `official_hint` を削除 [決定 30]。これにより profile_* と group_* の行は全て ○ になる | 6.2 |
| 09-7 | §8.6 の表・SAF-FN-17・§11 共通・エラー表の reason 列・SAF-UI-05 `onAckReview`・SAF-T-30・35 | deny は `invalid_input` + `reason: "text_denied"` + `fields[field]`、review は `reason: "text_review_required"` + `fields[field]` + `detail.reviewRequired: true`。理由文は `fields[field]` と `message` に入れる(`ErrorBody.reason` はコード)。再送は本文最上位の `ackReview: true` | 6.2 |
| 09-8 | SAF-FN-27・§8.8・§17.1 の作成行・SAF-REQ-09・SAF-CHK-12・エラー表 | `rejectProhibitedParams(params: URLSearchParams)` はクエリだけ。呼び出し元は 02 の一覧(lenient を含む)と 03 の一覧で、ハンドラ先頭・`c.query` の前。本文には呼ばない(未知キーとして捨てる)。作成行から削除 | 3.4 |
| 09-9 | §5(SAF-FN-29 追加)・`summary.ts`・SAF-TASK-08・§17.1 の 02・10 行・SAF-REQ-12 | `ageBandsOf(userIds: readonly Id[]): { ageBand: AgeBand }[]` を追加(公開設定にかかわらず読む。呼び出し元 02・10)。02・10 は `db().profiles` を直接読まない | 6.3 |
| 09-10 | §4.2 コメント・§9.1・SAF-TASK-07・10・SAF-CHK-17 | u-008 は `ageBand: "18-19"`、18 歳未満は `Verification` だけ。SAF-CHK-17 は解消済み(`AgeBand \| null` 案を削除) | 6.3、11.4 |
| 09-11 | SAF-API-02・SAF-FN-28・SAF-CHK-16・SAF-REQ-01・SAF-T-05 | `PUT /api/me/profile` は同じ `tx` で `Profile.displayName` と `DemoUser.displayName` を更新。SAF-CHK-16 は解消済み。SAF-REQ-01 は「seed の 2 つの表示名を同じ値にする」。SAF-T-05 に `/api/demo/users` の表示名の一致を追加 | 3.6 |
| 09-12 | SAF-CHK-18・`ProfileInput` の参照 | 解消済み(全置換・全項目必須)。参照を契約書 7.10 に | 7.10 |
| 09-13 | SAF-REQ-08・SAF-FN-06・SAF-RULE-40 | `inviteVerified: true` を渡すのは 02 の `POST /api/invites/lookup` だけ(照合は 01 `findGroupByInviteCode`)。SAF-REQ-08 の宛先を 02 にし、01 には #17 だけ残す。SAF-RULE-40 の `?code=` を削除し、到達経路は lookup と承認後の `GET G` | 6.1、7.2 |
| 09-14 | §10(レート制限) | 「スライディングにはしない」を 1 文追加 | 10.4 |
| 09-15 | §4.3 の表・§4.4 のコメント・§8.5 の [要確認]・SAF-T-49 | `LIMITS.DISPLAY_NAME`・`PROFILE_BIO`(maxLines 3)・`REPORT_BODY`・`TRAVEL_PURPOSES`・`OFFICIAL_SUMMARY`・`OFFICIAL_HIGHLIGHT` で参照。§8.5 の [要確認] は解消済み | 10.3 |
| 09-16 | §9.2 の表・SAF-FN-19・§17.1 の 11 行 | 11 の公式枠・同行枠の作成も `requireVerified(user.id, "create_group")` を通す(作成上限は検査しない)。「公式枠は通さない」を改める | 7.11 |
| 09-17 | SAF-FN-19・§9.2・§17.1 の作成行・§6.5 | 作成は合成層の `createGroupHandler`、詳細の振り分けは `getGroupDetailHandler`(5.5) | 2.1、5.5 |
| 09-18 | §10 の DELETE の [要確認] | 解消済み(本文なしの DELETE・POST も `application/json` 必須) | 2.3 |
| 09-19 | 試験データ(`__tests__/fixtures.ts` の `SAF_USERS`・`SAF_GROUPS`、SAF-T-01〜08・20〜24・29・45〜47・50〜52、SAF-SEC-10〜13・22、SAF-REQ-01) | 00 の fixtures に置き換える: u-new → `UNVERIFIED_USER`、u-minor → `UNDERAGE_USER`、g-priv → `PRIVATE_GROUP`、u-a・u-x → `BLOCK_SAMPLE`、g-pub・g-other → `insertGroup` の g-901・g-902。SAF-T-52 の u-008 の退会は `insertMember` が前提。SAF-REQ-01 の「試験用グループを seed に統合」は削除 | 3.2、11.3 |
| 09-20 | 見送り | 429 の画面表示(`ReportDialog` の `retryAfterSec` ほか)と SAF-T-29 の 11 回目・SAF-SEC-18(SAF-T-46 の `checkRate` 単体試験は残す)、`sameGroupOnBlock: "leave"`・`minorPolicy: "deny_all"` と関連の記述(SAF-RULE-25 後半、案 A'、SAF-CHK-05)、差分による推測(SAF-CHK-10、A04 の括弧、SAF-SEC-22 の応答時間)、SAF-T-39(性能)、SAF-T-40 の網羅部分(代表を残す) | 16.2 |

### 17.11 10 通知

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 10-1 | 冒頭・§17-1・17-2 | 冒頭の「統一仕様書と異なるオーナー判断(#22)…差異を第 17 章に書く」を削除。17-1 の「統一仕様書 12 章は 8 → 11」を「8 → 12」に。17-2 は解消済み | 5.3、7.4、9.1、第 12 章 |
| 10-2 | §4・seed の節 | 通知の seed は必須 12 種から選ぶ(`chat_new`・`deadline_near` を入れない)と追記 | 11.4 |
| 10-3 | `format.ts`(NTF-TASK-02・ファイル一覧・§11・R-2・dayjs の行・§15.1・§17-5) | `format.ts` を作らず 00 の `formatJst(value: IsoDateTime \| DateStr, pattern?)` を使う。dayjs は使わない。R-2 と §17-5 は解消済み | 3.7 |
| 10-4 | §11.2・§11.3・§6.2 手順 5・NTF-TASK-06・§15 | 確定通知の概要は 09 の `ageBandsOf` → `memberSummary` → `formatMemberSummary`。`db()` の読み取り先から `profiles` を削除(groups・members・joinRequests・users)。「Profile が見つからない場合」は「`ageBandsOf` が例外を投げた場合」に | 4.6、6.3、9.1 |
| 10-5 | `join_rejected` の [未決]・§16 #15・organizer_cancelled の [未決]・R-8・§17-7 の 03 | 却下理由・中止理由は本文に入れない(解消済み)。幹事の中止理由は 04 の `LifecycleView.organizerCancelReason` で画面に出す。R-8 は欠番 | 4.3、5.2、9.1 |
| 10-6 | §17-7 の 04(`conditions_changed` の宛先) | 解消済み: 幹事を除く参加中メンバーと申請中の申請者(04 が `recipients` で指定)。10 の既定値の記述を改める | 9.1 |
| 10-7 | §6.4・NTF-T-15 | `chat_new` の既読化は通知画面で項目を開いたとき(`POST /api/me/notifications/read`)。チャットを開いても既読にしない | 7.7、9.2 |
| 10-8 | 宛先除外の変数名 | `blockedBySenderRecipients` を `recipientsBlockingSender` などに改名(`isBlockedByMe(recipient, sender)` が真の受信者を除く) | 6.3 |
| 10-9 | §7 の未知キー・API の検証 | クエリは `c.query` で strict(未知キーは `invalid_input`)。捨てるのは本文と params だけ。クエリの未知キーで 400 の試験を 1 件追加 | 3.4 |
| 10-10 | `CursorPage` の参照・§17-5 の limit・§16 の「統一仕様書 14 章」 | `CursorPage` の参照は 3.7。limit の最大はモジュールの定数で可(解消済み)。「14 章」は 14.2 に | 2.3、3.7、14.2 |
| 10-11 | params の検証(groupTitle・minParticipants) | `LIMITS.GROUP_NAME`・`LIMITS.MIN_MEMBERS` で参照 | 10.3 |
| 10-12 | 試験の前提(A〜D・G) | `insertGroup`・`insertMember` の 900 番台の ID で作ると明記 | 11.3 |
| 10-13 | 見送り | `chat_new`・`deadline_near`(NTF-TASK-15、NTF-T-14〜17)、`read-all`(NTF-API-04、NTF-FN-05、NTF-T-27・28、「すべて既読にする」、`markAll()`)、保持件数 100 件・14 日(NTF-T-36)、ポーリングの段階的延長、永続化、差分による推測、形式不正の網羅試験(NTF-T-30・39・42 は代表を残す)。§18 の実装メモに「見送り(契約書 16.2)」を付記 | 16.2 |

### 17.12 11 入口B・公式枠

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 11-1 | §5.4 の 2・末尾・§10.3 要望 1・§11 | 本人確認(`create_group`)と「作成上限なし」を [統一、契約書 7.11] に。参照 7.1 は 7.11 に。要望 1 と §11 の該当項目は解消済み | 7.11 |
| 11-2 | §4.1 `Listing`・§5.1・§10.1 | `LIMITS.OFFICIAL_SUMMARY`・`OFFICIAL_HIGHLIGHT` で参照 | 10.3 |
| 11-3 | §5.1・作成本文 | 本文は `{ group, summary, highlights }`。`fields` のキーは `group.` 接頭辞付き | 7.11 |
| 11-4 | §7.2・§10.3 要望 5・ENT-T-19・ENT-TASK-13 | 「公式」「自治体」は警告語にしない [決定 30]。ENT-T-19 は「名前に『自治体公式』を含んでも保存され、`official === false` でバッジは出ない」に改める | 6.2 |
| 11-5 | §3.1・ENT-FN-01・ENT-FN-02・§7.1・§10.1・`EntryParseContext` | `parseGroupListQuery(params, "lenient", ctx)`。ctx は 02 の `QueryContext`。§7.1 の 7(11 側の地方照合)を削除。§13-6 は解消済み | 7.3 |
| 11-6 | `IgnoredReason`・§7.1 の 6・`IGNORED_REASON_LABEL`・ENT-T-04〜07・10・§13-7 | 11 の型は `EntryIgnoredReason` に改名。11 自身の理由は `too_long`・`duplicate`・`unknown_value`(src)、02 から写すのは `invalid_value`(`unknown_key` は `_unknown` に数える)。`bad_format`・`out_of_range`・`inconsistent` は削除。試験の期待値を `invalid_value` に。§13-7 は解消済み | 7.3 |
| 11-7 | §7.1 official 行・§14 | `official=1` で確定 | 7.3 |
| 11-8 | §10.2 の 12 の行・ENT-FN-14・§12.2・ENT-TASK-06・§10.3 要望 6 | 12 は `db().municipalities` を読む。`getMunicipality` は 11 内部・試験用にする(または削除)。12 向けには `ENTRY_SOURCES`・`FunnelEvent` を加える | 7.12 |
| 11-9 | §4.3・§2・§9 冒頭 | 担当地方を確定値で書く(mun-demo-a = r-nijiho・r-hoshinagi・r-suzukaze、mun-demo-b = r-mizukoto)。「仮」と [要確認] を削除 | 7.12 |
| 11-10 | §3.2・§11(外部リンク集)・§10.3 要望 2・§13-10 | 外部リンク集は 2.2 で確定、`createGroupInternal` は 7.1 で確定。§13-10 に今回の解消分を追加 | 2.2、7.1 |
| 11-11 | §1.1 | 「[決定、統一仕様書 2.2・7.11]」を「[決定 24、契約書 2.2・7.12]」に | 7.12 |
| 11-12 | ENT-T-32・ENT-T-40 | ENT-T-32 は募集中の g-002 を中止する(確定済みの g-005 は中止できない)。ENT-T-40 は存在しない ID に `g-999`、Listing の無いグループに g-001 | 4.3、11.3 |
| 11-13 | 見送り | FunnelEvent の上限 1,000 件(§4.4・ENT-T-24・ENT-TASK-05)、§7.1 の 1 と ENT-T-14、ENT-T-10・11(境界値・重複)、ENT-T-34(00 の共通試験で確認) | 16.2 |

### 17.13 12 自治体向け集計

| # | 節(目安) | 修正 | 根拠 |
|---|---|---|---|
| 12-1 | §4 末尾・§16.1・MUN-REQ-README・§17-3 | 依存は「実行時は 00・11。型と `db()` の読み取りは 01・02・03・04・08・09」。§17-3 は解消済み | 4.6 |
| 12-2 | §6.3・§17-12・§18・MUN-REQ-11・MUN-T-11 | 担当地方の確定値を [統一] で記載。MUN-T-11 は `r-mizukoto`。関連の未決・要望は解消済み | 7.12 |
| 12-3 | §3.4・§9・§17-2・§18 | M-08 はキャンペーン全体の件数で地方の条件を追加しない(確定)。画面の注記は現行のまま | 7.12 |
| 12-4 | §4・§17-5・§18 | 非公開グループも数える。年代帯は公開設定にかかわらず 3 区分の人数に使う(K=5)。[案]・[未決] を解消済みに | 7.12 |
| 12-5 | §3.2 M-13〜17・§3.5・MUN-T-33・34・MUN-TASK-05・§17-13・MUN-REQ-08 | アンケートの指標は completed のみ・余力の印。文言は [決定 25] で確定。MUN-REQ-08 は解消済み | 7.8、7.12 |
| 12-6 | MUN-REQ-04・§3.1 | MUN-REQ-04 は確定(契約書 4.2)。§3.1 の「確定後の幹事の中止」を削除(確定後の中止は `below_floor` だけ) | 4.2、4.3 |
| 12-7 | §7.2・§11・§12 エラー表 | クエリは strict(未知キーは `invalid_input`)。試験を 1 件追加(例 `?foo=1` → 400)。`rejectProhibitedParams` は呼ばない | 3.4 |
| 12-8 | MUN-FN-01・MUN-T-08・10 | 自治体ロールでない場合は 12 が `forbidden` + `reason: "not_municipal"` を返す(00 の `requireRole` は使わないか、使った後に reason 付きで投げ直す) | 7.12 |
| 12-9 | §1 | 「[決定 12、統一仕様 2.2・7.12]」を「[決定 24、契約書 2.2・7.12]」に | 7.12 |
| 12-10 | MUN-T-41・42・fixture F1・F2 | 900 番台の ID と `GROUP_BY_STATUS`(再企画は g-013 から) | 11.3 |
| 12-11 | §5.6・§15.5・MUN-T-35〜37・MUN-FN-04・§17-7・§18 | 複数回の照会の差分による推測への対策は見送り(既知の制約 1 行で足りる)。補完秘匿(§5.5)は残す | 10.5、16.2 |
| 12-12 | 見送り | MUN-T-14・15(日付の境界) | 16.2 |
| 12-13 | MUN-REQ-00a | seed は確定済み。残るのは AppShell の導線だけ | 11.4 |
