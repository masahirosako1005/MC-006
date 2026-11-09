# 詳細設計 横断レビュー(API・関数契約・データモデル・データフロー)

状態の凡例は README に従う。本書はレビュー結果であり、各モジュールのファイルは変更していない。
対象: docs/feature の README、_template、00〜12(2026-11-09 12:55〜13:13 時点の内容)、docs/design 全章、rule/rule.md、app/ の既存構成(`api/v2/[...path]/route.ts`、`lib/server-store.ts`、`lib/api.ts`、`package.json`)。
各モジュールは並行で改訂中のため、行番号は参照時点の値である。指摘 ID: F=致命、I=重要、M=軽微。

## 1. 概要と結論

### 1.1 件数

| 重大度 | 件数 | 定義 |
|---|---|---|
| 致命(F) | 16 | このままでは実装できない、または呼び出し側と提供側の契約が食い違う |
| 重要(I) | 30 | 実装は可能だが、二重処理・断絶・方針の不一致があり、後で手戻りになる |
| 軽微(M) | 7 | 名称・表記・応答コードの細部 |
| 合計 | 53 | |

### 1.2 結論

- 各モジュールの内部設計は詳細化が進んでいるが、**モジュール間の共有定義(状態名、Group の形、ID 形式、Store、エラー形式、通知、ルーティング)が 00 と各モジュールで別々に決められており、3〜6 通りの定義が並存している**。00 の §4.2 は全エンティティを定義しているが、所有モジュール側(03、05〜10)は 00 と異なる形を独自に定義している。
- ルーティングは 00 が「リソースごとの route.ts」、01・03〜08 が「キャッチオール `[...path]` へのハンドラ登録」、02・10・12 が「静的 route.ts」を前提としている。動的セグメント名も `[id]` と `[groupId]` が混在し、Next.js では同一階層で名前が異なるとビルドできない。
- 関数契約は、呼び出し側の想定と提供側の定義が一致しないものが 40 件中 27 件ある(第 3 章)。特に `notify`(10 は引数オブジェクト、03・04・06・08 は位置引数)、`checkText`(09 は文脈 `TextContext` と判定結果オブジェクト、他は欄名と `{ok}`)、lifecycle の書き込み関数(01 `applyLifecyclePatch` と 04 `patchGroupLifecycle`)が食い違う。
- データフローでは、申請の失効(03 の遅延失効と 04 の `expirePendingRequests` の二重)、退会と辞退の二重経路(01 `/leave` と 04 `/withdraw`)、システムメッセージ(06)と退会フック(07)を誰も呼ばない、流入計測(11 と 12 で別の記録形式)の断絶がある。

### 1.3 実装着手前に必ず解消する項目

第 8 章の適用順序 S0〜S2 に相当する。

| 順 | 項目 | 指摘 |
|---|---|---|
| 1 | ルーティング方式・動的セグメント名・予約パス・URL 名前空間の確定 | F-01、F-02、F-03 |
| 2 | 共有型の所有規則(00 は基本型と Store の枠のみ、エンティティの形は所有モジュール)と、00 §4.2 の同期 | F-12 |
| 3 | GroupStatus の値・型名、Group の形(lifecycle の入れ子)、締切の型 | F-04、F-05、F-06 |
| 4 | ID 形式と接頭辞表、Store のアクセサとコレクション一覧 | F-10、F-11 |
| 5 | エラー応答形式(`reason`・`detail`)と追加コード | F-13 |
| 6 | 01 の素の取得関数・lifecycle 書き込み関数の名前と署名 | F-07、F-16 |
| 7 | `notify`・`checkText`(`assertTextAllowed`)・`visibleProfile`・`memberSummary` の署名 | F-08、F-09、I-04、I-05 |
| 8 | 退会/辞退の経路と申請失効の担当 | F-14、F-15 |

## 2. API 一覧と指摘

### 2.1 現在の記述(モジュール別。パスは原文の表記)

`/api/groups` は省略して `…` と書く。ルーティング前提の列: C=キャッチオール登録、R=リソースごとの route.ts、S=静的 route.ts。

| 担当 | メソッド・パス | 認可 | 要点 | 前提 |
|---|---|---|---|---|
| 00 | GET/POST `/api/demo/me`、GET `/api/demo/users`、GET/POST `/api/demo/clock`、POST `/api/demo/reset` | Cookie。POST は `DEMO_TOOLS` が off なら 404 | デモユーザー切替・時計・リセット | R |
| 01 | POST `…` | 本人確認済み | 作成(`CreateGroupInput`)→ 201 `GroupDetailView` | C |
| 01 | GET `…/:id` | メンバー/幹事。公開の非メンバーは 02 の公開ビューへ振り分け | `GroupDetailView` | C |
| 01 | PATCH `…/:id` | 幹事 | `UpdateGroupPatch` | C |
| 01 | GET `…/:id/members` | メンバー | `MemberView[]` | C |
| 01 | POST `…/:id/leave` | 本人 | 退会(usecase が 04 `evaluate`・10 `notify` を呼ぶ) | C |
| 01 | GET/POST `…/:id/invite-code`、POST `…/:id/invite-code/reissue` | 幹事 | 招待コード | C |
| 01 | POST `…/_invite/verify` | 利用者 | コード → `InvitePreview` | C |
| 01 | GET `…/_meta?campaign=` | 利用者 | 地方・タグ候補・上限値 | C |
| 02 | GET `…` | 利用者 | 一覧(`GroupListResponse`、page/pageSize) | S(`groups/route.ts` は 00/01 所有) |
| 02 | GET `…/:id`(ファイル `[id]`) | 公開は誰でも、非公開は関係者 | `PublicGroupDetail` | S |
| 02 | POST `…/invite-lookup` | 利用者 | コード → `PrivateGroupPreview` | S |
| 02 | GET `…/regions?campaign=` | 利用者 | 地方マスタ | S |
| 03 | POST/GET `…/:id/join-requests`、GET `…/:id/join-requests/mine` | 申請者/幹事/本人 | 申請・一覧・自分の状態 | C |
| 03 | POST `…/:id/join-requests/:rid/{approve,reject,withdraw}` | 幹事/幹事/申請者 | 判断・取り下げ | C |
| 03 | POST `…/_invite/resolve` | 利用者 | コード → `{groupId}` | C |
| 03 | GET `…/_me/join-requests` | 本人 | 自分の申請一覧 | C |
| 04 | GET `…/:id/lifecycle`、POST `…/:id/withdraw`、POST `…/:id/cancel`、PATCH `…/:id/conditions`、GET `…/:id/replan-draft`、POST `…/:id/replan`、GET `…/:id/status-log` | メンバー/本人/幹事 | 状態・辞退・中止・条件変更・再企画 | C |
| 04 | GET/POST `…/_demo/clock` | デモ | 日付を進める | C |
| 05 | GET `…/:groupId/plan`、GET/POST `…/plan/items`、PUT `…/plan/meeting`、PUT `…/plan/memo`、PATCH/DELETE `…/plan/items/:itemId`、POST `…/plan/items/reorder` | メンバー(編集は `canEdit`) | 楽観ロック `baseVersion`、DELETE はクエリ `baseVersion`、200 `{deleted}` | C |
| 06 | GET/POST `…/:groupId/messages`、POST `…/messages/:messageId/report`、POST `…/:groupId/chat/read`、GET `…/chat/templates` | メンバー(投稿は `canChat`)、templates は認証不要 | ポーリング `sinceId`/`before` | C |
| 07 | GET/POST `…/:id/expenses`、PUT/DELETE `…/expenses/:eid`、GET `…/expenses/summary` | メンバー | 楽観ロック `expectedVersion`、DELETE はクエリ `version`、204 | C |
| 08 | GET `…/:id/rally`、POST `…/:id/stamps`、GET `…/:id/review`、POST `…/review/{memo,survey,photos}`、POST `…/review/photos/:photoId/delete` | メンバー(状態別) | 削除も POST | C |
| 09 | GET/PUT `…/me/profile`、GET `…/users/:userId/profile`、GET/POST `…/me/blocks`、POST `…/me/blocks/:userId/unblock`、POST/GET `…/reports`・`…/me/reports`、GET/POST `…/me/verification`、GET `…/_dev/reports` | 本人 | すべて `/api/groups/...` 配下と記載 | 記載なし |
| 10 | GET `…/notifications`、GET `…/notifications/unread-count`、POST `…/notifications/:id/read`、POST `…/notifications/read-all` | 本人 | 既存 `/api/v2/notifications` とは別 | S |
| 11 | GET `/api/entry/resolve`、POST `/api/entry/events`、GET `/api/entry/stats`、GET/POST `/api/official`、GET `/api/official/:groupId`、POST `/api/hosts/slots` | 利用者/自治体/地元 | `/api/groups` と別名前空間 | 記載なし |
| 12 | GET `…/stats` | 自治体ロール | 指標 | S |

### 2.2 API の指摘

