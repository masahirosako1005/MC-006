# 00 共通基盤

状態の凡例: [事実]/[推定]/[決定]/[案]/[未決]/[要確認]。docs/design と矛盾する場合は docs/design を正とする。本書の ID 接頭辞は `CMN`(CMN-FN: 関数、CMN-API: API、CMN-UI: 画面部品、CMN-T: 試験、CMN-TASK: 実装タスク、CMN-D: データ)。本書の型・署名は **全モジュールの契約**であり、変更は本書の改訂とあわせて行う(第 14 章)。

## 1. 概要と責務 / 対応する柱
- 全モジュールが使う次の土台を提供する。柱の直接対応なし(全体)。 [案]
  1. インメモリストア(globalThis)とトランザクション相当の排他、ID 採番、リセット
  2. ダミーデータ `group-seed.json`(デモユーザー、グループ、各状態のバリエーション)
  3. 現在ユーザー(Cookie `demoUser` によるデモユーザー切替)
  4. 時計 `clock`(デモ用に日付を進める。試験で固定)
  5. 検証・サニタイズ(自前)、エラー型とレスポンス形式、Route Handler 共通ラッパー
  6. ページネーション・ソート・日時・権限ヘルパー、共通 UI、テスト基盤
- 本モジュールは業務ルール(実行条件、公開範囲、禁止語)を持たない。それらは 04・09 等が持ち、本モジュールは型・共通関数・共通部品だけを置く。 [決定(方針)]

## 2. 既存機能との関係
- 並置: 既存 `app/src/lib/server-store.ts`(globalThis `__raundMock`、seed.json から初期化、再起動で初期化)と**同じ方式**の `groups-store.ts` を別ファイル・別キー(`__groupsStore`)で新設する。既存の `/api/v2` モックと `server-store.ts`、`src/lib/api.ts` は**変更しない**。 [案]
- 流用: `seed.json`(campaign、spots、rewards。読み取りのみ)、Mantine・dayjs(クライアント側の表示。Zustand は本モジュールでは使わない。利用ライブラリの一覧は第 10.2)。既存 `api.ts` の `api()` は `body.error` しか保持せず `message`/`fields` を捨てるため、新規に `groups-api.ts` を作る(第 5.9)。
- 既存の変更が必要なのは `AppShell.tsx`(デモバーの差し込み 1 箇所。CMN-TASK-11)と `package.json`(テスト用 devDependency とスクリプト。CMN-TASK-12)のみ。
- [事実] 既存コードから読み取れる Next.js 16 の作法: Route Handler の第 2 引数 `ctx.params` は `Promise`。`next.config.ts` は `cacheComponents: true`。 [要確認] 本 worktree には `app/node_modules` が無く `node_modules/next/dist/docs/` を未確認。キャッシュ(`cacheComponents`)と Route Handler の関係、`cookies()` の扱い、フォルダ名 `_xxx` の扱いは実装前に該当ガイドを読む(AGENTS.md 1)。

## 3. 画面・UI
| 画面/部品 | 04 章の項目 | パス・場所 |
|---|---|---|
| デモバー(「デモ用モック」表示、デモユーザー切替、日付表示と「日付を進める」、リセット) | UI 方針「モックを画面上で明示」 | `AppShell` のヘッダ直下に常時表示(`components/groups/common/DemoBar.tsx`) |
| 共通 UI(ErrorNotice、LoadingBlock、StatusBadge、MockBadge) | 06 章(原因と次の行動) | `components/groups/common/` |

### 3.1 DemoBar(CMN-UI-01)
- 表示: 左に `MockBadge`(「モック」)、現在ユーザー名(`displayName`)と年代帯・地方、右に「日付: 2026-11-09」。 [案]
- 操作: ユーザー選択(Mantine `Select`、選択肢は `GET /api/demo/users`)→ `POST /api/demo/me` → 成功したら `window.location.reload()`(画面全体のデータを取り直す。クライアント側にキャッシュを持たないため、この方式が最も単純。 [案])。「日付を進める」(+1 日、+3 日、+7 日)→ `POST /api/demo/clock` → reload。「デモを初期化」(確認ダイアログ付き)→ `POST /api/demo/reset` → reload。
- props: なし(自己完結)。state: `me`(`useGroupsApi<MeResponse>("/api/demo/me")`。`MeResponse` は第 4.2)、`users`、`busy`、`error`。操作が失敗したときは再読み込みせず、`error` を DemoBar 内の `ErrorNotice` で表示する。
- `DEMO_TOOLS=off` のとき `GET /api/demo/me` は `tools: false` を返し、DemoBar は「モック」表示のみとし操作を隠す。

### 3.2 共通 UI の方針(CMN-UI-02〜06)
| ID | 部品 | props | 方針 |
|---|---|---|---|
| CMN-UI-02 | `ErrorNotice` | `error: ApiError \| Error \| null`, `onRetry?: () => void`, `backHref?: string`, `backLabel?: string` | Mantine `Alert`(`role="alert"`)。見出し=原因(`message`)、本文=次の行動(`code` ごとの定型の助言。下表)、`fields` があるときは項目別の一覧を出す。`onRetry` があれば「もう一度試す」。`internal` と `network` には「画面を再読み込み」「デモを初期化」の案内を足す(06 章の未決の暫定)。`not_found`/`forbidden` は `backHref`(既定: グループ一覧)への導線。`ApiError` 以外の `Error` は `internal` として表示する |
| CMN-UI-03 | `LoadingBlock` | `lines?: number`(既定 3), `label?: string` | Mantine `Skeleton` を行数分。`aria-busy="true"`、`aria-label`(既定「読み込み中」)。画面全体のスピナーは使わない |
| CMN-UI-04 | `StatusBadge` | `kind: "group" \| "joinRequest"`, `value: string`, `size?: "sm" \| "md"` | 状態の見た目を一元化(下表)。色だけで区別せず**必ずテキストを併記**。未知の値は例外にせず、灰色で値をそのまま表示する |
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
| blocked | 操作できません | ブロックの有無を示さない一般的な文言のみ(09 に従う) |
| internal / network | 問題が発生しました | 再読み込み、デモ初期化 |

`StatusBadge` の対応表(ラベルと色は `features/groups/labels.ts`。04 が状態を増減したらここを更新) [案]:

| kind | value | ラベル | Mantine color |
|---|---|---|---|
| group | recruiting | 募集中 | blue |
| group | minReached | 最少人数到達 | teal |
| group | withdrawalPeriod | 辞退期間 | yellow |
| group | confirmed | 実行確定 | green |
| group | inProgress | 実施中 | cyan |
| group | completed | 完了 | gray |
| group | cancelled | 中止 | red |
| joinRequest | pending | 申請中 | blue |
| joinRequest | approved | 承認 | green |
| joinRequest | rejected | 見送り | gray |
| joinRequest | withdrawn | 取り下げ | gray |

- 「却下」の画面表記は「見送り」とする(断りを穏当な表現で伝える 06 章の方針 [案]。内部値は `rejected`)。
- 禁止: `dangerouslySetInnerHTML` の使用(eslint `react/no-danger` を error にする。CMN-TASK-17、CMN-T-36)。

## 4. データ

### 4.1 ファイル・ディレクトリ(本モジュールが作るもの)
パスは `app/` からの相対。 [案]

```
app/
  vitest.config.ts                          テスト設定(CMN-TASK-12)
  .data/                                    (任意)永続化ファイル。.gitignore に追加(CMN-TASK-15)
  src/
    data/group-seed.json                    ダミーデータ(手書き。第 4.4)
    lib/
      groups-types.ts                       全エンティティ・DTO・列挙型(第 4.2)
      errors.ts                             AppError、エラーコード、toResponse(第 5.4)
      messages.ts                           共通の利用者向け文言(検証メッセージ等。第 5.4)
      ids.ts                                ID 接頭辞、newId、isId、newToken(第 5.1)
      datetime.ts                           ISO 8601 / JST 日付ヘルパー(第 5.11)
      limits.ts                             文字数・件数・範囲の共通上限(第 4.3)
      validation.ts                         検証 DSL `v`、parse、sanitizeText(第 5.10)
      groups-store.ts                       ストア本体、Repo、tx、resetStore(第 5.1)
      group-seed.ts                         seed の読み込み・検証(parseSeed)
      clock.ts                              時計(第 5.3)
      current-user.ts                       Cookie 解決(第 5.2)
      authz.ts                              権限ヘルパー(第 5.7)
      api-route.ts                          Route Handler 共通ラッパー、ok/created/noContent(第 5.5)
      query.ts                              parsePage/paginate、parseSort/sortBy(第 5.6)
      hooks.ts                              afterClockChange/afterReset フック登録(第 5.8)
      groups-api.ts                         クライアント fetch、ApiError、useGroupsApi(第 5.9)
    features/
      bootstrap.ts                          各モジュールのフック登録を import する 1 行集約(第 5.8)
      groups/labels.ts                      状態ラベル・色(第 3.2)
    app/api/demo/
      me/route.ts   users/route.ts   clock/route.ts   reset/route.ts
    components/groups/common/
      ErrorNotice.tsx  LoadingBlock.tsx  StatusBadge.tsx  MockBadge.tsx  DemoBar.tsx  useFormErrors.ts
    test/
      setup.ts  helpers.ts  fixtures.ts     テスト基盤(第 9.1)
    **/*.test.ts                            単体・結合試験(同じ階層に置く)
```

- 他モジュールのファイルは `features/<module>/`(サービス)と `app/api/groups/<resource>/route.ts`(HTTP)に置く。**Route Handler は `[...path]` のキャッチオール 1 本ではなくリソースごとの `route.ts`** とする(12 モジュールが並行で別ファイルを作れ、マージ競合が出ないため)。 [案] (README 4.1 の案 `api/groups/[...path]` からの変更。第 16 章)
- デモ用 API は **`/api/demo/*`**(README・骨子の `/api/groups/_reset` は使わない。Next.js の App Router では `_` で始まるフォルダは「プライベートフォルダ」としてルーティング対象外になるため。 [要確認]。第 16 章)。

### 4.2 型定義(`src/lib/groups-types.ts`)
以下が全モジュール共通のエンティティ。**項目の追加(任意項目)は所有モジュールが本書へ追記すれば可、必須項目の追加・削除・型変更は 00 の改訂とする**。所有欄は「その項目の意味と更新ルールを決めるモジュール」。 [案]

