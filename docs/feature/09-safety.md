# 09 安全(公開範囲・通報・ブロック・禁止表現・本人確認モック)

状態の凡例: [事実]/[推定]/[決定]/[案]/[未決]/[要確認]。docs/design と矛盾する場合は docs/design を正とする。本書の ID 接頭辞は `SAF`(SAF-FN=関数、SAF-API=API、SAF-RULE=規則、SAF-UI=画面、SAF-TASK=実装タスク、SAF-T=機能試験、SAF-SEC=セキュリティ試験、SAF-REQ=他モジュールへの要望、SAF-CHK=設計上の確認事項、SAF-Q=未決)。

> 本書の規制・年齢・個人情報に関する記述は、公開資料(docs/ideas/ideas.md 7.5)と一般的な理解に基づく安全側の暫定方針であり、法的判断ではない。競技中は警察署(生活安全課)・弁護士への確認ができない(12 章 #2 は未決)。実運用に進む場合は、警察庁の解釈基準での裏取りと専門家への確認を必須とする。 [要確認]

## 1. 概要と責務 / 対応する柱

- 柱5(プロフィール公開範囲)、6(通報・ブロック)、7(本人確認・18歳確認のモック)、8(禁止表現・性別絞り込みの禁止)を実装し、他モジュールが呼ぶガード関数を提供する。加えて、出力のサニタイズ・認可漏れ(IDOR)防止などセキュリティ共通部品(第10章)を持つ。第10章は全モジュール共通のセキュリティ方針の正とする(適用範囲は 10.0)。 [案]
- 本モジュールは 00(共通基盤)にだけ依存する。01〜03、05〜07、10、12 から呼ばれる(README 依存図の点線)。本モジュールは他の機能モジュール(01 等)の関数を import しない。グループやメンバーは 00 のストアを直接読む(循環依存の回避)。00 も 09 を import しない。要求の検査・サニタイズ・ID 形式の検査は 00 が実装し、09 はその要件と試験を持つ(10.1)。 [案]
- 規制方針(12 #2)、本人確認の水準(#3)、未成年の扱い(#10)、通報・ブロックのグループ側の挙動(#8)、公開粒度(#16)は未決。本書は暫定案を `SAFETY_POLICY` 定数(4.4)に集約し、決定後は定数と該当節の差し替えで追従できる構造にする。 [案]
- デモの優先度: 禁止表現・公開範囲が S、通報・ブロック・本人確認モックが A(README 2 章)。

## 2. 既存機能との関係

- 新規(利用者間の関係に関する機能は既存になし)。既存 `server-store.ts`・`/api/v2` は変更しない。 [案]
- 流用: 00 の `db()`・`tx`(ストア)、`newId`・`isId`、`currentUser(req)`、`AppError`、`clock.now()`、`route()`(Route Handler ラッパー)、`v`・`sanitizeText`(検証)、`registerHook`。
- 競技はログイン不要のため、利用者識別は 00 の Cookie `demoUser`(ダミーユーザー切替)。これは認証ではなくデモ用の視点切替である。改ざん可能であることを前提に、サーバー側のガード(第6〜10章)を毎回通す。 [案]

## 3. ファイル構成(実装時に作るもの。すべて新規)

```
app/src/features/safety/
  types.ts                   型・列挙(第4章)
  policy.ts                  SAFETY_POLICY 定数、FIELD_POLICY、RATE_LIMITS
  messages.ts                画面文言(拒否理由、通報理由ラベル、確認手順)
  visibility/
    profile.ts               resolveProfileRelation / maskProfile / visibleProfile / getMyProfile / updateProfile
    group.ts                 getGroupRole / maskGroup / isGroupVisibleTo
    summary.ts               memberSummary / suppressSmallCell
  blocks/
    block-service.ts         blockUser / unblockUser / listBlocks / isBlocked / isBlockedByMe / hasBlockAmong / assertNotBlocked / filterVisibleMessages
  reports/
    report-service.ts        createReport / listMyReports
  text/
    normalize.ts             normalizeForCheck
    dictionary.json          禁止表現の辞書(実語彙は実装時にレビューのうえ作成。本書には書かない)
    dictionary.test.json     試験用のダミー語(明らかに架空の語のみ)
    check-text.ts            checkText / assertTextAllowed
    contexts.ts              TextContext と適用表(8.5)
  verification/
    verification-service.ts  getVerification / setMockVerification / requireVerified
  guards/
    access.ts                assertGroupAccess / assertInGroup(assertSafeRequest の処理は 00 の route() が実装。10.5)
    input.ts                 isSafeId / rejectProhibitedParams(sanitizeText は 00 の lib/validation.ts を使う)
    rate-limit.ts            checkRate
  components/                画面部品(第12章)
  __tests__/                 単体試験(第16章)
app/src/app/api/groups/me/profile/route.ts                   SAF-API-01、02(00 4.1 の「リソースごとの route.ts」に従う。薄く)
app/src/app/api/groups/users/[userId]/profile/route.ts       SAF-API-03
app/src/app/api/groups/me/blocks/route.ts                    SAF-API-04、05
app/src/app/api/groups/me/blocks/[userId]/unblock/route.ts   SAF-API-06
app/src/app/api/groups/reports/route.ts                      SAF-API-07
app/src/app/api/groups/me/reports/route.ts                   SAF-API-08
app/src/app/api/groups/me/verification/route.ts              SAF-API-09、10
app/src/app/api/demo/reports/route.ts                        SAF-API-12(demoOnly)
app/src/app/[campaign]/mypage/profile/page.tsx        プロフィール編集(公開範囲)
app/src/app/[campaign]/mypage/blocks/page.tsx         ブロック一覧
app/src/app/[campaign]/mypage/verification/page.tsx   本人確認・18歳確認(モック)
app/src/data/group-seed.json                          Profile・Verification・Block・Report の初期値を追記(00 管理。手書きダミー)
app/scripts/scan-banned.mjs                           禁止表現の混入走査(seed・messages・UI 文言)
app/scripts/check-no-gender.mjs                       性別項目の静的検査
```

- [要確認] `app/node_modules` が無く Next.js 16 のドキュメント(`app/node_modules/next/dist/docs/`)を未確認。Route Handler の `cookies()`/`headers()` が非同期か、`params` が Promise か、ヘッダー設定の記法、静的セグメント(`me`、`users`、`reports`)が動的セグメント `[groupId]` より優先されることは実装前に確認する(既存コードでは `params` が Promise)。

### 3.1 利用ライブラリ・モジュール

新規に追加する依存はない(試験用の Vitest は 00 が追加する)。ライセンスは各パッケージの package.json の記載。実装時に `npm ls` で確認し、docs/design/08 の一覧に載せる(00 の CMN-TASK-16)。 [案]

| 名前 | 種別 | 本モジュールでの用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| next | フレームワーク | Route Handler(SAF-API)、App Router のページ(12 章)、`next.config.ts` の `headers()`(SAF-REQ-07) | MIT | 16.4.5 を維持(app/package.json) |
| react / react-dom | UI | 画面部品。既定のテキストエスケープを XSS 対策の前提にする(10.2) | MIT | 19.3.0 を維持 |
| @mantine/core | UI 部品 | Modal(通報・ブロック確認)、Radio、Checkbox、Tabs、TextInput、Textarea、MultiSelect、Alert、Badge | MIT | ^9.7.5 を維持 |
| @mantine/hooks | UI 部品 | `useDebouncedValue`(`useTextCheck` の 400ms デバウンス) | MIT | ^9.7.5 を維持 |
| @tabler/icons-react | アイコン | 拒否・警告表示のアイコン(色だけで伝えない、12.3) | MIT | ^3.51.0 を維持 |
| dayjs | 日時表示 | ブロック一覧・通報一覧の日時を JST で表示 | MIT | ^1.11.23 を維持 |
| typescript | 言語 | 型定義(第4章)、`tsc --noEmit` | Apache-2.0 | ^5 を維持 |
| eslint / eslint-config-next | 静的検査 | `react/no-danger` による `dangerouslySetInnerHTML` の検出(SAF-RULE-30)。ルールは eslint-config-next が含む eslint-plugin-react のもの [要確認] | MIT | ^9 / 16.4.5 を維持 |
| vitest | 試験(devDependency) | 単体試験(第16章)。00 が導入(00 9.1) | MIT | 00 が追加する。最新の安定版を使う |
| Node 標準モジュール | 実行環境 | `node:fs/promises`・`node:path`・`node:url`・`node:process`(`scan-banned.mjs`、`check-no-gender.mjs` のファイル走査と終了コード) | Node.js(MIT) | 実行環境の Node.js に従う |
| ECMAScript・Web 標準の組み込み | 実行環境 | `String.prototype.normalize`(NFC・NFKC)、`RegExp` の `u` フラグと Unicode プロパティ(`\p{P}`、`\p{S}`)、`Map`(レート制限)、`Request`・`Response`・`URL`・`URLSearchParams` | -(組み込み) | - |
| 00 共通基盤(自前) | 自前モジュール | `lib/errors.ts`(AppError)、`lib/validation.ts`(`v`、`sanitizeText`)、`lib/ids.ts`(`newId`、`isId`)、`lib/groups-store.ts`(`db`、`tx`、`resetStore`)、`lib/clock.ts`、`lib/current-user.ts`、`lib/api-route.ts`(`route`)、`lib/authz.ts`、`lib/hooks.ts`、`lib/groups-api.ts`、`components/groups/common/MockBadge.tsx` | - | 00 の設計に従う |

自前実装にするもの(ライブラリを使わない理由):

| 対象 | 方針 | 理由 |
|---|---|---|
| 禁止表現の辞書・正規化・検査(第8章) | 自前 | 日本語の正規化(カナ・全角・区切り)と文脈ごとの適用表が要件であり、既存の禁止語リスト系ライブラリは語彙の出所とライセンスの確認が必要なため |
| レート制限(10.6) | 自前(globalThis の Map) | 単一プロセス・インメモリのデモであり、外部ストアを前提とするライブラリは不要なため |
| CSRF 対策(10.5) | 自前(00 の `route()` で Origin・Content-Type を検査) | トークン方式のライブラリはセッション認証を前提とし、ログイン不要のデモに合わないため |
| HTML サニタイズ(DOMPurify 等) | 使わない | HTML を描画せず、表示は常にテキストノードのため(SAF-RULE-30〜32) |
| 入力検証(zod 等) | 使わない | 00 の自前の `v` に統一するため(00 5.10) |
| セキュリティヘッダー(helmet 等) | 使わない | Next.js の `headers()` で設定できるため |

## 4. データ・型(05 章)

### 4.1 エンティティと保存先

| エンティティ | 保存先 | 備考 |
|---|---|---|
| Profile | `Store.profiles[userId]`(初期値は group-seed.json) | 実名・連絡先はダミー文字列。API から編集不可 |
| Block | `Store.blocks` | 双方向に効かせるが記録は一方向(7.2) |
| Report | `Store.reports` | 通報は受付の記録のみ。相手・グループへ通知しない |
| Verification | `Store.verifications[userId]` | 確認結果のみ。書類・生年月日は保持しない |
| RateBucket | globalThis 上の Map(Store 外) | 00 の `registerHook("afterReset", "safety", resetRateBuckets)` で `resetStore()` の後に初期化する(00 5.8。`features/bootstrap.ts` に 1 行追記) |

[要確認] 00 の骨子は DemoUser に「公開設定の初期値」を持たせ、Store に profiles を持たない。本書は Profile を 09 の所有とし `Store.profiles` を追加する案(SAF-REQ-01)。

### 4.2 型定義(`types.ts`)

```ts
// 年代帯(性別・細かい年齢は型に存在しない)。18歳未満の帯は型に置かず、作成・申請は requireVerified(9.2)で拒否する。
export type AgeBand = "18-19" | "20s" | "30s" | "40s" | "50s" | "60s" | "70s+";
export type TravelPurpose = "sightseeing" | "food" | "nature" | "history" | "photo" | "relax" | "stamp_rally";

export type ProfileFieldKey = "displayName" | "ageBand" | "bio" | "travelPurposes" | "realName" | "contact";
// 公開レベル。public → reviewer → members → self の順に見える範囲が狭くなる(比較は 4.4 の VISIBILITY_RANK)。
export type Visibility = "public" | "reviewer" | "members" | "self";

export interface Profile {
  userId: string;
  displayName: string;                  // 1〜20 文字
  ageBand: AgeBand;
  bio: string;                          // 0〜200 文字(ひとこと)
  travelPurposes: TravelPurpose[];      // 0〜3 件、重複なし
  realName: string | null;              // ダミー文字列。seed のみ。API で編集しない
  contact: string | null;               // ダミー(例「連絡手段メモ(ダミー)」)。seed のみ
  visibility: Record<ProfileFieldKey, Visibility>;
}

// 閲覧者と対象ユーザーの関係(プロフィール用)
export type ProfileRelation = "self" | "stranger" | "reviewer" | "groupmate";
// 閲覧者とグループの関係(グループ用)
export type GroupViewerRole = "organizer" | "member" | "applicant" | "outsider";

export type PublicProfile = Partial<Pick<Profile, "displayName" | "ageBand" | "bio" | "travelPurposes" | "realName" | "contact">> & {
  userId: string;
  displayName: string;                  // displayName だけは常に含む
};

export type AgeBucket = "20s-" | "30-40s" | "50-60s" | "70s+";
export interface MemberSummary {
  count: number;                        // 参加中の人数(幹事を含む)
  buckets: AgeBucket[] | null;          // 年代帯のまとまり(人数は持たない)。非表示のとき null
  hiddenReason: "few_members" | null;
}

export type ReportTargetType = "user" | "group" | "message" | "join_request" | "text_check";
export type ReportReason =
  | "contact_solicitation"   // 外部連絡先・別アプリへの誘導
  | "harassment"             // 嫌がらせ・迷惑行為
  | "inappropriate_content"  // 不適切な内容
  | "money_solicitation"     // 金銭・勧誘
  | "off_purpose"            // 旅の目的以外の言動
  | "impersonation"          // なりすまし(公式を装う等)
  | "minor_suspected"        // 18歳未満の疑い
  | "other"
  | "false_positive";        // target=text_check 専用(禁止表現の誤検知の報告)
export type ReportStatus = "received" | "in_review" | "resolved";

export interface Report {
  id: string;                  // newId("rp")
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;            // user/group/message/join_request の ID、text_check は ruleId
  targetUserId: string | null; // 解決した対象ユーザー(未解決なら null)
  groupId: string | null;
  reason: ReportReason;
  body: string;                // 0〜500 文字(sanitizeText 済み。禁止表現検査は通さない: 8.7)
  snapshot: string | null;     // 通報時点の本文の写し(最大 200 文字。message のみ)
  status: ReportStatus;        // デモは "received" のみ
  createdAt: string;           // ISO 8601
}

export interface Block {
  id: string;                  // newId("bl")
  blockerId: string;
  blockedId: string;
  createdAt: string;
  releasedAt: string | null;   // null=有効
  sourceGroupId: string | null;
}

export type VerificationStatus = "unverified" | "verified" | "underage";
export interface Verification {
  userId: string;
  status: VerificationStatus;
  method: "mock_self_declaration";
  confirmedAt: string | null;
}
export type VerifiedAction = "create_group" | "request_join" | "join_by_invite_code";

export type TextContext =
  | "group_name" | "group_description" | "group_tag" | "join_note" | "reject_reason_free"
  | "chat_message" | "plan_note" | "expense_item" | "profile_display_name" | "profile_bio" | "report_body";
export type TextCategory = "romance_hint" | "contact_exchange" | "contact_pattern" | "money_solicit" | "gender_filter" | "age_filter";
export type TextVerdict = "ok" | "deny" | "review";
export interface TextFinding { ruleId: string; category: TextCategory; severity: "deny" | "review"; start: number; end: number; matched: string } // start/end は原文の UTF-16 位置
export interface TextCheckResult { verdict: TextVerdict; findings: TextFinding[]; reason: string | null; suggestion: string | null }
```

### 4.3 検証規則(項目ごと。00 の `v` で実施し、内容の方針は 09 が検査)

| 項目 | 型 | 長さ・範囲 | 追加規則 |
|---|---|---|---|
| displayName | string | 1〜20(00 の `sanitizeText` の後。改行不可) | `profile_display_name` を通す |
| ageBand | AgeBand | 列挙 | 列挙外は invalid_input |
| bio | string | 0〜200 | `profile_bio` を通す。3 行まで(改行文字は 2 個まで) |
| travelPurposes | TravelPurpose[] | 0〜3 件 | 重複不可、列挙のみ |
| visibility.* | Visibility | 列挙 | 項目ごとの許可レベル(6.1、`FIELD_POLICY`)内のみ |
| report.reason | ReportReason | 列挙 | `false_positive` は targetType=text_check のみ。text_check は `false_positive` のみ |
| report.body | string | 0〜500 | 禁止表現の検査なし(引用を許す)。制御文字除去、画面は常にエスケープ |
| report.alsoBlock | boolean | 任意 | 7.1 |
| verification.declare | `"adult" \| "minor" \| "reset"` | 列挙 | - |
| userId / groupId / メッセージ・申請の ID | string | 00 の ID 形式(`isId`。例 `u-001`) | パスの ID は 00 の `c.id`(形式不正は `not_found`)、本文・クエリの ID は `v.id`(形式不正は `invalid_input`) |
| report.targetId | string | targetType ごとの形式 | user=`u`、group=`g`、message=`msg`、join_request=`jr` の 00 の ID 形式。text_check は辞書の ruleId(`^[a-z]{2}-\d{3}$`)。いずれも `isSafeId` を満たす |
| リクエスト本文 | JSON | 最大 64KB | 超過は `payload_too_large`(413。00 の `route()` が判定) |

### 4.4 方針定数(`policy.ts`)。未決事項の差し替え点

```ts
export const SAFETY_POLICY = {
  sameGroupOnBlock: "stay",        // #8: "stay"(案A+C)| "leave"(案B。同一グループに留まれない)
  blockAffectsListAndApply: "symmetric",  // 一覧・申請・プロフィール詳細は双方向に効く
  chatHideScope: "blocked_by_me",  // チャットは自分がブロックした相手の投稿だけ隠す
  notifyTargetOnReport: false,     // 通報・ブロックは相手とグループ他メンバーに通知しない(#8 案C)
  minorPolicy: "deny_writes",      // #10: "deny_writes"(最小案)| "deny_all"
  summaryMinCount: 4,              // メンバー概要で年代帯を出す最少人数(6.4)
  smallCellThreshold: 3,           // 件数がこれ未満なら「少数」(12 へ提供)
  reportBodyMax: 500,
  requestBodyMaxBytes: 65536,      // 00 の LIMITS.BODY_BYTES と同値。判定は 00 の route()
} as const;

// 公開レベルの比較(6.1)。閲覧者の上限ランク以下の項目だけを返す。
export const VISIBILITY_RANK: Record<Visibility, number> = { public: 0, reviewer: 1, members: 2, self: 3 };
export const RELATION_MAX_RANK: Record<ProfileRelation, number> = { stranger: 0, reviewer: 1, groupmate: 2, self: 3 };

export const FIELD_POLICY: Record<ProfileFieldKey, { editable: boolean; allowed: readonly Visibility[]; initial: Visibility }> = {
  displayName:    { editable: true,  allowed: ["public"],                               initial: "public" },
  ageBand:        { editable: true,  allowed: ["reviewer", "members", "self"],           initial: "reviewer" },
  bio:            { editable: true,  allowed: ["public", "reviewer", "members", "self"], initial: "reviewer" },
  travelPurposes: { editable: true,  allowed: ["public", "reviewer", "members", "self"], initial: "reviewer" },
  realName:       { editable: false, allowed: ["members", "self"],                       initial: "self" },   // 値は編集不可。公開レベルは選べる
  contact:        { editable: false, allowed: ["members", "self"],                       initial: "self" },
};

export const RATE_LIMITS = {                       // key = `${name}:${userId}`(+ groupId)
  chat_post:      { limit: 5,  windowMs: 10_000 },
  join_request:   { limit: 5,  windowMs: 600_000 },
  report:         { limit: 10, windowMs: 600_000 },
  block:          { limit: 20, windowMs: 600_000 },
  profile_update: { limit: 10, windowMs: 60_000 },
  group_create:   { limit: 5,  windowMs: 600_000 },
} as const;
```

## 5. 公開インターフェース(ガード関数一覧)

他モジュールが呼ぶ関数の契約。名前・署名は本表を正とする(README・各骨子の名称と対応づけ。差分は第17章)。すべて `features/safety` から import する。例外は 00 の `AppError`。引数 `user` の型は `Readonly<DemoUser>`(00 の `currentUser` の戻り値)。純粋関数は「純」と記す。

| ID | 署名 | 戻り値 / 例外 | 呼び出し元 |
|---|---|---|---|
| SAF-FN-01 | `maskProfile(profile: Profile, relation: ProfileRelation): PublicProfile` | 純。許可項目だけを新規オブジェクトに詰めて返す | 内部、画面のプレビュー |
| SAF-FN-02 | `resolveProfileRelation(viewerId: string, targetId: string, ctx: ProfileContext): ProfileRelation` | 例外 `not_found`(ブロック関係、ctx の関係が成り立たない。SAF-RULE-04) | 内部 |
| SAF-FN-03 | `visibleProfile(viewer: {id: string}, targetId: string, ctx: ProfileContext): PublicProfile` | 例外 `not_found` | 02、03、01 |
| SAF-FN-04 | `getGroupRole(viewerId: string, groupId: string): GroupViewerRole` | ストアを読む。存在しない groupId は `not_found` | 01、02、03、05〜08 |
| SAF-FN-05 | `maskGroup(group: GroupRecord, role: GroupViewerRole, ctx: MaskGroupContext): GroupListItem \| GroupDetailPublicView \| GroupMemberView` | 純。ホワイトリスト構築 | 01、02 |
| SAF-FN-06 | `isGroupVisibleTo(viewerId: string, group: GroupRecord, opts?: {inviteCode?: string}): boolean` | 非公開・ブロック関係を考慮 | 02、01 |
| SAF-FN-07 | `memberSummary(members: ReadonlyArray<{ageBand: AgeBand}>): MemberSummary` | 純 | 02、10、(01) |
| SAF-FN-08 | `suppressSmallCell(n: number, threshold?: number): number \| "少数"` | 純 | 12 |
| SAF-FN-09 | `isBlocked(a: string, b: string): boolean` | 双方向(どちらかの有効な Block があれば true) | 02、03、06、01 |
| SAF-FN-10 | `isBlockedByMe(viewerId: string, otherId: string): boolean` | 一方向(viewer が有効にブロック) | 06 |
| SAF-FN-11 | `hasBlockAmong(viewerId: string, userIds: readonly string[]): boolean` | userIds のいずれかと viewer がブロック関係か | 02(一覧) |
| SAF-FN-12 | `assertNotBlocked(a: string, b: string): void` | 例外 `blocked`(一般文言) | 03、06 |
| SAF-FN-13 | `filterVisibleMessages<T extends {senderId: string}>(viewerId: string, msgs: T[]): T[]` | 自分がブロックした相手の投稿を除く | 06 |
| SAF-FN-14 | `blockUser(user, targetUserId: string, sourceGroupId?: string): {block: Block; created: boolean}` / `unblockUser(user, targetUserId: string): void` / `listBlocks(user): BlockView[]` | `invalid_input`(自分自身)、`not_found`(対象が不在。解除は有効なブロックが無い)、`rate_limited` | API |
| SAF-FN-15 | `createReport(user, input: CreateReportInput): {report: Report; deduplicated: boolean}` / `listMyReports(user): ReportView[]` | `invalid_input`、`not_found`、`rate_limited` | 06(`reportMessage`)、画面 |
| SAF-FN-16 | `checkText(text: string, context: TextContext, opts?: {extraRules?: DictRule[]}): TextCheckResult` | 純(クライアントでも実行可) | 画面のライブ警告、内部 |
| SAF-FN-17 | `assertTextAllowed(text: string, context: TextContext, field: string, opts?: {ackReview?: boolean}): void` | `invalid_input`(`fields[field]`。review で未確認のときは `detail.reviewRequired=true`) | 01、03、05、06、07 |
| SAF-FN-18 | `normalizeForCheck(text: string): Normalized` | 純 | check-text |
| SAF-FN-19 | `requireVerified(userId: string, action: VerifiedAction): void` | `forbidden`(`detail.reason` が `"not_verified"` または `"underage"`) | 01(createGroup)、03(requestJoin、招待コード) |
| SAF-FN-20 | `getVerification(userId: string): Verification` / `setMockVerification(userId: string, declared: "adult" \| "minor" \| "reset"): Verification` | - | API |
| SAF-FN-21 | `sanitizeText(s: string, o?: {multiline?: boolean}): string`(実装は 00 の `lib/validation.ts`) | 純。NFC、改行の統一、制御・ゼロ幅・双方向制御文字の除去、trim(00 5.10)。09 は再定義せず、除去対象の要件(SAF-RULE-35)と試験(SAF-T-41)を持つ | 全入力(00 の `v.string` が自動で通す) |
| SAF-FN-22 | `isSafeId(s: unknown): s is string` | 純。`^[a-z0-9-]{1,40}$`。00 の `isId` を満たす値は必ずこれも満たす。00 の `isId` を使えない値(辞書の ruleId)と、マップの添字に使う前の確認(SAF-RULE-38)に使う | 09 内部(`createReport` 等) |
| SAF-FN-23 | `assertSafeRequest(req: Request): void`(実装は 00 の `route()` の処理。00 5.5 動作 3・7) | `forbidden`(Origin 不一致)、`unsupported_media_type`(415)、`payload_too_large`(413)。09 は要件(10.5)と試験(SAF-SEC-16、17、19、20)を持つ | 00 の Route Handler ラッパー |
| SAF-FN-24 | `checkRate(name: keyof typeof RATE_LIMITS, userId: string, scope?: string): void` | `rate_limited` | 03、06、01、API |
| SAF-FN-25 | `assertGroupAccess(userId: string, groupId: string, need: "view" \| "member" \| "organizer"): GroupRecord` | `not_found`(非公開・不在・ブロック関係)、`forbidden`(判定表は 10.4) | 全グループ系 API |
| SAF-FN-26 | `assertInGroup<T extends {groupId: string}>(item: T \| undefined, groupId: string): T` | `not_found`(他グループの資源) | 05〜08、03 |
| SAF-FN-27 | `rejectProhibitedParams(params: URLSearchParams \| Record<string, unknown>): void` | `invalid_input`(性別・細かい年齢の条件)。00 の `v.object` は未知キーを捨てるため、検証(parse)の前に生のクエリ・本文に対して呼ぶ | 02、全クエリ/ボディ |
| SAF-FN-28 | `getMyProfile(user): MyProfileDto` / `updateProfile(user, patch: ProfilePatch): MyProfileDto` | `invalid_input`、`rate_limited` | API |

補助型:

```ts
export type ProfileContext =
  | { kind: "list" }                                   // 一覧・参加前の詳細(対象は幹事)
  | { kind: "request"; groupId: string }               // 幹事が申請中の申請者を見る
  | { kind: "member"; groupId: string };               // 同じグループのメンバー同士
export interface GroupRecord { /* 01 の Group。09 は下記フィールドだけに依存する */
  id: string; organizerId: string; visibility: "public" | "private"; inviteCode?: string | null;
  // 以下は maskGroup が通すフィールド。01 の最終定義に合わせる [要確認 SAF-CHK-02]
  name: string; destination: string; region: string; dates: { start: string; end: string }; tags: string[];
  capacity: number; minCount?: number; status: string; official: boolean; description?: string;
}
export interface MaskGroupContext {
  now: Date;
  members: ReadonlyArray<{ userId: string; ageBand: AgeBand }>;   // 参加中のみ
  organizerProfile: Profile;
  viewerId: string;
  myRequest?: { id: string; status: "pending" | "approved" | "rejected" | "withdrawn" } | null;
}

export interface Normalized {          // normalizeForCheck の戻り値(8.4)
  plain: string;                       // 手順 1〜4 の結果
  squeezed: string;                    // 手順 5 の結果
  plainMap: number[];                  // plain の各 UTF-16 位置 → 原文の UTF-16 位置
  squeezedMap: number[];               // squeezed の各 UTF-16 位置 → 原文の UTF-16 位置
}
export interface CreateReportInput {
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  body?: string;                       // 0〜500
  groupId?: string;                    // user を通報するときの関係の判定に使う(7.1)
  alsoBlock?: boolean;
}
export interface BlockView { userId: string; displayName: string; createdAt: string }
export interface ReportView { id: string; targetType: ReportTargetType; reason: ReportReason; status: ReportStatus; createdAt: string }
export type ProfilePatch = Partial<Pick<Profile, "displayName" | "ageBand" | "bio" | "travelPurposes">> & {
  visibility?: Partial<Record<ProfileFieldKey, Visibility>>;
};
export interface MyProfileDto {
  profile: Profile;                                          // 本人には全項目を返す
  allowed: Record<ProfileFieldKey, readonly Visibility[]>;   // FIELD_POLICY の許可レベル
  editable: Record<ProfileFieldKey, boolean>;                // 値を編集できるか
}
```

## 6. 公開範囲ガード(柱5、12 #16 の暫定案)

### 6.1 プロフィール項目の公開レベル(`FIELD_POLICY`)

公開レベルは `public`(誰でも)< `reviewer`(幹事が申請を審査するとき)< `members`(承諾後のグループのメンバー)< `self`(本人のみ)。閲覧者の関係ごとに見られるレベルの上限は次のとおり(比較は 4.4 の `VISIBILITY_RANK` と `RELATION_MAX_RANK`)。

| 関係(ProfileRelation) | 意味 | 見られるレベル |
|---|---|---|
| self | 本人 | すべて |
| groupmate | 同じグループの参加中メンバー同士(ctx.kind=member、両者が `active`) | public、reviewer、members |
| reviewer | 幹事が、申請中(pending)の申請者を見る(ctx.kind=request)。承認で groupmate、却下・取り下げで stranger に戻る | public、reviewer |
| stranger | 上記以外(一覧・詳細を見る人、非メンバー、申請者から見た幹事) | public |

| 項目 | 編集 | 許可レベル | 初期値 [案] |
|---|---|---|---|
| displayName | 可 | public 固定 | public |
| ageBand | 可 | reviewer / members / self(public は選べない) | reviewer |
| bio | 可 | public / reviewer / members / self | reviewer |
| travelPurposes | 可 | public / reviewer / members / self | reviewer |
| realName | 値は不可(seed のダミー)。公開レベルは可 | members / self | self |
| contact | 値は不可(seed のダミー)。公開レベルは可 | members / self | self |

- SAF-RULE-01: 初期値は「参加が成立するまで最小限」(12 #10 の案)。承諾前(stranger・reviewer)の応答には realName・contact を含めない(許可レベルが members 以上のため)。 [案]
- SAF-RULE-02: 許可レベルの外の値(例: realName=public)を `updateProfile` に送ると `invalid_input`。
- SAF-RULE-03: `maskProfile` は結果を新規オブジェクトに項目単位で詰める(`{...profile}` や `delete` を使わない)。Profile に項目を追加しても、`FIELD_POLICY` に登録するまでは応答に含まれない。
- SAF-RULE-04: `resolveProfileRelation` は次の順で判定する。
  1. viewerId と targetId が同じなら self。
  2. `isBlocked(viewer, target)` なら `not_found`(ブロックの有無を相手が判別できないようにする)。
  3. ctx.kind=list は stranger(public の項目のみ)。API からは list を指定できない(SAF-API-03)ため、一覧に出ない個人のプロフィールを API で取得することはできない。
  4. ctx.kind=request は、viewer が groupId の参加中の幹事で、target がそのグループに JoinRequest を持つ場合に限る。状態が pending なら reviewer、それ以外(却下・取り下げ・承認後)は stranger。条件を満たさなければ `not_found`。
  5. ctx.kind=member は、viewer と target がともに groupId の参加中メンバーなら groupmate。満たさなければ `not_found`。
- SAF-RULE-05: 性別の項目は Profile にも Group にも存在しない。性別でのフィルタ・表示・並べ替えの API/画面は作らない(8.8 の静的検査)。

### 6.2 グループの閲覧者の役割(`getGroupRole`)

| 役割 | 条件(ストアから判定) |
|---|---|
| organizer | `group.organizerId === viewerId` かつ参加中 |
| member | 参加中メンバー(幹事以外) |
| applicant | 状態 pending の JoinRequest を持つ(承認前)。却下・取り下げ後は outsider(自分の申請結果の表示だけ `myRequest` で返す) |
| outsider | 上記以外。非公開グループは招待コードを提示した場合のみ詳細に到達できる(02 の `findByInviteCode`)。ブロック関係の相手がグループにいる場合は 02 側で一覧から外す |

役割の判定は毎回サーバー側で行い、クライアントの申告(クエリ・ボディの role 等)は使わない。

### 6.3 閲覧者別の返却項目(`maskGroup`)

○=返す、×=返さない、△=条件つき。表にない項目(Group の将来の追加フィールドを含む)は返さない(ホワイトリスト)。

| 項目 | outsider | applicant(承認前) | member | organizer | 備考 |
|---|---|---|---|---|---|
| id、名称、行き先、地方、日程、タグ、公式枠、状態、締切 | ○ | ○ | ○ | ○ | 一覧(`GroupListItem`)の項目 |
| 定員・最少人数・現在人数・空き | ○ | ○ | ○ | ○ | 現在人数は参加中のみ(申請中は数えない) |
| 説明(プラン内容) | ○(詳細のみ) | ○ | ○ | ○ | 一覧には出さない |
| メンバー概要 `memberSummary` | ○ | ○ | ○ | ○ | 6.4 の丸め |
| 幹事の表示名・userId | ○ | ○ | ○ | ○ | userId は通報・ブロックの宛先に必要。幹事のプロフィールは public レベルの項目だけ |
| 幹事のその他のプロフィール項目 | public のみ | public のみ | members まで | - | maskProfile の結果 |
| 自分の申請(状態・ひとこと・同意の日時) | × | ○ | × | × | `myRequest`。他人の申請は返さない |
| メンバー一覧(表示名+項目別 maskProfile) | × | × | ○ | ○ | 各メンバーの公開レベルに従う。他人の userId を含む |
| 申請者一覧(reviewer レベルのプロフィール付き) | × | × | × | ○ | 03。ブロック関係の申請者は含めない |
| 招待コード | × | × | × | ○ | [案] メンバーにも見せるかは 01(#17) |
| 旅程・集合場所メモ、チャット、費用メモ、グループのスタンプ集計 | × | × | ○ | ○ | 各モジュールが `assertGroupAccess(..., "member")` を通す |
| 辞退・退会した人の氏名 | × | × | × | △ | 他の参加者には人数の変化のみ(07 論点16)。幹事は必要最小限 [案] |
| 通報・ブロックの有無 | × | × | × | × | どの役割にも返さない |

返却型(要点のみ。残りの項目は 01 の Group に合わせる):

```ts
export interface GroupListItem {
  id: string; name: string; destination: string; region: string; dates: { start: string; end: string };
  tags: string[]; capacity: number; minCount: number | null; currentCount: number; vacancy: number;
  status: string; deadline: string | null; official: boolean;
  organizer: { userId: string; displayName: string };
  memberSummary: MemberSummary;
}
export interface GroupDetailPublicView extends GroupListItem {
  description: string;
  organizerProfile: PublicProfile;                 // public レベルのみ
  myRequest: { id: string; status: string } | null;
}
export interface GroupMemberView extends GroupDetailPublicView {
  members: Array<{ userId: string; role: "organizer" | "member"; profile: PublicProfile }>;
  inviteCode?: string;                             // organizer のみ
}
```

### 6.4 メンバー概要の丸め規則(`memberSummary`、論点 11・17)

グループの人数は 2〜6 人のため、年代帯の分布は個人を推測させやすい。次の規則で丸める。 [案、12 #16 の確認が要る]

- SAF-RULE-06: 人数(count)は常に返す(参加中、幹事を含む。申請中は数えない)。
- SAF-RULE-07: `count < SAFETY_POLICY.summaryMinCount`(=4)のとき、年代帯は返さない(`buckets=null`、`hiddenReason="few_members"`)。画面は「人数が少ないため年代は表示しません」と出す。
- SAF-RULE-08: `count >= 4` のとき、年代帯を 20 年幅のまとまり(`20s-`=18〜29 歳、`30-40s`、`50-60s`、`70s+`)にして、存在するまとまりだけを昇順で返す。まとまりごとの人数は返さない。例: 30代・40代・50代・50代 → `["30-40s","50-60s"]`。
- SAF-RULE-09: 画面の文言は「20代以下」「30〜40代」「50〜60代」「70代以上」。「同年代」「若い人」等の語は使わない。性別の分布は存在しない。
- SAF-RULE-10: 確定通知(10)の「実際の人数と参加者の概要」も同じ `memberSummary` の出力だけを使う。辞退した人の名前・年代は載せない。
- SAF-RULE-11: 件数の集計(12 の自治体向け)は `suppressSmallCell(n)`: `n < 3` なら文字列 `"少数"`、それ以外は `n`。最小単位は 12 章の未決。
- 既知の制約(デモ範囲外): 人数が 3 から 4 に増えた前後の差分から、追加された人の年代帯を推測できる場合がある(承認時の通知で人数が分かるため)。デモでは対処せず、実運用で検討する(SAF-CHK-10)。

### 6.5 実装方針

- `maskGroup`・`maskProfile` は純粋関数。ストア読み取りは呼び出し側(`getGroup` 等)で行い、必要な値は ctx で渡す(試験容易性)。
- `GET /api/groups/:id` は `getGroupRole` → `maskGroup` の順で必ず通す。サービス層が Group をそのまま返すことを禁止する(コードレビュー規約、SAF-T-06 で検証)。

## 7. 通報・ブロック(柱6、12 #8)

### 7.1 通報

- 理由の分類(`ReportReason`、画面ラベルは 12.2): `contact_solicitation`(外部連絡先・別アプリへの誘導)、`harassment`(嫌がらせ・迷惑行為)、`inappropriate_content`(不適切な内容)、`money_solicitation`(金銭・勧誘)、`off_purpose`(旅の目的以外の言動)、`impersonation`(なりすまし)、`minor_suspected`(18歳未満の疑い)、`other`。
- 通報できる対象と前提(内部関数 `canReport`、report-service.ts。IDOR 対策)。前提を満たさない場合は `not_found`(存在を隠す)。

| targetType | 通報できる条件 | targetUserId | groupId |
|---|---|---|---|
| user | 次のいずれか。(a) `input.groupId` で通報者と対象がともに参加中メンバー、(b) `input.groupId` で通報者と対象が幹事と申請者の関係(申請の状態を問わない)、(c) 対象が、通報者に見える(`isGroupVisibleTo`)グループの幹事 | targetId | `input.groupId` ?? null |
| group | `isGroupVisibleTo(reporter, group)` が true、または通報者がそのグループのメンバー・申請者 | group.organizerId | targetId |
| message | 通報者がメッセージのグループの参加中メンバー | message.senderId | message.groupId |
| join_request | 通報者がその申請のグループの幹事、または申請者本人 | 幹事が通報: applicantId / 申請者が通報: organizerId | request.groupId |
| text_check | 常に可(reason は `false_positive` のみ) | null | null |

- SAF-RULE-12: 通報・ブロック・退会は、本人確認の状態(未確認・18歳未満の申告を含む)に関係なく実行できる。承認前の申請者も幹事・グループを通報できる(07 論点10)。
- (reporterId、targetType、targetId、reason)が同じ通報が 24 時間以内(`clock.now()` 基準)にあれば、新規作成せず既存を返す(`deduplicated: true`)。レート制限(10 件/10 分)は重複の判定より前に数える。
- `alsoBlock: true` のとき、targetUserId が解決できれば同じ処理の中で `blockUser` を行う(ブロックのレート制限も数える)。targetUserId が null(text_check)のときは無視する。
- メッセージの通報は `snapshot` に本文の写し(sanitize 済み、最大 200 文字)を保存する(後で削除・編集されても確認できる)。
- 通報本文(`body`)は禁止表現の検査を通さない(相手の発言の引用を拒否すると通報できなくなるため)。長さ制限、制御文字の除去、出力時のエスケープで対処する(8.7)。
- デモで使う状態は `received` のみ(運営の対応画面は作らない)。`in_review`・`resolved` は型にだけ置き、遷移させる処理は作らない。

### 7.2 ブロック

- 記録は一方向(`blockerId → blockedId`)とし、効果は用途別に定める。 [案、12 #8 未決]

| ID | 効果 | 方向 | 実装する関数(呼び出し元) |
|---|---|---|---|
| SAF-RULE-20 | グループ一覧・検索結果に、ブロック関係の相手が幹事または参加中メンバーのグループを出さない | 双方向 | `hasBlockAmong`/`isGroupVisibleTo`(02) |
| SAF-RULE-21 | グループ詳細を ID の直接指定で開いた場合も、同上のグループは `not_found` | 双方向 | `isGroupVisibleTo`(02、01) |
| SAF-RULE-22 | 参加申請ができない(`blocked`、一般文言)。ブロック関係にある申請者の申請中(pending)の申請は、幹事の申請一覧に表示しない | 双方向 | `assertNotBlocked`(03) |
| SAF-RULE-23 | プロフィール詳細を取得できない(`not_found`) | 双方向 | `resolveProfileRelation`(09) |
| SAF-RULE-24 | チャットで、自分がブロックした相手の投稿を自分の画面に表示しない。相手の画面の表示は変わらない | 一方向(自分→相手) | `filterVisibleMessages`(06) |
| SAF-RULE-25 | 同じグループにすでに参加している場合は、そのまま参加を続けられる(メンバー一覧には表示する。プロフィール詳細は取得できない) | - | `sameGroupOnBlock="stay"`(案A+C)。`"leave"`(案B)にする場合は 04/01 の退会処理を呼ぶ [未決 #8] |
| SAF-RULE-26 | ブロック・通報は相手・他メンバーに通知しない(報復防止)。10 は通知を生成しない | - | `notifyTargetOnReport=false` |
| SAF-RULE-27 | ブロックの存在を示す文言を相手に返さない。拒否は「この操作は行えません」「見つかりません」の一般文言 | - | messages.ts |

- 解除は本人のみ(`POST …/unblock`)。解除後は上記の効果がなくなる(再申請できる)。同一組の有効な Block は 1 件とし、重複の要求は新規作成せず成功(200)を返す。
- 通報時に「同時にブロックする」を選べる(`alsoBlock`、7.1)。
- 通報・ブロック後のグループ側の挙動の選択肢(12 #8)と本書の暫定: 案A(自分の画面で非表示のみ)+案C(通報を他メンバーに通知しない)を採用、案B(同一グループに留まれない)は `sameGroupOnBlock` の切替で後から可能。 [案]

## 8. 禁止表現の制御(柱8、12 #9)

### 8.1 方針

- 目的: 恋愛・異性交際を連想させる表現、連絡先の外部誘導、金銭の勧誘、性別・細かい年齢での選別表現を、グループ名・説明・タグ・申請のひとこと・チャット・メモ・費用メモ・プロフィールに出さない(柱8、規制への安全側の暫定対応)。 [案。法的判断ではない]
- 方式: 入力時にサーバーで検査して拒否または警告する(チャットの案C、12 #9 の[案])。画面では同じ純粋関数をクライアントでも実行して入力中に警告する(最終判断はサーバー)。表示側の一括置換(伏せ字)はしない(誤検知で意味が変わるため)。
- 辞書は自前・ローカル(`dictionary.json`)。実語彙は実装時に別ファイルで作成してレビューし、本書には書かない。本書の例はカテゴリ名と非直接的なダミー語にとどめる。

### 8.2 カテゴリ

| カテゴリ | 内容 | 例(非直接的なものとダミー) | 既定の重さ |
|---|---|---|---|
| romance_hint | 恋愛・異性交際を連想させる表現 | 〈ダミー恋愛語A〉〈ダミー交際語B〉(実語彙は辞書に) | deny |
| contact_exchange | 連絡先の交換・外部への誘導の言い回し | 「連絡先を教えて」「別のアプリで話そう」「IDを交換」「DMください」 | deny |
| contact_pattern | 連絡先らしき文字列 | メールアドレス、電話番号、URL、SNS の ID らしき `@名前` | deny / review(8.5) |
| money_solicit | 金銭・勧誘・対価を伴う誘い | 「投資」「副業」「儲かる」「紹介料」「会員募集」、〈ダミー対価語C〉 | deny |
| gender_filter | 性別での選別 | 「男性のみ」「女性限定」「女性歓迎」(語+のみ/限定/歓迎/優先/専用) | deny / review |
| age_filter | 細かい年齢・年代での選別 | 「同年代のみ」「若い人」「25歳まで」 | deny / review |

### 8.3 辞書の構造と運用

```ts
export interface DictRule {
  id: string;                         // 例 "rh-001"。`^[a-z]{2}-\d{3}$`(カテゴリの略号 rh/ce/cp/ms/gf/af + 連番)。ログ・誤検知報告(Report.targetId)で使うため isSafeId を満たす形にする
  category: TextCategory;
  severity: "deny" | "review";
  terms?: string[];                   // 正規化後(ひらがな・小文字)の語。squeezed 文字列に対し部分一致
  regex?: string;                     // contact_pattern 用。plain 文字列に対し(ReDoS 対策で量指定子の入れ子を禁止)
  needsAffix?: string[];              // gender_filter: 語に続く「のみ/限定/歓迎…」(語単独では判定しない)
  contexts?: TextContext[];           // 指定時はその文脈だけ。未指定は全文脈
  note?: string;
}
export const DICTIONARY_VERSION: string;  // 辞書を変えたら更新
```

- 辞書変更時は `scan-banned.mjs`(8.9)と固定の正例・誤検知例の単体試験(SAF-T-30 系)を必ず通す。
- 許可リスト(`ALLOW_PHRASES`): 観光地・施設・祭りの固有名詞に恋愛を連想させる語が含まれることがある。seed の spot 名・地方名と、手書きの許可リストに一致する範囲は検査前にマスクする。マスクは固有名詞の完全一致のみ(部分一致で語を通さない)。

### 8.4 正規化(`normalizeForCheck`)

検査は「そのまま」と「ノイズ除去後(squeezed)」の 2 形で行い、原文位置への対応表(map)を返す。

1. NFKC 正規化(全角英数・記号→半角、半角カナ→全角カナ)。原文位置への対応表を保つため 1 文字ずつ適用するが、半角の濁点・半濁点(U+FF9E、U+FF9F)は直前の文字と組にして適用する(例 `ｶﾞ`→`ガ`)。
2. 小文字化。
3. カタカナ→ひらがな(U+30A1〜U+30F6 を −0x60)。長音「ー」は残す。
4. 不可視・書式文字を除去: U+200B〜200F、U+202A〜202E、U+2060〜2069、U+FEFF、U+00AD、U+FE00〜FE0F。
5. squeezed 形: 空白・句読点・記号(`/[\s\p{P}\p{S}_]/gu`)を除去(記号の挿入による回避への対策: 例「て.す.と」「て す と」)。
6. contact_pattern の電話番号は plain 形で、数字の間の区切り(`-`、`ー`、`−`、空白、`.`、`()`)だけを除去して `(?<!\d)0\d{9,10}(?!\d)` を判定する(日付・金額の誤検知を避ける)。漢数字(〇一二…)・全角数字は先に半角数字にする。
- 既知の制約: 見た目が似た別文字(キリル文字等)、意図的な誤字、画像、句の言い換えは検出できない。辞書は網羅的ではないため、通報と誤検知報告(8.6)で補う。

### 8.5 文脈ごとの適用表

○=deny、△=review(警告し、ユーザーが確認すれば通す)、-=対象外。

| 文脈(TextContext) | 適用箇所(モジュール) | 上限 | romance_hint | contact_exchange | contact_pattern(メール・電話) | contact_pattern(URL・SNS ID) | money_solicit | gender_filter | age_filter |
|---|---|---|---|---|---|---|---|---|---|
| group_name | グループ名(01) | 40 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| group_description | 説明(01) | 1000 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| group_tag | タグ(01) | 20×最大 5 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| join_note | 申請のひとこと(03) | 200 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| reject_reason_free | 却下理由が自由記入の場合(03。定型選択なら不要) | 100 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| chat_message | チャット(06) | 500 | ○ | ○ | ○ | △ | ○ | △ | △ |
| plan_note | 旅程・集合場所メモ(05) | 2000 | ○ | △ | ○ | △ | ○ | △ | △ |
| expense_item | 費用メモの項目名(07) | 40 | ○ | ○ | ○ | △ | ○ | △ | △ |
| profile_display_name | 表示名(09) | 20 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| profile_bio | ひとこと(09) | 200 | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| report_body | 通報本文(09) | 500 | - | - | - | - | - | - | - |

- 費用メモでは「円」「割り勘」「立て替え」等の金額・分担の語は辞書に入れない(正常な入力)。money_solicit は「勧誘」の言い回しだけを対象にする。
- 06 の定型文方式(案A)に切り替えた場合、自由入力が無いため `chat_message` の検査は不要(定型文 ID の存在確認のみ)。12 #9 の決定に追従。

### 8.6 検査の流れと戻り値

```ts
// checkText(text, context): 純関数。contexts.ts の適用表と辞書を引く
// 1) sanitizeText 済みの文字列を受ける  2) ALLOW_PHRASES をマスク  3) normalizeForCheck
// 4) 辞書の terms を squeezed に、regex を plain に適用  5) 文脈の適用表で severity を決定
// 6) findings の最大 severity で verdict を決める(deny > review > ok)
```

| verdict | 意味 | `assertTextAllowed` の挙動 |
|---|---|---|
| ok | 問題なし | 何もしない |
| deny | 拒否 | `invalidInput({ [field]: reason })`(00 5.4)を投げる。保存しない |
| review | 要確認(誤検知の可能性があるもの) | `opts.ackReview !== true` なら `new AppError("invalid_input", message, { fields: { [field]: reason }, detail: { reviewRequired: true } })` を投げる。画面が「このまま使う」を出し、`ackReview: true` を付けて再送すると通す |

- 理由文(`reason`)は「<欄の名称>に『<該当部分>』を含めることはできません。<カテゴリ別の説明>」。該当部分は入力者自身の文字列(エスケープして表示)。辞書の他の語・ルール ID は画面に出さない(辞書の内容を推測されにくくするため)。
- `suggestion`(言い換え案)はカテゴリ別の定型: contact_exchange/contact_pattern=「連絡は参加成立後にグループ内のチャットを使ってください」、gender_filter/age_filter=「条件で人を選ぶ表現は使えません。旅の内容や日程を書いてください」、money_solicit=「金銭の勧誘はできません」、romance_hint=「旅の内容に関する表現にしてください」。
- 誤検知への対処: (1) 許可リストで固有名詞を通す、(2) あいまいな語は deny でなく review、(3) ユーザーが「誤検知を報告」(`createReport` で `targetType=text_check, reason=false_positive, targetId=ruleId`)でき、辞書の見直しに使う、(4) 辞書にバージョンを持たせ、誤検知例を正例の試験として固定、(5) 検査結果で本文を自動書き換えしない。
- ログ: 拒否された本文は保存しない(個人情報・不適切な内容を残さない)。開発用ログには ruleId と文脈だけを出す。

### 8.7 通報本文・既存データの扱い

- `report_body` は検査しない(7.1)。seed(グループ名・メッセージ等)は実装時の走査(8.9)で検査する。
- 既存データに辞書更新で新たに該当する語が見つかっても、遡って削除はしない(デモ)。走査で検出して seed を直す。

### 8.8 性別での絞り込み・表示の禁止(静的な担保)

- API の入力(クエリ・ボディ)と出力(JSON のキー)、画面の項目に、性別を表すキー・ラベルを置かない。
- `rejectProhibitedParams(params)`: キー名が `/^(gender|sex|sexual|male|female|性別|男性|女性)$/i`、または年齢の細かい指定(`age`、`ageMin`、`ageMax`、`birthYear`、`birthday`)のとき `invalid_input`("unsupported filter")。年代帯の指定は `ageBand`(列挙)のみ許可。02 の一覧クエリ、03・01 のボディ検証で、00 の `v` による parse の前に呼ぶ(SAF-FN-27)。
- `scripts/check-no-gender.mjs`: `app/src/features/**`、`app/src/app/**`、`app/src/data/group-seed.json` を走査し、`/gender|\bsex|性別|男性|女性/i` が現れたら終了コード 1。除外は `features/safety/text/`(辞書)、`features/safety/guards/input.ts`(`rejectProhibitedParams` の定義)、`features/safety/__tests__/`。CI が無いため、`npm run lint` の後に手動で実行する。

### 8.9 混入走査(`scripts/scan-banned.mjs`)

Node スクリプトで `group-seed.json` の全文字列、`features/*/messages.ts`、画面の文言(`app/src/app/[campaign]/groups/**`、`app/src/app/[campaign]/mypage/**`)を `checkText`(文脈は列挙)に通し、deny を 1 件でも検出したら終了コード 1。辞書自体(`features/safety/text/`)と試験は除外する。さらに、README の用語方針で使わないと定めた語(スクリプト内の定数に持つ)を直接検索する。 [案]

## 9. 本人確認・18歳確認のモック(柱7、12 #3・#10)

### 9.1 モックの範囲

- 競技はログイン不要のため、実際の書類提出・照合は行わない。モックは自己申告の形とし、画面で「18歳以上です」または「18歳未満です」を選び、結果(`Verification.status`)だけを保存する。生年月日・書類画像・氏名は保持しない。 [決定(モック・結果のみ)/案(自己申告の形)]
- 画面に常に「モック表示。実際の本人確認は行っていません」を出す(rule.md の「モックを画面上で明示」)。
- 状態: `unverified`(未確認)→ `verified`(確認済み=18歳以上と申告)/ `underage`(18歳未満と申告)。デモ用に `reset` で `unverified` に戻せる。`confirmedAt` は申告時に `clock.nowIso()` を入れ、reset で null に戻す。自己申告では事実と異なる申告を防げないため、実運用では書類確認など別の水準が必要([未決 #3])。
- seed のダミーユーザーに、確認済み・未確認・18歳未満(申告)をそれぞれ最低 1 人置き、視点切替で試験できるようにする(00 の group-seed.json へ。SAF-REQ-01)。

### 9.2 確認が必要な操作(ガード `requireVerified`)

| 操作(VerifiedAction) | 呼ぶ場所 | 未確認 | 18歳未満(underage) |
|---|---|---|---|
| create_group | 01 `createGroup` | forbidden(not_verified) | forbidden(underage) |
| request_join | 03 `requestJoin` | forbidden(not_verified) | forbidden(underage) |
| join_by_invite_code | 03 / 02 `findByInviteCode` の申請 | forbidden(not_verified) | forbidden(underage) |
| (対象外)一覧・詳細の閲覧、プロフィール編集、通報、ブロック、退会、本人確認画面 | - | 可 | 可(`minorPolicy="deny_all"` の場合は閲覧も不可) |

- 通報・ブロック・退会は、確認状態に関係なく実行できる(SAF-RULE-12)。
- 承認(03 `approve`)は幹事の操作であり、幹事は作成時に確認済みのため追加のガードは不要。チャット・メモ・費用はメンバー限定で足りる(申請時に確認済み)。確認状態をモックで reset した後は、新規の作成・申請だけが `forbidden` になる(既存のメンバーとしての操作は続けられる)。
- `forbidden` には `detail.reason`(`not_verified` / `underage`)を付け、画面は本人確認画面(9.4)への導線を出す。

### 9.3 未成年の扱い([未決 #10]。選択肢と最小案)

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A(デモの最小案) | 18歳未満(申告)は作成・申請を不可。閲覧は一覧・詳細(公開情報)のみ | 規制リスクを最小にする。実装が単純 | 家族旅行など未成年が同席する場面に対応できない |
| A' | A に加え閲覧も不可(`deny_all`) | より安全 | 一覧の公開情報にも触れられず、案内が必要 |
| B | 保護者を含むグループのみ未成年の参加を許す | 家族旅行に対応 | 保護者関係の確認が必要。モックでは検証不能。実運用で重い |

- 本書は A を `minorPolicy="deny_writes"` として実装し、A'・B は決定後に差し替える。18歳未満の確認方法・保護者同伴の扱いは法的判断を要するため、実運用の論点として残す。 [未決 #10、要確認]
- 一覧は見知らぬ人に公開されるため、18歳未満が幹事・申請者になる場面は実運用で重い論点である(07 論点6)。デモでは、18歳未満と申告した利用者の作成・申請を拒否する動作だけを示す。
- `minor_suspected`(18歳未満の疑い)の通報理由を用意する(7.1)。

### 9.4 画面(第12章に詳細)

本人確認(モック)画面 `/[campaign]/mypage/verification`: 現在の状態、申告の選択、確認ボタン、注意書き。初回の参加申請の前に必要な場合は、申請ボタンの代わりに案内を出す(`VerificationGate`)。

## 10. 出力のサニタイズ・セキュリティ共通

### 10.0 適用範囲

- 本章は、追加機能の全モジュール(00〜12)に共通するセキュリティ方針の正とする。各モジュールの設計書は本章を参照し、モジュール固有の対策だけを書く。 [案]
- 対象: `app/src/features/**`、`app/src/app/api/groups/**`、`app/src/app/api/demo/**`、`app/src/app/[campaign]/groups/**`、`app/src/app/[campaign]/mypage/**`(本書の画面)、`app/src/data/group-seed.json`。
- 対象外: 既存の `/api/v2` モックと `server-store.ts`(変更しない)。実運用で必要になる認証、HTTPS、監視(10.8 の「既知の制約」)。
- 前提: localhost 完結、ダミーデータのみ、ログイン不要(Cookie `demoUser` は視点切替であり認証ではない)。
- OWASP Top 10 の項目ごとの対応状況は 10.8 にまとめる。

### 10.1 方針と役割分担

| 層 | 担当 | 内容 |
|---|---|---|
| 要求の検査 | 00 `route()`(要件は 09 の 10.5) | Origin、Content-Type、本文サイズ、応答ヘッダー |
| 入力検証 | 00 の `v`・`sanitizeText`・`isId`(実装は 00)+ 09 の `rejectProhibitedParams`・`isSafeId` | 型・長さ・列挙・ID 形式、制御文字・不可視文字の除去、性別・細かい年齢の条件の拒否。HTML 文字のエスケープはここでは行わない(二重エスケープを避け、出力側のエスケープに一本化するため) |
| 内容の方針 | 09 `checkText` | 禁止表現(第8章) |
| 認可 | 各サービス + 09 `assertGroupAccess`/`assertInGroup`/`getGroupRole` | 役割判定、他グループの資源の遮断(10.4) |
| 出力 | React の既定エスケープ + 規約(10.2) | 表示時にエスケープ。API は JSON(`Content-Type: application/json`)のみ |
| ログ | 00 `route()` + 規約(10.7) | requestId と ID だけを出す |

### 10.2 XSS 対策(規約)

- SAF-RULE-30: `dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`document.write`、`eval`、`new Function` を使わない。ESLint の `react/no-danger` を有効にする。現状の `app/eslint.config.mjs` は eslint-config-next の core-web-vitals と typescript の設定だけで、`react/no-danger` を明示していない [事実]。有効化は SAF-REQ-07。違反は grep 検査(SAF-SEC-05、SAF-TASK-19)でも検出する。
- SAF-RULE-31: ユーザー入力を `href`・`src`・`style`・`className`・`id`・`key` に使わない。リンクは固定の内部パス(`/${campaign}/groups/${id}`、`id` は 00 の `isId` 済み)のみ。メモ・チャットの URL は自動リンク化しない(05 の方針)。このため `javascript:` などのスキームを含む文字列はリンクとして描画されない。
- SAF-RULE-32: 保存は「sanitize 済みの生の文字列」。HTML 実体化して保存しない。表示は常にテキストノード。
- SAF-RULE-33: 通知本文(10)はテンプレート+変数。ユーザー入力(チャット本文、ひとこと)を通知に埋め込まない。
- SAF-RULE-34: エラー応答に入力値を含める場合も JSON に入れ、HTML として返さない。`X-Content-Type-Options: nosniff` を API 応答に付ける(00 のラッパー)。
- SAF-RULE-35: 方向制御文字(U+202A〜202E、2066〜2069)は `sanitizeText` で除去する(表示名での表示偽装の対策)。
- 追加ヘッダー [案]: `X-Content-Type-Options: nosniff`(全応答)、`Referrer-Policy: no-referrer`、`X-Frame-Options: DENY`(クリックジャッキング対策)、本番ビルドのみ CSP(`default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'`)。`next.config.ts` の `headers()` で設定する。app/ の変更を伴うため要望とする(SAF-REQ-07)。開発サーバーは eval を使うため CSP は本番ビルドのみとする。`'unsafe-inline'` は Next.js のインラインスクリプトと Mantine のインラインスタイルのために置く。nonce 方式にするかは Next.js 16 のガイドを読んで決める [要確認]。

### 10.3 SQLi・パストラバーサル・その他

- SAF-RULE-36: SQL を使わない(インメモリ)ため SQLi は該当しない。検索語 `q` は文字列の部分一致のみ(`includes`)、正規表現にしない(ReDoS 回避)。SQLite 等を採る場合はプレースホルダ必須(00 と共通)。 [案]
- SAF-RULE-37: ユーザー入力をファイルパスに使わない。ID は 00 の `isId`(または `isSafeId`)で許可文字だけに制限するため、`../`、`%2e%2e`、`\`、NUL を含む値は通らない(パスの ID は `not_found`、本文・クエリの ID は `invalid_input`)。seed・辞書は固定パスで読む。写真投稿(既存機能の再利用、08)で保存する場合は、ファイル名をサーバー生成(`newId`)、拡張子・サイズの許可リスト、保存先を固定ディレクトリに限定。 [要確認(08 の実装時)]
- SAF-RULE-38: オブジェクトのキーにユーザー入力を使う箇所(マップの添字)は、`isSafeId` 済みの ID のみとし、`__proto__`、`constructor`、`prototype` を拒否する。マップは `new Map()` または `Object.create(null)` で作る。更新ボディは既知キーだけを読む(00 の `v.object` が未知キーを捨てる。SAF-CHK-12)。
- SAF-RULE-39: 秘密情報: `.env*`、`Password.txt.txt` を読み書きしない・出力しない。API 応答に実名(ダミー含む)・連絡先を公開範囲(6.1)の外で出さない。ログの規則は 10.7。

### 10.4 認可の漏れ(IDOR)防止

- SAF-RULE-40: すべてのグループ系 Route Handler の先頭で `assertGroupAccess(userId, groupId, need)` を呼ぶ。判定は次の表のとおり。非公開グループに招待コードで到達する経路は 02 の `findByInviteCode` が扱い、`assertGroupAccess` は通さない。

| 閲覧者 \ need | view | member | organizer |
|---|---|---|---|
| 参加中の幹事 | 通す | 通す | 通す |
| 参加中のメンバー(幹事以外) | 通す | 通す | `forbidden` |
| 非メンバー(公開グループ) | 通す | `forbidden` | `forbidden` |
| 非メンバー(非公開グループ) | `not_found` | `not_found` | `not_found` |
| 非メンバーで、ブロック関係の相手が幹事・参加中メンバーにいる(SAF-RULE-21) | `not_found` | `not_found` | `not_found` |
| 存在しない groupId | `not_found` | `not_found` | `not_found` |

- SAF-RULE-41: 子資源(メッセージ、申請、費用、メモ、通報)を ID で取得するときは `assertInGroup(item, groupId)` で、URL の groupId と資源の groupId の一致を検査する(`/groups/gA/messages/<gB のメッセージ ID>` を遮断)。他人の通知・通報・ブロックも本人のみ。
- SAF-RULE-42: 認可判定は `currentUser(req)`(Cookie)から得た ID だけで行い、ボディ・クエリの userId、role、isOrganizer を信用しない。
- SAF-RULE-43: 一覧系は「見える行だけ」を返す(行ごとに `isGroupVisibleTo`)。件数やページ総数に非公開の行を含めない。
- SAF-RULE-44: Cookie `demoUser` は seed に存在する ID のみ受理(00)。無効なら既定のデモユーザーに戻し、管理系(12 の擬似ロール等)の権限を与えない。

### 10.5 CSRF とリクエスト検査(`assertSafeRequest`)

- localhost 完結で、Cookie は認証ではなく視点切替だが、利用者が意図しない状態変更(CSRF)を防ぐため、次の最低限の対策を設ける。実装は 00 の `route()`(00 5.5、7)。 [案]
  1. GET で状態を変えない(変更は POST/PUT/PATCH/DELETE)。
  2. 変更系は `Content-Type: application/json` を必須とする(フォーム送信・`text/plain` の単純リクエストを拒否 → `unsupported_media_type`(415))。
  3. `Origin` ヘッダーがある場合は `Host` と一致するもののみ許可(不一致は `forbidden`)。`Origin` が無い要求と GET は Origin の検査の対象外。
  4. Cookie は `SameSite=Lax`、`HttpOnly`、`Path=/`(00 5.2 で設定済み)。
  5. 本文サイズは 64KB まで(超過は `payload_too_large`(413))。
  6. CORS ヘッダーを付けない(00 7)。
- 実運用ではセッション認証と CSRF トークンが別途必要(本書の範囲外)。

### 10.6 レート制限(`checkRate`)

- 目的は連投・連続申請・通報の乱用の抑止(デモでも「連投制限」が試験できる)。固定ウィンドウの単純なカウンタ(globalThis の Map)。時刻は `clock.now()`(試験で差し替え可)。
- 設定は 4.4 の `RATE_LIMITS`。キーは `${name}:${userId}`(チャットはグループ単位 `chat_post:${userId}:${groupId}`)。超過は `rate_limited`(HTTP 429)で「しばらくしてからやり直してください」。`detail.retryAfterSec`(ウィンドウ終了までの秒数、切り上げ)を付ける。
- チャットの上限は 06 の「連投制限」と一致させる(SAF-CHK-04)。
- 既知の制約: プロセス再起動・`resetStore()` でカウンタが初期化される。Cookie の切替で別ユーザーとして数えられる。デモでは対処しない。

### 10.7 ログ・エラー応答

- SAF-RULE-45: ログ(`console.error`、開発用ログ)に出すのは requestId、エラーコード、ruleId、文脈(TextContext)、エンティティの ID だけとする。入力本文、拒否された文字列、realName・contact、Cookie の値は出さない。
- SAF-RULE-46: エラー応答に例外のメッセージ・スタック・ファイルパスを含めない。想定外の例外は 00 の `internal`(固定の一般文)で返す。
- 通報・ブロック・本人確認の操作の記録は、Store の Report・Block・Verification(作成日時つき)で足りるとし、別の監査ログは持たない。
- 既知の制約: 監視・警告(アラート)の仕組みは持たない(デモ範囲外)。

### 10.8 OWASP Top 10 との対応

番号は OWASP Top 10(2021 年版)。状態は「対応済み」(本書の設計で対処)、「一部対応」、「適用外」(本アプリに該当する機能が無い)、「既知の制約」(デモでは対処しない)。CSRF は Top 10 の独立項目ではないが、依頼の観点として行を設ける。

| 項目 | 本アプリでの該当箇所 | 対処(節・規則) | 状態 |
|---|---|---|---|
| A01 アクセス制御の不備(IDOR を含む) | グループ・子資源・プロフィール・通報・ブロックの取得と変更 | 役割判定をサーバーで毎回行う(6.2)、`assertGroupAccess`・`assertInGroup`(10.4)、クライアントの申告を使わない(SAF-RULE-42)、存在を隠す `not_found`、公開範囲のホワイトリスト(6.1、6.3) | 対応済み |
| A02 暗号化の失敗(機密データの扱い) | 実名・連絡先(ダミー)、通報 | 実データを持たない。公開範囲で返す項目を制限(SAF-RULE-01)、本人確認は結果のみ保持(9.1)。localhost の http で HTTPS を使わない | 一部対応(HTTPS なしは既知の制約) |
| A03 インジェクション(XSS、SQLi、パストラバーサル、プロトタイプ汚染、ReDoS) | 全入力欄、パス・クエリの ID、検索語 | 出力は React のエスケープ(10.2)、SQL を使わない(SAF-RULE-36)、ID の許可文字(SAF-RULE-37)、キーの制限(SAF-RULE-38)、正規表現の制限(8.3、SAF-RULE-36) | 対応済み |
| A04 安全でない設計 | 公開範囲、ブロック、通報、連投 | 承諾前の最小公開(SAF-RULE-01)、ブロックの存在を示さない(SAF-RULE-27)、レート制限(10.6)、メンバー概要の丸め(6.4) | 対応済み(差分による推測は既知の制約、6.4) |
| A05 セキュリティ設定のミス | 応答ヘッダー、エラー応答、デモ用 API | nosniff・no-store(00 の `route()`)、追加ヘッダーと CSP(10.2、SAF-REQ-07)、内部情報を返さない(SAF-RULE-46)、デモ用 API は `DEMO_TOOLS=off` で無効化(00)、CORS を付けない | 一部対応(追加ヘッダーは SAF-REQ-07 の承認待ち) |
| A06 脆弱で古いコンポーネント | npm の依存 | 新規依存を追加しない(3.1)。実装時に `npm audit` を実行し結果を記録(SAF-SEC-24) | 対応済み(運用で確認) |
| A07 識別と認証の失敗 | Cookie `demoUser` | ログイン不要のデモ。Cookie は seed に存在する ID のみ受理(SAF-RULE-44)、`HttpOnly`・`SameSite=Lax` | 既知の制約(認証ではない。実運用では認証が必要) |
| A08 ソフトウェアとデータの整合性の不備 | seed、辞書、リクエスト本文 | seed・辞書は固定パスのリポジトリ内ファイル。本文は `JSON.parse` と 00 の `v` による検証のみで、任意のコードやオブジェクトの復元をしない | 対応済み |
| A09 セキュリティログと監視の不備 | サーバーログ | requestId 付きのログ、本文を出さない(10.7) | 既知の制約(監視・警告なし) |
| A10 サーバーサイドリクエストフォージェリ | - | サーバーから外部への通信を行わない(URL を取得しない) | 適用外 |
| (参考)CSRF | 変更系 API | `route()` の Origin・Content-Type 検査、`SameSite=Lax`(10.5) | 対応済み(トークン方式は実運用の範囲) |

## 11. API(Route Handler。パスは SAF-API-12 を除き `/api/groups/...`。00 の形式・エラー体系に従う)

共通: 現在ユーザーは Cookie(00 の `currentUser`)。全 API は 00 の `route()` を通す(Origin・Content-Type・本文サイズの検査、パスの ID の検査、`v` による検証とサニタイズ)。エラーは 00 5.4 の `{ error, message, fields?, detail? }`。禁止表現の review は `detail.reviewRequired: true`、本人確認による拒否は `detail.reason`、レート制限は `detail.retryAfterSec` を付ける。エラーコードの一覧は第14章。

| ID | メソッド・パス | リクエスト | レスポンス | エラー |
|---|---|---|---|---|
| SAF-API-01 | GET `/me/profile` | - | 200 `MyProfileDto`(Profile + 項目ごとの公開レベル + 許可レベル) | - |
| SAF-API-02 | PUT `/me/profile` | `ProfilePatch`(`{displayName?, ageBand?, bio?, travelPurposes?, visibility?: Partial<Record<ProfileFieldKey, Visibility>>}`。未知キーは反映しない。SAF-CHK-12) | 200 `MyProfileDto` | invalid_input(型・長さ・許可外レベル・禁止表現 `fields`)、rate_limited |
| SAF-API-03 | GET `/users/:userId/profile?context=request\|member&groupId=` | - | 200 `PublicProfile`(`visibleProfile` の結果) | invalid_input(context が列挙外、groupId の欠落・形式不正)、not_found(userId の形式不正・不在、ブロック関係、SAF-RULE-04 の関係が成り立たない) |
| SAF-API-04 | GET `/me/blocks` | - | 200 `{ items: BlockView[] }`(有効なブロックのみ、作成日時の新しい順) | - |
| SAF-API-05 | POST `/me/blocks` | `{ targetUserId, sourceGroupId? }` | 201 `{ blocked: true }`(既に有効なら新規作成せず 200 で同じ形) | invalid_input(自分自身、ID の形式不正)、not_found(対象ユーザーが不在)、rate_limited |
| SAF-API-06 | POST `/me/blocks/:userId/unblock` | - | 200 `{ blocked: false }` | not_found(有効なブロックなし) |
| SAF-API-07 | POST `/reports` | `CreateReportInput`(`{ targetType, targetId, reason, body?, groupId?, alsoBlock? }`) | 201 `{ id, status: "received", deduplicated }`(重複のときは既存の id で 200) | invalid_input、not_found(通報できない対象。7.1)、rate_limited |
| SAF-API-08 | GET `/me/reports` | - | 200 `{ items: ReportView[] }`(自分の通報のみ) | - |
| SAF-API-09 | GET `/me/verification` | - | 200 `Verification` | - |
| SAF-API-10 | POST `/me/verification` | `{ declare: "adult" \| "minor" \| "reset" }` | 200 `Verification` | invalid_input |
| SAF-API-11 | (欠番: 禁止表現の検査はクライアントで `checkText` を直接実行する) | - | - | - |
| SAF-API-12 | GET `/api/demo/reports`(00 の `demoOnly: true`。加えて `NODE_ENV==="production"` では 404。運営画面の代わりに試験で件数を確認) | - | 200 `{ items: Report[] }` | not_found(`DEMO_TOOLS=off` または本番) |

- 他モジュールの API が禁止表現でエラーを返すときの形: `400 { error: "invalid_input", message, fields: { name: "…" } }`。review のときは `detail: { reviewRequired: true }` を付ける(SAF-REQ-02)。
- SAF-API-12 は旧案の `/_dev/reports` から変更した。App Router では `_` で始まるフォルダはルーティングの対象外になるため(00 4.1)。
- プロフィールの公開 API(03)は `context` を必須とし、`context` 無しの `GET /users/:id/profile` は設けない(誰でも任意の利用者を引けないようにする)。

## 12. 画面

### 12.1 画面とパス(04 章の対応)

| 画面 | 04 章の項目 | パス | コンポーネント |
|---|---|---|---|
| プロフィール編集(公開範囲) | プロフィール編集 | `/[campaign]/mypage/profile` | `ProfileForm`、`VisibilityPicker`、`ProfilePreview` |
| 通報ダイアログ | 通報・ブロック | メンバー一覧・承認画面・チャット・グループ詳細から開く | `ReportDialog` |
| ブロックの導線・ブロック一覧 | 通報・ブロック | 各画面のメニュー、`/[campaign]/mypage/blocks` | `BlockMenuItem`、`BlockListPage` |
| 本人確認・18歳確認(モック) | 本人確認 | `/[campaign]/mypage/verification` | `VerificationPage`、`VerificationGate` |
| 禁止表現の拒否メッセージ | (入力欄共通) | 各入力欄 | `TextRejectNotice`、`useTextCheck` |

共通: 「モック」の明示バッジ(00 の `MockBadge`)を本人確認画面・通報完了画面に表示する。部品は Mantine 9 を使う(3.1。[要確認] `app/node_modules` が無く API を未確認)。データ取得は 00 の `lib/groups-api.ts`(`gapi`・`gpost`・`useGroupsApi`、00 5.9)を使う。

### 12.2 各コンポーネント(SAF-UI)

**SAF-UI-01 `ProfileForm`(プロフィール編集)**
- props: なし(ページ内で `GET /me/profile`)。state: `draft`(編集中の値)、`errors: Record<string,string>`、`saving`。
- 項目: 表示名(必須 1〜20)、年代帯(選択。性別の欄は無い)、ひとこと(0〜200、残り文字数)、旅の目的(複数選択、最大 3)。各項目の右に `VisibilityPicker`。
- `VisibilityPicker`: props `{ field: ProfileFieldKey; allowed: readonly Visibility[]; value: Visibility; onChange(v: Visibility): void }`。ラベル「誰に見える?」と選択肢「全員」「申請を確認する幹事」「参加が成立したメンバー」「自分のみ」のうち、許可レベル(`MyProfileDto.allowed`)だけを表示する。displayName は「全員」の固定表示。実名・連絡先は値を編集できない(ダミーであることを表示する)。公開レベルだけを「参加が成立したメンバー」「自分のみ」から選べる。
- `ProfilePreview`: props `{ profile: Profile }`。state `relation: "stranger" | "reviewer" | "groupmate"`。「他の人からの見え方」をこの 3 つのタブで表示する(クライアントで `maskProfile` を自分のデータに適用)。
- 保存: `PUT /me/profile`。禁止表現は欄の下に `TextRejectNotice`。ひとこと入力中は `useTextCheck("profile_bio")` で 400ms デバウンスの警告。

**SAF-UI-02 `ReportDialog`**
- props: `{ opened: boolean; onClose(): void; target: { type: ReportTargetType; id: string; label: string; groupId?: string }; allowBlock?: boolean }`。state: `step: "form" | "done"`、`reason`、`body`、`alsoBlock`、`submitting`、`error`。
- 「通報の理由」を `fieldset/legend` のラジオ(7.1 の 8 種)、補足(任意、500 文字)、「この人をブロックする」チェック(対象がユーザーのとき)。注意書き「通報は相手やグループの他の人には通知されません。デモのため運営の対応は行われません」。
- 送信: `POST /reports`。完了は「受け付けました」+ `MockBadge`。`rate_limited` は `detail.retryAfterSec` から再試行までの目安を表示する。

**SAF-UI-03 `BlockMenuItem` / `BlockListPage`**
- `BlockMenuItem` props `{ userId: string; displayName: string; groupId?: string; onBlocked?(): void }`: 確認ダイアログ「ブロックすると、あなたの画面でこの人の投稿を隠し、この人のグループは一覧に出なくなります」→ `POST /me/blocks`。
- `BlockListPage`: `GET /me/blocks` を表示し、各行に「解除」(`POST …/unblock`)。空のときは「ブロックしている人はいません」。

**SAF-UI-04 `VerificationPage` / `VerificationGate`**
- `VerificationPage`: 現在の状態表示(未確認/確認済み/18歳未満の申告)、ラジオ「18歳以上です / 18歳未満です」、「確認する(モック)」。`MockBadge` と「実際の本人確認は行っていません。結果だけを保存します」。デモ用「状態をリセット」。
- `VerificationGate`: props `{ action: VerifiedAction; children: ReactNode }`。確認済みなら children、そうでなければ children の代わりに説明と本人確認画面へのリンク(18歳未満の場合は「このサービスは18歳以上の方が対象です」)。サーバーの `forbidden` が最終判断。

**SAF-UI-05 `TextRejectNotice` / `useTextCheck`**
- `useTextCheck(context: TextContext)` → `{ result: TextCheckResult; onChange(value: string) }`(`checkText` をクライアントで実行)。`TextRejectNotice` props `{ result: TextCheckResult | null; serverError?: string; onAckReview?(): void; onReportFalsePositive?(): void }`。
- 表示: deny=「<欄>に『…』は入力できません。<言い換え案>」(`role="alert"`)、review=「確認してください。…」+「このまま使う」ボタン、末尾に「誤検知を報告」リンク。該当部分の強調は文字の色だけに頼らず下線+文言で示す。

### 12.3 アクセシビリティ

- 全入力に可視ラベルを付け、エラーは `aria-describedby` で入力に関連づけ、`role="alert"`(deny)/`aria-live="polite"`(review・文字数)で通知。色だけで伝えない(アイコン・文言を併用)。
- ダイアログ(通報・ブロック確認)はフォーカストラップ、Esc で閉じる、開いたとき最初の操作可能要素、閉じたら起点要素へフォーカス復帰(Mantine の Modal 既定に従う [要確認])。
- ラジオ・チェックはキーボード操作可能、タップ領域 44px 以上、スマホ幅で横スクロールなし(04 章の UI 方針)。
- 公開範囲の選択は「現在の設定」を文言で読み上げられる(`aria-label` に項目名と現在値)。プレビューのタブは `role="tablist"`。

## 13. 状態遷移

| 対象 | 遷移 | 条件 |
|---|---|---|
| Report | received → in_review → resolved | デモは received のみ。in_review・resolved は型だけに置き、遷移させる処理は作らない(運営画面なし) |
| Block | 有効(releasedAt=null) → 解除(releasedAt 設定) → 有効(再ブロックは新しい Block を作成) | 本人のみ。同一組の有効は 1 件 |
| Verification | unverified → verified(adult 申告) / unverified → underage(minor 申告) / verified・underage → unverified(reset) | 本人のみ(モック)。デモ用の reset 以外に戻す導線は設けない [案] |
| 関係(reviewer) | JoinRequest が pending の間だけ reviewer。approved で groupmate、rejected/withdrawn で stranger | 03 が JoinRequest を更新したとき、次の読み取りから反映(キャッシュしない) |

## 14. エラー処理

コード体系と応答形式は 00 5.4 に従う。本モジュールで発生する条件は次のとおり。

| コード | detail | 発生条件(本モジュール) | HTTP | 画面での表示・挙動 |
|---|---|---|---|---|
| invalid_input | - | 型・長さ・列挙外の値、許可外の公開レベル(SAF-RULE-02)、自分自身のブロック、reason と targetType の組の不正(4.3)、性別・細かい年齢の条件(SAF-FN-27)、本文・クエリの ID の形式不正、JSON 不正 | 400 | `fields` の内容を各入力欄の下に表示する。入力値は保持する |
| invalid_input | `reviewRequired` なし / `true` | 禁止表現の deny / review(8.6) | 400 | deny: 該当部分と言い換え案(`TextRejectNotice`)。review: 「このまま使う」を押すと `ackReview: true` を付けて再送する |
| forbidden | `reason: "not_verified"` | 未確認の利用者の作成・申請(9.2) | 403 | 「本人確認(モック)が必要です」と本人確認画面へのリンク |
| forbidden | `reason: "underage"` | 18歳未満と申告した利用者の作成・申請(9.2) | 403 | 「このサービスは18歳以上の方が対象です」と本人確認画面へのリンク |
| forbidden | - | 公開グループでの権限外の操作(メンバー限定・幹事限定。10.4)、Origin 不一致(10.5) | 403 | 権限外: 必要な役割の説明(例「メンバーのみ利用できます」)。Origin 不一致: 「画面を再読み込みしてやり直してください」 |
| blocked | - | ブロック関係での参加申請(SAF-RULE-22)・投稿 | 403 | 「この操作は行えません」。ブロックの語と理由は表示しない(SAF-RULE-27) |
| not_found | - | 存在しない ID、パスの ID の形式不正、非公開グループの非メンバー、他グループの資源(SAF-RULE-41)、ブロック関係のプロフィール・グループ、関係の成り立たないプロフィール(SAF-RULE-04)、通報できない対象(7.1)、有効なブロックが無い解除 | 404 | 「見つかりません」と一覧へ戻る導線(存在しない場合と見えない場合を区別しない) |
| conflict | - | 本モジュールでは返さない。重複のブロックは成功(200)、重複の通報は既存を返す(`deduplicated: true`)。同時操作は 00 の `tx`(同期)で直列化されるため競合しない | 409 | - |
| unavailable_state | - | 本モジュールでは返さない(グループの状態に依存する操作を持たない) | 409 | - |
| rate_limited | `retryAfterSec` | 4.4 の `RATE_LIMITS` の超過 | 429 | 「しばらくしてからやり直してください」と再試行までの目安。入力内容は保持する |
| unsupported_media_type | - | 変更系で Content-Type が JSON 以外(00 の `route()`) | 415 | 通常の画面操作では起きない。「画面を再読み込みしてやり直してください」 |
| payload_too_large | - | 本文が 64KB を超える(00 の `route()`) | 413 | 入力を短くするよう表示する |
| internal | - | 想定外の例外 | 500 | 00 の共通表示(requestId を表示) |

- [要確認] `rate_limited` は 00 の `ErrorCode` に未定義(SAF-REQ-03)。追加されない場合の代用は `conflict`(409)と `detail.reason: "rate_limited"` とする [案]。
- `forbidden` の理由と `reviewRequired` は 00 の `AppError.detail` で返す(SAF-REQ-02)。

## 15. 実装タスク(順序つき。規模 S/M/L)

| ID | タスク | 規模 | 前提 | 完了条件 |
|---|---|---|---|---|
| SAF-TASK-01 | `types.ts`・`policy.ts`(型、SAFETY_POLICY、FIELD_POLICY、RATE_LIMITS)を作る | S | 00 の型・AppError | 型チェックが通る |
| SAF-TASK-02 | `guards/input.ts`(`isSafeId`、`rejectProhibitedParams`)と単体試験。00 の `sanitizeText` が SAF-RULE-35 を満たすことの確認 | S | TASK-01 | SAF-T-40〜42 が通る |
| SAF-TASK-03 | `text/normalize.ts`(正規化と対応表) | M | TASK-02 | SAF-T-31 の正規化部分が通る |
| SAF-TASK-04 | `text/dictionary.json`(実語彙の作成・レビューを含む)、`dictionary.test.json`、`contexts.ts` | M | TASK-03 | カテゴリごとの正例・誤検知例が固定される |
| SAF-TASK-05 | `text/check-text.ts`(`checkText`/`assertTextAllowed`、許可リスト、review 方式) | M | TASK-03、04 | SAF-T-30〜39 が通る |
| SAF-TASK-06 | `blocks/block-service.ts`(`isBlocked` 系、`blockUser` 等、`filterVisibleMessages`) | M | TASK-01、11 | SAF-T-20、24、25 が通る(T-21〜23、26 は TASK-20) |
| SAF-TASK-07 | `visibility/profile.ts`(`maskProfile`、`resolveProfileRelation`、`visibleProfile`、`getMyProfile`、`updateProfile`)と seed の Profile | M | TASK-01、02、05、06 | SAF-T-01〜04、09 が通る(T-05 は TASK-13) |
| SAF-TASK-08 | `visibility/summary.ts`(`memberSummary`、`suppressSmallCell`) | S | TASK-01 | SAF-T-10〜14 が通る |
| SAF-TASK-09 | `reports/report-service.ts`(重複排除、snapshot、レート制限) | M | TASK-02、06、11 | SAF-T-27〜29 が通る |
| SAF-TASK-10 | `verification/verification-service.ts`(`requireVerified`)と seed の Verification | S | TASK-01 | SAF-T-53、54 と `requireVerified` の判定の単体試験が通る(T-50〜52 は TASK-20) |
| SAF-TASK-11 | `guards/access.ts`(`assertGroupAccess`、`assertInGroup`)、`guards/rate-limit.ts`(`checkRate`、afterReset フックの登録) | M | TASK-01、02 | SAF-T-44〜46 が通る(HTTP での確認は SAF-SEC-10〜19、TASK-19) |
| SAF-TASK-12 | `visibility/group.ts`(`getGroupRole`、`maskGroup`、`isGroupVisibleTo`) | M | TASK-06、07、08、11 | SAF-T-07、08 の判定部分が単体で通る(T-06、21 は TASK-20) |
| SAF-TASK-13 | Route Handler(SAF-API-01〜10、12)を 3 章のリソースごとの `route.ts` として作る | M | TASK-07、09、10、11、12 | SAF-T-05 と、各 API のエラーコードが 11 章・14 章の表どおり |
| SAF-TASK-14 | `scripts/scan-banned.mjs`、`scripts/check-no-gender.mjs` | S | TASK-05 | SAF-T-43、64 が通る |
| SAF-TASK-15 | 画面: `ProfileForm`/`VisibilityPicker`/`ProfilePreview` とページ | M | TASK-13 | SAF-T-60 |
| SAF-TASK-16 | 画面: `ReportDialog`、`BlockMenuItem`、`BlockListPage` | M | TASK-13 | SAF-T-61 |
| SAF-TASK-17 | 画面: `VerificationPage`/`VerificationGate` | S | TASK-13 | SAF-T-62 |
| SAF-TASK-18 | 画面: `TextRejectNotice`/`useTextCheck` を 01・03・05・06・07 の入力欄へ組み込み(各モジュール担当と調整) | M | TASK-05、13 | SAF-T-63、アクセシビリティ確認 |
| SAF-TASK-19 | セキュリティ試験の実施と記録(SAF-SEC を HTTP で実行)、ESLint `react/no-danger` の確認、`npm audit` の実行 | M | TASK-13 | SAF-SEC 全件に結果を記録 |
| SAF-TASK-20 | 他モジュールの組み込み確認(第17章の呼び出しが入っているか)と結合試験 | S | 01〜03、05〜07 の実装、TASK-13 | SAF-T-06、21〜23、26、50〜52 が通る。契約表(17.1)の呼び出しがすべて入っている |

優先順位: 禁止表現(TASK-02〜05)と公開範囲(TASK-07、08、12)を最優先(S)。通報・ブロック・本人確認(TASK-06、09、10、16、17)は次点(A)。

## 16. 受け入れ条件・試験項目

試験用の seed(SAF-REQ-01): 以下の名前は役割の別名である。実 ID は 00 の形式(`u-001`、`g-001` 等)とし、`features/safety/__tests__/fixtures.ts` の定数 `SAF_USERS`・`SAF_GROUPS` で対応づける(00 9.1 の fixtures.ts と同じ方式。試験に ID 文字列を直書きしない)。ユーザー u-org(幹事・確認済み)、u-a(確認済み)、u-b(確認済み)、u-new(未確認)、u-minor(18歳未満の申告)、u-x(ブロックの相手役)。グループ g-pub(公開、幹事 u-org)、g-priv(非公開)、g-other(別グループ、メッセージ・申請あり)。禁止表現の試験には架空の語を使う: `dictionary.test.json` に `テスト禁止語` を romance_hint(deny)として登録する(実語彙は使わない)。

### 16.1 機能試験(SAF-T)

| ID | 入力・操作 | 期待結果 |
|---|---|---|
| SAF-T-01 | stranger として u-org のプロフィール(既定の公開設定)を `maskProfile` | `displayName` のみ。ageBand、bio、travelPurposes、realName、contact のキーが存在しない |
| SAF-T-02 | reviewer(pending の申請者を幹事が見る)で同 | public と reviewer のレベルの項目(既定では ageBand、bio、travelPurposes を含む)。realName、contact は含まれない |
| SAF-T-03 | groupmate で、u-a が bio=members、realName=members に設定済み | bio と realName が返る。contact(self のまま)は返らない |
| SAF-T-04 | 申請を却下した後、幹事が同じ申請者の profile を `visibleProfile`(context=request)。別に、申請の無い利用者を context=request で指定 | 前者は stranger となり displayName と public の項目のみ(reviewer のレベルの項目は返らない)。後者は 404 not_found(SAF-RULE-04) |
| SAF-T-05 | `PUT /me/profile` で `visibility.realName = "public"`、`visibility.ageBand = "public"` | いずれも 400 invalid_input(許可外) |
| SAF-T-06 | 全グループ API の応答を各役割で走査: outsider の `GET /groups/g-pub` | `members`、`inviteCode`、`myRequest`(他人の分)、plan/chat/expense、`memberIds` 等のキーが存在しない。キー集合が `GroupDetailPublicView` と完全一致 |
| SAF-T-07 | 非メンバーが g-priv を ID の直接指定で開く | 404 not_found(内部情報なし)。招待コード経由なら最小限の公開情報 |
| SAF-T-08 | member が `GET /groups/g-pub` | `members` に各人の `maskProfile`(members レベル)を含む。`inviteCode` は含まれない。organizer では含まれる |
| SAF-T-09 | u-a が u-b をブロック済みのとき、u-a が `visibleProfile(u-b, member)` | 404 not_found |
| SAF-T-10 | `memberSummary` に 1、2、3 人 | `count` が 1、2、3。`buckets=null`、`hiddenReason="few_members"` |
| SAF-T-11 | 4 人(30s、40s、50s、50s) | `buckets=["30-40s","50-60s"]`。人数の内訳が含まれない |
| SAF-T-12 | 6 人(18-19、20s、70s+ …) | `buckets=["20s-","70s+"]` 等、存在するまとまりのみ昇順 |
| SAF-T-13 | 申請中 2 人を含む場合 | 申請中は count に含まれない |
| SAF-T-14 | `suppressSmallCell(2)`、`(3)`、`(0)` | `"少数"`、`3`、`"少数"`(0 も少数として扱うか [要確認]。12 と合わせる) |
| SAF-T-20 | u-a が u-x をブロック | `isBlocked(u-a,u-x)` と `isBlocked(u-x,u-a)` が true。`isBlockedByMe(u-a,u-x)` true、`(u-x,u-a)` false |
| SAF-T-21 | u-x が幹事のグループを u-a が一覧取得 | 一覧に含まれない。ID の直接指定で 404 |
| SAF-T-22 | u-x が u-a の幹事グループへ申請 | 403 blocked。メッセージに「ブロック」の語が無い |
| SAF-T-23 | u-x が u-a の幹事グループに申請済み(pending)の状態で u-a が u-x をブロック | u-a の申請一覧に u-x が出ない |
| SAF-T-24 | チャットで u-x の投稿を含む一覧を u-a が `filterVisibleMessages` | u-x の投稿が除かれる。u-x から見た u-a の投稿は残る |
| SAF-T-25 | 自分自身をブロック、存在しない ID をブロック | 400 invalid_input / 404 not_found |
| SAF-T-26 | ブロックを解除後に一覧・申請 | 7.2 の効果がなくなる(一覧に表示され、申請できる)。ブロック・解除で通知(10)が作られない(0 件) |
| SAF-T-27 | message を通報(メンバー)、理由 harassment | 201、status=received、`snapshot` が保存される。相手に通知なし |
| SAF-T-28 | 同一の通報を 24 時間以内に再送 | `deduplicated: true`。件数は増えない |
| SAF-T-29 | 非メンバーが g-other のメッセージ ID を通報 | 404 not_found。11 回目の通報は 429 rate_limited |
| SAF-T-30 | `checkText("テスト禁止語を含む旅", "group_name")` | deny。`fields.name` に該当部分「テスト禁止語」を含む理由 |
| SAF-T-31 | 回避: `て.す.と.禁.止.語`、`テ スト禁止語`、`ﾃｽﾄ禁止語`、`テ` + U+200B + `スト禁止語`(ゼロ幅)、全角英数混在 | すべて deny(同一語として検出) |
| SAF-T-32 | `report_body` に `テスト禁止語` | ok(検査対象外) |
| SAF-T-33 | 連絡先: `090-1234-5678`、`０９０－１２３４－５６７８`、`〇九〇…`、`test@example.com`、`連絡先を教えて` を group_description | すべて deny(contact_pattern / contact_exchange) |
| SAF-T-34 | 誤検知: `2026-11-09 10:30 集合、予算 3000円、費用は割り勘` を plan_note / expense_item | ok(日付・金額・割り勘は通る) |
| SAF-T-35 | URL `https://example.com`: group_name と chat_message | group_name は deny、chat_message は review(`ackReview` 無しで 400+`reviewRequired`、有りで通る) |
| SAF-T-36 | `女性限定の旅`、`同年代のみ`、`25歳まで` を group_name | deny。chat_message では review |
| SAF-T-37 | 金銭の勧誘「副業で儲かる話」を chat_message | deny。`立て替え 1200円` は ok |
| SAF-T-38 | 許可リスト: seed の spot 名と同じ固有名詞を含むグループ名 | ok(固有名詞のみがマスクされる。固有名詞+辞書語の組み合わせは deny) |
| SAF-T-39 | (デモ範囲外)長文 2000 文字(ok の文面)で `checkText` | 50ms 未満(実測を記録)。ReDoS: `a`×10000 でも同等 |
| SAF-T-40 | `isSafeId`: `g-001`、`rh-001`、`../x`、`g%2e%2e`、`G-001`、41 文字、空 | true、true、false、false、false、false、false |
| SAF-T-41 | `sanitizeText("a\u0000b\u202Ec")`(00 の実装) | `"abc"`(制御・方向制御を除去) |
| SAF-T-42 | `rejectProhibitedParams`: `?gender=f`、`?sex=m`、`?ageMin=20`、`?ageBand=20s` | 前の 3 つは 400、最後は通る |
| SAF-T-43 | 全 API 応答の JSON を seed シナリオで再帰走査 | キー名に `gender`、`sex`、`性別` が無い。`scripts/check-no-gender.mjs` が成功 |
| SAF-T-44 | `assertGroupAccess` を 10.4 の表の各行(幹事、メンバー、公開の非メンバー、非公開の非メンバー、ブロック関係、不在)× need(view/member/organizer)で呼ぶ | 表のとおり、通過・forbidden・not_found になる |
| SAF-T-45 | `assertInGroup(g-other のメッセージ, g-pub)`、`assertInGroup(undefined, g-pub)`、`assertInGroup(g-pub のメッセージ, g-pub)` | 前の 2 つは not_found。最後はそのまま返る |
| SAF-T-46 | `checkRate("chat_post", u-a, g-pub)` を 6 回、`clock.set` で 10 秒進めて 1 回。別グループ・別ユーザーでも呼ぶ | 6 回目は rate_limited(`detail.retryAfterSec` あり)。進めた後は通る。別グループ・別ユーザーのキーは独立して数える |
| SAF-T-50 | u-new が `createGroup` / `requestJoin` | 403 forbidden(`not_verified`)、本人確認画面への導線 |
| SAF-T-51 | u-minor が同 | 403 forbidden(`underage`) |
| SAF-T-52 | u-minor が通報・ブロック・退会・一覧閲覧 | すべて実行できる |
| SAF-T-53 | `POST /me/verification {declare:"adult"}` 後に申請 | 申請できる。`reset` の後の新規申請は 403 forbidden(`not_verified`) |
| SAF-T-54 | `GET /me/verification` の応答 | 生年月日・書類・氏名のキーが無い(status、method、confirmedAt のみ) |
| SAF-T-60 | プロフィール編集画面の公開範囲変更 | 変更が保存され、プレビュー(stranger/reviewer/groupmate)が即時に反映。許可外の選択肢が出ない |
| SAF-T-61 | 通報ダイアログ(キーボードのみ) | Tab でラジオ→補足→送信、Esc で閉じる、完了後に起点へフォーカス復帰。理由未選択で送信できない |
| SAF-T-62 | 本人確認画面 | 「モック」の明示がある。申告後に状態が反映される |
| SAF-T-63 | 入力欄で禁止語を入力 | 入力中に警告、送信でサーバーも拒否。拒否メッセージに入力した語が表示され、辞書の他の語は表示されない |
| SAF-T-64 | 全画面(本機能の画面・グループ画面・seed)に対し `scan-banned.mjs` | deny 0 件、README の用語方針で使わない語が 0 件 |

### 16.2 セキュリティ試験(SAF-SEC。HTTP とブラウザで実施)

| ID | 攻撃入力 | 期待結果 |
|---|---|---|
| SAF-SEC-01 | グループ名に `<script>alert(1)</script>` を作成 | 保存はされるが(禁止語でなければ)画面ではテキストとして表示。DOM に `<script>` 要素が増えない。alert が発火しない |
| SAF-SEC-02 | ひとこと・チャットに `"><img src=x onerror=alert(1)>` | 同上。属性としても解釈されない |
| SAF-SEC-03 | メモに `javascript:alert(1)` と `[x](javascript:alert(1))` | リンク化されない(ただの文字列) |
| SAF-SEC-04 | 表示名に U+202E(右から左への上書き)を含む | 保存時に除去される(表示が反転しない) |
| SAF-SEC-05 | `grep -R "dangerouslySetInnerHTML\|innerHTML" app/src` | 該当 0 件(ESLint `react/no-danger` も有効) |
| SAF-SEC-06 | `GET /api/groups/../../data/seed.json`、`/groups/%2e%2e%2fseed/…` | 400/404。ファイル内容を返さない |
| SAF-SEC-07 | groupId に `g-001' OR '1'='1` | パスの ID は 404 not_found(00 の `c.id`)、本文・クエリの ID は 400 invalid_input |
| SAF-SEC-08 | 検索 `q=.*`、`q=(a+)+$` | 文字列として扱われ、応答時間が通常と同程度 |
| SAF-SEC-09 | `PUT /me/profile` に `{"__proto__":{"admin":true}}`、未知キー | 未知キーと `__proto__` は反映されない(00 の `v.object` が既知キーだけを読む)。`Object.prototype` と他ユーザーのデータに影響しない |
| SAF-SEC-10 | 非メンバーが `GET /groups/g-priv/messages` | 404(存在を隠す)。g-pub のメッセージは 403 |
| SAF-SEC-11 | `/groups/g-pub/messages/<g-other のメッセージ ID>` | 404(`assertInGroup`) |
| SAF-SEC-12 | u-a が g-other の申請を `approve`(幹事でない) | 403 forbidden。他グループの申請 ID を g-pub の URL で指定しても 404 |
| SAF-SEC-13 | ボディに `{"userId":"u-org","isOrganizer":true}` を付けて申請・承認 | 無視される(Cookie のユーザーで判定) |
| SAF-SEC-14 | Cookie `demoUser=../x`、`u-unknown`、空 | 既定のデモユーザー(00 の `meta.defaultUserId`)として扱う。権限が上がらない |
| SAF-SEC-15 | 他人の通知・通報・ブロック一覧を ID 指定で取得 | 404/403。応答に他人の ID を含まない |
| SAF-SEC-16 | `Content-Type: text/plain` / `application/x-www-form-urlencoded` で状態変更 POST | 415 unsupported_media_type(状態変更なし) |
| SAF-SEC-17 | `Origin: http://evil.example` で POST | 403 forbidden。`Origin: http://localhost:<port>` は通る |
| SAF-SEC-18 | 連投: チャット 6 件/10 秒、申請 6 件/10 分、通報 11 件/10 分 | 超過分が 429 rate_limited。`clock.set` で進めると解除 |
| SAF-SEC-19 | 本文 1MB の POST | 413 payload_too_large。サーバーは処理を続けられる(以降の要求に応答する) |
| SAF-SEC-20 | 応答ヘッダー | `Content-Type: application/json; charset=utf-8`、`X-Content-Type-Options: nosniff`、`Cache-Control: no-store`。エラーが HTML で返らない |
| SAF-SEC-21 | 通報本文・プロフィールに他人の連絡先らしき文字列を入れて `GET /…` で他者向け応答を走査 | 他者向けの応答に承諾前の realName・contact が含まれない(SAF-T-01〜04 と同根) |
| SAF-SEC-22 | ブロックされた u-x が、u-a の存在を示す差異(エラー文言)を探る | 申請拒否は一般文言。「ブロック」の語が応答に無い。応答時間の差の検査はデモ範囲外 |
| SAF-SEC-23 | 本番ビルド(`npm run build` → `npm start`)の応答ヘッダー(SAF-REQ-07 の反映後) | `X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`、CSP がある |
| SAF-SEC-24 | `npm audit --omit=dev`(app/ で実行) | 重大度 high 以上が 0 件。残る場合は内容と判断を記録する |
| SAF-SEC-25 | 禁止表現の拒否と通報を行った後にサーバーログを確認 | 入力本文、拒否された文字列、realName・contact が出力されていない(SAF-RULE-45) |

## 17. 他モジュールとの契約

### 17.1 呼び出し一覧(呼ぶ側 → 本モジュール)

| 呼ぶ側 | 呼ぶ関数(ID) | タイミング |
|---|---|---|
| 01 グループ中核 | `requireVerified(userId,"create_group")`(19)、`assertTextAllowed`(17: group_name、group_description、group_tag)、`assertGroupAccess`(25)、`maskGroup`/`getGroupRole`(05、04)、`checkRate("group_create")`(24) | 作成・更新・取得 |
| 02 グループ探索 | `isGroupVisibleTo`(06)、`hasBlockAmong`(11)、`maskGroup`(05)、`memberSummary`(07)、`rejectProhibitedParams`(27) | 一覧・詳細・招待コード |
| 03 参加申請・承認 | `requireVerified("request_join"/"join_by_invite_code")`、`assertNotBlocked`(12)、`assertTextAllowed`(join_note、reject_reason_free)、`visibleProfile(…,{kind:"request"})`(03)、`checkRate("join_request")`、`assertInGroup`(26) | 申請・承認・却下・一覧 |
| 05 旅程メモ | `assertTextAllowed("plan_note")`、`assertGroupAccess(…,"member")` | 保存 |
| 06 チャット | `assertTextAllowed("chat_message")`、`filterVisibleMessages`(13)、`assertNotBlocked`(12、必要な場合のみ)、`checkRate("chat_post")`、`createReport`(15。`reportMessage` の委譲先)、`assertInGroup` | 投稿・一覧・通報 |
| 07 費用メモ | `assertTextAllowed("expense_item")`、`assertGroupAccess(…,"member")` | 保存 |
| 10 通知 | `memberSummary`(確定通知の概要)。通報・ブロックでは通知を生成しない | 確定通知 |
| 12 自治体集計 | `suppressSmallCell`(08) | 集計 |
| 00 共通基盤 | なし。00 は 09 を import しない。SAF-FN-21・23 に当たる処理は 00 の `sanitizeText`・`route()` が実装し、09 は要件と試験を持つ(10.1) | - |

### 17.2 README・各骨子の名称との対応

| 旧(骨子の名称) | 本書の名称 |
|---|---|
| `visibleProfile(viewer, target, context)` | `visibleProfile(viewer, targetId, ctx)`(03)。内部で `maskProfile`(01)・`resolveProfileRelation`(02) |
| `isBlocked(a,b)` | `isBlocked`(09)。ほかに `isBlockedByMe`(10)、`hasBlockAmong`(11)、`assertNotBlocked`(12) |
| `report(user, target, reason, body)` / `block(user, target)` | `createReport`(15) / `blockUser`(14) |
| `checkText(text, field)` | `checkText(text, context)`(16)。`field` は `assertTextAllowed` の第 3 引数(エラー表示用の欄名) |
| `requireVerified(user)` | `requireVerified(userId, action)`(19)。操作名を引数に追加 |
| `memberSummary(members)` | `memberSummary`(07)。入力は `{ageBand}` の配列 |
| 06 `reportMessage(user, messageId)` | 06 が `createReport({targetType:"message", targetId})` へ委譲 |
| 01 `getGroup(user, id)` | 内部で `getGroupRole` → `maskGroup` を必ず通す |

## 18. 他モジュールへの要望(他ファイルは編集していない)

| ID | 宛先 | 要望 |
|---|---|---|
| SAF-REQ-01 | 00 | `Store.profiles`(Profile 全項目)・`verifications`・`blocks`・`reports` の追加。group-seed.json に 6.1 の公開設定を持つ Profile、確認済み・未確認・18歳未満のユーザー、試験用の g-pub/g-priv/g-other、禁止語を含まない seed 文言を用意。DemoUser と Profile の関係(重複する年代帯・表示名)の整理 |
| SAF-REQ-02 | 00 | `AppError.detail` で `reviewRequired: true`(禁止表現の review)、`reason: "not_verified" \| "underage"`(forbidden)、`retryAfterSec`(rate_limited)を返す。00 5.4 の `detail` で表せるため型の追加は不要。`toResponse` が `detail` を応答に含めることの確認のみ |
| SAF-REQ-03 | 00 | エラーコード `rate_limited`(HTTP 429)の追加(01、03、06 も同じ要望) |
| SAF-REQ-04 | 00 | Route Handler のラッパー(`route()`)で、Origin・Content-Type・本文サイズの検査、nosniff・no-store の応答ヘッダー、パスの ID の検査を全リクエストに適用する(00 5.5 に記載済み)。実装は 00 に置き、00 は 09 を import しない。09 は要件(10.5)と試験(SAF-SEC-16〜20)を持つ |
| SAF-REQ-05 | 00 | `/api/groups` 用のクライアント(`gapi`・`gpost`・`useGroupsApi`)の提供(00 5.9 で対応済み) |
| SAF-REQ-06 | 00 | Cookie `demoUser` を `HttpOnly`、`SameSite=Lax`、`Path=/` で設定(00 5.2 で対応済み) |
| SAF-REQ-07 | 00(app 全体) | `next.config.ts` に `headers()`(`Referrer-Policy: no-referrer`、`X-Frame-Options: DENY`、本番のみ CSP。10.2)を追加、ESLint の `react/no-danger` を有効化(app の変更を伴うため別途承認) |
| SAF-REQ-08 | 01 | `GroupRecord` の最終定義を通知。ストアのグループ・メンバーを 09 が直接読むため、メンバー状態の値(参加中/退会/辞退)と幹事の判定を明記。招待コードを幹事以外に返すか(#17)の決定 |
| SAF-REQ-09 | 02 | 一覧クエリの未知キーを `invalid_input` にし、`rejectProhibitedParams` を呼ぶ。一覧・詳細の整形は `maskGroup`/`isGroupVisibleTo` を使い、自前でフィールドを選ばない |
| SAF-REQ-10 | 03 | `listRequests` で `isBlocked` の申請者を除外。却下理由は定型選択を推奨(自由記入なら `reject_reason_free` を通す)。`JoinRequest` の状態を 09 が読めるよう Store.joinRequests の形を通知 |
| SAF-REQ-11 | 06 | チャット一覧は `filterVisibleMessages` を通してから返す(`since` のポーリングでも同様)。投稿は `checkRate("chat_post")` を通す。定型文方式に変えた場合は通知 |
| SAF-REQ-12 | 10 | 通報・ブロックでは通知を作らない。通知の変数にユーザー入力を入れない。確定通知の参加者概要は `memberSummary` の出力のみ |
| SAF-REQ-13 | 12 | 件数の表示に `suppressSmallCell` を使い、ユーザー ID・表示名を応答に含めない(閾値 3 は暫定) |
| SAF-REQ-14 | 05、07 | 禁止表現の検査を `assertTextAllowed` で通し、URL を自動リンク化しない。写真投稿を再利用する場合は 10.3 のファイル規則に従う(08) |

## 19. 依存・未決・設計上の確認事項

### 19.1 依存
- 00(`db`・`tx`、`currentUser`、`AppError`、`clock`、`newId`・`isId`、`v`・`sanitizeText`、`route`、`registerHook`、`groups-api`)。呼ばれる側: 01〜03、05〜07、10、12。画面は Mantine 9・既存 `AppShell` を使用。ライブラリは 3.1。

### 19.2 未決事項(SAF-Q)

| ID | 内容 | 対応する 12 章 | 本書の暫定 |
|---|---|---|---|
| SAF-Q-01 | 規制方針(警察・弁護士への確認前に安全側を暫定とするか) | #2 | 安全側の暫定(第8章)。法的判断ではない |
| SAF-Q-02 | 本人確認の水準(モックの形。実運用の水準) | #3 | 自己申告のモック(9.1) |
| SAF-Q-03 | 通報・ブロックのグループ側の挙動 | #8 | 案A+C(7.2)。`sameGroupOnBlock` で切替 |
| SAF-Q-04 | チャットの入力方式(定型文/自由入力+通報/入力時に弾く) | #9 | 入力時に弾く+通報(8.5) |
| SAF-Q-05 | 未成年の扱い(A/A'/B) | #10 | A(`deny_writes`) |
| SAF-Q-06 | 公開粒度(一覧・詳細・承認後の項目)、メンバー概要の丸めの閾値 | #16 | 6.3、6.4 |
| SAF-Q-07 | 禁止語辞書の範囲(実語彙の作成者・レビュー者) | - | カテゴリのみ本書で定義 |
| SAF-Q-08 | ブロックの対称性(効果の方向) | #8 | 一覧・申請は双方向、チャットは一方向 |
| SAF-Q-09 | 却下理由の自由記入の有無 | #15 | 定型選択を推奨 |

### 19.3 設計上の確認事項(docs/design や他モジュールとの矛盾・不足。直していない)

- SAF-CHK-01: 00 の骨子は DemoUser に公開設定の初期値を持たせ Profile を持たない。05 章は Profile(表示名、年代、一言、旅の目的、項目別の公開設定)を別エンティティとして記載。本書は Profile を `Store.profiles` で持つ案。
- SAF-CHK-02: 01 の Group の最終フィールド(日程・状態・実行条件)が未確定。`maskGroup` のホワイトリストは 01 確定後に合わせる。
- SAF-CHK-03: docs/design の「年代」の表現(年代帯の区切り、18〜19 歳の扱い)が未確定。本書は `18-19`〜`70s+` の 7 区分とした。
- SAF-CHK-04: 06 は連投制限を「60 秒に 5 件」とし、本書の `RATE_LIMITS.chat_post`(5 件/10 秒)と異なる。値は 06 と合わせる(変更は `RATE_LIMITS` の値のみ)。
- SAF-CHK-05: 02 要件の「18歳未満は利用できない」と、本書の案A(閲覧は可、書き込みのみ不可)の差。`minorPolicy="deny_all"` にすれば「利用できない」に厳密に合う。 [未決 #10]
- SAF-CHK-06: 12 #8 は「通報・ブロックのグループ側の挙動」を未決とするが、02・03 の骨子は一覧・申請でのブロックの効果を前提にしている(本書は前提どおり実装し、グループ内の扱いだけを切替可能にした)。
- SAF-CHK-07: 骨子 09 の「ブロックは双方向に効かせるか自分側のみか」は、本書では用途別に分けた(7.2)。決定時に変更が要る。
- SAF-CHK-08: 00 の骨子にある「forbidden / not_found: 非表示グループ(存在を隠す)」と、03 の「forbidden: 未確認ユーザー」を、理由コード(SAF-REQ-02)で区別する必要がある。本書は `detail.reason` で区別する(第14章)。
- SAF-CHK-09: 既存 `lib/api.ts` の `/api/v2` 固定により、新 API を `useApi` で呼べない(SAF-REQ-05)。00 5.9 の `groups-api.ts` で解消する。
- SAF-CHK-10: 年代帯の概要の差分推測(人数が 3 から 4 に変わる前後、6.4)。デモでは対処せず、実運用で検討する。
- SAF-CHK-11: 00 4.2 の型との差。`AgeBand`(00 は `under18`〜`60plus` の 6 区分、本書は `18-19`〜`70s+` の 7 区分)、`Visibility` の名前の衝突(00 はグループの `public`/`private`、プロフィール項目は `FieldVisibility = public/members/private`。本書はプロフィール項目の 4 段階)、`Verification`・`Report`・`Block` の項目、Store の持ち方(00 は配列、本書 4.1 は userId をキーとする形)、Group のフィールド名(00 は `startDate`/`endDate`、`minMembers`、`state`、`isOfficial`。本書 `GroupRecord` は `dates`、`minCount`、`status`、`official`)。00 4.2 は「必須項目の追加・型変更は 00 の改訂」とするため、00 との調整が要る。
- SAF-CHK-12: 00 の `v.object` は未知キーを捨てる(00 5.10)。本書の更新 API はこれに従い、未知キーを反映しない(以前の本書の案は `invalid_input` で拒否)。性別・細かい年齢のキーは `rejectProhibitedParams` で `invalid_input` にする。
- SAF-CHK-13: 他モジュールの禁止表現の呼び出し形式が本書と異なる。01 `checkText(text, "group.name")` と戻り値 `{ok, reason, term?}`、03 `"note"`、06 `"chat"`、07 `"expense.title" | "expense.memo"`、08 `"rally.photoCaption"`・`"rally.memo"`(本書の `TextContext` に無い)。本書の `TextContext` と `assertTextAllowed` への統一、08・11 の文脈の追加が要る。
- SAF-CHK-14: `visibleProfile` の第 3 引数が、01・05・07 は `"member"`、02 は `"list" | "detail"` の文字列で、本書は `ProfileContext`(groupId を含むオブジェクト)。`memberSummary` の入力が 10 は `GroupMember[]`、本書は `{ageBand}` の配列。04 の `summarizeParticipants` と 02 の概要は年代帯の区分・人数の扱いを独自に定義しており、本書 SAF-RULE-08(まとまりごとの人数を返さない)と異なる。
- SAF-CHK-15: `_` で始まるフォルダは App Router のルーティング対象外(00 4.1)。本書は SAF-API-12 を `/api/demo/reports` に変更した。03 の `/api/groups/_invite/resolve` も同じ問題がある。

## 20. 実装メモ(デモ範囲の最小実装)

- 最小(S): 禁止表現の検査(SAF-TASK-02〜05)、公開範囲(TASK-07、08、12。年代帯のみ・概要の丸め)、IDOR の検査(TASK-11)、性別項目の静的検査(TASK-14)。
- 次点(A): ブロック・通報の記録と効果(TASK-06、09、16)、本人確認モック(TASK-10、17)、画面(TASK-15〜18)。
- 余力(B): レート制限の画面表示、プレビュー(`ProfilePreview`)、誤検知報告の導線、`deny_all`/`leave` 切替。
- デモで確認する内容: 視点切替(幹事/申請者/他メンバー/未確認/18歳未満)で同じプロフィールの表示項目が変わること、禁止語・連絡先が拒否されること、ブロック後に相手のグループが一覧に表示されなくなること。本人確認・通報の画面に「モック」を明示し、規制に関する記述が法的判断ではない暫定方針であることを README 等に記載する。