| ID | 重大度 | 内容 | 該当 | 統一案 |
|---|---|---|---|---|
| F-01 | 致命 | ルーティング方式が 3 通り。00 §4.1(L112)はリソースごとの route.ts を推奨し README 4.1 の `[...path]` を不採用とした。01 §5.2・03 §5・04 §10・05 §5.2/§15・06 §16・07 §5.3・08 §2.3/RLY-REQ-02 はキャッチオールへのハンドラ登録(`handlePlanRoute`、`handleRally`、`JoinRoutes`、`handlers.ts`)を前提とする。02・10・12 は静的 route.ts | 00 §4.1/§16-2、README 4.1 | **リソースごとの route.ts に統一**(00 案)。各モジュールは `features/<m>/handlers.ts` に `route()` でラップしたハンドラを置き、`app/api/.../route.ts` は 1 行の再エクスポートにする。登録表・ディスパッチャは作らない。README 4.1 を更新 |
| F-02 | 致命 | 動的セグメント名の混在。`[id]`/`:id`(01、02 のファイル `app/api/groups/[id]/route.ts`、03、04、07、08)と `[groupId]`(00 の例 L558、05、06、README、画面パス)。Next.js は同一階層で異なる名前の動的セグメントを許さない | 02 §5.1、05 §16-4、06 §17-3、08 §11.3-2 | **`[groupId]` に統一**。子資源は `[requestId]`、`[itemId]`、`[messageId]`、`[expenseId]`、`[photoId]`、`[notificationId]`、`[userId]` |
| F-03 | 致命 | `_` で始まるパス(01 `_invite`・`_meta`、03 `_invite`・`_me`、04 `_demo`、06・02 の `_reset`、09 `_dev`)。リソースごとの route.ts では `_` 始まりのフォルダはプライベートフォルダとしてルーティングされない(00 L113 [要確認])。また 09 の `me`、`users`、`reports` と 10 の `notifications`、12 の `stats`、06 の `chat` が `/api/groups/<静的>` に置かれ、グループ以外の資源がグループ名前空間に混在する | 00 §4.1、09 §11、10 §6.6、12 §7.2 | `_` 始まりのパスを廃止し、グループに属さない資源は別名前空間へ移す(2.3 の案)。`/api/groups` 直下の静的セグメントは `regions`、`invite-lookup` の 2 つに限定する。グループ ID が `g-` で始まる規則(F-11)で静的セグメントと衝突しない |
| I-01 | 重要 | HTTP メソッドの方針が不一致。README 4.3 は「状態を変える操作は POST」、00 §5.5 は POST/PUT/PATCH/DELETE を許可するがクライアントに `gput` がない。05 は PUT/PATCH/DELETE、07 は PUT/DELETE(204)、08 は削除も POST(`…/delete`)、04 は PATCH、09 は PUT | README 4.3、00 §5.9、05 §5.2、07 §5.3、08 §5.2 | **GET/POST/PATCH/PUT/DELETE を許可**。全置換は PUT、部分更新は PATCH、削除は DELETE(本文なし、版はクエリ `baseVersion`)。状態遷移の操作は POST の動詞サブパス(`approve`、`withdraw`、`cancel` 等)。08 の `…/delete` は DELETE に変更。00 に `gput` を追加 |
| I-02 | 重要 | クライアントの名称と範囲が不一致。00 は `gapi/gpost/gpatch/gdelete/useGroupsApi`(`ApiError{code,status,fields,detail}`)。02・06・09 は `groupsApi`、03 は独自 `joinApi`(ベース `/api`、`JoinClientError{code,reason,…}`)、08 は `rally/client.ts`。既存 `lib/api.ts` は `/api/v2` 固定で `message`/`fields` を捨てる | 00 §5.9、03 §8.4、08 §2.3 | 00 の `lib/groups-api.ts` に一本化し、`ApiError` に `reason` を追加(F-13)。モジュール固有クライアントは作らず、必要なら 00 の関数を呼ぶ薄い関数のみ |
| I-03 | 重要 | 重複 API: 招待コード照合が 3 本(01 `_invite/verify`、02 `invite-lookup`、03 `_invite/resolve`)。地方マスタが 2 本(01 `_meta`、02 `regions`)。`GET …/[groupId]` が 01 と 02 の両方。退会が 2 本(01 `leave`、04 `withdraw`。F-14)。日付操作が 2 本(00 `/api/demo/clock`、04 `_demo/clock`)。リセットが 2 通り(00 `/api/demo/reset`、06・02 の `_reset`)。流入集計が 2 本(11 `/api/entry/stats`、12 `stats` の MUN-M-08) | 01 §5.2、02 §5.1、03 §8.2、04 §10 | 招待コードは `POST /api/groups/invite-lookup`(02 が DTO、照合は 01 `verifyInviteCode`)の 1 本。地方は `GET /api/groups/regions`(02)。`GET /api/groups/[groupId]` は 1 ファイル(所有 01)で役割により 01/02 のハンドラに振り分け。日付・リセットは 00 の `/api/demo/*` のみ。流入集計は 12 の API から 11 `aggregateFunnel` を呼ぶ |
| I-19 | 重要 | ページングの形式が 3 通り。00 `Page<T>{items,total,limit,offset,hasMore}`(R-02-1 で 02 に要求)、02 `{items,total,page,pageSize,totalPages}`、10 カーソル `{items,nextCursor}`、06 `sinceId/before` | 00 §5.6、02 TY-09、10 §5.1 | 一覧は 00 の `Page<T>` に統一(02 は `page`/`pageSize` を UI 側で limit/offset に換算)。時系列の追記型(06 チャット、10 通知)はカーソル方式を例外として許容し、00 に「カーソル型 `CursorPage<T>{items,nextCursor}`」を追加 |
| M-02 | 軽微 | 削除の応答: 05 は 200 `{deleted:true,itemsRevision}`、07 は 204、08 は 200 `{ok:true}`、00 は 204 を `noContent()` 明示時のみ | 05、07、08 | 本文で返す値がない削除は 204。05 のように再計算値を返す場合のみ 200 |
| M-03 | 軽微 | 06 のパスが `…/messages` と `…/chat/read` で接頭辞が揃っていない。定型文 API がグループ ID なしで `/api/groups/chat/templates` | 06 §5.2 | `…/[groupId]/messages/read` に変更。定型文はクライアントの定数とし API を廃止(06 自身が省略可としている) |

### 2.3 統一後の URL 案(F-01〜F-03、I-03 の適用結果)

| 名前空間 | パス(`route.ts` の場所) | 所有 |
|---|---|---|
| デモ | `/api/demo/{me,users,clock,reset}` | 00 |
| グループ | `/api/groups`(GET 一覧=02、POST 作成=01)、`/api/groups/regions`(02)、`/api/groups/invite-lookup`(02、照合は 01) | 01/02 |
| グループ個別 | `/api/groups/[groupId]`(GET=01 が振り分け、PATCH=01)、`/members`(01)、`/invite-code`、`/invite-code/reissue`(01) | 01 |
| 参加申請 | `/api/groups/[groupId]/join-requests`、`/mine`、`/[requestId]/{approve,reject,withdraw}` | 03 |
| 実行条件 | `/api/groups/[groupId]/{lifecycle,withdraw,cancel,conditions,replan-draft,replan,status-log}` | 04 |
| 旅程 | `/api/groups/[groupId]/plan`、`/plan/{meeting,memo,items}`、`/plan/items/[itemId]`、`/plan/items/reorder` | 05 |
| チャット | `/api/groups/[groupId]/messages`、`/messages/read`、`/messages/[messageId]/report` | 06 |
| 費用 | `/api/groups/[groupId]/expenses`、`/expenses/summary`、`/expenses/[expenseId]` | 07 |
| ラリー | `/api/groups/[groupId]/{rally,stamps,review}`、`/review/{memo,survey,photos}`、`/review/photos/[photoId]` | 08 |
| 本人 | `/api/me/{profile,blocks,reports,verification,join-requests}`、`/api/me/blocks/[userId]`(DELETE で解除) | 09、03 |
| 通知 | `/api/me/notifications`、`/unread-count`、`/[notificationId]/read`、`/read-all` | 10 |
| 利用者 | `/api/users/[userId]/profile?context=` | 09 |
| 通報 | `/api/reports`(POST)、`/api/dev/reports`(開発のみ) | 09 |
| 入口B・公式 | `/api/entry/{resolve,events}`、`/api/official`、`/api/official/[groupId]`、`/api/hosts/slots` | 11 |
| 集計 | `/api/stats` | 12 |

- 静的セグメントが同階層の動的セグメントより優先されることは Next.js の既知の挙動だが、本 worktree では `node_modules/next/dist/docs/` を確認できていない [要確認]。実装の最初のタスクで確認する。

## 3. 関数契約の突き合わせ

判定: ○=一致、△=名前または細部の差、×=署名・戻り値・意味が食い違う、欠=提供側に定義がない。すべての service は同期(00 R-ALL-1、03・04・05・06・07・10 が明記)で、同期/非同期の食い違いはない。