```ts
// ---- 基本型 ----
export type Id = string;            // "g-001" 形式。ids.ts の接頭辞表に従う
export type DateStr = string;       // "YYYY-MM-DD"(JST の暦日)
export type IsoDateTime = string;   // ISO 8601 オフセット付き。例 "2026-11-09T09:00:00+09:00"
export const ID_PREFIXES = ["u", "g", "m", "jr", "wd", "n", "msg", "ex", "gs", "rp", "bl"] as const; // 定義は ids.ts。ここから再エクスポート
export type IdPrefix = (typeof ID_PREFIXES)[number];

export const REGIONS = ["水琴地方", "鈴風高原", "星凪諸島", "虹帆町"] as const; // seed.json の spots.area / user.region に由来。 [案]
export type Region = (typeof REGIONS)[number];
export const AGE_BANDS = ["under18", "20s", "30s", "40s", "50s", "60plus"] as const;
export type AgeBand = (typeof AGE_BANDS)[number];   // 18〜19 歳の帯は [未決](第 16 章)
export type UserRole = "traveler" | "municipal";    // municipal=自治体担当者(公式枠の幹事、12 の閲覧者)
export type Visibility = "public" | "private";      // グループの公開設定(05 章)
export type FieldVisibility = "public" | "members" | "private"; // プロフィール項目別(09 が意味づけ)

// ---- ユーザー(所有: 09 がプロフィール意味づけ、00 が seed と解決) ----
export interface DemoUser {
  id: Id;                       // "u-001"
  displayName: string;          // 1〜20 字。架空の名(ひらがな/カタカナの名のみ)
  ageBand: AgeBand;
  homeRegion: Region;
  role: UserRole;
  bio: string;                  // 一言。0〜100 字
  purpose: string;              // 旅の目的。0〜50 字
  visibility: Record<"ageBand" | "homeRegion" | "bio" | "purpose", FieldVisibility>;
}

// ---- グループ(所有: 01 が作成・設定、04 が state 系を更新) ----
export const GROUP_STATES = ["recruiting", "minReached", "withdrawalPeriod", "confirmed", "inProgress", "completed", "cancelled"] as const;
export type GroupState = (typeof GROUP_STATES)[number];   // 状態名は 05 章「状態」に対応。正は docs/design と 04
export type CancelReason = "minNotReached" | "organizerCancelled" | "withdrawalBelowMin" | "organizerLeft"; // 04 が確定

export interface Group {
  id: Id;                       // "g-001"
  name: string;                 // 1〜40 字
  description: string;          // 0〜500 字
  campaign: string;             // seed.json の campaign.slug("nttw-demo")
  region: Region;
  destination: string;          // 行き先。1〜40 字
  startDate: DateStr;           // 旅行開始。<= endDate
  endDate: DateStr;
  capacity: number;             // 人数上限。整数 2〜6(1 対 1 は 2)
  minMembers: number;           // 最少人数。整数 2〜capacity(範囲は [案]、12 章 #19)。幹事を含む
  deadline: DateStr;            // 締切(05 章は「日付」。当日の終わりまで有効 [案]。判定は 04)
  withdrawalEndsOn: DateStr | null; // 辞退期間の終了日(04 が設定)
  visibility: Visibility;
  tags: string[];               // 0〜5 件、各 1〜20 字
  isOfficial: boolean;          // 公式枠(自治体のおすすめプラン)。作成 API の入力では受け取らない(11/seed のみ)
  organizerId: Id;              // 幹事の DemoUser.id
  inviteCode: string | null;    // 非公開グループのダミー招待コード。一覧・DTO に出さない(01)
  state: GroupState;            // 更新は 04 の関数のみ
  createdAt: IsoDateTime;
  confirmedAt: IsoDateTime | null;
  cancelledAt: IsoDateTime | null;
  cancelReason: CancelReason | null;
  replanOfId: Id | null;        // 再企画元
  replannedToId: Id | null;     // 元グループ側の「再企画済み」の印(新グループの id)
}

export type MemberStatus = "active" | "left" | "withdrawn"; // left=退会、withdrawn=辞退(区別は [未決] 05 章)
export type MemberRole = "organizer" | "member";
export interface GroupMember {                                // 所有: 01(追加・退会)、04(辞退)
  id: Id;                       // "m-001"
  groupId: Id;
  userId: Id;
  status: MemberStatus;
  role: MemberRole;
  joinedAt: IsoDateTime;
  leftAt: IsoDateTime | null;
}
// 不変条件(01): (groupId,userId) で active は高々 1 件。グループごとに active な organizer は 1 人で Group.organizerId と一致。

export type JoinRequestStatus = "pending" | "approved" | "rejected" | "withdrawn";
export interface JoinRequest {                                // 所有: 03
  id: Id;                       // "jr-001"
  groupId: Id;
  applicantId: Id;
  message: string;              // ひとこと。0〜200 字
  status: JoinRequestStatus;
  minAccepted: boolean;         // 「最少人数でもOK」の同意(12 章 #22)
  minAcceptedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
  decidedBy: Id | null;
  rejectReason: string | null;  // 持つかは [未決](12 章 #15)
  replanOfRequestId: Id | null; // 再エントリー時の元申請
}

export interface Withdrawal {                                 // 所有: 04(辞退の記録。理由・ペナルティは持たない)
  id: Id;                       // "wd-001"
  groupId: Id;
  userId: Id;
  at: IsoDateTime;
  phase: "recruiting" | "withdrawalPeriod" | "confirmed";
  remainingMembers: number;
}

export type NotificationType =                                // 所有: 10(種類は 05 章。10 が確定)
  | "minReached" | "withdrawalPeriodStarted" | "withdrawalPeriodEnding" | "confirmed" | "cancelled"
  | "replanInvite" | "withdrawalReceived" | "conditionChanged"
  | "joinRequested" | "joinApproved" | "joinRejected" | "chatMessage" | "deadlineNear";
export interface Notification {
  id: Id;                       // "n-001"
  userId: Id;                   // 宛先
  type: NotificationType;
  groupId: Id | null;
  vars: Record<string, string | number>;   // 本文テンプレートへの差し込み値(人数など。ユーザー入力は入れない)
  createdAt: IsoDateTime;
  read: boolean;
}

export interface GroupPlan {                                  // 所有: 05。id は groupId と同じ(1 グループ 1 件)
  id: Id; groupId: Id; meetingPlace: string; scheduleMemo: string; updatedBy: Id | null; updatedAt: IsoDateTime;
}
export interface GroupMessage {                               // 所有: 06
  id: Id;                       // "msg-001"
  groupId: Id; senderId: Id; kind: "text" | "template"; body: string; templateId: string | null; createdAt: IsoDateTime; reported: boolean;
}
export interface ExpenseNote {                                // 所有: 07。決済・送金の項目は持たない
  id: Id;                       // "ex-001"
  groupId: Id; title: string; amount: number; paidBy: Id; sharedWith: Id[]; createdBy: Id; createdAt: IsoDateTime;
}
export interface GroupStamp {                                 // 所有: 08。spotId は seed.json の spots[].id
  id: Id;                       // "gs-001"
  groupId: Id; spotId: number; userId: Id; at: IsoDateTime;
}
export interface Report {                                     // 所有: 09
  id: Id;                       // "rp-001"
  reporterId: Id; targetType: "user" | "message" | "group"; targetId: Id; reason: string; body: string; status: "received"; createdAt: IsoDateTime;
}
export interface Block {                                      // 所有: 09
  id: Id;                       // "bl-001"
  blockerId: Id; blockedId: Id; createdAt: IsoDateTime;
}
export interface Verification {                               // 所有: 09。id は userId と同じ
  id: Id; userId: Id; status: "unverified" | "mockVerified"; adultConfirmed: boolean; at: IsoDateTime | null;
}

// ---- 共通 DTO(00 の API・クライアント・他モジュールの一覧が使う) ----
export interface Page<T> { items: T[]; total: number; limit: number; offset: number; hasMore: boolean; }
export type DemoUserSummary = Pick<DemoUser, "id" | "displayName" | "ageBand" | "homeRegion" | "role">;
export interface ClockInfo { nowIso: IsoDateTime; today: DateStr; mode: "live" | "frozen"; shiftedDays: number; }
export interface MeResponse { user: DemoUserSummary; clock: ClockInfo; tools: boolean; }

// ---- ストア全体 ----
export interface Store {
  users: DemoUser[];
  groups: Group[];
  members: GroupMember[];
  joinRequests: JoinRequest[];
  withdrawals: Withdrawal[];
  notifications: Notification[];
  plans: GroupPlan[];
  messages: GroupMessage[];
  expenses: ExpenseNote[];
  groupStamps: GroupStamp[];
  reports: Report[];
  blocks: Block[];
  verifications: Verification[];
  counters: Record<string, number>;   // ID 採番の最終値(接頭辞ごと)
}
export type CollectionName = Exclude<keyof Store, "counters">;
```

- 個人情報: DemoUser は**全員架空**。氏名は名のみ(姓なし)、メール・電話・住所・性別の項目は**型に存在させない**(性別での絞り込み禁止、07 章。CMN-T-35)。
- API 応答に `DemoUser`/`Group` の内部オブジェクトをそのまま返さない。各モジュールが DTO(公開範囲を適用した形。例: `inviteCode` を除く、`organizerId` を表示名に変換)を作る。唯一の例外は `/api/demo/users`(デモの視点切替専用。第 5.2)。 [決定(方針)]
- Store に collection を足す場合は「`Store` 型 + seed(空配列で可)+ `groups-store.ts` の Repo 生成」を 1 回の小さな変更で行い、00 の担当が確認する(第 14 章)。

### 4.3 共通の取り決め
| 項目 | 決定 |
|---|---|
| ID 形式 | `<接頭辞>-<3 桁以上の 10 進連番>`。正規表現 `^(u|g|m|jr|wd|n|msg|ex|gs|rp|bl)-\d{3,8}$`。接頭辞は `ids.ts` の `ID_PREFIXES` に登録されたものだけ。連番は接頭辞ごとの `counters` で採番(seed の最大値の次から)。README 4.4 の `^[a-z0-9-]{1,40}$` より狭い許可集合(ファイルパス・クエリに直結させない) [案] |
| ID 以外のトークン | 招待コード等の推測困難な値は `newToken(bytes=8)`(Node `crypto.randomBytes`、Crockford Base32 の大文字。8 バイトで 13 文字)。形式・有効期限は 01 が決める(12 章 #17) |
| 日時 | 保存・API とも ISO 8601 のオフセット付き(`+09:00` 固定)。暦日だけの項目は `YYYY-MM-DD`(JST)。表示はクライアントが dayjs で整形。サーバーの現在時刻は `clock` 経由のみ(`new Date()`/`Date.now()` を直接呼ばない。eslint の `no-restricted-properties`(`Date.now`)と `no-restricted-syntax`(引数なしの `new Date()`)で警告し、`clock.ts` と試験ファイルは対象外にする [案]) |
| タイムゾーン | デモは JST(UTC+9、夏時間なし)固定。サーバーの TZ 設定に依存しない |
| 金額 | 整数の円。0〜10,000,000 |
| 文字数 | コードポイント数で数える(絵文字 1 字)。`limits.ts` の共通上限(下記)を既定とし、モジュール側で変える場合は理由を各設計書に書く |
| ページネーション | `?limit=`(整数 1〜50、既定 20)と `?offset=`(整数 0 以上、既定 0)。応答は `Page<T>`(第 4.2) |
| ソート | `?sort=<キー>:<asc\|desc>`(1 つのみ)。キーはエンドポイントごとの許可リスト。同値は `id` 昇順で安定化 |
| JSON | 文字コード UTF-8、キーは lowerCamelCase、`null` は「値なし」、省略は「指定なし」(PATCH) |
| 空配列・空文字 | 応答では `[]` と `""` を返し `null` にしない(文字列項目)。未設定の日時は `null` |

`limits.ts`(共通上限。`export const LIMITS = {...} as const`)。値の形: 文字数・数値の範囲は `{ min, max }`、件数の上限は `maxItems`、単一の上限値は数値(例: `TAG = { min: 1, max: 20, maxItems: 5 }`、`BODY_BYTES = 65536`)。

| 定数 | 値 | 用途の例 |
|---|---|---|
| `NAME` | 1〜40 字 | グループ名、行き先、費用項目名 |
| `DESCRIPTION` | 0〜500 字(改行可) | グループの説明 |
| `DISPLAY_NAME` | 1〜20 字 | デモユーザーの表示名(seed の検証) |
| `BIO` | 0〜100 字 | プロフィールの一言 |
| `PURPOSE` | 0〜50 字 | 旅の目的 |
| `TAG` | 1〜20 字、最大 5 件 | タグ |
| `SHORT_TEXT` | 0〜200 字 | ひとこと(参加申請)、却下理由 |
| `MEMO` | 0〜2000 字(改行可) | 旅程メモ |
| `CHAT` | 1〜500 字(改行可) | チャット自由入力 |
| `CAPACITY` | 整数 2〜6 | 人数上限 |
| `AMOUNT` | 整数 0〜10,000,000 | 費用メモ |
| `PAGE` | `limit` 既定 20、最大 50 | ページネーション(`parsePage` の既定) |
| `BODY_BYTES` | 65,536 バイト | リクエスト本文の上限 |

### 4.4 ダミーデータ `group-seed.json`(CMN-D-01〜04)

**CMN-D-01 スキーマ**(トップレベルは `Store` の collection と同名の配列 + メタ):

```ts
export interface GroupSeed {
  schemaVersion: 1;
  meta: {
    demoNow: IsoDateTime;           // デモの初期の現在時刻。"2026-11-09T09:00:00+09:00" [案]
    defaultUserId: Id;              // Cookie が無いときの現在ユーザー。"u-001"
    campaign: string;               // "nttw-demo"
    tagCatalog: string[];           // タグの候補(入力補助用。自由入力も可)
  };
  users: DemoUser[]; groups: Group[]; members: GroupMember[]; joinRequests: JoinRequest[];
  withdrawals: Withdrawal[]; notifications: Notification[]; plans: GroupPlan[]; messages: GroupMessage[];
  expenses: ExpenseNote[]; groupStamps: GroupStamp[]; reports: Report[]; blocks: Block[]; verifications: Verification[];
}
```
- JSON は手書き(`sample-data/` は使わない。ユーザー情報を含むため。AGENTS.md 5)。読み込みは `parseSeed(raw: unknown): GroupSeed`(`group-seed.ts`)が `validation.ts` で型・列挙・参照整合を検査し、不正なら起動時に例外(fail-fast)。JSON の文字列リテラルは列挙型に推論されないため、`import` した値を直接 `Store` に代入せず必ず `parseSeed` を通す。
- 日付は `meta.demoNow` を基準にした絶対値で書く(相対指定の仕組みは持たない)。 [案]
- 暦の根拠: [推定] 本日 2026-11-09 をデモ開始日とした。デモ実施日が決まったら `meta.demoNow` と各日付を一括でずらす(件数が少ないため、スクリプトは作らず手作業で直す)。 [要確認]

**CMN-D-02 デモユーザー(9 人。全員架空。氏名は名のみ)** [案]

| id | 表示名 | 年代帯 | 地方 | role | 視点としての役割 |
|---|---|---|---|---|---|
| u-001 | ミサキ | 30s | 水琴地方 | traveler | 既定ユーザー(10 章のデモで主に使う視点)。g-001 の幹事 |
| u-002 | ケンタ | 20s | 星凪諸島 | traveler | 承認済みメンバー。g-009 の幹事(1 対 1) |
| u-003 | ユイ | 40s | 鈴風高原 | traveler | g-003・g-011 の幹事 |
| u-004 | ダイスケ | 50s | 虹帆町 | traveler | 申請者の視点(g-001 に申請中)。g-006・g-007 の幹事 |
| u-005 | ハルカ | 60plus | 水琴地方 | traveler | 非公開グループ g-008 の幹事 |
| u-006 | ソウタ | 20s | 水琴地方 | traveler | 辞退者・ブロックされる側(u-001 がブロック) |
| u-007 | ナナミ | 30s | 星凪諸島 | traveler | g-004・g-012 の幹事 |
| u-008 | ヒナタ | under18 | 鈴風高原 | traveler | 18 歳未満(モック)。進めないことの試験用。未確認(unverified) |
| u-009 | タナカ | 40s | 虹帆町 | municipal | 自治体担当者。公式枠(g-002、g-005)の幹事。12 の閲覧者 |

- 公開設定(`visibility`)の初期値: 既定は ageBand=`public`、homeRegion=`public`、bio=`members`、purpose=`members`。u-006 は ageBand=`members`、u-008 は全項目 `private`(公開範囲の試験用)。
- `verifications`: u-004 と u-008 は `unverified`(adultConfirmed=false)、それ以外は `mockVerified`(adultConfirmed=true)。u-008 は 18 歳未満の試験用、u-004 は「申請前に本人確認(モック)へ誘導される」試験の対象にする(第 16 章 15)。

**CMN-D-03 サンプルグループ(12 件。公開 11、非公開 1、公式 2)**。`demoNow`=2026-11-09 時点。状態は 04 の `evaluate` が「変化なし」を返す整合した値にする(04 への要望 R-04-1)。 [案]

| id | 名称の方向性(架空) | 公開 | 状態 | 定員/最少 | 現在人数(active) | 締切 | 旅行日 | 特記(試験での用途) |
|---|---|---|---|---|---|---|---|---|
| g-001 | 鈴風高原のんびり歩き | public | recruiting | 4/3 | 2(u-001 幹事、u-002) | 11-20 | 12-05〜06 | u-004 の申請中(pending、最少人数同意あり)。既定ユーザーが幹事の標準例 |
| g-002 | 虹帆町 夜市めぐり(公式) | public | recruiting | 6/4 | 3(u-009 幹事、u-003、u-005) | 11-25 | 12-12〜13 | 公式枠。幹事が自治体担当者 |
| g-003 | 星綴港 朝市さんぽ | public | minReached | 4/3 | 3(u-003 幹事、u-002、u-007) | 11-14 | 11-30 | 最少人数到達・締切前 |
| g-004 | 雫森谷 紅葉ハイク | public | withdrawalPeriod | 4/3 | 3(u-007 幹事、u-001、u-005) | 11-07 | 11-29〜30 | 辞退期間(終了 11-11)。u-006 が辞退済み(wd-001、status=withdrawn) |
| g-005 | 星凪諸島 島時間(公式) | public | confirmed | 6/4 | 5(u-009 幹事、u-001、u-002、u-004、u-005) | 11-01 | 11-28〜29 | 実行確定・公式枠。チャット・旅程メモ・通知あり |
| g-006 | 月灯集落 灯りの夕べ | public | cancelled | 4/4 | 2(u-004 幹事、u-006) | 11-05 | 11-22 | 自動中止(minNotReached)。replannedToId=g-007 |
| g-007 | 月灯集落 灯りの夕べ(再企画) | public | recruiting | 4/3 | 1(u-004 幹事) | 11-30 | 12-20 | 再企画。replanOfId=g-006。u-006 の再エントリー申請(replanOfRequestId あり) |
| g-008 | 白波離島 少人数の島旅 | **private** | recruiting | 3/2 | 1(u-005 幹事) | 11-27 | 12-08 | 招待コード(ダミー値、seed に直書き)。一覧に出ない |
| g-009 | 星凪諸島 灯台めぐり(1 対 1) | public | recruiting | 2/2 | 1(u-002 幹事) | 11-22 | 12-02 | 定員 2・最少 2 |
| g-010 | 鈴風高原 音楽堂の朝 | public | completed | 4/3 | 3(u-001 幹事、u-003、u-007) | 10-10 | 10-18〜19 | 完了。グループ・スタンプ集計と振り返りの試験用 |
| g-011 | 虹帆町 夜明けの港 | public | inProgress | 4/3 | 3(u-003 幹事、u-004、u-002) | 10-30 | 11-08〜10 | 実施中。費用メモ 2 件、グループ・スタンプ 2 件 |
| g-012 | 雫森谷 小さな森歩き | public | minReached | 3/2 | 3(u-007 幹事、u-001、u-006)(満員) | 11-18 | 12-01 | 満員。申請が `conflict`(満席)になる試験用 |

(日付は 2026 年。人数は seed 上の status=`active` のメンバー数。g-004 の u-006 は status=`withdrawn` で人数に含めない)

**CMN-D-04 その他の seed 内容**(件数の目安): 参加申請 5〜6 件(pending 1、approved 数件、rejected 1、withdrawn 1、再エントリー 1)、辞退 1 件(wd-001)、通知 5〜8 件(u-001 宛を中心に未読・既読混在)、旅程メモ 2 件(g-005、g-011)、チャット 4〜6 件(g-005、g-011。定型文 `kind=template` と自由入力 `kind=text` の両方)、費用メモ 2 件(g-011)、グループ・スタンプ 2〜4 件(g-010、g-011。spotId は seed.json の 1〜7)、通報 1 件、ブロック 1 件(u-001 が u-006 をブロック)。**本文はすべて架空で、定型の短文**(個人名・連絡先・実在の店名を含めない。実在の地名ではなく seed.json の架空の地名のみ)。

`meta.tagCatalog` 例: `["温泉", "食べ歩き", "写真", "ハイキング", "歴史", "離島", "ゆっくり", "朝活"]`。

JSON の抜粋(形式の例。g-001 と関連レコード):

```json
{
  "schemaVersion": 1,
  "meta": { "demoNow": "2026-11-09T09:00:00+09:00", "defaultUserId": "u-001", "campaign": "nttw-demo",
            "tagCatalog": ["温泉", "食べ歩き", "写真", "ハイキング", "歴史", "離島", "ゆっくり", "朝活"] },
  "users": [
    { "id": "u-001", "displayName": "ミサキ", "ageBand": "30s", "homeRegion": "水琴地方", "role": "traveler",
      "bio": "のんびり歩くのが好きです。", "purpose": "景色と食事",
      "visibility": { "ageBand": "public", "homeRegion": "public", "bio": "members", "purpose": "members" } }
  ],
  "groups": [
    { "id": "g-001", "name": "鈴風高原のんびり歩き", "description": "ゆっくり歩いて音楽堂へ向かいます。",
      "campaign": "nttw-demo", "region": "鈴風高原", "destination": "雪雫の音楽堂", "startDate": "2026-12-05", "endDate": "2026-12-06",
      "capacity": 4, "minMembers": 3, "deadline": "2026-11-20", "withdrawalEndsOn": null, "visibility": "public",
      "tags": ["ハイキング", "ゆっくり"], "isOfficial": false, "organizerId": "u-001", "inviteCode": null, "state": "recruiting",
      "createdAt": "2026-11-01T10:00:00+09:00", "confirmedAt": null, "cancelledAt": null, "cancelReason": null,
      "replanOfId": null, "replannedToId": null }
  ],
  "members": [
    { "id": "m-001", "groupId": "g-001", "userId": "u-001", "status": "active", "role": "organizer", "joinedAt": "2026-11-01T10:00:00+09:00", "leftAt": null }
  ]
}
```

(`destination` は seed.json の spots の `stampName` と一致させておくと 08 がスポットに紐づけやすい [案]。実在しない架空名。)

## 5. インターフェース

凡例: 例外は `AppError`(第 5.4)。全関数は**同期**(ストアがメモリのため)。Route Handler のみ非同期。

### 5.1 ストア(`lib/groups-store.ts`)

方式 [決定(方針)/案(細部)]:
- `globalThis.__groupsStore = { schemaVersion, db }`。Next.js の dev ではルートごとに別バンドルになりモジュール変数が共有されない/HMR で消えるため、既存 `server-store.ts` と同様 globalThis に置く。`schemaVersion` はコード側の定数 `STORE_SCHEMA_VERSION`(seed の `schemaVersion` とは別)で、globalThis 上の値と違えば作り直す(型変更後の HMR で旧い形のデータが残るのを防ぐ)。
- 初期化: 初回アクセスで `parseSeed(groupSeedJson)` → `structuredClone` して Store を作る。`counters` は seed の各接頭辞の最大連番で初期化する(seed に無い接頭辞は 0)。`GroupPlan`・`Verification` は id に groupId・userId をそのまま使うため採番しない。
- 永続化: **既定は永続化しない**(再起動で seed に戻る。デモの再現性、既存モックと同じ。ファイル書き込みの失敗要因を持たない)。 [案] 任意機能として `GROUPS_PERSIST=file` のとき、`tx` のコミット後に `app/.data/groups-store.json`(固定パス。ユーザー入力は使わない)へ同期書き出しし、起動時に存在し `schemaVersion` が一致すれば読み込む(CMN-TASK-15。デモ範囲外の任意機能)。SQLite は採らない(ネイティブ依存・ライセンス確認の工数、競技規模に対して過大。 [案]、03・05 章の「DB 有無」は未決のまま)。

```ts
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
export interface Db {
  users: Repo<DemoUser>; groups: Repo<Group>; members: Repo<GroupMember>; joinRequests: Repo<JoinRequest>;
  withdrawals: Repo<Withdrawal>; notifications: Repo<Notification>; plans: Repo<GroupPlan>; messages: Repo<GroupMessage>;
  expenses: Repo<ExpenseNote>; groupStamps: Repo<GroupStamp>; reports: Repo<Report>; blocks: Repo<Block>; verifications: Repo<Verification>;
}
```

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-01 | `db()` | `() => Db` | 現在のストアの Repo 群を返す(読み取り用。書き込みも可能だが**書き込みは `tx` 内のみ**とする規約) |
| CMN-FN-02 | `tx` | `<T>(fn: (db: Db) => T) => T` | **同期**関数 `fn` を原子的に実行する。例外が出たら開始前の状態(counters を含む)に巻き戻して再 throw。入れ子は外側に合流(巻き戻しは最外のみ)。`fn` が Promise を返したら `Error`(プログラムエラー)。**`fn` 内で `await` しない** |
| CMN-FN-03 | `resetStore` | `() => void` | seed から Store を作り直し、`clock.reset()` を呼ぶ。`afterReset` フック(第 5.8)を実行。`afterClockChange` は実行しない(seed の状態は `demoNow` 時点で整合しているため。R-04-1)。永続化ファイルがあれば削除 |
| CMN-FN-04 | `newId` | `(prefix: IdPrefix) => Id` | `counters[prefix]` を +1 し `"${prefix}-${String(n).padStart(3,"0")}"`。未登録の接頭辞は Error。`tx` の巻き戻しで counters も戻る |
| CMN-FN-05 | `newToken` | `(bytes?: number) => string` | 招待コード等。`crypto.randomBytes` を Crockford Base32 大文字に変換。既定 8 バイト(13 文字)。`Math.random` を使わない |
| CMN-FN-06 | `isId` | `(prefix: IdPrefix, v: unknown) => v is Id` | 形式検査(存在確認はしない) |

排他の考え方 [案]: Node.js はシングルスレッドで、`tx` 内に `await` が無ければ他のリクエストは割り込めない。よって「確認してから更新(定員チェック→メンバー追加、状態確認→遷移)」は `tx` 内で一括して行えば競合しない。ロック機構・キューは持たない。`tx` の巻き戻しは「開始時にコレクション配列と counters を `structuredClone`」で実現(seed 規模は数百件以下で十分軽い)。 [案]

例外規約: 業務エラーは `AppError`、不変条件違反・プログラムエラーは通常の `Error`(ラッパーが `internal` にする)。

### 5.2 現在ユーザー(`lib/current-user.ts`)

方式 [案]: ログイン不要のため、Cookie `demoUser=<DemoUser.id>` で「誰の視点か」を表す。属性: `Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000`(30 日。localhost の http のため `Secure` は付けない)。値は `isId("u", v)` を満たし、かつ `db().users` に存在するときだけ受理する。それ以外(Cookie なし、不正値、存在しない ID)は **`meta.defaultUserId` のユーザーを返す**(エラーにしない。Cookie の状態にかかわらずデモ操作を続けられるようにするため)。権限は常にこの結果で判定し、クライアントの申告(本文・クエリの `userId` 等)を信用しない。 [決定(方針)]

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-10 | `currentUser` | `(req: Request) => Readonly<DemoUser>` | Cookie ヘッダを自前で解析(依存なし)。常に DemoUser を返す |
| CMN-FN-11 | `userCookieHeader` | `(userId: Id) => string` | `Set-Cookie` の値を組み立てる(`POST /api/demo/me` が使用) |
| CMN-FN-12 | `listDemoUsers` | `() => DemoUserSummary[]` | 切替用(id 昇順)。`DemoUserSummary` は第 4.2 |

サーバーコンポーネントから使う場合は `next/headers` の `cookies()`(非同期 [要確認])を使うが、**画面は既存どおりクライアントコンポーネント + API 取得**を基本とし、サーバーコンポーネントでのユーザー依存の描画は行わない。 [案]

### 5.3 時計(`lib/clock.ts`)

方式 [案]: 状態は `globalThis.__groupsClock = { mode: "live" | "frozen", offsetMs: number, frozenAt: number }`。`live` は「実時刻 + offsetMs」、`frozen` は固定。初期状態(および `reset()`)は `live` で、`offsetMs = Date.parse(meta.demoNow) - 実時刻` とする(デモ開始時刻が `demoNow` で、その後は実時間で進む。締切判定は日付単位のため、デモ中の実時間の経過は日付をまたがない限り判定に影響しない)。試験では `freeze()` で固定する。`clock` 内部だけが `Date.now()` を呼んでよい。

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-20 | `clock.now` | `() => Date` | 現在のデモ時刻 |
| CMN-FN-21 | `clock.nowIso` | `() => IsoDateTime` | `+09:00` 付き ISO 8601(秒精度)。保存する日時はこれを使う |
| CMN-FN-22 | `clock.today` | `() => DateStr` | JST の暦日。締切・辞退期間の判定に使う |
| CMN-FN-23 | `clock.advanceDays` | `(days: number) => ClockInfo` | 整数 1〜365。`live` は offsetMs に加算、`frozen` は固定時刻に加算。後戻りは `set` のみ |
| CMN-FN-24 | `clock.set` | `(iso: IsoDateTime) => ClockInfo` | その時刻を「今」にする(`live` のまま offset を再計算)。不正な形式は `invalid_input` |
| CMN-FN-25 | `clock.freeze` | `(iso?: IsoDateTime) => ClockInfo` | 時刻を固定(省略時は現在値で固定)。試験用 |
| CMN-FN-26 | `clock.unfreeze` | `() => ClockInfo` | `live` に戻す(固定時刻を現在として継続) |
| CMN-FN-27 | `clock.reset` | `() => ClockInfo` | seed の `demoNow` からの `live` に戻す |
| CMN-FN-28 | `clock.info` | `() => ClockInfo` | `ClockInfo` は第 4.2。`shiftedDays` は `daysBetween(jstDate(meta.demoNow), clock.today())` |

- 時計を変えても状態遷移は**自動では実行されない**。04 が読み取り時の遅延評価で反映し、加えて `afterClockChange` フック(第 5.8)で `evaluateAll()` を呼ぶ。通知の生成は 04 → 10 の責務。 [案]
- `clock.set`/`advanceDays` は `DEMO_TOOLS=off` で API 経由を拒否(第 5.5 の demoOnly)。関数自体は試験から常に使える。
- `clock.set` で時刻を過去に戻しても、グループ等の状態は戻らない。状態を戻すには `POST /api/demo/reset` を使う(既知の制約)。

### 5.4 エラー(`lib/errors.ts`)

```ts
export type ErrorCode =
  | "invalid_input" | "forbidden" | "blocked" | "not_found" | "method_not_allowed"
  | "conflict" | "unavailable_state" | "payload_too_large" | "unsupported_media_type" | "internal";

export interface ErrorBody { error: ErrorCode; message: string; fields?: Record<string, string>; detail?: Record<string, unknown>; }

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;                       // STATUS_BY_CODE から決まる
  readonly fields?: Record<string, string>;      // invalid_input の項目別メッセージ。キーは "name"、"tags.2" のようなパス
  readonly detail?: Record<string, unknown>;     // 画面が次の行動を出すための補足(例: { state: "cancelled", allowedActions: ["replan"] })
  constructor(code: ErrorCode, message: string, opts?: { fields?: Record<string,string>; detail?: Record<string, unknown>; cause?: unknown });
}
// 生成ヘルパー(例外は throw する側が使う)
export const invalidInput: (fields: Record<string,string>, message?: string) => AppError;
export const forbidden:    (message?: string) => AppError;
export const blocked:      (message?: string) => AppError;          // 既定文言はブロックの有無を示さない一般的な文
export const notFound:     (label?: string) => AppError;            // 「<label>が見つかりません」
export const conflict:     (message: string, detail?: Record<string, unknown>) => AppError;
export const unavailableState: (message: string, detail?: Record<string, unknown>) => AppError;
// 変換
export function toErrorBody(e: unknown, requestId?: string): { status: number; body: ErrorBody }; // AppError 以外は internal(本文に内部情報を出さない)。internal のときは detail: { requestId } を付ける
export function toResponse(e: unknown, requestId?: string): Response;                                // JSON + no-store
```

| code | HTTP | 使う場面 | 備考 |
|---|---|---|---|
| invalid_input | 400 | 検証失敗、JSON 不正、クエリ不正、禁止表現(09) | `fields` 必須(全体の不備は `fields` なし) |
| forbidden | 403 | 権限なし(幹事のみ、メンバーのみ、未確認・18 歳未満(09)) | 存在を隠したいときは `notFound` を使う |
| blocked | 403 | ブロック関係(09) | 文言は一般的に |
| not_found | 404 | 存在しない、**参照できない(非公開・非メンバーに隠す)**、ID 形式不正 | 「存在しない」と「見えない」を区別しない |
| method_not_allowed | 405 | `route.ts` が export していないメソッドへの要求(Next.js が 405 を返す [要確認])。本書のラッパーは生成しない | 本文が `ErrorBody` 形式になるかは [要確認]。画面操作では発生しない(デモ範囲外) |
| conflict | 409 | 重複申請、定員超過、同時操作による不整合 | 画面を更新して再確認 |
| unavailable_state | 409 | 現在の状態で不可(確定済み、中止済み、締切後) | `detail.state`、`detail.allowedActions` を推奨 |
| payload_too_large | 413 | 本文が 64KB 超 | |
| unsupported_media_type | 415 | 変更系で Content-Type が `application/json` でない | CSRF 対策(第 7 章) |
| internal | 500 | 想定外 | 本文は固定の一般文と `detail.requestId`。詳細は `console.error` にのみ出す |

画面での表示・挙動を含むエラー一覧は第 8 章。

- 応答形式(全エラー共通): `{ "error": "<code>", "message": "<利用者向け日本語>", "fields"?: {...}, "detail"?: {...} }`。README 4.3 の `{error, message?, fields?}` に対し、`message` は**常に付ける**(画面にそのまま出せるように)。既存 `/api/v2` は `{error}` のみで別系統のまま。 [案]
- `message` は利用者向け日本語で、原因と次の行動を 1〜2 文で書く(06 章、rule.md 9.1)。文言は `features/<module>/messages.ts` に集約する(README 4.4)。共通の文言(検証メッセージ等)は `lib/messages.ts`(CMN-TASK-03 に含める)。
- 検証メッセージの定型(`fields[...]` の値): 必須「入力してください」/ 長さ「{min}〜{max}字で入力してください」/ 範囲「{min}〜{max}の整数で入力してください」/ 列挙「選択肢から選んでください」/ 日付「YYYY-MM-DD 形式の日付で入力してください」/ 件数「{max}件までです」/ 制御文字「使用できない文字が含まれています」。

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
  /** クエリを検証して返す(文字列→数値/真偽へは schema の coerce 指定) */
  query<S extends Schema>(schema: S): Infer<S>;
}
export interface RouteOptions {
  auth?: "demoUser" | "none";               // 既定 "demoUser"
  demoOnly?: boolean;                       // true なら DEMO_TOOLS=off のとき 404
  maxBodyBytes?: number;                    // 既定 LIMITS.BODY_BYTES
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
1. `import "@/features/bootstrap"`(フック登録の副作用。第 5.8)。
2. **`req.headers` を最初に読む**(動的な Route Handler として扱われ、ビルド時にキャッシュ・事前生成されないようにする。`cacheComponents: true` 対策 [要確認])。
3. 変更系メソッド(POST/PUT/PATCH/DELETE)では次の順に検査する(第 7 章)。
   - (a) `Origin` ヘッダがあり、`new URL(origin).host` が `Host` ヘッダと異なる、または `Origin` を URL として解釈できない(`null` 等)→ `forbidden`。`Origin` が無い要求(試験・curl)は許可する。
   - (b) `Content-Type` が `application/json`(charset 指定可)でない → `unsupported_media_type`。本文の有無にかかわらず必須とし、クライアント(第 5.9)は常にこのヘッダを付ける。本文が空でもこの段階では許可し、内容は `c.body()` を呼んだときだけ要求する(空なら `invalid_input`)。
   - (c) `Content-Length` が `maxBodyBytes` を超えれば本文を読む前に `payload_too_large`。`c.body()` で読んだ本文のバイト数(`TextEncoder`)が超えた場合も同じ。
4. `auth:"demoUser"` なら `currentUser(req)` を解決。
5. `handler` を実行。戻り値が `ApiResult`(`API_RESULT` 識別子付き)でなければ、戻り値をそのまま本文として `200` + JSON。DTO が `status` 項目を持っていても `ApiResult` とは扱わない。`undefined` は `204` ではなく `{}`(クライアントの `res.json()` を単純にするため。204 は `noContent()` を明示したときのみ)。
6. 例外は `toResponse` へ。`AppError` 以外は `console.error("[<requestId>]", method, path, e)` を出力して `internal`。本文・Cookie・招待コードはログに出さない(第 7 章)。
7. すべての応答に `Cache-Control: no-store`、`Content-Type: application/json; charset=utf-8`、`X-Content-Type-Options: nosniff`。

使い方の例(他モジュールの Route Handler の型):

```ts
// app/src/app/api/groups/[groupId]/join-requests/route.ts
import { route, created } from "@/lib/api-route";
import { v } from "@/lib/validation";
import { requestToJoin } from "@/features/groups/join/service";

const Body = v.object({ message: v.string({ max: 200, optional: true }), minAccepted: v.boolean() });

export const POST = route<{ groupId: string }>(async (c) => {
  const groupId = await c.id("groupId", "g");
  const input = await c.body(Body);
  return created(requestToJoin(c.user, groupId, input));   // service は同期・フレームワーク非依存
});
```

#### デモ用 API(`app/src/app/api/demo/`)
| ID | メソッド・パス | リクエスト | 成功応答 | エラー |
|---|---|---|---|---|
| CMN-API-01 | `GET /api/demo/me` | なし | `200 { user: DemoUserSummary, clock: ClockInfo, tools: boolean }` | - |
| CMN-API-02 | `POST /api/demo/me` | `{ userId: Id }`(`v.id("u")`) | `200 { user: DemoUserSummary }` + `Set-Cookie: demoUser=<id>; Path=/; SameSite=Lax; HttpOnly; Max-Age=2592000` | 400 invalid_input(形式不正・存在しない ID。`fields.userId`)、404(`DEMO_TOOLS=off`) |
| CMN-API-03 | `GET /api/demo/users` | なし | `200 { items: DemoUserSummary[] }` | 404(`DEMO_TOOLS=off`) |
| CMN-API-04 | `GET /api/demo/clock` | なし | `200 ClockInfo` | - |
| CMN-API-05 | `POST /api/demo/clock` | `{ action: "advanceDays", days: 1..365 }` / `{ action: "set", at: IsoDateTime }` / `{ action: "reset" }` | `200 ClockInfo`。3 種の action のいずれでも `afterClockChange` フックを実行 | 400 invalid_input、404(`DEMO_TOOLS=off`) |
| CMN-API-06 | `POST /api/demo/reset` | `{}` | `200 { ok: true, clock: ClockInfo }`。`resetStore()` 実行 | 404(`DEMO_TOOLS=off`) |

- `DEMO_TOOLS`: 環境変数。既定は有効(未設定=on)。`off` で `me` の POST、`users`、`clock` の POST、`reset` を 404 にする。`NODE_ENV=production`(`next start`)でも既定で有効(09 章の起動方式が未決で、本番ビルドでのデモ初期化が必要になりうるため)。画面は常に「モック」「デモ用」と明示する。 [案] README・骨子の「production では無効」案からの変更(第 16 章)。
- 表のエラーに加え、POST はすべて第 5.5 の入口検査による 403・413・415 を返しうる。
- `me` の GET は `DEMO_TOOLS=off` でも返す(視点の表示用)が、`tools:false` を付けて DemoBar の操作を隠す。

### 5.6 ページネーション・ソート(`lib/query.ts`)
| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-30 | `parsePage` | `(q: URLSearchParams, opts?: { defaultLimit?: number; maxLimit?: number }) => { limit: number; offset: number }` | 既定 limit 20、最大 50、offset 0 以上の整数。不正は `invalid_input`(`fields.limit`/`fields.offset`) |
| CMN-FN-31 | `paginate` | `<T>(items: readonly T[], page: { limit: number; offset: number }) => Page<T>` | `total` は絞り込み後の全件数。範囲外の offset は空配列 + `hasMore:false` |
| CMN-FN-32 | `parseSort` | `<K extends string>(q: URLSearchParams, opts: { allowed: readonly K[]; default: { key: K; dir: "asc" \| "desc" } }) => { key: K; dir: "asc" \| "desc" }` | `?sort=deadline:asc`。許可外のキーは `invalid_input`(`fields.sort`) |
| CMN-FN-33 | `sortBy` | `<T extends { id: Id }, K extends string>(items: readonly T[], sort: { key: K; dir: "asc"\|"desc" }, get: Record<K, (x: T) => string \| number>) => T[]` | 比較は文字列/数値。同値は `id` 昇順で安定化。元配列は変更しない |

### 5.7 権限ヘルパー(`lib/authz.ts`)
「幹事/メンバー」の判定は 00 が実装し、01 は再エクスポートして使う(01 の骨子 `isMember / isOrganizer(user, group)` と同名・互換)。`UserRef = Id | { id: Id }`、`GroupRef = Id | { id: Id }`。

| ID | 名称 | 署名 | 説明 |
|---|---|---|---|
| CMN-FN-40 | `isMember` | `(user: UserRef, group: GroupRef) => boolean` | `members` に status=`active` の行がある(幹事も含む)。退会・辞退者は false |
| CMN-FN-41 | `isOrganizer` | `(user: UserRef, group: GroupRef) => boolean` | active かつ role=`organizer` |
| CMN-FN-42 | `memberRole` | `(user: UserRef, group: GroupRef) => MemberRole \| null` | 非メンバーは null |
| CMN-FN-43 | `activeMembers` | `(group: GroupRef) => Readonly<GroupMember>[]` | active のメンバー(参加日時昇順)。人数は `.length` |
| CMN-FN-44 | `requireGroup` | `(id: Id) => Readonly<Group>` | 無ければ `not_found`。**公開範囲(非公開の隠蔽)は適用しない**(02・09 の責務) |
| CMN-FN-45 | `requireMember` | `(user: UserRef, group: GroupRef) => Readonly<GroupMember>` | 非メンバーは `forbidden`(隠したい文脈では呼び出し側で `not_found` に差し替える) |
| CMN-FN-46 | `requireOrganizer` | `(user: UserRef, group: GroupRef) => Readonly<GroupMember>` | 幹事以外は `forbidden`(「幹事のみができる操作です」) |
| CMN-FN-47 | `requireRole` | `(user: Readonly<DemoUser>, role: UserRole) => void` | role が異なれば `forbidden`。例: 12 の `requireRole(user, "municipal")` |

### 5.8 フック(`lib/hooks.ts`、`features/bootstrap.ts`)
- 目的: 00 が上位モジュール(04 の `evaluateAll`)を import せずに、時計変更・リセット時に上位の処理を呼べるようにする(依存の向きを「上位 → 00」の一方向に保つ)。 [案]
- CMN-FN-60 `registerHook(name: "afterClockChange" | "afterReset", key: string, fn: () => void): void` — `globalThis.__groupsHooks` に `key` で登録(同じ key は上書き。HMR の二重登録を防ぐ)。CMN-FN-61 `runHooks(name): void`(登録順に実行。1 つが例外でも残りを実行し、最初の例外を再 throw)。
- `features/bootstrap.ts` は各モジュールが 1 行ずつ追記する import 集約(例: `import "@/features/groups/lifecycle/register";`)。`route()`(`api-route.ts`)と `src/test/setup.ts` から import する。`groups-store.ts` からは import しない(`register` → service → `groups-store` の循環 import を避けるため)。追記の衝突を避けるため**1 モジュール 1 行・アルファベット順**とする。
- 使う予定: 04 が `afterClockChange` で `evaluateAll`(締切・辞退期間の遷移を実行して通知を生成)、`afterReset` は必要なら各モジュールの補助状態の初期化用。

### 5.9 クライアント(`lib/groups-api.ts`)
既存 `api.ts` を変更せず、同じ形で新設する(`"use client"`)。

```ts
export class ApiError extends Error {
  code: ErrorCode | "network"; status: number; fields?: Record<string, string>; detail?: Record<string, unknown>;   // network のとき status は 0
  constructor(code: ErrorCode | "network", status: number, message: string, opts?: { fields?: Record<string, string>; detail?: Record<string, unknown> });
}
export async function gapi<T>(path: string, init?: RequestInit): Promise<T>;           // path は "/api/groups/..." など完全なパス。cache:"no-store"、credentials は同一オリジンの既定
export const gpost: <T>(path: string, data?: unknown) => Promise<T>;                    // POST + JSON
export const gpatch: <T>(path: string, data?: unknown) => Promise<T>;
export const gdelete: <T>(path: string) => Promise<T>;
export function useGroupsApi<T>(path: string | null): { data: T | null; error: ApiError | null; loading: boolean; reload: () => Promise<void> };
export function useCurrentUser(): { user: DemoUserSummary | null; loading: boolean };   // GET /api/demo/me
```
- 本文が JSON でない/ネットワーク失敗は `code:"network"` の `ApiError`。`error` は `{error, message, fields, detail}` をそのまま保持(`message` を画面に出せる)。
- `gpost`/`gpatch`/`gdelete` は本文の有無にかかわらず `Content-Type: application/json` を付ける(第 5.5 の入口検査)。`data` を省略したときは `{}` を送る。
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
  string(o?: { min?: number; max?: number; multiline?: boolean; pattern?: RegExp; optional?: boolean; default?: string }): Schema<string>;
  int(o?: { min?: number; max?: number; coerce?: boolean; optional?: boolean; default?: number }): Schema<number>;
  boolean(o?: { coerce?: boolean; optional?: boolean; default?: boolean }): Schema<boolean>;
  enum<T extends string>(values: readonly T[], o?: { optional?: boolean; default?: T }): Schema<T>;
  id(prefix: IdPrefix, o?: { optional?: boolean }): Schema<Id>;
  date(o?: { optional?: boolean }): Schema<DateStr>;                         // 実在する暦日(2026-02-30 は不可)
  datetime(o?: { optional?: boolean }): Schema<IsoDateTime>;                 // オフセット必須(Z も可)。出力は +09:00 に正規化した値
  array<S extends Schema>(item: S, o?: { min?: number; max?: number; unique?: boolean; optional?: boolean }): Schema<Infer<S>[]>;
  object<Shape extends Record<string, Schema>>(shape: Shape, o?: { optional?: boolean }): Schema<{ [K in keyof Shape]: Infer<Shape[K]> }>;
  csv<S extends Schema>(item: S, o?: { max?: number; optional?: boolean }): Schema<Infer<S>[]>;   // クエリ "a,b,c" 用
};
export function sanitizeText(s: string, o?: { multiline?: boolean }): string;
```

規則:
- **型は厳密**: 文字列に数値、`"3"` を `int` に渡す等は `coerce` 指定がない限り不可。`NaN`/`Infinity`/`MAX_SAFE_INTEGER` 超は不可。`null` は `optional` でも不可(省略のみ許可)。
- **未知キーは捨てる**(マスアサインメント防止。`isOfficial`、`state`、`organizerId` を本文で受け取らない)。`object` の出力は shape のキーだけを新しいオブジェクトへ写したもの(`__proto__`・`constructor` 等の未知キーを取り込まない)。
- `string`: 入力を `sanitizeText` に通してから長さを数える。既定は `min:1`(必須)、`optional:true` なら空/省略を許可(`default` があれば補う)。`pattern` は sanitize 後に適用。
- `sanitizeText`: ① Unicode NFC に正規化、② 改行を `\n` に統一、③ 制御文字(U+0000〜001F。ただし `multiline` のとき `\n` `\t` を除く、U+007F〜009F)、ゼロ幅・双方向制御文字(U+200B〜200F、U+202A〜202E、U+2066〜2069、U+FEFF)を除去、④ 前後の空白を除去、⑤ `multiline:false` で `\n` を含む場合は `invalid_input`(除去ではなく拒否)。HTML は**入力時に除去・エスケープしない**(出力側のエスケープに一本化。入力時の変形は文字化けと二重エスケープの原因)。
- 禁止表現(09 `checkText`)は 00 に含めない。各 service が `parse` の後で呼ぶ(`fields.<name>` に 09 のメッセージを入れて `invalidInput`)。
- 項目パスは `name`、`tags.2`、`range.start` の形。配列の問題は `tags`(件数)と `tags.2`(要素)。
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

## 6. 状態遷移・主要シーケンス
- 本モジュールにエンティティの状態遷移はない(グループは 04、申請は 03)。
- 状態を持つのは `clock`(live ⇄ frozen)と、ストアの `tx`(開始 → コミット/巻き戻し)のみ。
- シーケンス: ある変更系 API の呼び出し [案]

```
Client → route(): Origin/Content-Type 検査 → currentUser(Cookie) → handler
  handler: c.body(schema)   … 検証・サニタイズ(失敗なら 400)
           service(user, input)
             tx(db => { 権限確認(requireOrganizer 等) → 状態確認 → 更新 → newId → 通知作成 })  … 同期・原子的
  → ok/created(DTO)   または  AppError → {error,message,fields} + ステータス