| # | 呼び出し元 → 先 | 呼び出し側の想定 | 提供側の定義 | 判定 | 統一案 | 指摘 |
|---|---|---|---|---|---|---|
| 1 | 03 → 04 | `canAcceptRequests(g)`: boolean、理由付き版を要望 | `canAcceptRequests(g: GroupLike, now?)`: boolean | △ | boolean のまま。理由は 04 `getCapabilities(g,user).deniedReason` から取る | - |
| 2 | 05/06 → 04 | `canEdit(group)`、`canChat(group)`: boolean | 同名、`canChat = canEdit` | ○ | - | - |
| 3 | 07 → 04 | `canEditExpenses(g): {ok,reason}`。募集中〜完了で可、中止で不可 | `canEditExpenses(g): boolean`。実行確定・実施中・完了のみ可 | × | 第 6.1 表を 04 が正とし、07 の §6.2 を合わせるか、04 が募集中からの記録を許可するかをオーナー判断。戻り値は boolean | I-09 |
| 4 | 08 → 04 | `canStamp(g)`、`canReview(g)` | `canCollectStamps(g)`、`canReview(g)` | △ | `canCollectStamps` | I-09 |
| 5 | 05 → 04 | `statusLabel(group)` | 関数なし(04 `messages.ts` の `STATUS_LABEL`、00 `features/groups/labels.ts` も別に定義) | 欠 | 04 が `statusLabel(status)` を公開。00 の labels.ts は廃止 | M-04 |
| 6 | 04 → 01 | `patchGroupLifecycle(groupId, expectedRevision, patch): GroupLifecycle`(不一致は conflict) | `applyLifecyclePatch(id, patch): Group`(revision なし) | × | `applyLifecyclePatch(groupId, expectedRevision, patch): GroupLifecycle`。`lifecycle.revision` を 01 の型に追加 | F-07 |
| 7 | 03/04/06 → 01 | `getGroupRaw(id)`(03・04)、`findGroupRaw(id)`(06) | 01 `getGroupById(id): Group \| undefined`、00 `requireGroup(id)`(無ければ not_found) | × | 素の取得は 00 `requireGroup(id)`(例外)と 01 `getGroupById`(undefined)の 2 つに限定。他の名前は使わない | F-16 |
| 8 | 01 → 呼び出し側 | 05・06・07・08 は `getGroup(user,id)` で Group(status・日程を含む)を取得し、非メンバー判定は自前 | `getGroup(user,id): GroupDetailView`。公開の非メンバーは forbidden を投げる | × | 05〜08 は 09 `assertGroupAccess(user.id, groupId, "member")`(Group を返す)を使う。`getGroup` は 01 の API 専用 | F-16 |
| 9 | 03/04 → 01 | `activeMemberCount(groupId)`(03)、`countActiveMembers`(04) | 01 `countActiveMembers(id)`、00 `activeMembers(group)` | △ | `countActiveMembers` | - |
| 10 | 04 → 01 | `listActiveMemberIds(groupId): string[]` | 01 `listActiveMembers(id): GroupMember[]`、00 `activeMembers(group)` | △ | 00 `activeMembers` に一本化し 01 は再エクスポート | I-10 |
| 11 | 04 → 01 | `markMemberLeft(groupId, userId, at)`(状態チェックなし) | なし。01 は `leaveGroup(user,id)`(利用者操作) | 欠 | 01 に `markMemberLeft` を追加し、`leaveGroup` は廃止(F-14) | F-14 |
| 12 | 03 → 01 | `addMember(groupId, userId)`、満席・既メンバーで conflict | `addMember(groupId, userId, role?)`、`conflict`(`group_full`/`already_member`) | ○ | - | - |
| 13 | 03 → 04 | `evaluate(group, now)` を承認直後に呼び、状態を永続化 | `evaluate(groupId, now?)`、承認後用に `onMembershipChanged(groupId, now?)` | × | 03 は `onMembershipChanged(groupId)` を呼ぶ | F-15 |
| 14 | 01 → 04 | `leaveGroupUsecase` が `evaluate(group, clock.now())` を呼ぶ(README の「01 は 04 を呼ばない」に反する) | 同上 | × | 退会経路を 04 `withdraw` に一本化して解消 | F-14 |
| 15 | 04 → 03 | `expirePendingRequests(groupId, reason): string[]` | なし。03 は `settleRequestsIfClosed(groupId): number` を自分の入口で遅延実行し、「04 は 03 を呼ばない」と記載 | × | 失効は 04 の遷移時に 1 回だけ行う(03 が `expirePendingRequests` を公開し、03 の遅延失効は廃止)。依存は 04 → 03 | F-15 |
| 16 | 03/04/06/08 → 10 | `notify(userId, type, groupId, vars)`(04 は `opts{dedupeKey,at}` 付き) | `notify(input: NotifyInput)`(`kind`、`groupId`、`eventKey`、`params`、`recipients`) | × | 10 の `NotifyInput` に統一 | F-08 |
| 17 | 06 → 10 | `markReadWhere(userId,{type,groupId})`、`hasUnread(userId,type,groupId)` | なし。10 は `chat_new` を内部で集約 | 欠 | `hasUnread` は不要(10 が集約)。10 に `markReadByKind(userId, kind, groupId)` を追加 | I-28 |
| 18 | 10 → 04 | `evaluateGroupsForUser(userId, now)` | なし(04 は `evaluateAll(now?)`) | 欠 | 00 の `route()` が全ハンドラの前に `evaluateAll` を呼ぶ(I-11)ため不要 | I-11 |
| 19 | 10 → 09 | `memberSummary(members: GroupMember[]): {text, coarse}` | `memberSummary(members: {ageBand}[]): MemberSummary{count,buckets,hiddenReason}` | × | 09 の形を正とし、09 に `formatMemberSummary(s: MemberSummary): string` を追加 | I-05 |
| 20 | 02 → 09 | `memberSummary` が `MemberSummaryView{level: hidden\|coarse\|fine}`(1〜2/3〜4/5〜6 人) | 同上(4 人未満は非表示) | × | 09 の規則と型を正とし、02 は表示のみ | I-05 |
| 21 | 01/03/05/06/07/08/11 → 09 | `checkText(text, field)`。戻り値は `{ok,reason}`(05)、`{ok,category,matched,hint}`(06)、`{ok,reason,term}`(01)。field は `group.name`、`note`、`chat`、`plan.item.title`、`expense.title`、`rally.memo` 等 | `checkText(text, context: TextContext): TextCheckResult{verdict,findings,reason,suggestion}`。保存系は `assertTextAllowed(text, context, field, {ackReview})` | × | 保存系は `assertTextAllowed` を呼ぶ。文脈名は 09 の `TextContext` に追加して揃える(F-09) | F-09 |
| 22 | 01/03/05/07/08 → 09 | `visibleProfile(viewer, target, "member"\|"request"\|"list")` | `visibleProfile(viewer:{id}, targetId, ctx: {kind,groupId?})` | × | 09 の形。呼び出し側は `{kind:"member", groupId}` を渡す | I-04 |
| 23 | 06 → 09 | `isBlocked(viewer, sender)` を一方向と仮定してチャットを隠す | `isBlocked(a,b)` は双方向。一方向は `isBlockedByMe`、チャット用は `filterVisibleMessages` | × | 06 は `filterVisibleMessages(viewerId, msgs)` を使う | I-06 |
| 24 | 06 → 09 | `report(user, target, reason, body)`、`ReportReasonId` | `createReport(user, input)`、`ReportReason` | × | 09 の形 | I-07 |
| 25 | 03 → 09 | `requireVerified(user)`、理由 `verification_required`/`age_restricted` | `requireVerified(userId, action)`、forbidden の理由 `not_verified`/`underage` | × | 09 の署名と理由コード | I-23 |
| 26 | 04 → 09 | `canView(user, group)` | なし。`isGroupVisibleTo(viewerId, group, opts)`、`assertGroupAccess` | 欠 | `isGroupVisibleTo` | I-10 |
| 27 | 02 → 01 | `resolveInviteCode(code): Group \| null` | なし。`verifyInviteCode(user, rawCode): InvitePreview`、`assertInviteCode(groupId, rawCode)` | 欠 | 01 に `findGroupByInviteCode(rawCode): Group \| undefined`(試行回数の検査は 09 `checkRate`)を追加し、02・03 が使う | I-03 |
| 28 | 03 → 01 | `findGroupByInviteCode(code)` | 同上 | 欠 | 同上 | I-03 |
| 29 | 11 → 01 | `markOfficial(groupId)` | なし。`createGroupInternal(input & {official, officialHost, organizerId})` | 欠 | 11 は `createGroupInternal` を使う | I-18 |
| 30 | 11 → 04 | `cancel(user, id, reason)` | `organizerCancel(user, groupId, reason: OrganizerCancelReason)` | △ | `organizerCancel` | - |
| 31 | 11 → 02 | `listGroups(user, filter, page)` | `listGroups(viewer, filter)`(page は filter 内) | △ | 02 の形 | - |
| 32 | 12 → 11 | `store().entryEvents` の `EntryEvent{at,campaign,region,channel}` と `recordEntry` | `funnelEvents` の `FunnelEvent{type,day,campaign,channel:"A"\|"B",source,…}` と `aggregateFunnel(q)` | × | 12 は `aggregateFunnel` を呼び、MUN-M-08 の入口区分を 11 の `channel`・`source` で定義 | I-17 |
| 33 | 12 → 08 | `store().groupStamps` の `acquiredAt` を直接読む | 08 は `at`。集計用 `rallyAggregate(filter,{minCell})` を提供 | × | 12 は `GroupStamp.at` を読む(facts アダプタ)。`rallyAggregate` は 12 が使わないなら 08 から削除 | I-26 |
| 34 | 07 → 01 | `listMembers(groupId, {includeLeft})`、`GroupMember.status: "active"\|"left"` | `listMembers(user, id): MemberView[]`(参加中のみ、09 を通す) | × | 素の一覧は 00 `db().members.filter(...)` か 01 `listMembersRaw(groupId,{includeLeft})` を追加 | I-22 |
| 35 | 05 → 01 | `getGroupSchedule(group)` | なし(`group.trip.startDate/endDate` を直接読める) | 欠 | 関数は作らず `group.trip` を読む | - |
| 36 | 04 → 05 | `copyPlanDraft(fromGroupId, toGroupId)`(任意) | なし(05 は最小実装で提供しない) | 欠 | デモ範囲では呼ばない。採る場合は 05 に追加 | I-29 |
| 37 | 01/03/04 → 06 | 06 は 01 `createGroup`・`leaveGroup`、03 `approve`、04 の各遷移から `postSystemMessage` が呼ばれる前提 | 01・04 は呼び出しを記載していない(01 は 06 に依存しない設計) | 欠 | 00 のフック機構でイベント購読にする(I-20、I-21) | I-21 |
| 38 | 01 → 07 | 07 は退会時に `onGroupMemberLeft`、退会画面で `unsettledBalanceOf` が呼ばれる前提 | 01・04 は記載なし | 欠 | 同上(イベント購読)。退会画面は 07 の関数を 04 の UI が呼ぶ | I-22 |
| 39 | 02 → 03 | `getMyRequestStatus(user, groupId): "none"\|"pending"` | `getMyRequest(user, groupId): MyRequestState`、`hasPendingRequest(userId, groupId)` | △ | `hasPendingRequest` | - |
| 40 | 02/03 → 11 | 11 は 02・03 が `recordFunnelEvent` を呼ぶ前提 | 02・03 は記載なし | 欠 | デモ範囲では 11 の着地記録のみとし、02・03 からの呼び出しは任意(I-17) | I-17 |

## 4. データモデルの不一致

### 4.1 指摘一覧

| ID | 重大度 | 項目 | 現状(モジュール: 値) | 統一案(正とする定義と理由) |
|---|---|---|---|---|
| F-04 | 致命 | GroupStatus の値・型名・項目名 | 00: 型 `GroupState`、項目 `state`、値 `recruiting,minReached,withdrawalPeriod,confirmed,inProgress,completed,cancelled`。01・02: 型 `GroupStatus`、`lifecycle.status`、値 `recruiting,min_reached,withdrawal_period,confirmed,in_progress,completed,cancelled`。04: `lifecycle.status`、値 `recruiting,reached,withdrawal,confirmed,in_progress,completed,cancelled`。08: 04 の型を import。docs/design 04・05: 7 状態+「再企画(済み)」 | 型 `GroupStatus`、項目 `group.lifecycle.status`、値は **01・02 の snake_case 7 値**。理由: 7 状態は docs/design と一致、他の列挙(通知種別、理由コード)が snake_case、01・02 が既に採用。04 が型を所有し(`lifecycle/types.ts`)、00 §4.2 は 04 を参照する。「再企画済み」は 04 の `displayStatus`(`cancelled` かつ `replannedToGroupId` あり)で表し状態にしない |
| F-05 | 致命 | Group の形と項目名 | 00: 平坦(`startDate`、`endDate`、`destination`、`campaign`、`region`、`description`、`isOfficial`、`deadline`、`withdrawalEndsOn`、`replanOfId`、`replannedToId`)。01: `trip{destination,startDate,endDate,dateNote}`、`campaignId`、`regionId`、`summary`、`official`、`officialHost`、`lifecycle{…}`。04: `lifecycle{status,minMembers,deadlineAt,deadlineExtendedCount,withdrawalStartedAt,withdrawalEndsAt,confirmedAt,startedAt,completedAt,cancelledAt,cancelReason,organizerCancelReason,replanOfGroupId,replannedToGroupId,…,revision}`。09 `GroupRecord`: `dates{start,end}`、`region`、`minCount`、`status`。12: `canceledAt`、`replannedFromId`。02: `regionId`、`minPeople`、`description` | **01 の構造(`trip` と `lifecycle` の入れ子)+ 04 の lifecycle 項目**を正とする。項目名は `campaign`、`region`(00・02・09・12 の多数)、`description`(00・09)、`official`(01・09・11・12)。`officialHost` は廃止し 11 の Listing から表示する。lifecycle は 04 の項目名(`replanOfGroupId`、`replannedToGroupId`、`cancelledAt`)。09 `GroupRecord` と 12 の facts アダプタはこの形を読む |
| F-06 | 致命 | 締切の型 | 00・01: `DateStr`(当日末まで)。04: 入力 `deadlineDate`、内部 `deadlineAt`(翌日 0:00+09:00、排他)。02 `GroupSummary.deadline`: ISO 日時。10 `deadline_near.params.deadline`: ISO 日時。docs/design 05: 日付 | `lifecycle.deadlineDate: DateStr` を正(docs/design 05 と一致)とし、04 が `deadlineAt: IsoDateTime` を派生値として同時に保存する(判定は `deadlineAt`)。DTO と通知は両方を返し、表示は日付 |
| F-10 | 致命 | Store のアクセサとコレクション | アクセサ: 00 `db()`+`Repo<T>`+`tx`、他の全モジュールは `store()`。名前・形の差: 05 `plans: Record<string, GroupPlan>`(00 は Repo)、01 `groups: Map`、03 `joinRequests: Record`、04 `groupWithdrawals`(00 は `withdrawals`)。未定義: 06 `chatSeq`・`chatReads`、08 `rallyMemos`・`rallySurveys`・`rallyPhotos`、09 `profiles`、03 `inviteAttempts`、04 `groupStatusLogs`、11 `municipalities`・`hosts`・`listings`・`funnelEvents`、12 `entryEvents` | 00 の `db()`/`Repo`/`tx` を正とし、全モジュールの記述を `db().<collection>` に置換。コレクション一覧は 4.2 の表で確定し、00 §4.2 の `Store` に追加。03 `inviteAttempts`、06 の連番・09 のレート制限は Store 外(09 の `checkRate` に統合、I-08)。12 `entryEvents` は作らない(I-17) |
| F-11 | 致命 | ID 形式と接頭辞 | 00: `^(u\|g\|m\|jr\|wd\|n\|msg\|ex\|gs\|rp\|bl)-\d{3,8}$`、連番 3 桁以上。01・03・05・06・07・08・09: `^[a-z0-9-]{1,40}$`。02: `^g-[a-z0-9]{1,36}$`。03 `^jr-[a-z0-9]{1,36}$`。05 `^pi-[a-z0-9]{1,36}$`(接頭辞 `pi` は 00 に無い)。06 `m-000001`(00 では `m` は GroupMember、06 自身は `newId` を使わない)。01 `newId("gm")`(00 は `m`)。04 `newId("sl")`(00 に無い)。09 `newId("rp")`、`newId("bl")`。11 `mun-`、`host-`。02 地方 `r-…` | 00 の接頭辞+連番形式を正とし、接頭辞表に `pi`(旅程項目)、`sl`(状態ログ)、`ph`(写真)、`rm`/`rs`(振り返り。08 が要否を決める)、`mun`、`host`、`r`(地方)を追加。GroupMember は `m`、チャットは `msg`(06 の独自連番は廃止し `newId("msg")`、`sinceId` 比較は `createdAt`+連番部で行う)。各モジュールの検証は 00 `isId(prefix, v)` を使い、個別の正規表現は書かない |
| F-12 | 致命 | 00 §4.2 の共有エンティティと所有モジュールの定義の乖離 | JoinRequest: 00 `message`、`minAccepted`、`minAcceptedAt`、`rejectReason`、`replanOfRequestId` / 03 `note`、`consentMinMembers`、`consentAt`、`consentedMinMembers`、`viaInviteCode`、`reasonId`、`reentryOfRequestId`、状態に `expired`。Notification: 00 `type`、`vars`、`read` / 10 `kind`、`params`、`dedupeKey`、`readAt`。GroupPlan: 00 `meetingPlace`、`scheduleMemo` / 05 `meeting{…,version}`、`scheduleMemo{…}`、`items[]`、`itemsRevision`。GroupMessage: 00 `kind:"text"\|"template"`、`reported` / 06 `kind:"normal"\|"template"\|"system"`、`seq`、`systemEvent`、`reportState`、`reportedBy`。ExpenseNote: 00 `paidBy`、`sharedWith` / 07 `payerId`、`targetIds`、`spentOn`、`memo`、`version`。GroupStamp: 00 `userId` / 08 `acquiredBy`、`method` / 12 `acquiredAt`。Report・Block・Verification: 00 と 09 で列挙・項目が異なる(Verification は 00 `mockVerified`+`adultConfirmed`、09 `verified`/`underage`)。DemoUser と Profile(I-15) | **エンティティの形は所有モジュールの定義を正**とし、00 §4.2 は所有モジュールの型を再エクスポートするか、型ファイルの場所(`features/<m>/types.ts`)を示す一覧に縮小する。00 は基本型(`Id`、`DateStr`、`IsoDateTime`)、Store の枠、`DemoUser` の最小項目だけを持つ。理由: 所有モジュールの方が詳細で、試験項目もその形で書かれている |
| I-12 | 重要 | 中止理由コード | 00 `minNotReached,organizerCancelled,withdrawalBelowMin,organizerLeft`。01 `min_not_reached,organizer,organizer_left,below_min_after_withdrawal`。04 `min_not_reached,below_min_in_withdrawal,below_floor,organizer_cancelled,organizer_left`。10 `min_not_reached,organizer_cancelled,withdrawals_below_min`。12 `deadline_unmet,organizer`。02 `cancelKind: auto\|organizer` | 04 の `CancelReasonCode` 5 値を正。10 は同じ型を import(本文テンプレートを 5 値に拡張)。12 は 5 値を「自動(min_not_reached、below_min_in_withdrawal、below_floor)/幹事(organizer_cancelled、organizer_left)」に集約。02 の `cancelKind` は 04 の値から導出 |
| I-13 | 重要 | 再企画・再エントリーの項目名 | 元/新の参照: 00 `replanOfId`/`replannedToId`、01・02 `replannedFromId`/`replannedToId`、04 `replanOfGroupId`/`replannedToGroupId`、12 `replannedFromId`、03 `replanSourceId`。申請側: 03 `reentryOfRequestId`、04 `reentryOfGroupId`、00 `replanOfRequestId`、docs/design 05「再企画元の参加申請ID」 | lifecycle は 04 の `replanOfGroupId`/`replannedToGroupId`。JoinRequest は `reentryOfGroupId: Id \| null`(04 案)。理由: 申請 ID は再企画グループへ申請する時点で前回の申請と 1 対 1 に対応しない(承認済み・失効済みが混在)ため、グループ参照の方が判定が単純 |
| I-14 | 重要 | 年代帯 | 00 `under18,20s,30s,40s,50s,60plus`。09 `18-19,20s,30s,40s,50s,60s,70s+`、まとまり `20s-,30-40s,50-60s,70s+`。02 `u20,20s,…,60p`、粗い区分 `young,middle,senior`。12 集計 `under30,30to49,50plus`、入力を「20代」等の文字列と想定 | 個人の年代帯は **09 の `AgeBand`** を正(18 歳未満を型に持たない、09 が公開範囲の所有者)。グループ内の概要は 09 の `AgeBucket`。統計の区分は 12 の 3 区分を 12 内で `AgeBand` から変換。02・00 は 09 を import |
| I-15 | 重要 | プロフィールの所有 | 00 `DemoUser` に `bio`、`purpose`、`visibility: Record<…, FieldVisibility(public\|members\|private)>`。09 `Store.profiles` の `Profile`、`Visibility(public\|reviewer\|members\|self)` | 09 の `Profile` を正とし、00 の `DemoUser` は `id`、`displayName`、`role`、(11・12 用の)`municipalityId?`/`hostId?` のみに縮小。年代帯は Profile に置く |
| I-16 | 重要 | ロールと自治体 | 00 `UserRole = traveler\|municipal`。11 `traveler\|municipal\|host`、`municipalityId`/`hostId`。12 `municipal`+`municipalityId`、自治体マスタを `features/stats/municipalities.ts` に別定義(`campaignId`)。11 は `Store.municipalities`(`campaign`) | `UserRole = traveler\|municipal\|host`。`Municipality` は 11 が所有し Store に置く。12 は 11 の Municipality を読む(担当地方 `regionIds` を 11 の型に追加) |
| I-23 | 重要 | 本人確認の状態・理由 | 00 `unverified\|mockVerified`+`adultConfirmed`。09 `unverified\|verified\|underage`、forbidden の理由 `not_verified`/`underage`。03 `verification_required`/`age_restricted` | 09 を正 |
| I-24 | 重要 | JoinRequest の状態 | docs/design 05・00: 4 状態。03: `expired` を追加。04: 「失効」を要望 | `pending,approved,rejected,withdrawn,expired` の 5 状態。docs/design 05 を更新(H) |
| I-25 | 重要 | 地方の識別子 | 00 `REGIONS = "水琴地方",…`(日本語名を値に使う)。02 `Region{id:"r-…",name,campaign,spotAreas}`。01 `regionId`。11 は 02 `listRegions` を使う | 02 の `Region` エンティティ(ID `r-…`)を正とし、00 は seed に `regions` を持つ。Group は `region: Id` |
| I-30 | 重要 | 上限値 | 名称: 00 1〜40、01 1〜30、09 `group_name` 40。タグ: 00 1〜20、01 1〜16。説明: 00 `description` 0〜500、01 `summary` 0〜200、02 0〜200、09 `group_description` 1000。金額: 00 0〜10,000,000、07 1〜1,000,000 | 00 の `LIMITS` を唯一の定義とし、各モジュールと 09 の文脈表はそれを参照。値は所有モジュール(01・07)の案を採り 00 の `LIMITS` を改訂 |

### 4.2 Store コレクション一覧(統一案)

| コレクション | 型(所有) | 現在の記述との差 |
|---|---|---|
| `users` | `DemoUser`(00) | 項目を縮小(I-15) |
| `profiles`、`verifications`、`blocks`、`reports` | 09 | `profiles` を追加。形は 09 |
| `regions` | `Region`(02) | 追加(I-25) |
| `groups`、`members` | `Group`、`GroupMember`(01、lifecycle は 04) | 01 の `Map` は `Repo` に置換 |
| `joinRequests` | `JoinRequest`(03) | 形は 03(F-12) |
| `withdrawals`、`groupStatusLogs` | `GroupWithdrawal`、`GroupStatusLog`(04) | 04 は `groupWithdrawals` と記載 → `withdrawals`。`groupStatusLogs` を追加 |
| `notifications` | `GroupNotification`(10) | 形は 10 |
| `plans` | `GroupPlan`(05、id=groupId) | `Record` ではなく `Repo` |
| `messages`、`chatReads` | 06 | `chatSeq` は不要(F-11)、`chatReads` を追加 |
| `expenses` | 07 | 形は 07 |
| `groupStamps`、`rallyMemos`、`rallySurveys`、`rallyPhotos` | 08 | 3 つを追加 |
| `municipalities`、`hosts`、`listings`、`funnelEvents` | 11 | 4 つを追加 |