```

## 7. 入力検証・セキュリティ
OWASP Top 10(2021)の分類のうち、本モジュールに関係するものを示す。業務上の権限・公開範囲の判定は各モジュールが持ち、本モジュールは判定に使う共通部品を提供する。 [案]

| 分類 | 対処 | 実装箇所・試験 |
|---|---|---|
| A01 アクセス制御の不備・IDOR | 権限は常に `currentUser(req)`(Cookie)から判定し、本文・クエリ・パスの `userId` を根拠にしない。ID は連番で推測できる前提とし、ID を知っていることを権限の根拠にしない(各 service が操作ごとに `requireMember` 等と公開範囲を確認する)。非メンバーに見せない対象は `not_found` で存在を隠す(判断は呼び出し側)。API 応答は DTO とし、`inviteCode` 等の内部項目を除く | `authz.ts`、`api-route.ts`、CMN-T-22、30、36 |
| A01 CSRF | Cookie で利用者を識別するため、(1) `SameSite=Lax`、(2) 変更系は `Content-Type: application/json` 必須(フォーム POST・`text/plain` を拒否する。別オリジンからの JSON 送信は CORS のプリフライトが必要になり、本アプリは CORS ヘッダを返さないためブラウザは送信しない)、(3) `Origin` が `Host` と異なれば拒否、の 3 点。CORS ヘッダは付けない(localhost 完結) | `api-route.ts`、CMN-T-13 |
| A03 インジェクション・入力検証 | サーバー側で必ず検証する(クライアント検証は補助)。長さ・範囲・列挙・日付の実在・配列件数を `LIMITS` を既定に検査する。未知キーを捨てる(マスアサインメント防止)。ID は `isId` の許可文字のみ。SQL を使わないため SQLi は該当しない。ユーザー入力から正規表現やコード(`eval`、`new Function`)を組み立てない | `validation.ts`、CMN-T-01〜10 |
| A03 XSS | 出力は React の既定エスケープに一本化し、`dangerouslySetInnerHTML` を禁止する(eslint `react/no-danger`)。入力は制御文字・ゼロ幅/双方向制御文字を除去するが HTML は加工しない。JSON API に `X-Content-Type-Options: nosniff` を付ける。URL を表示するモジュールは `http`/`https` スキームのみ許可する(`javascript:` を拒否)。通知本文はテンプレート + 変数とし、ユーザー入力を埋め込まない(10) | CMN-T-14、36、38 |
| A07 認証・セッション(デモ) | ログイン不要(rule.md)のため認証は持たない。`demoUser` Cookie は `HttpOnly`・`SameSite=Lax`・`Path=/` とし、値は形式と存在を検証して、不正値は既定ユーザーに置き換える。Cookie は利用者が書き換えられる(他のデモユーザーになれる)ことを既知の制約とし、実運用では認証が必要と 11 章に記載する [案] | `current-user.ts`、CMN-T-22、23 |
| A05 セキュリティ設定 | 全応答に `Cache-Control: no-store` と `nosniff` を付ける。エラー本文にスタックトレース・ファイルパスを出さない(`internal` は固定文)。`/api/demo/*` は `DEMO_TOOLS=off` で無効化できる。画面に「モック」「デモ用」を常時表示する | `api-route.ts`、`errors.ts`、CMN-T-12、14、27、29 |
| A02 機密データの扱い | seed はすべて架空。DemoUser の公開は `/api/demo/users` の 5 項目(id、表示名、年代帯、地方、role)に限る。メール・電話・住所・性別の項目を型に持たない。招待コードは `crypto.randomBytes` で生成し、DTO とログに出さない。`.env*` を読まず、秘密情報を設定に持たない | `groups-types.ts`、`ids.ts`、CMN-T-24、35 |
| A09 ログ | `console.error` に出すのは `internal` の例外だけとし、内容は `requestId`・メソッド・パス・例外に限る。本文・Cookie・招待コード・表示名は出さない。ログファイルは作らない | `api-route.ts`、CMN-T-12 |
| パストラバーサル・過大入力 | ユーザー入力をファイルパスに使わない(永続化ファイルは固定パス)。本文 64KB 上限、配列件数の上限、`limit` 最大 50 | CMN-T-13、15、31 |

既知の制約(対処はデモ範囲外): 連番 ID による件数の推測、招待コード比較の処理時間の差、Cookie の書き換えによる別ユーザーへの切替、メモリストアの肥大や大量リクエストによる負荷には対処しない(デモはリセット API で復旧する)。

## 8. エラー処理
エラー一覧。コードと HTTP ステータスの対応は第 5.4 の表が正。画面の表示は `ErrorNotice`(第 3.2)と `useFormErrors` が行う。

| コード | HTTP | 本モジュールでの発生条件 | 他モジュールでの主な発生条件 | 画面での表示・挙動 |
|---|---|---|---|---|
| invalid_input | 400 | 検証失敗(項目パス付き)、JSON 不正、本文が空で `c.body()` を呼んだ、クエリ不正(`limit`・`offset`・`sort`)、`POST /api/demo/me` の形式不正・存在しない `userId`、`POST /api/demo/clock` の範囲外の値 | 禁止表現(09)、業務上の入力不備 | 項目ごとのメッセージを入力欄に表示する(`useFormErrors`)。`fields` が無いときは `ErrorNotice` に `message` を表示 |
| forbidden | 403 | `Origin` が `Host` と異なる変更系要求、`requireMember`・`requireOrganizer`・`requireRole` の不一致 | 幹事のみ・メンバーのみの操作、本人確認未了・18 歳未満(09) | `ErrorNotice` で権限の説明と戻る導線を表示。Origin 不一致は通常の画面操作では起きない |
| blocked | 403 | なし(09 が使う) | ブロック関係(09) | ブロックの有無を示さない一般的な文言のみ表示 |
| not_found | 404 | パスの ID 形式不正、`requireGroup`・`getOrThrow` で対象なし、`DEMO_TOOLS=off` のときの `/api/demo/*`(GET の `me`・`clock` を除く) | 存在しない、参照できない(非公開・非メンバー) | `ErrorNotice` で一覧へ戻る導線を表示(存在しないと見えないを区別しない) |
| conflict | 409 | なし(各モジュールが使う) | 重複申請、定員超過、同時操作による不整合 | 「画面を更新して最新の状態を確認」を表示し、`onRetry` で再取得 |
| unavailable_state | 409 | なし(各モジュールが使う) | 確定済み・中止済み・締切後など、現在の状態では実行できない | 原因と `detail.allowedActions` の操作を表示 |
| payload_too_large | 413 | 本文が `maxBodyBytes`(既定 64KB)を超える | 同左 | 「入力を短くしてください」。入力欄の上限があるため通常の画面操作では起きない |
| unsupported_media_type | 415 | 変更系で `Content-Type` が JSON でない | 同左 | 通常の画面操作では起きない。「画面を再読み込みしてやり直してください」 |
| method_not_allowed | 405 | `route.ts` が export していないメソッド(Next.js が応答 [要確認]) | 同左 | 画面操作では発生しない(デモ範囲外) |
| internal | 500 | 想定外の例外、フック(`runHooks`)内の例外 | 同左 | 「問題が発生しました」と「画面を再読み込み」「デモを初期化」の案内。`detail.requestId` を表示 [案] |
| (client) network | - | fetch 失敗・非 JSON 応答(`gapi` が生成) | 同左 | 「サーバーに接続できません。起動していることを確認して再試行してください」。ローカル保存・読込の失敗に相当(06 章) |

- DemoBar の操作(ユーザー切替・日付・初期化)が失敗したときは再読み込みせず、DemoBar 内に `ErrorNotice` を表示する。
- データ不整合(seed 検証失敗)は初回のストアアクセス時に例外とし、メッセージにファイル名と項目パスを含める(復旧は seed の修正と再起動。06 章の未決の暫定)。

## 9. 試験観点・試験項目

### 9.1 テスト基盤 [案]
- ツール: **Vitest**(MIT。devDependency のみで成果物には含まれない。第 10.2)。環境は `node`(サーバー側の純粋関数・Route Handler を直接呼ぶ)。コンポーネントの表示確認は手動(第 9.3)とし、jsdom によるコンポーネントの自動試験は行わない(デモ範囲外)。導入時に、Vitest が要求する Node.js のバージョンと実行環境の Node.js(Next.js 16 は 20.9 以上)が合うことを確認する [要確認]。OSS 一覧(docs/design/08)への追記は CMN-TASK-16。
- 実行コマンド(`app/` で): `npm test`(= `vitest run`)、`npm run test:watch`(= `vitest`)、型検査 `npx tsc --noEmit`、`npm run lint`、`npm run build`(package.json の `build` に `--webpack` 指定済み。ルートが動的になっているかの確認を含む)。
- `vitest.config.ts`: `test.environment: "node"`、`resolve.alias: { "@": "<app>/src" }`、`test.setupFiles: ["src/test/setup.ts"]`、`include: ["src/**/*.test.ts"]`。`setup.ts` は先頭で `@/features/bootstrap` を import し(フック登録。第 5.8)、各テストの前に `resetStore()` と `clock.freeze(seed の demoNow)` を行う(テスト間の独立)。
- `src/test/helpers.ts`:

```ts
export function resetForTest(opts?: { now?: IsoDateTime }): void;                 // resetStore() + clock.freeze(opts.now ?? demoNow)
export function asUser(userId: Id): { cookie: string };                            // "demoUser=u-002"
export interface CallOptions { method?: string; body?: unknown; user?: Id; headers?: Record<string, string>; params?: Record<string, string>; rawBody?: string; }
export async function callRoute(handler: (req: Request, ctx: { params: Promise<any> }) => Promise<Response>, path: string, opts?: CallOptions): Promise<{ status: number; body: any; headers: Headers }>;
// path は "/api/groups/g-001?limit=5" 形式。Request("http://localhost:3000"+path) を作り、Content-Type: application/json を付与する
export function insertGroup(partial?: Partial<Group>): Readonly<Group>;           // seed ファイルを変更せずストアに追加する(テスト専用)。必須項目の既定値つき + 幹事メンバー行も作る
export function insertMember(groupId: Id, userId: Id, role?: MemberRole): Readonly<GroupMember>;
```
- `src/test/fixtures.ts`: seed の ID 定数(`USER = { misaki: "u-001", kenta: "u-002", ... }`、`GROUP = { recruiting: "g-001", official: "g-002", minReached: "g-003", withdrawal: "g-004", confirmed: "g-005", cancelled: "g-006", replan: "g-007", private: "g-008", oneToOne: "g-009", completed: "g-010", inProgress: "g-011", full: "g-012" }`)。試験に ID 文字列を直書きしない。
- 試験の置き場所: 各モジュールは自分の `features/<m>/*.test.ts` に書く。共通基盤の試験は `lib/*.test.ts`。