### 4.3 状態ごとの可否(04 §6.1 を正とした突き合わせ)

| 判定 | 04 の定義(○の状態) | 利用側の想定 | 差 |
|---|---|---|---|
| `canEdit`(05) | recruiting〜in_progress | 05 §6.1: 同じ | なし |
| `canChat`(06) | recruiting〜in_progress | 06 §6.2: 同じ | なし |
| `canEditExpenses`(07) | confirmed、in_progress、completed | 07 §6.2: recruiting〜completed | 募集中〜辞退期間の扱いが逆(I-09) |
| `canCollectStamps`(08) | in_progress | 08 §6: 同じ | 名前のみ(`canStamp`) |
| `canReview`(08) | completed | 08 §6: 同じ | なし |
| `canWithdraw`(04) | recruiting〜confirmed | 01 `canLeave(status, role)` が別表 | 二重(F-14) |
| `canAcceptRequests`(03) | recruiting、reached かつ締切前 | 03: 同じ。02 `ApplyState` も 04 を呼ぶ | なし |

## 5. データフローの追跡結果

表の「断絶・二重」列の記号: 断=誰も書かない/呼ばない、二=二重処理、不=契約不一致。

### 5.1 シナリオ①: 作成 → 一覧 → 申請 → 承認 → 最少人数到達 → 締切 → 辞退期間 → 実行確定 → 共有機能 → 完了 → 集計

| 段階 | 処理(担当・関数) | 断絶・二重 |
|---|---|---|
| 作成 | `POST /api/groups` → 09 `requireVerified(userId,"create_group")`、`assertTextAllowed` → 04 `validateLifecycleInput`、`buildInitialLifecycle` → 01 `createGroup` → 04 `recordCreated` | 不: 合成の所有が不明(01 は「01 は 04 を呼ばない」、04 L615 は「作成 API は 01」、04 L23 は Route Handler が合成)。統一案: route 層(`app/api/groups/route.ts`)が合成し、01 の service は 04 を import しない。断: 06 `group_created` の発火元なし(I-21) |
| 一覧 | 02 `listGroups` → 04 `evaluateAll`、09 `isGroupVisibleTo`/`hasBlockAmong`/`maskGroup`/`memberSummary`、11 `getOfficialBadges` | 不: `memberSummary` の形(I-05)、ページング(I-19)、公式枠表示(I-18)。二: `evaluateAll` を 02 が自前で呼び、04 は全ハンドラで呼ぶ要望(I-11) |
| 詳細 | `GET /api/groups/[groupId]` → 01 または 02 | 二: 01・02 の両方が定義(I-03) |
| 申請 | 03 `requestJoin` → 09 `requireVerified`、`assertNotBlocked`、`assertTextAllowed("join_note")`、04 `canAcceptRequests` → 10 `join_requested` | 不: `notify` 署名(F-08)、`checkText` 文脈名 `note`(F-09)、本人確認の理由コード(I-23)。断: 11 `recordFunnelEvent(official_requested)` を 03 が記載していない(I-17) |
| 承認 | 03 `approve` → 01 `addMember` → 04 `evaluate` → 10 `join_approved` | 不: 03 は `evaluate(group,now)`、04 は `onMembershipChanged(groupId)`(F-15)。断: 06 `member_joined` は 03 が呼ぶ前提だが 03 §15 に記載なし(I-21) |
| 最少人数到達 | 04 T2 → 10 `min_reached`(04 は `lc_min_reached`) | 不: 通知種別名(F-08) |
| 締切 | 時計 → 04 `evaluate`(T5)→ 申請失効 → 10 `withdraw_period_started` | 二: 失効を 04 `expirePendingRequests`(03 に未定義)と 03 `settleRequestsIfClosed` の両方が行い、通知も 04 `lc_cancelled`/03 `join_expired` が重なる(F-15)。不: 評価の発火点(I-11) |
| 辞退期間 | 04 `withdraw` → 01 `markMemberLeft`(未定義)→ 04 `withdrawals` 記録 → 10 `withdrawal_received` | 二: 01 `POST …/leave`(`leftAtGroupStatus` を記録)と 04 `POST …/withdraw`(`GroupWithdrawal` を記録)の 2 経路(F-14)。断: 06 `member_left`、07 `onGroupMemberLeft` を呼ぶ者がいない(I-21、I-22) |
| 実行確定 | 04 T6 → `confirmedAt` → 10 `confirmed`(概要付き) | 二: 参加者概要を 04 `summarizeParticipants`(vars に `ageBands`)と 10(09 `memberSummary` から `summaryText`)の両方が作る(I-05)。断: 06 `state_confirmed`(I-21) |
| 共有機能 | 05 `canEdit`、06 `canChat`、07 `canEditExpenses`、08 `canCollectStamps` | 不: 07 の可否(I-09)。不: 05〜08 が 01 `getGroup` で Group を取る前提(F-16)。不: 06 の `isBlocked` 方向(I-06)。不: 06 のチャット通知の集約(I-28) |
| 実施中・完了 | 04 T9・T10(通知なし)→ 08 `canReview` | 断: 06 `state_started`/`state_completed` の発火元なし(I-21) |
| 集計 | 12 `collectFacts` が `db()` を直接読む | 不: `canceledAt`(04 は `cancelledAt`)、`replannedFromId`(04 は `replanOfGroupId`)、`GroupStamp.acquiredAt`(08 は `at`)、年代帯文字列(I-14)、`cancelReason` 値(I-12)、`entryEvents`(I-17) |

### 5.2 シナリオ②: 締切未達 → 中止 → 再企画 → 再エントリー

| 段階 | 処理 | 断絶・二重 |
|---|---|---|
| 自動中止 | 04 T4(`min_not_reached`)→ 申請失効 → 10 `cancelled`(宛先: メンバー+申請者) | 不: 10 の宛先 `pendingApplicants` は失効後に解決すると 0 件になる。04 は失効した申請者の ID を `users` で渡す(04 §5.7 の記述どおり)ことを 10 §11.1 に明記する。二: 失効の二重(F-15) |
| 再企画 | 04 `getReplanDraft` → `replan` → 01 `createGroup`(新グループ)→ lifecycle に `replanOfGroupId` → 元に `replannedToGroupId` → 10 `replan_invited` | 不: 04 は `buildInitialLifecycle(input, now)` に `replanOfGroupId` を渡す引数がなく、01 `createGroup(user, input)` は 09 の本人確認と作成上限を通る(I-29)。断: 05 `copyPlanDraft` は 05 に無い(デモでは引き継がない)。断: 06 `state_replanned` |
| 再エントリー | 新グループの詳細 → 03 `requestJoin`(`reentryOf…`) | 不: 03 `reentryOfRequestId`、04 `reentryOfGroupId`、00 `replanOfRequestId`(I-13) |
| 集計 | 12 MUN-M-06 再企画率 | 不: 項目名(I-13) |

### 5.3 シナリオ③: 入口B → 一覧の絞り込み → 申請

| 段階 | 処理 | 断絶・二重 |
|---|---|---|
| 着地 | `/[campaign]/entry` → 11 `resolveEntry` → `parseEntryParams`(02 `listRegions` で地方検証)→ `recordFunnelEvent(entry_landed)` | 不: 地方 ID の形式(I-25) |
| 転送 | 11 `buildGroupsPath` → `/[campaign]/groups?region=&dateFrom=&dateTo=&vacancy=&officialOnly=` | 不: 02 のキーは `official`(11 は `officialOnly`、I-18)。11 は 02 の `parseGroupListQuery(…,"lenient")` と `serializeFilter` を使えば変換を持たずに済む |
| 一覧・申請 | 02 → 03 | 断: `src` を引き継がないため、着地から申請までの転換は出せない(11 が限界として記載済み) |
| 集計 | 12 MUN-M-08 | 断: 12 は `entryEvents`(`channel: direct\|external\|official\|invite`)を読むが、11 は `funnelEvents`(`channel: A\|B`、`source`)を書く。誰も `entryEvents` を書かない(I-17) |

### 5.4 シナリオ④: 公式枠の作成 → 一覧 → 申請

| 段階 | 処理 | 断絶・二重 |
|---|---|---|
| 作成 | `POST /api/official` → 11 `requireRole("municipal")` → 01 `createGroup` + `markOfficial` → 11 `listings` 追加 | 欠: `markOfficial` は 01 に無く、01 は `createGroupInternal({official:true, officialHost, organizerId})` を提供(I-18)。不: 自治体ロールのデモユーザーの本人確認(09 `requireVerified`)を `createGroupInternal` は通らない(仕様として明記が要る) |
| 一覧 | 02 `listGroups` → 11 `getOfficialBadges`、`listOfficialGroupIds` | 不: 02 `GroupSummary.official: {orgName} \| null` と 11 `OfficialBadgeView`(I-18)。依存: 02 → 11 と 11 → 02 の循環(I-20) |
| 申請 | 03 `requestJoin`(通常と同じ) | 断: 11 が要望する `official_requested` 記録を 03 が記載していない |
| 集計 | 12 MUN-RULE-06(公式枠フィルタ) | 不: 00 `isOfficial` と他の `official`(F-05) |

### 5.5 シナリオ⑤: 通報・ブロック → 一覧/チャット/申請への反映

| 反映先 | 処理 | 断絶・二重 |
|---|---|---|
| 一覧・詳細 | 02 → 09 `hasBlockAmong`、`isGroupVisibleTo`(双方向) | 02 は `isBlocked(viewer, x)` で記載。09 の関数を使うことを 02 §14 に明記(軽微) |
| 申請 | 03 → 09 `assertNotBlocked`、`listRequests` で除外 | 03 は `isBlocked(user.id, organizerId)`。双方向なので結果は同じ |
| チャット | 06 → 09 | 不: 06 は `isBlocked(viewer, sender)`(双方向)でメッセージを隠すため、09 の規則(自分がブロックした相手のみ隠す、SAF-RULE-24)と異なり、ブロックされた側の画面でも相手の投稿が消える(I-06) |
| 通知 | 06 → 10 `chat_new` の宛先除外 | 06 は `isBlocked(recipient, sender)`、10 §11.1 は `excludeUserIds` に「ブロック関係の相手」。方向を 09 SAF-RULE-24 に合わせ `isBlockedByMe(recipient, sender)` |
| 通報 | 06 `reportMessage` → 09 `createReport` | 不: 署名・理由列挙(I-07)。08 のメモ・写真、05 の旅程項目、07 の費用項目は 09 の `ReportTargetType` に無い |
| seed | 00 seed: u-001 が u-006 をブロックし、両者が g-012 のメンバー | 09 `sameGroupOnBlock="stay"` なら整合。00 の本人確認 seed(u-004 が未確認なのに申請中・参加中)は 09 `requireVerified` と矛盾(00 内部矛盾) |

### 5.6 シナリオ⑥: デモ用の日付進行 → 状態遷移 → 通知

| 段階 | 処理 | 断絶・二重 |
|---|---|---|
| 操作 | 00 `POST /api/demo/clock`(`advanceDays`/`set`/`reset`)→ `runHooks("afterClockChange")` | 二: 04 も `POST /_demo/clock`(`advanceDemoClock`、後戻り禁止)を定義(I-03)。不: 04 は `clock.isDemo()` を要望、00 は `DEMO_TOOLS` と `clock.info()`(M-01)。不: 00 の `set` は後戻り可、04 は後戻り不可を要求 |
| 評価 | フック → 04 `evaluateAll(now)`(00 R-04-2 で 04 が登録) | 不: 04 REQ-04 は全ハンドラ先頭での `evaluateAll` も要望、00 の `route()` には該当処理がない。10 は `evaluateGroupsForUser`(04 に無い)を要望(I-11) |
| 通知 | 04 遷移 → 10 `notify`(冪等キー) | 不: 04 の `dedupeKey`(`type:groupId:revision:userId`)と 10 の `eventKey` 表(`reached`、`wp-start` 等)が別(F-08)。`effectiveAt` を `createdAt` に使うかは 10 に記述なし |
| 画面更新 | 10 R-5: クライアント共通 fetch で `ntf:refresh` を発火 | 断: 00 の `groups-api.ts` に記述なし(00 への要望として未反映) |

## 6. 依存関係

### 6.1 README の依存図と各モジュールの記述の差

| 辺(呼ぶ → 呼ばれる) | README | 各モジュールの記述 | 判定 |
|---|---|---|---|
| 01 → 06 | なし | 06 は 01 `createGroup`/`leaveGroup` から `postSystemMessage` を要求。01 は呼ばない設計 | 未合意 |
| 03 → 06、04 → 06 | なし | 06 が要求 | 追加が必要 |
| 04 → 03 | なし | 04 `expirePendingRequests`。03 は「04 は 03 を呼ばない」 | 衝突(F-15) |
| 04 → 05 | なし | 04 `copyPlanDraft`(任意) | 追加(任意) |
| 04 → 09 | なし | 04 `canView`、禁止表現 | 追加が必要 |
| 01 → 09、04 → 01 | 01 → 00 のみ / あり | 01 は 09 を呼ぶ(`checkText` 等) | 追加が必要 |
| 01 → 04、01 → 10 | なし | 01 の `usecases.ts` が 04 `evaluate`・`cancel`、10 `notify` を呼ぶ | README 方針に反する(F-14 で解消) |
| 02 → 03、02 → 11 | なし | 02 `getMyRequestStatus`、11 `getOfficialBadges` | 追加が必要 |
| 11 → 04 | なし | 11 `cancel` | 追加が必要 |
| 03 → 11 | なし | 11 が `recordFunnelEvent` を要求 | 任意(I-17) |
| 06 → 10、08 → 10 | なし | `notify` | 追加が必要 |
| 10 → 04、10 → 09 | 10 → 00 のみ | 10 `evaluateGroupsForUser`、09 `memberSummary` | 10 → 04 は不要(I-11)、10 → 09 は追加 |
| 12 → 04、08、09、11 | 12 → 01、03 のみ | 12 §17-3 | 追加が必要 |
| 07 → 09、05 → 09 | 点線 | 実線(関数呼び出し) | 表記の修正 |

### 6.2 循環(I-20、重要)

| 循環 | 原因 | 解消案 |
|---|---|---|
| 01 ↔ 06 | 06 が 01 `getGroup`/`isMember` を呼び、01 が 06 `postSystemMessage` を呼ぶ想定 | 00 のフック機構(`hooks.ts`)を拡張し、ドメインイベント(`group_created`、`member_joined`、`member_left`、`status_changed`)を発行。06・07・10 が購読する。発行側は 06・07 を import しない |
| 04 ↔ 06 | 04 → `postSystemMessage`、06 → `canChat` | 同上 |
| 03 ↔ 04 | 03 → `canAcceptRequests`/`onMembershipChanged`、04 → `expirePendingRequests` | 04 → 03 の失効を `status_changed` イベントの購読(03)に置換するか、03 の型だけに依存する失効関数を 03 から公開して 04 → 03 を 1 方向で許可し、03 → 04 は判定関数のみとする。推奨は前者(イベント) |
| 04 ↔ 10 | 04 → `notify`、10 → `evaluateGroupsForUser` | 10 → 04 を削除(I-11) |
| 02 ↔ 11 | 02 → `getOfficialBadges`、11 → `listGroups`/`listRegions`/`parseGroupListQuery` | 11 の ENT-API-03(`GET /api/official`)を廃止し、公式枠一覧は 02 の `official=1` で取得。11 → 02 は `listRegions`・`parseGroupListQuery` の型と純粋関数のみ、02 → 11 は `getOfficialBadges`。純粋関数を `features/groups/discovery/query.ts` に分けて 11 はそれだけを import する |
| 01 ↔ 04(型) | 04 `GroupLike` が 01 `Group` を Pick、01 が 04 の lifecycle 型を import | 型のみの相互参照は許容(`import type`)。実行時の import は 04 → 01 のみ |

## 7. 00 共通基盤への要望の集約

判定: 済=00 に反映済み、部分=名前・形を変えて反映、未=未反映で採用が必要、衝突=00 の方針と矛盾。

| 要望元 | 要望 | 00 の現状 | 判定 | 対応案 |
|---|---|---|---|---|
| 01・03・04・08・09 | `AppError`/`toResponse` に `reason`(下位コード) | `detail` のみ | 未 | `reason?: string` を本体の最上位に追加(F-13) |
| 05・07・08・09 | 追加項目(`current`、`state`、`reviewRequired`、`extra`) | `detail: Record<string,unknown>` | 部分 | `detail` に格納する規則に統一(F-13) |
| 01・03・06・09 | `rate_limited`(429) | なし | 未 | 追加 |
| 08 | モジュール固有コード `invalid_code`、`already_acquired` | なし | 衝突 | `invalid_input`+`reason:"invalid_code"`、`conflict`+`reason:"already_acquired"` に置換。08 の画面文言は `reason` で引く |
| 03・04・05・06・07・08 | キャッチオールのディスパッチャとハンドラ登録 | リソース別 route.ts | 衝突 | 00 案を採用(F-01) |
| 05・06・08・09・02・12 | `/api/groups` 用クライアント | `gapi` 等 | 部分 | 名前を `gapi` 系に統一。`gput` と `reason` を追加(I-02) |
| 05・07 | PUT/DELETE の採否、楽観ロックの共通方式 | メソッドは許可、ロック方式は記載なし | 未 | `version: number`+入力 `baseVersion`、不一致は `conflict`+`reason:"version_mismatch"`+`detail.current`(I-01) |
| 02・03・04・05・06・07・08・09・10・11・12 | Store へのコレクション追加 | 13 コレクション | 未 | 4.2 の表のとおり追加(F-10) |
| 04 | 全ハンドラ先頭での `evaluateAll` | フック `afterClockChange`/`afterReset` のみ | 未 | `route()` に `beforeHandler` フックを追加し 04 が登録(I-11) |
| 04 | `clock.isDemo()`、後戻り禁止 | `clock.info()`、`DEMO_TOOLS`、`set` は任意時刻 | 衝突 | `clock.info().tools` 相当で判定。後戻りは 00 の `set` で許可し、04 の評価は「後戻り時は再評価しない」と明記 |
| 10 | `formatJst(iso, pattern)` | `toJstIso` 等(署名なし) | 部分 | 00 `datetime.ts` に表示用 `formatJst` を追加し署名を書く |
| 10 | `ntf:refresh` の発火 | なし | 未 | `gpost/gpatch/gput/gdelete` 成功時に発火 |
| 09 | `isSafeId`/`sanitizeText` は 09 の実装を import | 00 が `isId`、`sanitizeText` を定義 | 衝突 | 00 を正(最下層に置く)。09 は 00 を使う |
| 09 | `assertSafeRequest` をラッパーで適用 | 00 `route()` が Origin・Content-Type を自前で検査 | 二重 | 00 の検査に一本化し、09 の `assertSafeRequest` は削除 |
| 09 | Cookie 属性 `HttpOnly; SameSite=Lax; Path=/` | 反映 | 済 | - |
| 09 | `next.config.ts` の `headers()`、ESLint `react/no-danger` | 記載なし | 未 | 既存ファイルの変更のためオーナー承認事項 |
| 11・12 | `DemoUser.role` に自治体・地元、`municipalityId`/`hostId` | `traveler\|municipal` | 部分 | I-16 |
| 12 | `getDemoUser(id)` | `db().users.get(id)` | 部分 | 00 の Repo を使うと明記 |
| 12・02 | テスト実行を `node --test`+相対 import | Vitest(`@/` エイリアス解決) | 衝突 | Vitest に統一(00 案)。02・12 の「相対 import 必須」の制約は外す |
| 06・09 | seed にメッセージ・プロフィール・確認状態を追加 | seed の一部のみ | 未 | 各モジュールが seed 断片を提供し 00 が統合 |
| 02 | 予約語 `new`、`invite`、`regions`、`_reset` | `_reset` は不採用 | 部分 | 2.3 の URL 案で確定 |
| 03 | `withGroupLock(groupId, fn)` | `tx(fn)`(同期) | 部分 | `tx` で足りる。非同期化は対象外 |

## 8. 統一案(適用順序つき)

各段階は前の段階の決定を前提とする。各モジュールへの修正は、段階ごとにブリーフを分けて適用する。