### 9.2 試験項目(自動。単体・結合。docs/design/10 の「状態の反映」「入力検証」を支える)
| ID | 対象 | 入力・操作 | 期待結果 |
|---|---|---|---|
| CMN-T-01 | v.string 必須 | `parse(v.object({name: v.string({max:40})}), {name: ""})` | `invalid_input`、`fields.name` = 「入力してください」 |
| CMN-T-02 | v.string 整形・長さ | `"  旅  "` → `"旅"`。41 字 → 失敗。`"😀"×40` → 成功(コードポイントで数える) | 左記どおり |
| CMN-T-03 | sanitizeText | `"a\u0000b\u202Ec\u200B"` → `"abc"`。`multiline:false` で `"a\nb"` → 失敗。`multiline:true` で `"a\r\nb"` → `"a\nb"` | 左記どおり |
| CMN-T-04 | v.int | `2.5`、`"3"`、`NaN`、`2**53` → 失敗。`{min:2,max:6}` で 1 と 7 は失敗、2 と 6 は成功。`coerce:true` で `"3"` → 3 | 左記どおり |
| CMN-T-05 | v.enum / v.boolean | 列挙外 `"x"` → `fields.<key>` = 「選択肢から選んでください」。`boolean` に `"true"` → 失敗(coerce なし) | 左記どおり |
| CMN-T-06 | v.array | `tags` 6 件 → `fields.tags`「5件までです」。要素 3 番目が空 → `fields["tags.2"]`。`unique:true` で重複 → 失敗 | 左記どおり |
| CMN-T-07 | object の未知キー除去 | `{name:"x", isOfficial:true, state:"confirmed"}` を `{name}` のスキーマで parse | 結果は `{name:"x"}` のみ |
| CMN-T-08 | v.date / v.datetime | `"2026-02-30"` 失敗、`"2026-12-05"` 成功。`"2026-12-05T10:00:00"`(オフセットなし)失敗、`"...+09:00"`・`Z` 成功し `+09:00` に正規化 | 左記どおり |
| CMN-T-09 | v.id / isId | `v.id("g")`: `"g-001"` 成功、`"../etc"`、`"u-001"`、`"g-1"`、`"g-001 "` 失敗 | 左記どおり |
| CMN-T-10 | 複数エラーの集約 | 3 項目が不正な本文 | `fields` に 3 キーすべて(最初の 1 件で止まらない) |
| CMN-T-11 | toResponse の対応表 | 各 `ErrorCode` の AppError | ステータス 400/403/403/404/405/409/409/413/415/500、本文に `error`・`message` が必ずある |
| CMN-T-12 | internal の秘匿 | `throw new Error("secret path C:\\x")` | 500 `{error:"internal"}`、本文に "secret" を含まず `detail.requestId` がある。`console.error` が呼ばれる |
| CMN-T-13 | ラッパーの入口検査 | POST を (a) `Content-Type: text/plain` (b) `Origin: http://evil.example`(Host は localhost:3000) (c) 本文 70KB (d) 不正 JSON `{` で送る | (a) 415 (b) 403 forbidden (c) 413 (d) 400 invalid_input |
| CMN-T-14 | ラッパーの共通ヘッダ | 任意の GET/POST/エラー応答 | `Cache-Control: no-store`、`Content-Type: application/json`、`X-Content-Type-Options: nosniff` |
| CMN-T-15 | パスの ID 検証 | `c.id("groupId","g")` に `"..%2Fx"`、`"u-001"` | 404 not_found |
| CMN-T-16 | tx の巻き戻し | `tx` 内で `groups.insert` と `newId("g")` の後に throw | 例外が再 throw、`groups.count()` と `counters.g` が開始前と同じ |
| CMN-T-17 | tx の入れ子・非同期禁止 | 入れ子の内側で throw → 外側も巻き戻る。`tx(async () => {})` | 前者は全体が戻る。後者は Error |
| CMN-T-18 | ホットリロード耐性 | `vi.resetModules()` の後に `groups-store` を再 import して `db()` で取得 | 再 import 前に挿入したデータが残る(globalThis 共有) |
| CMN-T-19 | resetStore | グループ追加・時計進行・ユーザー変更後に `resetStore()` | seed の件数と `demoNow` の時刻に戻り、`newId("g")` は `g-013` |
| CMN-T-20 | newId / newToken | 連続 2 回、未登録接頭辞 `"zz"`、`newToken()` を 100 回 | 連番で重複なし、`zz` は Error、トークンは長さ・文字集合が一定で重複なし |
| CMN-T-21 | Repo | `update("g-999", {})`、`getOrThrow("g-999")`、`insert` で既存 id、`update` で `id` 変更を試みる | not_found、not_found、Error、id は変更されない(型で禁止 + 実行時に無視) |
| CMN-T-22 | currentUser の解決 | Cookie なし / `demoUser=u-002` / `demoUser=u-999` / `demoUser=../x` / 長さ 1000 の値 | u-001(既定)/ u-002 / u-001 / u-001 / u-001 |
| CMN-T-23 | POST /api/demo/me | `{userId:"u-002"}`、`{userId:"u-999"}`、`{}` | 200 + `Set-Cookie: demoUser=u-002` に `HttpOnly`・`SameSite=Lax`・`Path=/`。u-999 は 400(`fields.userId`)。`{}` も 400 |
| CMN-T-24 | 視点の切替 | 同じ `GET /api/demo/me` を Cookie `u-001` と `u-004` で | `user.id` が異なる。`GET /api/demo/users` は 9 件で 5 項目のみ(`bio` 等を含まない) |
| CMN-T-25 | clock の基本 | `freeze("2026-11-09T09:00:00+09:00")`、`advanceDays(3)` | `today()`=`"2026-11-12"`、`nowIso()` が `+09:00` で終わる、`info().shiftedDays`=3 |
| CMN-T-26 | clock の JST 境界 | `freeze("2026-11-09T00:30:00+09:00")`(UTC では 11-08)、`freeze("2026-11-09T23:59:59+09:00")` | `today()` は両方 `"2026-11-09"`。`advanceDays(1)` で 11-10 |
| CMN-T-27 | clock API の入力 | `POST /api/demo/clock` に `days:0`、`days:366`、`days:1.5`、`action:"x"`、`at:"2026-11-09"` | すべて 400 invalid_input。`days:3` は 200 で `ClockInfo`。`DEMO_TOOLS=off` で 404 |
| CMN-T-28 | clock.reset / unfreeze | (a) 進めた後 `reset()`。(b) `freeze("2026-11-10T09:00:00+09:00")` の後 `unfreeze()` | (a) `mode`=`live`、`nowIso()` が `demoNow` から 5 秒以内。(b) `mode`=`live`、`nowIso()` が 2026-11-10T09:00:00+09:00 から 5 秒以内 |
| CMN-T-29 | POST /api/demo/reset | 変更後に呼ぶ | 200 `{ok:true}`、データと時計が seed に戻る。`DEMO_TOOLS=off` で 404 |
| CMN-T-30 | authz | `isOrganizer(u-001,g-001)`、`isOrganizer(u-002,g-001)`、`isMember(u-006,g-004)`(辞退)、`isMember(u-004,g-001)`(申請中)、`requireOrganizer(u-002,g-001)`、`requireGroup("g-999")`、`activeMembers("g-012").length`、`requireRole(u-001,"municipal")` | 順に true、false、false、false、forbidden、not_found、3、forbidden |
| CMN-T-31 | parsePage / paginate | `limit=0`、`51`、`abc`、`offset=-1`、省略。25 件で `limit=10&offset=20`、`offset=100` | 不正は 400(`fields.limit`/`fields.offset`)。省略は 20/0。`items` 5 件・`hasMore:false`・`total:25`。範囲外は空・`total` 不変 |
| CMN-T-32 | parseSort / sortBy | `sort=deadline:asc`、`sort=password:asc`、`sort=deadline`、同値の 2 件 | 許可外・形式不正は 400(`fields.sort`)。同値は `id` 昇順 |
| CMN-T-33 | datetime ヘルパー | `addDays("2026-11-30",1)`、`addDays("2028-02-28",1)`、`daysBetween("2026-11-09","2026-12-05")`、`toJstIso(new Date("2026-11-09T00:00:00Z"))`、`jstDate("2026-11-08T15:30:00Z")`、`isDateStr("2026-02-30")`、`parseIso("2026-11-09T09:00:00")` | `"2026-12-01"`、`"2028-02-29"`、26、`"2026-11-09T09:00:00+09:00"`、`"2026-11-09"`、false、null |
| CMN-T-34 | seed の整合 | `parseSeed(groupSeedJson)` と整合検査 | 成功。ID 一意。外部キー(groupId、userId、spotId、replanOfId 等)がすべて存在。`minMembers ≤ capacity ≤ 6`。active 人数 ≤ capacity。各グループに active な幹事がちょうど 1 人で `organizerId` と一致。7 状態すべて、再企画の連鎖(g-006↔g-007)、非公開 1、公式 ≥1、定員 2 が存在 |
| CMN-T-35 | seed の衛生 | seed 全文字列を検査 | 「相乗り」「マッチング」「恋」「出会い」を含まない。`gender`/`sex`/`email`/`phone` のキーなし。メール・電話番号らしいパターンなし。`displayName` は 1〜20 字で姓を含まない(目視 + パターン) |
| CMN-T-36 | 静的検査 | `src/**/*.{ts,tsx}` を走査 | `dangerouslySetInnerHTML` が 0 件。`/api/groups` の Route Handler に `userId` を本文から受ける定義がない(`body`/`query` スキーマに `userId`/`actorId` キー不在) |
| CMN-T-37 | クライアント ApiError | `gapi` を fetch モックで `{error:"invalid_input",message:"x",fields:{a:"b"}}`(400)と、非 JSON 応答、reject で | 1 つめは `code`・`status`・`fields` を保持。残りは `code:"network"` |
| CMN-T-38 | サニタイズの非破壊 | 本文 `"<script>alert(1)</script>"` を `v.string` で parse | `<script>...` が**そのまま**返る(入力時に加工しない。出力側のエスケープが責務) |
| CMN-T-39 | 既存 API の無影響 | `/api/v2/user`、`/api/v2/spots` の GET と、`POST /api/demo/reset` の後の再 GET | 既存の応答が変わらない(既存ストアを変更していない) |
| CMN-T-40 | ビルドの動的扱い | `npm run build` の出力 | `/api/demo/*` が動的ルート(ビルド時に事前生成されない)。型エラー・lint エラーなし [要確認: `cacheComponents` 下の表示形式] |
| CMN-T-46 | フック | `registerHook("afterClockChange","a",f1)` を 2 回、例外を投げる f2 を key `"b"`、f3 を key `"c"` で登録して `runHooks("afterClockChange")` | f1 は 1 回だけ実行、f3 も実行され、f2 の例外が再 throw される |
| CMN-T-47 | ApiResult の識別 | handler が `{ id: "jr-001", status: "pending" }`(DTO)を返す | 200 で本文がその DTO。`status` 項目を HTTP ステータスとして扱わない |

(CMN-T-41〜45 は手動確認のため第 9.3 に置く。)

### 9.3 手動確認(スマホ幅・表示)
| ID | 確認 | 期待 |
|---|---|---|
| CMN-T-41 | DemoBar の表示(幅 360px) | 「モック」バッジ、現在ユーザー、日付が 1〜2 行に収まり横スクロールなし。操作は 44px 以上のタップ領域 |
| CMN-T-42 | ユーザー切替 | 切替後に再読み込みされ、同じ画面の内容が視点に応じて変わる(例: g-001 で幹事ボタンの有無) |
| CMN-T-43 | 日付を進める → リセット | 日付表示が進み、リセットで初期日付に戻る。確認ダイアログが出る |
| CMN-T-44 | ErrorNotice | 400/404/409/500/ネットワーク断それぞれで、原因と次の行動が表示され、色だけに依存しない(スクリーンリーダーで `alert` として読まれる) |
| CMN-T-45 | StatusBadge | 全状態のラベル・色が第 3.2 の表と一致。未知の値でも例外にならず、値をそのまま灰色で表示する |

## 10. 依存するモジュール・利用ライブラリ

### 10.1 依存するモジュール
- 自前モジュールへの依存: なし(最下層)。上位モジュールの処理は `hooks.ts` の登録機構で呼ぶ(第 5.8)。例外として `api-route.ts` と `src/test/setup.ts` が `features/bootstrap.ts` を import する。
- 呼ばれる側: 全モジュール(第 14 章)。

### 10.2 利用ライブラリ・モジュール
採否は本節で確定する(推奨案。変更は本書の改訂で行う)。既存の依存は `app/package.json` の指定を維持し、新規に追加するものは導入時点の最新の安定版を使う。ライセンスは導入時に `npm ls` と各パッケージの `license` 項目で確認し、OSS 一覧(docs/design/08)に載せる(CMN-TASK-16)。

| 名前 | 種別 | 本モジュールでの用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | 既存 dependency | App Router、Route Handler(`/api/demo/*`、共通ラッパー) | MIT | 16.4.5 を維持 |
| react / react-dom | 既存 dependency | 共通 UI・DemoBar | MIT | 19.3.0 を維持 |
| @mantine/core | 既存 dependency | `Alert`、`Skeleton`、`Badge`、`Select`、`Modal`(初期化の確認ダイアログ)、`Button` | MIT | ^9.7.5 を維持 |
| dayjs | 既存 dependency | クライアントでの日時表示の整形のみ。サーバー側では使わない | MIT | ^1.11.23 を維持 |
| typescript | 既存 devDependency | 型検査(`tsc --noEmit`) | Apache-2.0 | ^5 を維持 |
| eslint / eslint-config-next | 既存 devDependency | lint。`react/no-danger` は eslint-config-next が導入する eslint-plugin-react の規則、`no-restricted-properties`・`no-restricted-syntax` は ESLint 本体の規則 | MIT | ^9 / 16.4.5 を維持。eslint-plugin-react は直接追加しない |
| @types/node | 既存 devDependency | Node 標準モジュールの型 | MIT | ^20 を維持 |
| vitest | 新規 devDependency | 単体・結合試験(第 9 章) | MIT | 最新の安定版を使う |
| node:crypto | Node 標準 | `randomBytes`(`newToken`、`requestId`) | Node.js に同梱 | 実行環境の Node.js に従う |
| node:fs / node:path | Node 標準 | 任意の JSON 永続化(CMN-TASK-15)のみ | Node.js に同梱 | 同上 |
| Web 標準 API | 実行環境 | `Request`・`Response`・`URL`・`URLSearchParams`、`structuredClone`(`tx` の巻き戻し)、`TextEncoder`(本文のバイト数)、`String.prototype.normalize`(NFC)、`fetch`(クライアント) | - | Node.js 20.9 以上(Next.js 16 の要件。[事実] package-lock.json の engines)とブラウザに従う |

自前で実装するもの:

| 対象 | ファイル | 理由 |
|---|---|---|
| 検証 DSL `v` | `validation.ts` | 必要な型が少なく、zod 等の直接依存と OSS 一覧の項目を増やさないため(第 5.10) |
| Cookie の解析 | `current-user.ts` | 読むのは `demoUser` の 1 キーだけで、数行で書けるため |
| 日時ヘルパー | `datetime.ts` | JST(+09:00 固定、夏時間なし)だけを扱うため、Date 演算で足りるため |
| Crockford Base32 | `ids.ts` | 数行の変換で済むため |
| ストア・トランザクション・時計・フック | `groups-store.ts` ほか | 既存 `server-store.ts` と同じ globalThis 方式で、デモ規模ではライブラリが不要なため |

採らないもの:

| 名前 | 理由 |
|---|---|
| zod | 自前の `v` で足りるため。[事実] package-lock.json には間接依存として zod 4.6.7 が入っているが、直接依存ではないため import しない |
| Zustand(既存 dependency) | 本モジュールはクライアント側の共有状態を持たないため使わない(他モジュールでの利用は妨げない) |
| SQLite(better-sqlite3 等) | ネイティブ依存とライセンス確認の工数が競技規模に対して大きいため。既定は永続化なし(第 5.1) |
| jsdom、@testing-library/react | コンポーネントは手動で確認し(第 9.3)、自動試験はデモ範囲外とするため |
| node:test + tsx | 試験ツールは Vitest に統一するため |
| Cookie 解析・UUID 等の小さなライブラリ | Node 標準と数行の自前実装で足りるため |

## 11. 未決事項
| 項目 | 内容 | 暫定 |
|---|---|---|
| 永続化(03・05 章) | JSON ファイル/SQLite の要否 | 既定は永続化なし。JSON 書き出しは任意機能(CMN-TASK-15)。SQLite は採らない(第 10.2) |
| 利用者識別(05 章) | ダミーユーザー ID で足りるか | 足りるとして進める。キャンペーン横断はスコープ外 [案] |
| DEMO_TOOLS の既定 | production でデモ用 API を有効にするか | 既定で有効。09 章の起動方式(`next start` 標準か)が決まったら再検討 |
| デモの現在日 | `meta.demoNow` の値 | 2026-11-09 [推定]。デモ実施日が決まったら更新 |
| i18n(02 章) | 多言語の要否 | 日本語のみ。文言は `messages.ts` に集約 [案] |
| 18〜19 歳の年代帯 | `AgeBand` に含まれない | `20s` に含めるか専用帯を作るか [未決。09・docs/design 07 と整合] |
| 未成年ユーザーの seed | u-008(under18)を置くか | 試験用に置く [案] |
| 通知の種類 | `NotificationType` の確定 | 10 が確定。05 章の種類 + 周辺で暫定 |

検証ライブラリ(自前/zod)とテストツール(Vitest/node:test)は第 10.2 で確定したため本表から除いた。

## 12. 実装メモ(デモ範囲)
- 最小(デモ必須): 型・エラー・ID・日時(TASK-01〜02)、検証(03)、ストアと seed(04〜05)、clock(06)、現在ユーザーと権限(07)、ラッパーとデモ API(08〜09)、クライアント(10)、DemoBar と ErrorNotice/StatusBadge(11)。
- 余力: 永続化(15)。jsdom によるコンポーネントの自動試験は行わない(第 10.2)。
- 注意: (a) Next.js のドキュメント(`node_modules/next/dist/docs/`)の Route Handler・キャッシュ・Cookie の節を、`npm ci` 後に TASK-08 の着手前に読む。(b) `tx` 内で `await` しない規約を各モジュールのレビュー観点に入れる。(c) seed の状態は 04 の `evaluate` と整合させる(seed を書き換えたら CMN-T-34 と 04 の整合試験を通す)。

## 13. 実装タスク(順序つき)
規模: S=半日以下、M=1 日程度、L=2 日以上。**マイルストーン G0 は他モジュールの着手条件**。