| 段階 | 決定・修正 | 対象ファイル | 指摘 |
|---|---|---|---|
| S0 方針(窓口・オーナー判断) | (1) ルーティングはリソース別 route.ts、動的セグメントは `[groupId]` 等、URL 名前空間は 2.3。(2) 共有エンティティは所有モジュールが定義し 00 は枠のみ。(3) 依存の循環はドメインイベントで解消。(4) 07 の費用メモを募集中から使えるか(I-09)。(5) 退会と辞退を 1 経路にすること | README、00 | F-01〜F-03、F-12、I-09、I-20 |
| S1 00 の改訂 | `db()`/`Repo`/`tx` の明記、コレクション一覧(4.2)、ID 接頭辞表の追加、`AppError` に `reason`、`detail` の格納規則、`rate_limited`、`gput`、`ApiError.reason`、`route()` の `beforeHandler`、ドメインイベント(`emit`/`on`)、`formatJst`、§4.2 を基本型+型の所在一覧に縮小 | 00 | F-10、F-11、F-12、F-13、I-02、I-11、I-20 |
| S2 中核の型 | 04: `GroupStatus` を snake_case 7 値に変更、`deadlineDate`+`deadlineAt`、`CancelReasonCode` 5 値、`statusLabel(status)`、`withdraw` を唯一の退会経路にし `status_changed`/`member_left` イベントを発行、03 への直接呼び出しを削除。01: `trip`・`lifecycle` の入れ子を維持、`campaign`/`region`/`description` に改名、`officialHost` 削除、`applyLifecyclePatch(groupId, expectedRevision, patch)`、`markMemberLeft`、`findGroupByInviteCode`、`leaveGroup`/`usecases.ts`/`_invite`/`_meta` の削除、GroupMember の ID 接頭辞 `m` | 04、01 | F-04〜F-07、F-14、F-16、I-03、I-12、I-13 |
| S3 安全・通知 | 09: `TextContext` の追加(`group_destination`、`group_date_note`、`plan_item_title`、`expense_memo`、`rally_memo`、`rally_photo_caption`、`official_summary`)、`ReportTargetType` の追加(`plan_item`、`expense`、`rally_memo`、`rally_photo`)、`formatMemberSummary`、URL を `/api/me/*`・`/api/users/*`・`/api/reports` へ。10: 通知種別を 4.4 の表で確定、URL を `/api/me/notifications`、`markReadByKind`、`evaluateGroupsForUser` の要望を取り下げ | 09、10 | F-08、F-09、I-04〜I-07、I-14、I-15、I-23、I-28 |
| S4 参加・探索・入口 | 03: `onMembershipChanged`、`expired` は 04 のイベント購読で設定、`notify` を 10 形式、`_invite`/`_me` 廃止、`reentryOfGroupId`、理由コードを 09 に合わせる。02: `[groupId]`、09 の `memberSummary` 型、`Page<T>`、公式枠表示を 11 の `OfficialBadgeView`。11: `createGroupInternal`、`official` キー、`/api/official` 一覧と `/api/entry/stats` を廃止 | 03、02、11 | F-15、I-03、I-17〜I-19、I-24、I-25 |
| S5 共有機能・集計 | 05〜08: `assertGroupAccess` で Group 取得、`assertTextAllowed`、`[groupId]`、楽観ロックの共通形、08 の削除を DELETE・エラーコード置換、06 は `filterVisibleMessages`・`msg` ID・09 の `checkRate`。12: 04 の項目名、`aggregateFunnel`、`AgeBand` からの変換、11 の Municipality | 05〜08、12 | F-09、F-11、I-01、I-06、I-08、I-26 |
| S6 文書 | README(依存図、ルーティング、柱 18、既存流用の境界)、docs/design(第 9 章) | README、docs/design | 第 9 章 |

### 8.1 個別の統一案(第 2〜5 章で詳細を書いていないもの)

| ID | 重大度 | 内容 | 該当 | 統一案 |
|---|---|---|---|---|
| F-07 | 致命 | lifecycle の書き込み口が 01 `applyLifecyclePatch(id, patch): Group`(revision なし)と 04 `patchGroupLifecycle(groupId, expectedRevision, patch): GroupLifecycle`。04 が必要とする `getGroupRaw`、`listActiveMemberIds`、`markMemberLeft` は 01 に無い | 01 GRP-FN-17、04 §12.1 | 第 3 章 #6・#7・#10・#11 のとおり |
| F-08 | 致命 | `notify` の署名と通知種別。10 は `notify(input: NotifyInput)`、13 種(`min_reached` 等)、冪等キー `eventKey`。04 は位置引数+`opts.dedupeKey`、12 種(`lc_min_reached` 等、`lc_min_lost`・`lc_headcount_changed`・`lc_capacity_full` を含む)。03 は位置引数、`join_withdrawn`・`join_expired` を使用。06・08 は位置引数、08 は `rally_reward`。00 は camelCase 13 種。docs/design 05 は 8 種 | 10 §4.1・§6.1、04 §5.7、03 §6.2、00 §4.2 | 10 の `NotifyInput` と種別名(snake_case)を正。種別は 4.4 の表で確定 |
| F-09 | 致命 | 禁止表現の検査契約(第 3 章 #21)。09 の `TextContext` に無い欄(01 の行き先・日程メモ、05 の旅程項目名、07 のメモ、08 のメモ・キャプション、11 の要約・ハイライト)があり、呼び出し側の文脈名も一致しない | 09 §4.2・§8.5、各モジュール | 保存系は `assertTextAllowed(text, context, field, {ackReview})`。review 判定時の `reviewRequired` は `detail.reviewRequired` に置く。不足文脈は S3 で 09 に追加 |
| F-13 | 致命 | エラー応答形式。00 `{error, message, fields?, detail?}`。01・03・04: 最上位 `reason`。05: 最上位 `reason`+`current`。07: `reason`+`current`。08: `state`+`reason`。09: `reviewRequired`。03 は `rate_limited` を `conflict` かつ HTTP 429 とする。06 は代用案で `conflict`+`fields.body` | 00 §5.4、各モジュール第 8 章 | `{ error: ErrorCode; reason?: string; message: string; fields?: Record<string,string>; detail?: Record<string,unknown> }`。`reason` はモジュールの下位コード(snake_case)。構造化データ(`current`、`state`、`allowedActions`、`retryAfterSec`、`reviewRequired`)は `detail`。コードに `rate_limited`(429)を追加。HTTP ステータスはコードから一意に決める |
| F-14 | 致命 | 退会と辞退の二重経路。01 `POST …/leave`(`leaveGroup`、`leftAtGroupStatus`・`activeCountAfterLeave` を GroupMember に記録、usecase が 04・10 を呼ぶ)と 04 `POST …/withdraw`(`withdraw` → 01 `markMemberLeft` → `GroupWithdrawal`)。`MemberStatus` は 00 `active\|left\|withdrawn`、01・04 `active\|left`。辞退記録は 00 `Withdrawal`、04 `GroupWithdrawal`、01 は記録なし | 01 §5、04 §5、00 §4.2 | 退会 API は 04 `POST /api/groups/[groupId]/withdraw` のみ(状態ごとに辞退/退会を 04 が判定、実施中以降は `unavailable_state`)。`MemberStatus = active\|left`。記録は 04 の `withdrawals`(`Withdrawal`)。01 は `markMemberLeft` だけを持ち、`leftAtGroupStatus`・`activeCountAfterLeave` は削除 |
| F-15 | 致命 | 申請失効と評価呼び出し(第 3 章 #13・#15)。失効の二重と通知の二重 | 03 §6・§15、04 §5.5・§12 | 04 の遷移(T4、T5、T11)が `status_changed` イベントを発行し、03 が購読して失効と `join_expired` 通知を行う。04 の `lc_cancelled` の宛先から失効した申請者を外す(重複防止)。03 の遅延失効 `settleRequestsIfClosed` は廃止(評価は 00 の `beforeHandler` で先に済む) |
| F-16 | 致命 | 01 `getGroup` の契約(第 3 章 #7・#8) | 01 GRP-FN-02、05 §10、06 §11、07 §6.3、08 §5.1 | 第 3 章のとおり |
| I-04 | 重要 | `visibleProfile` の署名(第 3 章 #22)。文脈を文字列で渡す呼び出し側と、`{kind, groupId}` を受ける 09 が食い違う。02 は `"list"\|"detail"` も使う | 09 SAF-FN-03、01 GRP-FN-04、02 §7、03 §15、05 §10、07 §10 | 09 の `visibleProfile(viewer:{id}, targetId, ctx: ProfileContext)` を正。`"detail"` は `{kind:"list"}` に含める |
| I-05 | 重要 | メンバー概要(第 3 章 #19・#20)。確定通知の概要を 04 と 10 が二重に作る | 09 §6.4、02 TY-07、10 §11.3、04 §5.7 | 09 の `memberSummary` と規則(4 人未満は年代非表示)を正。確定通知の概要は 10 が 09 から作り、04 の `vars.ageBands` と `summarizeParticipants` は削除 |
| I-06 | 重要 | ブロックの方向(第 3 章 #23、5.5)。06 は双方向の `isBlocked` で投稿を隠すため、ブロックされた側でも相手の投稿が消える | 06 §6.6、09 SAF-RULE-24 | 06 は `filterVisibleMessages`、通知の除外は `isBlockedByMe(recipient, sender)` |
| I-07 | 重要 | 通報の署名と対象種別(第 3 章 #24)。08 のメモ・写真、05 の旅程項目、07 の費用項目、03 の申請者以外(グループ・幹事)は 09 の `ReportTargetType` に一部しかない | 06 §5.1、08 RLY-REQ-06、03 §15、09 §4.2 | 09 `createReport(user, {targetType, targetId, reason, body?, alsoBlock?})` を正。対象種別を S3 で追加 |
| I-08 | 重要 | レート制限の重複。06 独自(5 件/60 秒)と 09 `checkRate("chat_post")`(5 件/10 秒)、03 独自 `inviteAttempts`(失敗 5 回/10 分)と 01 の試行回数(10 回)と 09 `checkRate` | 06 §4.3、09 §4.4、03 §4、01 GRP-T-19 | 09 `checkRate` に一本化し、値は 09 の `RATE_LIMITS` に集約(チャットの値はオーナー判断、案は 06 の 5 件/60 秒)。招待コードの試行は `checkRate("invite_lookup")` を 09 に追加 |
| I-09 | 重要 | 可否表(4.3)と状態ラベルの所有 | 04 §6.1、07 §6.2、08 §6 | 04 の表を正。07 の差はオーナー判断。ラベルは 04 の `statusLabel` |
| I-10 | 重要 | 認可ヘルパーの重複。00 `authz.ts`(`isMember`、`isOrganizer`、`requireGroup`、`requireMember`、`requireOrganizer`、`activeMembers`)、01 の同名関数(再エクスポートと記載しつつ独自署名 `requireMember(user, group): void`、公開/非公開で forbidden/not_found を切替)、09 `assertGroupAccess(userId, groupId, need)`・`getGroupRole` | 00 §5.7、01 GRP-FN-12〜16、09 §5 | API 層のグループ取得と権限は 09 `assertGroupAccess` に一本化(存在を隠す規則を内包)。`isMember`/`isOrganizer`/`activeMembers` は 00 を正とし 01 は再エクスポートのみ。01 の `requireMember` は削除 |
| I-11 | 重要 | 遅延評価の発火点。04 は全ハンドラ先頭で `evaluateAll`、02 は一覧で自前に呼ぶ、10 は `evaluateGroupsForUser`、08 は `getGroup` が評価済みと仮定 | 04 REQ-04、02 §5、10 R-4、08 §6 | 00 `route()` の `beforeHandler` で `evaluateAll(clock.now())` を 1 回実行。各モジュールは自前で呼ばない |
| I-17 | 重要 | 流入計測の断絶(5.3) | 11 §4.4、12 §4・MUN-REQ-11 | 11 の `FunnelEvent` と `aggregateFunnel` を正。12 の MUN-M-08 を 11 の `channel`(A/B)× `source` で定義し直す。02・03 からの記録はデモ範囲外(任意) |
| I-18 | 重要 | 公式枠の作成・表示。00 `isOfficial`、01 `official`+`officialHost`+`createGroupInternal`、11 `markOfficial`+`Listing`、02 `official:{orgName}`、02 フィルタ `official` と 11 `officialOnly` | 01、02、11 | `Group.official: boolean`、作成は `createGroupInternal`、表示は 11 `OfficialBadgeView`(02 の `GroupSummary.badge`)、フィルタキーは `official` |
| I-21 | 重要 | 06 のシステムメッセージを発火する呼び出しが 01・03・04 に無い | 06 §6.7・§11.2 | ドメインイベントを 06 が購読(I-20) |
| I-22 | 重要 | 07 の `onGroupMemberLeft`・`unsettledBalanceOf` を呼ぶ者がいない。07 が退会者を含むメンバー一覧を要求 | 07 §10 | `member_left` イベントを 07 が購読。退会確認ダイアログ(04 の UI)が 07 の `unsettledBalanceOf` を表示。メンバー一覧は 00 の Repo で取得 |
| I-26 | 重要 | 少数セルの閾値。09 `summaryMinCount=4`(グループ内概要)・`smallCellThreshold=3`(`suppressSmallCell`、12 向け)、08 `minCell=3`、12 `MIN_CELL_COUNT=5`。12 は 09 の `suppressSmallCell` も 08 の `rallyAggregate` も使わない | 09 §4.4、08 RLY-FN-09、12 §5.2 | 統計(12)の閾値は 12 の K=5 に一本化し、09 の `suppressSmallCell`・08 の `rallyAggregate` は削除。グループ内概要(09 の 4)は別規則として残す |
| I-27 | 重要 | 02 の `ageBands` 絞り込み(メンバーの年代帯)と、09 `rejectProhibitedParams`(「細かい年齢の条件」を拒否)・docs/design 07 論点 11 の整合が未確認 | 02 §5、09 §5 | 02 の絞り込みを許可する範囲(年代帯のみ、性別なし)を 09 の `rejectProhibitedParams` の許可リストに明記。docs/design 07 で確認 |
| I-28 | 重要 | チャット通知の集約責務(第 3 章 #17) | 06 §8.2、10 §6.4 | 06 は投稿ごとに `notify({kind:"chat_new", recipients:[{type:"groupMembers", excludeUserIds:[送信者, isBlockedByMe(受信者,送信者) の受信者]}]})` を 1 回呼ぶ。集約は 10 |
| I-29 | 重要 | 再企画の新グループ作成で 04 が 01 `createGroup(user, input)` を呼ぶと本人確認・作成上限・禁止表現を再度通り、lifecycle の `replanOfGroupId` を渡す口がない | 04 §5.6、01 GRP-FN-01 | 04 → 01 `createGroupInternal`(権限判定なし)に `lifecycle` を渡す形にし、本人確認・禁止表現は 04 の `replan` が先に実施 |
| M-01 | 軽微 | 名称差: `store()`/`db()`、`validate`/`parse`、`clock.set` の意味、`formatJst`/`toJstIso` | 各モジュール | 00 の名称 |
| M-04 | 軽微 | 状態ラベルの置き場所が 00 `features/groups/labels.ts`、04 `messages.ts`、02(04 の表を使用)の 3 か所 | 00 §3.2、04 §9 | 04 に一本化 |
| M-05 | 軽微 | 本文過大: 05 は 400、00 は `payload_too_large`(413) | 05 §5.2 | 00 |
| M-06 | 軽微 | 08 §11.3-3・12 §17-1 が「04 の骨子は 3 状態」と古い記述を前提にしている | 08、12 | 04 の現行(7 状態)に合わせて記述を更新 |
| M-07 | 軽微 | 04 内部: `replan` の戻り値が関数 `{group, invited}` と API `{groupId, invited}`。`evaluate` が「例外なし」と「not_found」を併記 | 04 | 04 内で修正 |

### 8.2 通知種別(統一案、F-08)

| kind | 発行元 | docs/design 05 | 備考 |
|---|---|---|---|
| `min_reached` | 04 | 8 種の 1 | |
| `min_lost` | 04 | 追加 | 04 案(T3) |
| `withdraw_period_started` | 04 | 8 種の 2 | |
| `withdraw_period_ending` | 04 | 8 種の 3 | |
| `confirmed` | 04 | 8 種の 4 | 概要は 10 が 09 から作成 |
| `cancelled` | 04 | 8 種の 5 | `reason` は 04 の `CancelReasonCode` |
| `replan_invited` | 04 | 8 種の 6 | |
| `withdrawal_received` | 04 | 8 種の 7 | 幹事向け |
| `headcount_changed` | 04 | 追加 | 04 案(辞退後に他メンバーへ人数のみ) |
| `conditions_changed` | 04 | 8 種の 8 | |
| `deadline_near` | 04 | 追加 | |
| `join_requested`、`join_approved`、`join_rejected` | 03 | 追加 | |
| `join_expired` | 03 | 追加 | F-15 の失効。04 の `cancelled` と重ならないよう宛先を分ける |
| `chat_new` | 06 | 追加 | 集約は 10 |
| (任意)`join_withdrawn`、`capacity_full`、`rally_reward` | 03、04、08 | 追加 | デモ範囲外。採否はオーナー判断 |

必須 16 種(docs/design 05 の 8 種+追加 8 種)、任意 3 種。

## 9. docs/design 側の更新が必要な点

| 章 | 更新内容 | 根拠 |
|---|---|---|
| 02 | 柱は 18(docs/design は 18 に更新済み)。docs/feature README の「柱数は 17」「04 は 13(+実行条件)」を柱 18 に修正(README 側の更新) | 02 章 L7、README §7 |
| 03 | ディレクトリ構成(`features/<m>/`、`app/api/...` の名前空間 2.3)、テスト実行(Vitest)、API を章として持つこと | 00、本書 2.3 |
| 04 | 状態遷移図に 04 の T3(到達 → 募集中)、T8(実行確定 → 中止、最少下限 2 未満)、幹事の中止(T11)、幹事不在(T12)を追加。「再企画」を状態から外し表示(再企画済み)にする。入口B の着地ページ `/[campaign]/entry`、通知画面と専用ベル(10 案 A)、プロフィール・本人確認画面の位置 | 04 §5.5、10 §2.2、11 §3 |
| 05 | 通知の種類(8.2 の 16 種)。JoinRequest の状態に「失効」。GroupMember の状態は「参加中/退会」とし辞退は辞退記録で区別。GroupPlan に旅程項目(PlanItem)と版番号、ExpenseNote に日付・メモ・版番号、振り返り(ReviewMemo、SurveyAnswer、PhotoPost)、Profile(09)、Listing・Municipality・LocalHost・FunnelEvent(11)、GroupStatusLog(04)。締切は日付+派生の日時。再企画元は申請 ID ではなくグループ ID | 第 4 章 |
| 06 | エラーコード一覧(`rate_limited` 追加、`reason` の下位コード) | F-13 |
| 07 | 年代帯の定義(09 の 7 区分、グループ内概要は 4 人以上で 4 まとまり)、統計の最小単位 K=5、ブロックの効果の方向(一覧・申請は双方向、チャットは一方向)、02 の年代帯絞り込みの可否 | I-14、I-26、I-27 |
| 08 | OSS 一覧に Vitest(devDependency、MIT [要確認])を追加。Mermaid の検証に mermaid-cli を使う場合は開発時のみの利用として記載 | 00 §9.1・§16-14 |
| 10 | 自動テストの採用(Vitest)と実行方法 | 00 §9.1 |
| 12 | 新たな未決: 07 費用メモの利用開始時期(I-09)、チャットの投稿頻度の値(I-08)、任意通知 3 種の採否、退会者の記録の表示(複数モジュール共通の「元メンバー」表記) | 第 8 章 |
| README(docs/feature) | 依存図(第 6 章)、ルーティング方式、`features/entry`・`features/official` の追加、「写真投稿・アンケートは既存流用」の訂正(app/ に実装が無い。08 §11.3-1)、既存の個人スタンプは単一ユーザー状態でデモユーザー切替と無関係であることの注記 | 08 §2.1、§11.3 |

## 10. レビュー範囲外・未確認

- `app/node_modules` が無く、Next.js 16.4.5 のドキュメント(`node_modules/next/dist/docs/`)を確認していない。静的セグメントと動的セグメントの優先順位、`_` 始まりのフォルダの扱い、Route Handler のキャッシュは [要確認]。
- 各モジュールのファイルは並行で改訂中で、本書は 12:55〜13:13 の内容に基づく(08 は 13:13 に更新あり)。00〜04 は全文を構造化して抽出し、05〜12 はインターフェース・データ・契約・要望の節を読んだ。05〜12 の試験項目・画面節の細部は突き合わせていない。
- 01 内部の不整合(`GET :id` の振り分けがサーバー側かクライアント側か、作成時の招待コード発行、`Group` と `GroupDetailView` の戻り値の変換担当、`LeaveResult` と GroupMember の項目名の差)は 01 内で解消する事項として本書の件数に含めていない。他モジュールも同様に、モジュール内部の矛盾は件数に含めていない。
- 各モジュールの試験期待値の検算、seed の具体値(00 の g-001〜g-012)と各モジュールの前提の全件照合は行っていない(00 の本人確認・ブロックの seed の矛盾のみ確認)。
- rule/rule.md との照合は、localhost 完結・外部依存なし・ダミーデータ・OSS 確認の観点のみ(違反は見つからない)。
- コード・ビルド・試験は実行していない(設計書のレビューのみ)。Mermaid は使用していない。