| ID | タスク | 規模 | 前提 | 完了条件 |
|---|---|---|---|---|
| CMN-TASK-01 | 骨組み: `groups-types.ts`(第 4.2 全型)、`errors.ts`(AppError・ヘルパー・toResponse)、`ids.ts`(接頭辞表・`newId`/`isId`/`newToken` の署名)、`limits.ts` を実装し、他の公開関数は署名のみのスタブ(`throw new Error("not implemented")`)で置く | S | なし | `npx tsc --noEmit` が通る。**G0: これをマージすれば他モジュールが型と署名に対して実装できる** |
| CMN-TASK-02 | `datetime.ts`(`toJstIso`、`jstDate`、`addDays`、`daysBetween`、`isDateStr`、`parseIso`)。依存なしの Date 演算 | S | 01 | CMN-T-33 |
| CMN-TASK-03 | `validation.ts`(`v`、`parse`、`safeParse`、`sanitizeText`)と `messages.ts` | M | 01、02 | CMN-T-01〜10、38 |
| CMN-TASK-04 | `groups-store.ts`(globalThis、Repo、`tx`、`resetStore`、counters)と `group-seed.ts`(`parseSeed`)。空の seed(users 1 件のみ)で先に動かす | M | 01、02、03 | CMN-T-16〜21 |
| CMN-TASK-05 | `group-seed.json` を第 4.4 のとおり作成(9 ユーザー、12 グループ、関連レコード) | M | 04(スキーマ)。04 の本体と並行可 | CMN-T-34、35。**G1 の一部** |
| CMN-TASK-06 | `clock.ts` | S | 02、04(demoNow) | CMN-T-25、26、28 |
| CMN-TASK-07 | `current-user.ts` と `authz.ts` | S | 04 | CMN-T-22、30 |
| CMN-TASK-14 | `hooks.ts` と `features/bootstrap.ts` | S | 04 | CMN-T-46 |
| CMN-TASK-12 | テスト基盤: `vitest`(最新の安定版)を devDependency に追加、`vitest.config.ts`、`npm test`/`test:watch`、`test/setup.ts`・`helpers.ts`・`fixtures.ts` | M | 04 | 試験が 0 件でも `npm test` が成功する。`resetForTest`/`callRoute` が使える。**G1: ここまでで他モジュールが試験を書ける** |
| CMN-TASK-08 | `api-route.ts`(`route`、`ok/created/noContent`、入口検査、`c.id/body/query`)と `query.ts`(ページ・ソート) | M | 03、04、07、14 | CMN-T-11〜15、31、32、47 |
| CMN-TASK-09 | デモ API 4 本(`/api/demo/me` `users` `clock` `reset`)と `DEMO_TOOLS` | S | 06、07、08 | CMN-T-23、24、27、29、39 |
| CMN-TASK-10 | `groups-api.ts`(`gapi`・`ApiError`・`useGroupsApi`・`useCurrentUser`) | S | 01 | CMN-T-37 |
| CMN-TASK-11 | 共通 UI(`ErrorNotice`、`LoadingBlock`、`StatusBadge`、`MockBadge`、`useFormErrors`、`DemoBar`)と `AppShell` への DemoBar 差し込み(既存ファイルの変更は 1 箇所) | M | 09、10 | CMN-T-41〜45。**G2: HTTP・クライアント・共通 UI が揃い、他モジュールの画面が作れる** |
| CMN-TASK-13 | 共通基盤の単体試験の仕上げ(上表のうち未実装の CMN-T) | M | 02〜11 | `npm test` がすべて成功する |
| CMN-TASK-15 | (任意)JSON 永続化(`GROUPS_PERSIST=file`、`.data/` を `app/.gitignore` に追加、`resetStore` で削除) | S | 04 | 再起動後にデータが残る手動確認。無効時の挙動が変わらない |
| CMN-TASK-16 | OSS 一覧(docs/design/08)に Vitest 等を追記する依頼メモ、README に起動・試験コマンドを追記する依頼メモを窓口へ(docs の編集は窓口/担当が行う) | S | 12 | メモが提出される |
| CMN-TASK-17 | 品質ゲート: eslint に `react/no-danger`(error)と `Date.now`・引数なし `new Date()` の警告規則、`tsc --noEmit`、`npm run build`、CMN-T-36、40 | S | 全体 | lint・型・build が通る |

実装順序の全体像(他モジュールの着手に必要な順):
1. **TASK-01 を最初にマージ(G0)**。以降、各モジュールは型・署名に対して service と試験(スタブの上)を書き始められる。
2. 02(日時)→ 03(検証)→ 04(ストア+空 seed)の順に進め、04 の後に 06(clock)、07、14、12(テスト基盤)を並行で進める。→ **G1: service 層の実装と単体試験が可能**(ストア部分が動く)。
3. 05(本 seed)を 04 と並行で用意。G1 までに最小 seed(u-001〜u-004、g-001〜g-003)を先に入れ、完成版で置き換える。
4. 08(ラッパー)→ 09(デモ API)→ 11(共通 UI)。10(クライアント)は 01 の後いつでも着手でき、11 の前に終える。→ **G2: Route Handler と画面の実装が可能**。
5. 13・17 で仕上げ。15 は余力。
- 目安の工数: S×10 + M×7。S を 0.5 日、M を 1 日とすると約 12 人日(任意の 15 を除くと約 11.5 人日)。直列の必須経路は 01 → 02 → 03 → 04 → 07 → 08 → 09(約 5 日)で、G2(11 まで)は約 6 日。

## 14. 他モジュールとの契約(呼ばれる関数・使い方)
本書の署名が正。各モジュールの骨子と名前を合わせた箇所を ◎ で示す。

| 区分 | 名称 | 使うモジュール |
|---|---|---|
| ストア | `db()`、`tx(fn)`、`resetStore()`、`newId(prefix)` ◎(README の `store()`/`resetStore()`/`newId` に対応。`store()` は `db()` に改称) | 全 service |
| 現在ユーザー | `currentUser(req)` ◎、`c.user`(ラッパー経由) | 全 Route Handler |
| 時計 | `clock.now()` ◎、`clock.today()`、`clock.nowIso()`、`clock.set(iso)` ◎、`clock.advanceDays(n)` | 04(締切評価、「締切を進める」)、10(通知の日時)、06(送信日時)、各 `createdAt`/`updatedAt` |
| 検証 | `v.*`、`parse(schema, input)` ◎(README の `validate(schema, input)` に対応)、`sanitizeText` | 全 Route Handler・service |
| エラー | `AppError`、`invalidInput`、`forbidden`、`notFound`、`conflict`、`unavailableState`、`blocked`、`toResponse(e)` ◎ | 全モジュール(09 の `requireVerified` ◎ 等) |
| ラッパー | `route()`、`ok`/`created`/`noContent` | 全 Route Handler |
| 権限 | `isMember`、`isOrganizer`(01 の骨子と同名。01 は再エクスポート)、`requireMember`、`requireOrganizer`、`requireGroup`、`requireRole` | 全モジュール |
| ページ・ソート | `parsePage`、`paginate`、`parseSort`、`sortBy`、`Page<T>` | 02(一覧)、10(通知一覧)、06(チャット履歴)、12 |
| 日時 | `addDays`、`daysBetween`、`toJstIso`、`jstDate`、`isDateStr`、`parseIso`(第 5.11) | 04(辞退期間)、01(日程検証)、12 |
| フック | `registerHook("afterClockChange" \| "afterReset", key, fn)`、`features/bootstrap.ts` への 1 行追記 | 04(`evaluateAll`)、必要なら 10 |
| クライアント | `gapi`、`gpost`、`gpatch`、`gdelete`、`ApiError`、`useGroupsApi`、`useCurrentUser` | 全画面 |
| 共通 UI | `ErrorNotice`、`LoadingBlock`、`StatusBadge`、`MockBadge`、`useFormErrors` | 全画面 |
| テスト | `resetForTest`、`callRoute`、`asUser`、`insertGroup`、`insertMember`、`fixtures` | 全モジュールの試験 |

本モジュールが**呼ぶ**もの: なし(上位への依存は `hooks.ts` の登録機構で逆転)。

変更手続き: 型・署名の変更は (1) 本書の該当箇所を更新、(2) `groups-types.ts` を変更、(3) 影響する他モジュール担当へ窓口経由で連絡、の順。任意項目の追加は 3 のみ省略可。

## 15. 他モジュールへの要望(他ファイルは編集していない)
| ID | 宛先 | 要望 |
|---|---|---|
| R-01-1 | 01 | `isMember`/`isOrganizer` は 00 の `authz.ts` を再エクスポートする(重複実装しない)。`addMember`/`leaveGroup` で `GroupMember` の不変条件(第 4.2)を満たす。`Group.inviteCode` を DTO に出さない |
| R-01-2 | 01 | 作成 API の本文スキーマに `isOfficial`、`state`、`organizerId` を含めない(幹事は `c.user`)。含めても `v.object` が捨てる |
| R-02-1 | 02 | 一覧は `parsePage`/`parseSort`/`paginate`/`sortBy` を使い、応答を `Page<T>` に合わせる。許可キーは各自で決める |
| R-04-1 | 04 | seed の各グループ状態(第 4.4 表)が `evaluate` で変化しないこと、または変化する場合の期待を 04 の試験で保証する。`evaluateAll()` を用意し、`registerHook("afterClockChange", "lifecycle", evaluateAll)` を `features/groups/lifecycle/register.ts` で呼び、`bootstrap.ts` に 1 行追記する。状態ラベル(第 3.2 の表)に増減があれば 00 へ連絡 |
| R-04-2 | 04 | `GroupState`・`CancelReason` の最終名称を docs/design 反映後に確定し 00 の型へ反映依頼。`withdrawalEndsOn` の設定責務は 04 |
| R-09-1 | 09 | `checkText(text, field)` は例外ではなく結果を返す形で、呼び出し側が `invalidInput({[field]: reason})` に変換できること(00 の検証は禁止語を含まない)。`visibleProfile` が `DemoUser.visibility` を使う。`Verification` の初期値は seed(第 4.4)に合わせる |
| R-10-1 | 10 | `NotificationType` の確定(第 4.2 は暫定)。通知の `vars` にユーザー入力を入れない。一覧は `Page<Notification>` |
| R-03-1 | 03 | `JoinRequest` の `status` 遷移と `minAccepted` の扱いを確定し、変更があれば 00 の型へ反映依頼。`blocked`/`unavailable_state` の `detail.allowedActions` を付ける |
| R-ALL-1 | 全モジュール | (a) Route Handler は `route()` を使い、service は同期・フレームワーク非依存にする。(b) 変更は `tx` 内で完結し `await` しない。(c) 時刻は `clock` のみ。(d) ユーザーは `c.user`。本文の `userId` を権限に使わない。(e) 日時は `IsoDateTime`/`DateStr`。(f) メッセージは `features/<m>/messages.ts`。(g) 上限は `LIMITS` を既定にする。(h) API 応答に内部エンティティを直接返さず DTO を作る。(i) 試験は `fixtures.ts` の ID 定数と `resetForTest` を使う |
| R-ALL-2 | 全モジュール | Store に collection を足す場合は 00 の担当へ連絡(型・seed・Repo の 3 点をそろえる) |

## 16. 設計上の確認事項(docs/design・README・他骨子との差異。本書では直さず記録)
1. **デモ用 API のパス**: README・00 骨子は `POST /api/groups/_reset`。Next.js App Router では `_` で始まるフォルダはプライベートフォルダ(ルーティング対象外)になるため、`/api/demo/reset` ほかに変更した。 [要確認: Next.js ドキュメント(node_modules 無しで未確認)。README 4.1・00 骨子の更新が必要]
2. **Route Handler の構成**: README 4.1 は `api/groups/[...path]/route.ts`(キャッチオール)。本書はリソースごとの `route.ts` を推奨(並行実装の競合回避)。README の更新が必要。
3. **`DEMO_TOOLS` の扱い**: 00 骨子の「production では `clock.set`/`_reset` を無効化または明示」を、「既定で有効、環境変数 `DEMO_TOOLS=off` で無効、画面で常時『モック』明示」に変更。09 章の起動方式(`next start` を標準にするか)が決まるまで暫定。
4. **エラー本文の `message`**: README 4.3 は `message?`(任意)。本書は常に付ける。既存 `/api/v2` は `{error}` のみで別系統。
5. **`store()` の名称**: README・骨子は `store()`。本書は Repo を返す `db()` に変更し、「生の Store オブジェクト」は公開しない(直接変更による不変条件違反を防ぐ)。
6. **`validate(schema, input)`**: README・骨子の名称に対し、本書は `parse(schema, input)`(失敗時 `AppError`)と `safeParse`。名称のみの差。
7. **締切の型**: 05 章は「締切(日付)」、04 骨子は「締切日時」。本書は `DateStr`(日付。当日末まで有効)とした。docs/design/05 に合わせる。時刻まで必要なら `IsoDateTime` へ変更(04 と協議)。
8. **状態名**: 05 章の日本語の状態名を英語識別子にした(recruiting/minReached/withdrawalPeriod/confirmed/inProgress/completed/cancelled)。04 骨子の暫定の状態図は「募集中/実行確定/中止」のみで、05 章の 7 状態と粒度が異なる。正は docs/design/05 と 04 で確定。
9. **年代帯**: 07 章は「20代、30代」等の例のみ。18〜19 歳、「60代以上」の帯の定義(既存 seed.json の user は「60代以上」)を `AgeBand` に反映した(`20s` の下限と `under18`)。確定は 07 章・12 章 #16。
10. **辞退と退会の区別**: 05 章は未決。`MemberStatus` に `left`/`withdrawn` の両方を持たせた暫定。
11. **ID 形式**: README 4.4 は `^[a-z0-9-]{1,40}$`。本書はより狭い接頭辞+連番形式。招待コードは別形式。
12. **既存 `api.ts` との差**: 既存 `api()` は `message`/`fields` を保持しない。新規 `groups-api.ts` を作る方針(既存は変更しない)。
13. **`cacheComponents: true`**: `next.config.ts` に有効。Route Handler の動的扱い、サーバーコンポーネントでの時刻・Cookie 参照の制約は Next.js 16 のドキュメント確認が必要 [要確認]。本書は「ラッパーが最初に `req.headers` を読む」「画面は API 取得」で回避する前提。
14. **docs/design/08(OSS 一覧)**: Vitest(devDependency)の追加で一覧の更新が必要。現時点で 08 章は「一覧未作成」。本モジュールの利用ライブラリは第 10.2。
15. **本人確認と seed の整合**: u-004 は `unverified` だが、seed では g-001 への申請中(pending)、g-006・g-007 の幹事、g-005・g-011 のメンバーである。09 が本人確認(モック)を申請・作成・参加の条件にする場合、seed はその条件を満たさない。09 の決定に合わせて、u-004 の申請・幹事の扱いか verifications の値を調整する。
