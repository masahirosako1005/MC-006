# 06 グループチャット

状態の凡例は README 1 章に従う([事実]/[推定]/[決定]/[案]/[未決]/[要確認])。docs/design と矛盾する場合は docs/design を正とする。モジュール間で共有する名前・署名・パス・値は [_unified-contracts.md](_unified-contracts.md)(以下「統一仕様」)を正とし、本書の該当箇所は統一仕様の節番号を併記する。ID 接頭辞は `CHT`(CHT-TYPE 型 / CHT-FN 関数 / CHT-API API / CHT-UI 画面 / CHT-ERR エラー / CHT-TASK 実装タスク / CHT-T 試験)。

## 1. 概要と責務 / 対応する柱

- 参加が成立したメンバー間のメッセージ交換。外部サービス・WebSocket・外部 API は使わず、サーバー側インメモリ(00 のストアのコレクション `messages`)+ポーリングのローカルのモックで表す。柱15。 [決定(モック)/案(詳細)]
- 責務: (1) 投稿・取得・ページング (2) 投稿前処理(整形、禁止表現、投稿頻度) (3) 権限(メンバーのみ、状態による投稿可否、ブロック非表示) (4) 通報の受け口(記録は 09) (5) システムメッセージ(参加・退会・状態変更)の生成 (6) 新着通知の連携(余力。[見送り(統一仕様 16.2)]) (7) チャット画面。
- 非責務: 禁止語辞書、投稿頻度の計数、通報・ブロックの記録(09)、通知の保存と集約(10)、状態遷移(04)、メンバー管理(01)。
- ユーザーストーリー: 参加が成立したメンバーとして、集合時間や持ち物を相談したい。不快な書き込みは通報したい。ブロックした相手の書き込みは見たくない。 [案]

## 2. 既存機能との関係

- 新規。既存 `/api/v2`・`server-store.ts` は変更しない。通知(10)でメッセージ到着を知らせる(余力。[見送り(統一仕様 16.2)]。8.2 参照)。
- [事実] 既存 `src/lib/api.ts` の `api()` は `/api/v2` 固定のため使わない。`/api/groups` の呼び出しは 00 の `lib/groups-api.ts`(`gapi`・`gpost`、`ApiError`)を使う(統一仕様 3.5)。06 固有のクライアントは作らない。

## 3. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| チャット(タブ) | グループ詳細(旅程、チャット、費用メモ、スタンプへのタブ)/ グループチャット(ローカルのモック) | `/[campaign]/groups/[groupId]?tab=chat` |

- タブの親ページは 01 が持ち、`tab=chat` のとき 06 の `<ChatPanel groupId={groupId} />` を描画する。06 は独立したルートを作らない。 [案]
- 画面には常に「モック(ローカル)」バッジと、「この画面の内容は外部に送信されません」の文言を出す。リアルタイム通信は使わずポーリング(5.3、CHT-API-01)。

## 4. データ(05 章)

### 4.1 型定義(CHT-TYPE)

配置: `app/src/features/groups/chat/types.ts`(エンティティの形は所有モジュールの `types.ts` に置く。統一仕様 3.1)。`Id`・`IsoDateTime`・`DemoUser`・`CursorPage<T>` は 00 の `lib/groups-types.ts`、`Group` は 01(`import type`)、`ReportReason` は 09 から import する。

```ts
// CHT-TYPE-01 種別
export type MessageKind = "normal" | "template" | "system";

// CHT-TYPE-02 通報状態(保存用。クライアントには出さない)
export type ReportState = "none" | "reported";

// CHT-TYPE-03 システムメッセージの事象(6.7。ドメインイベントから生成する)
export type SystemEventType =
  | "group_created"      // group_created イベント
  | "member_joined"      // member_joined イベント
  | "member_left"        // member_left イベント
  | "state_min_reached"  // status_changed(to = min_reached)
  | "state_confirmed"    // status_changed(to = confirmed)
  | "state_cancelled"    // status_changed(to = cancelled)
  | "state_started"      // status_changed(to = in_progress)
  | "state_completed"    // status_changed(to = completed)
  | "state_replanned";   // status_changed(to = replanned)

// CHT-TYPE-04 エンティティ(コレクション messages の要素)
export interface GroupMessage {
  id: Id;                  // newId("msg")。例 "msg-001"(00 の形式 <接頭辞>-<3〜8 桁の連番>)。統一仕様 3.2
  groupId: Id;             // g-NNN
  senderId: Id | null;     // system のとき null
  kind: MessageKind;
  body: string;            // normal: 整形済み本文 / template: 定型文のスナップショット / system: ""(表示時に生成)
  templateId: TemplateId | null;       // kind==="template" のとき tpl-01 等
  systemEvent: SystemEventType | null; // kind==="system" のとき必須
  systemSubjectUserId: Id | null;      // member_joined / member_left の対象ユーザー
  systemPhase: "withdrawal" | "leave" | null; // member_left のとき。辞退(withdrawal_period まで)か退会(確定後)か
  createdAt: IsoDateTime;  // clock.nowIso()(+09:00)
  reportState: ReportState;
  reportedBy: Id[];        // 通報したユーザー ID(サーバー内部のみ。応答に含めない)
}
// 並び順・sinceId/before の比較に使う連番は、00 の idSeq(id)(lib/ids.ts。"msg-012" → 12)で ID の連番部分から導出する
// (保存しない。06 は自前の変換関数を持たない。統一仕様 3.2・3.7)

// CHT-TYPE-05 閲覧者ごとの既読位置(コレクション chatReads の要素。id は `${groupId}:${userId}`)
// lastReadSeq は既読にした最後のメッセージの idSeq の値。行が無い場合は lastReadSeq=0(全件未読)として扱う。lastReadSeq は増える方向にのみ更新する
export interface ChatReadMark { id: string; groupId: Id; userId: Id; lastReadSeq: number; updatedAt: IsoDateTime }

// CHT-TYPE-06 API 応答用 DTO(送信者名は表示時に解決。内部項目は含めない)
export interface MessageDto {
  id: Id;
  kind: MessageKind;
  senderId: Id | null;
  senderName: string;        // system: "お知らせ" / 参加中でない送信者: "元メンバー" [決定 18]
  isMine: boolean;
  text: string;              // normal/template: body / system: 文言を生成した結果
  templateId: TemplateId | null;
  createdAt: IsoDateTime;
  reportedByMe: boolean;     // 他人の通報有無は返さない(報復防止 [案、#8])
}

// CHT-TYPE-07 取得応答(時系列の追記型のため 00 の CursorPage<T> を使う。統一仕様 2.3)
export interface ListMessagesResponse extends CursorPage<MessageDto> {
  // items: 昇順(古い→新しい)
  // nextCursor: 過去分の取得で before に渡す値。最新取得・before 取得で、返した範囲より古い表示対象があれば
  //             返した最古の id、無ければ null。sinceId 取得では常に null
  latestId: Id | null;             // 次回の sinceId に使う値(5.3)。最新取得: グループ内の最大 id(非表示分を含む。0 件なら null)
                                   // sinceId 取得: 走査した最後の id(新着なしなら sinceId と同じ値)/ before 取得: null(クライアントは更新しない)
  unreadCount: number;             // 自分の既読位置より後の、表示対象かつ他人/システムのメッセージ数
  access: ChatAccess;
  serverTime: IsoDateTime;
}

// CHT-TYPE-08 アクセス可否(GET 応答と画面の入力欄の制御に使う)
export interface ChatAccess {
  canRead: boolean;
  canPost: boolean;
  reason?: "not_member" | "state_readonly"; // canPost=false の理由。画面で説明する
}

// CHT-TYPE-09 投稿入力
export type PostMessageInput =
  | { kind: "normal"; body: string; ackReview?: boolean } // ackReview: 09 の review 判定を確認済みで再送するとき true(6.5)。
                                                          // 本文スキーマに v.boolean({ optional: true }) で宣言する(統一仕様 6.2)
  | { kind: "template"; templateId: TemplateId };

// CHT-TYPE-10 定型文
export type TemplateId = "tpl-01" | "tpl-02" | "tpl-03" | "tpl-04" | "tpl-05" | "tpl-06";
export interface ChatTemplate { id: TemplateId; label: string; text: string }
```

### 4.2 ストア上のコレクション

00 の `Db` に次の 2 つを置く(統一仕様 3.1)。アクセスは 00 の `db()`/`Repo<T>`/`tx()` だけを使う。

| コレクション | 型 | ID | 備考 |
|---|---|---|---|
| `messages` | `Repo<GroupMessage>` | `msg-NNN`(`newId("msg")`) | 追記のみ。並び順は ID の連番部分の昇順 |
| `chatReads` | `Repo<ChatReadMark>` | `${groupId}:${userId}` | 既読位置 |

- 採番用の独自カウンタ(旧 `chatSeq`)は置かない。ID は 00 の `newId("msg")`(00 の `counters`)で採番する。
- 1 グループあたり保持件数の上限は 500 件。超過分は古い順に `messages.remove` で削除する(メモリ使用量の上限)。 [案、デモ範囲外・見送り(統一仕様 16.2): デモ中に 500 件へ達する操作は想定しないため、実装は任意]
- 初期化は 00 の `POST /api/demo/reset` で seed の初期状態に戻る。06 はデモ用のメッセージ 10〜20 件(通常・定型文・システム混在。うち 1 件は表示確認用の長文で、禁止表現を含まない。g-011 には、実行確定で退会した u-006(統一仕様 11.3 の `LEFT_MEMBER_SAMPLE`)の退会前の投稿 1 件を含め、「元メンバー」表示の見本にする(CHT-T-35))の seed 断片を用意し、00 の `group-seed.json` に統合する(統一仕様 11.4)。実在個人の発言や連絡先は入れない。 [案]
- 退会・辞退したメンバーのメッセージ履歴は削除せず残し、表示名は「元メンバー」とする [決定 18、統一仕様 10.6]。退会・辞退後は閲覧・投稿とも不可。

### 4.3 制約値(`constants.ts`)

| 名前 | 値 | 根拠・備考 |
|---|---|---|
| 本文の長さ・行数 | `LIMITS.CHAT`(`{ min: 1, max: 500, maxLines: 10 }`) | 00 の `LIMITS` の確定値(統一仕様 10.3)。06 は値を再定義せず、コードでは `LIMITS.CHAT.min`・`max`・`maxLines` で参照する。トリム後。コードポイント数(`[...s].length`)で数える [案] |
| 投稿頻度 | 60 秒に 10 件 | 09 の `RATE_LIMITS.chat_post = { limit: 10, windowMs: 60_000 }` を使う [決定 4、統一仕様 10.4]。06 は値を持たない。ユーザー×グループ単位(キー `chat_post:${userId}:${groupId}`)。system は数えない |
| `PAGE_DEFAULT` / `PAGE_MAX` | 50 / 100 | 取得件数。カーソル一覧の既定・最大は 06 の定数とする(統一仕様 2.3・10.3) |
| `POLL_INTERVAL_MS` | 5000 | 5.3 |
| `POLL_BACKOFF_MS` | [5000, 10000, 30000] | 5.3。連続失敗回数で段階を進め、30000 で止める [見送り(統一仕様 16.2)]。最小構成では失敗時も `POLL_INTERVAL_MS` の固定間隔で再試行する |
| `READ_DEBOUNCE_MS` | 1000 | 9.2。既読位置の送信間隔 |
| `AT_BOTTOM_PX` | 80 | 9.2。「最下部にいる」と見なす距離 |
| 通報本文の長さ | `LIMITS.REPORT_BODY`(`{ min: 0, max: 500 }`) | 00 の `LIMITS` の確定値(統一仕様 10.3)。06 は値を再定義しない |
| `SYSTEM_DEDUPE_SEC` | 5 | 6.7。システムメッセージの重複抑止 [デモ範囲外・見送り(統一仕様 16.2)] |
| `GROUP_RETENTION` | 500 | 4.2 [デモ範囲外・見送り(統一仕様 16.2)] |
| `CHAT_FREE_INPUT` | true | false で自由入力を無効にし、定型文のみにする(5.4) |

## 5. インターフェース

### 5.1 サービス関数(CHT-FN)

配置: `app/src/features/groups/chat/service.ts`。UI・HTTP に依存しない。全関数は同期(00 の規約)。例外は 00 の `AppError`(統一仕様 3.3)。グループの取得とアクセス判定は 09 の `assertGroupAccess(user.id, groupId, "member")` で行う(統一仕様 6.1。グループ不在・非公開グループの非メンバー・ブロック関係のある非メンバーは `not_found`、公開グループの非メンバーは `forbidden`)。

```ts
// CHT-FN-01 一覧取得。取得方式は sinceId(新着)/ before(過去ページ)/ どちらもなし(最新 limit 件)の 3 通り(5.3)
export function listMessages(
  user: DemoUser,
  groupId: Id,
  opts?: { sinceId?: Id; before?: Id; limit?: number },
): ListMessagesResponse;
// 例外: not_found / forbidden(assertGroupAccess)
//       / invalid_input(sinceId と before の同時指定。形式不正はハンドラの v.id・v.int で先に検出する)

// CHT-FN-02 投稿
export function postMessage(user: DemoUser, groupId: Id, input: PostMessageInput): MessageDto;
// 例外: not_found / forbidden / unavailable_state(reason "state_readonly")/ invalid_input(fields.body または fields.templateId。
//       review 判定は detail.reviewRequired)/ rate_limited(detail.retryAfterSec)

// CHT-FN-03 通報(09 の createReport に委譲)
export function reportMessage(
  user: DemoUser, groupId: Id, messageId: Id, reason: ReportReason, body?: string,
): { reported: true };
// 例外: not_found(メッセージが不在・別グループのもの。09 assertInGroup)/ forbidden / not_found(assertGroupAccess)
//       / invalid_input(自分の投稿・システムメッセージは通報不可、reason・body 不正)/ rate_limited(09 の report の回数制限)
// 冪等: 同じ利用者が通報済み(reportedBy に含まれる)なら成功を返し、09 を呼ばない

// CHT-FN-04 既読位置の更新。lastReadId の連番が現在の既読位置以下なら更新しない(既読位置を戻さない)
export function markChatRead(user: DemoUser, groupId: Id, lastReadId: Id): { unreadCount: number };
// 例外: not_found(assertGroupAccess、lastReadId が不在・別グループのもの)/ forbidden

// CHT-FN-05 システムメッセージ(6.7 のイベント購読からだけ呼ぶ内部関数。権限チェックなし。API・他モジュールから呼ばない)
// 重複抑止(6.7。デモ範囲外・見送り)で生成しなかった場合は null を返す
function postSystemMessage(
  groupId: Id, event: SystemEventType, subject?: { userId: Id; phase?: "withdrawal" | "leave" },
): GroupMessage | null;
// 例外: not_found(グループ不在。00 requireGroup)。購読側で捕捉する(6.7)

// CHT-FN-06 アクセス判定(画面の入力欄制御と各関数が共用。例外を投げない)
export function chatAccess(user: DemoUser, group: Group): ChatAccess;

// CHT-FN-07 定型文の一覧(templates.ts の定数 CHAT_TEMPLATES を返す。画面とサービスが共用。API は設けない)
export function listTemplates(): readonly ChatTemplate[];

// CHT-FN-08 未読数(01 のグループ詳細でチャットタブのバッジに使う)。グループ不在・非メンバーは 0 を返し、例外を投げない
export function getUnreadCount(user: DemoUser, groupId: Id): number;

// CHT-FN-09 イベント購読の登録(6.7)。features/bootstrap.ts から 1 回呼ぶ
export function registerChatSubscribers(): void;
```

純粋関数(`sanitize.ts`、`system-messages.ts`):

```ts
// CHT-FN-10 本文の整形。00 の sanitizeText(raw, { multiline: true })(NFC、改行の統一、制御・ゼロ幅・双方向制御文字の除去、trim)を呼び、
// その後に連続 3 つ以上の改行を 2 つに圧縮する [案、見送り(統一仕様 16.2)。最小構成では sanitizeText の結果をそのまま使う]
export function normalizeBody(raw: unknown): string;   // string 以外は AppError invalid_input(fields.body)を投げる
// CHT-FN-11 本文の検証(長さ・行数。値は LIMITS.CHAT)。禁止表現は含めない
export function validateBody(body: string): { ok: true } | { ok: false; message: string };
// CHT-FN-12 (欠番。投稿頻度の判定は 09 の checkRate に一本化した。統一仕様 7.7)
// CHT-FN-13 システムメッセージの文言生成(表示時に呼ぶ)
export function renderSystemText(m: GroupMessage, resolveName: (userId: Id) => string): string;
// CHT-FN-14 DTO 化(送信者名の解決、reportedByMe の算出)。resolveName は 09 の visibleProfile から名前を得る関数(6.7)
export function toDto(m: GroupMessage, viewerId: Id, resolveName: (id: Id) => string, isMemberNow: (id: Id) => boolean): MessageDto;
```

### 5.2 API(CHT-API)

ルーティングはリソースごとの `route.ts` とする(統一仕様 2.1)。ハンドラは `app/src/features/groups/chat/handlers.ts` に 00 の `route()` で包んで置き、`app/src/app/api/groups/[groupId]/.../route.ts` は再エクスポートだけを書く。キャッチオール `[...path]` とハンドラ登録表は使わない。

```ts
// app/src/app/api/groups/[groupId]/messages/route.ts
export { listMessagesHandler as GET, postMessageHandler as POST } from "@/features/groups/chat/handlers";
// app/src/app/api/groups/[groupId]/messages/[messageId]/report/route.ts
export { reportMessageHandler as POST } from "@/features/groups/chat/handlers";
// app/src/app/api/groups/[groupId]/chat/read/route.ts
export { markChatReadHandler as POST } from "@/features/groups/chat/handlers";
```

共通:

- 00 の `route()` が、変更系(POST)の `Origin`・`Content-Type: application/json` の検査、本文 64KB の上限、`Cache-Control: no-store`・`X-Content-Type-Options: nosniff` の付与、例外から応答への変換を行う(7.2)。
- 現在ユーザーは `c.user`(00 の `currentUser`、Cookie `demoUser`)から解決し、クライアントの申告を使わない。
- エラー応答は 00 の `ErrorBody`(`{ error, reason?, message, fields?, detail? }`。統一仕様 3.3)。エラーコードと画面の扱いは 8.1。

| ID | メソッド・パス | リクエスト | 成功応答 | 主なエラー |
|---|---|---|---|---|
| CHT-API-01 | `GET /api/groups/[groupId]/messages` | クエリ `sinceId?` `before?` `limit?`(整数 1〜100、既定 50) | 200 `ListMessagesResponse` | 400 invalid_input / 403 forbidden / 404 not_found |
| CHT-API-02 | `POST /api/groups/[groupId]/messages` | `{ kind:"normal", body, ackReview? }` または `{ kind:"template", templateId }` | 201 `MessageDto` | 400 invalid_input / 403 forbidden / 404 not_found / 409 unavailable_state / 429 rate_limited |
| CHT-API-03 | `POST /api/groups/[groupId]/messages/[messageId]/report` | `{ reason: ReportReason, body? }`(body は `LIMITS.REPORT_BODY`) | 200 `{ reported: true }` | 400 invalid_input / 403 forbidden / 404 not_found / 429 rate_limited(09 の通報回数制限) |
| CHT-API-04 | `POST /api/groups/[groupId]/chat/read` | `{ lastReadId }` | 200 `{ unreadCount: number }` | 400 invalid_input / 403 forbidden / 404 not_found |
| CHT-API-05 | (欠番) | - | - | 定型文の API は設けず、画面は `templates.ts` の定数を使う(統一仕様 2.2・7.7) |

- ID の検証は 00 の `isId` だけを使う(統一仕様 3.2)。パスの `[groupId]` は `c.id("groupId", "g")`、`[messageId]` は `c.id("messageId", "msg")` で検証し、形式不正は not_found(404)。クエリの `sinceId`・`before` と本文の `lastReadId` は `v.id("msg")` で検証し、形式不正は invalid_input(400)。パストラバーサル・注入の対策を兼ねる。
- 本文の未知のキー(`senderId`、`createdAt`、`kind:"system"` 用の項目など)は捨てる(00 の `v.object` の規則)。`kind` が `"normal"`・`"template"` 以外なら invalid_input。
- 投稿の本文スキーマ(`kind:"normal"`)には `ackReview: v.boolean({ optional: true })` を宣言する。宣言しないと未知キーとして捨てられ、review 判定の確認後の再送が通らない(統一仕様 3.4・6.2)。
- パスの配置は R-1・R-2(統一仕様 2.1)を満たす。`G/messages` の子は `[messageId]` だけ、`G/chat` の子は `read` だけである。

### 5.3 取得方式(ポーリング、差分、ページング)

- **初回**: `GET …/messages`(`sinceId` なし)で最新 50 件を昇順で取得。`latestId` と `nextCursor` を保持。
- **ポーリング**: 5 秒ごとに `?sinceId=<保持中の latestId>`。新着のみ返る(通常は空配列)。`latestId` は応答の値で更新する。初回取得で `latestId=null`(0 件)の場合は、ポーリングも `sinceId` なしで行う。
- **sinceId 取得の件数**: `sinceId` より後のメッセージを古い順に走査し、表示対象を最大 `limit` 件返す。走査しきれなかった分は次のポーリングで返る(`latestId` が走査した最後の id のため)。 [デモ範囲外・見送り(統一仕様 16.2): 5 秒間に 50 件を超える投稿はデモで起きない]
- **過去分**: 「以前のメッセージを読み込む」ボタンで `?before=<保持中の nextCursor>&limit=50`。`nextCursor=null` でボタンを消す。無限スクロールは採らない(実装量を抑えるため)。 [案]
- ポーリング制御: タブが非表示(`document.visibilityState==="hidden"`)の間は停止し、復帰時に即時 1 回取得。失敗時は 5 秒の固定間隔で再試行する。段階的な延長(5→10→30 秒、`POLL_BACKOFF_MS`。成功で 5 秒に戻す)は見送り(統一仕様 16.2)。手動「更新」ボタンも置く。
- 差分の整合: `sinceId`・`before` は ID の連番部分の数値で比較する(統一仕様 3.2)。ブロック非表示のメッセージも `latestId` の計算には含める(同じ id を再走査しないため)。メッセージは削除されない設計のため、差分の取りこぼしは起きない(保持上限による古い順の削除のみ。保持上限は見送り。`before` で取得済みの範囲外が消えても影響なし)。
- 重複排除: クライアントは id をキーに Map で保持し、投稿直後のローカル追加とポーリングの重複を吸収する。

### 5.4 入力方式の選択肢と推奨([未決 #9])

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A 定型文のみ | 固定の定型文から選ぶ。自由入力なし | 禁止表現の制御・通報が不要で、不適切な書き込みが発生しない。実装量が最も少ない | 実用性が低く、チャットを見せる意義が薄い |
| B 自由入力+通報のみ | 制限なしの自由入力、事後に通報 | 実装が軽い | 不適切な書き込みが先に出る。デモで禁止表現が画面に出る可能性がある(docs/design 10 章の試験観点に反する) |
| C 自由入力+入力時に弾く | 09 の禁止表現チェックで拒否 | 事前に抑止。柱8 を適用して見せられる | 辞書の作成と誤検知への対応が要る |

**[案] 推奨: C を基本とし、A の定型文ボタンと B の通報導線を併設する(C に A・B を組み合わせる)。**

- 理由: docs/design 07 章「柱8 はチャット・メモ・費用メモの項目名にも適用」と整合し、禁止表現が画面・データに出ないことの試験(docs/design 10 章)を満たせる。定型文は「集合時間を相談したい」等を 1 回の操作で投稿でき、デモで示しやすい。通報は 09 の `createReport` を呼ぶだけで実装できる。
- デモ範囲の実装順: 定型文ボタン(優先度 S、CHT-TASK-04・09)→ 自由入力+禁止表現(S、CHT-TASK-07)→ 通報ボタン(A、CHT-TASK-12)。時間が足りなければ案 A(定型文のみ)に縮退する。縮退時は `CHAT_FREE_INPUT=false`(constants)にし、API は `kind:"template"` のみを受け付ける。 [案]

## 6. 投稿処理・状態・シーケンス

### 6.1 状態遷移

メッセージ自体の状態遷移はない(追記のみ。通報状態 `none → reported` の一方向のみ。対応中・完了は 09 のデモ範囲外)。投稿可否はグループ状態で決まる(6.2)。

### 6.2 アクセス判定(CHT-FN-06、権限チェック)

グループの取得と閲覧権限は 09 の `assertGroupAccess(user.id, groupId, "member")` で判定する(統一仕様 6.1、09 SAF-RULE-40)。メンバーと判定された後、状態による可否を 04 の関数で判定する。

| 条件 | canRead | canPost | 備考 |
|---|---|---|---|
| 非メンバー(申請中・却下・退会・辞退を含む) | false | false | `reason:"not_member"`。API は `assertGroupAccess` が forbidden(公開グループ)または not_found(非公開グループ、ブロック関係の相手がいるグループ)を返す |
| メンバー、`canChat(group)===true` | true | true | recruiting、min_reached、withdrawal_period、confirmed、in_progress(統一仕様 4.4) |
| メンバー、`canChat(group)===false` | true | false | `reason:"state_readonly"`。completed、cancelled、replanned は読み取り専用で履歴を残す(統一仕様 4.4) |

- 可否は 04 の `canChat(g)`・`canReadHistory(g)`(戻り値 boolean)に委ね、06 は状態名を直接比較しない。`canRead` は `isMember(user, group) && canReadHistory(group)`(`canReadHistory` は全状態で true)とする。
- 「承諾前は使えない」: メンバー判定は 00 の `isMember(user, group)`(`lib/authz.ts`。status=`active` の行があるときだけ真)。申請中(03)はメンバーではない。
- `chatAccess` は API の応答(`access`)と `getUnreadCount` で使う。API ではメンバー以外は `assertGroupAccess` で先に拒否されるため、応答の `canRead` は常に true になる。

### 6.3 投稿シーケンス(CHT-FN-02)

1. ハンドラ: `c.user` で投稿者を確定し、`c.id("groupId", "g")` でパスを検証し、`c.body(schema)` で本文を検証する。
2. 09 `assertGroupAccess(user.id, groupId, "member")` でグループを取得する(不在・非公開の非メンバーは not_found、公開の非メンバーは forbidden)。
3. 04 `canChat(group)` が false なら `unavailable_state`(`reason: "state_readonly"`、`detail.state` に `group.lifecycle.status`)。
4. kind で分岐する。
   - template: `templateId` が定型文表に存在するか検証。本文は定型文の text をスナップショットとして保存。禁止表現チェックは省略(固定文。静的試験 CHT-T-24 で担保)。
   - normal: `CHAT_FREE_INPUT` が false なら invalid_input(`fields.body`)。`normalizeBody` → `validateBody`(`LIMITS.CHAT`: 1〜500 文字、10 行以内)→ 09 `assertTextAllowed(body, "chat_message", "body", { ackReview })`(6.5)。
5. 09 `checkRate("chat_post", user.id, groupId)`(60 秒に 10 件。超過は 429 `rate_limited`、`detail.retryAfterSec`)。
6. 00 の `tx` 内で `{ id: newId("msg"), …, createdAt: clock.nowIso() }` を `messages` に追加する。保持上限を超えたら古い順に削除する [デモ範囲外・見送り(統一仕様 16.2)]。
7. 通知(8.2。余力・見送り)を作る場合はここで呼ぶ。`MessageDto` を 201 で返す。通知の呼び出しが例外になった場合は `console.error` に ID とエラーコードだけを記録し(本文は出さない)、投稿は成功として返す。

順序の理由: 安価な検証→高価な検証→計数→状態変更の順。`checkRate` は呼ぶたびに数えるため、禁止表現・長さ・定型文 ID で拒否された投稿は投稿頻度の件数に数えない(手順 5 の前に拒否するため)。

### 6.4 サニタイズ(XSS)

- 保存は「プレーンテキスト」。HTML エスケープ文字列を保存すると二重エスケープになるため、保存時は変換しない。
- 表示は React の既定エスケープのみ。`dangerouslySetInnerHTML` は使わない。URL を自動リンク化しない(外部誘導の抑止、`<a>` を生成しない)。改行は CSS `white-space: pre-wrap` で表示する。
- `normalizeBody` は 00 の `sanitizeText` で制御文字(U+0000〜U+0008、U+000B、U+000C、U+000E〜U+001F、U+007F、C1 制御文字)、ゼロ幅文字、双方向制御文字(U+202A〜U+202E・U+2066〜U+2069)を除去し、NFC に正規化する。表示崩れと、文字の向きを操作した偽装表示を防ぐため。06 は独自の除去処理を持たない(統一仕様 3.4)。
- 通知・ログ・エラー文言に本文を埋め込まない(8.2、7.2)。

### 6.5 禁止表現の拒否(09 との契約)

- 呼び出し: 保存前に 09 `assertTextAllowed(body, "chat_message", "body", { ackReview })`(統一仕様 6.2)。画面のライブ警告に使う場合は `checkText(body, "chat_message")`(戻り値 `TextCheckResult`)。
- deny のとき: 400 `invalid_input`、`fields: { body: "<理由>" }`。投稿は保存せず、入力欄の本文を保持したまま、欄の下に理由と修正案を表示する(例:「外部の連絡先や別のアプリへの誘導は送信できません。言い換えてください。」)。
- review のとき(URL など誤検知の可能性があるもの。09 の `chat_message` の規則): `ackReview` が true でなければ 400 `invalid_input`、`fields.body`、`detail.reviewRequired: true`。画面は理由と「このまま送信」を表示し、押されたら `ackReview: true` を付けて再送する。再送は通常の投稿として 6.3 の手順 5 以降を通る。
- 禁止の例(デモ用の辞書側で定義): 09 の辞書の区分(`romance_hint`、`contact_exchange`、`contact_pattern`、`money_solicit` など)。電話番号・メールアドレス・外部 SNS の ID や URL への誘導(「LINE 交換しよう」等)を含む。辞書の中身は 09 の責務で、06 は持たない。
- 定型文は禁止表現チェックを通さないが、定型文の追加・変更時に 09 の `checkText(text, "chat_message")` を通す静的試験(CHT-T-24)を置く。

### 6.6 ブロックの非表示([案]、#8)

- `listMessages` は、取得したメッセージを system を含めてすべて 09 `filterVisibleMessages(viewer.id, msgs)` に通し、閲覧者がブロックした相手の投稿を応答から除外する(サーバー側で適用。クライアントに送らない)。09 の型は `senderId: Id | null` を受け、system(`senderId=null`)を残すため、06 は system を分けて扱わない(統一仕様 6.3)。09 の規則(SAF-RULE-24)により、チャットは自分がブロックした相手だけを隠し、相手の画面の表示は変わらない。自分のメッセージも常に表示される。
- `sinceId` のポーリング・`before` の過去分取得でも同じ関数を通す。
- 非表示にした件数は応答に含めない(非表示のメッセージの有無を応答から推測できないようにするため)。ブロックした相手が同じグループにいる場合も、グループの構成は変更しない(09 の `sameGroupOnBlock: "stay"`)。
- 通報は、ブロックの有無と関係なく行える。

### 6.7 システムメッセージ(CHT-FN-05、CHT-FN-09)

システムメッセージは 00 の `lib/events.ts` のドメインイベントを購読して作る(統一仕様 4.6)。発行側(01・04)は 06 を import せず、`postSystemMessage` は 06 の内部関数とする。購読の登録は `registerChatSubscribers()` を `features/bootstrap.ts` から呼んで行う(キーは `"chat"`)。

| イベント | 発行元(統一仕様 4.6) | 生成する事象 | 文言(`renderSystemText`) |
|---|---|---|---|
| `group_created` | 01 `createGroup`・`createGroupInternal` | group_created | 「グループが作成されました。」 |
| `member_joined` | 01 `addMember`(03 の承認から。作成時の幹事の登録では発行されない) | member_joined(対象 `userId`) | 「{名前}さんが参加しました。」 |
| `member_left` | 04 `withdraw`(`Withdrawal` の作成後。01 の `markMemberLeft` は発行しない) | member_left(対象 `userId`。`phase` が withdrawal_period まで → 辞退、confirmed → 退会) | 「{名前}さんが辞退しました。」/「{名前}さんが退会しました。」 [案] |
| `status_changed`(`to = min_reached`) | 04 の状態が変わるすべての遷移(`applyDue`、`onMembershipChanged`、`changeConditions` の後の評価、`withdraw`、`organizerCancel`、`replan`) | state_min_reached | 「最少人数に達しました。まだ実行は確定していません。」 |
| `status_changed`(`to = confirmed`) | 同上 | state_confirmed | 「実行が確定しました。」 |
| `status_changed`(`to = cancelled`) | 同上(自動の中止、幹事による中止) | state_cancelled | 「このグループは中止になりました。」 |
| `status_changed`(`to = in_progress` / `completed`) | 同上 | state_started / state_completed | 「旅行が始まりました。」「旅行が完了しました。」 |
| `status_changed`(`to = replanned`) | 04 `replan`(元グループが replanned になったとき) | state_replanned | 「このグループは再企画されました。」 |

- `to` が上の表に無い状態(`recruiting`、`withdrawal_period`)の `status_changed` ではメッセージを作らない。
- 購読ハンドラは発行元の `tx` の中で同期に呼ばれる。ハンドラは例外を外へ出さない(自分で捕捉し、`console.error` にグループ ID とエラーコードだけを残す)。そのため、システムメッセージの失敗で状態変更は巻き戻らない(統一仕様 4.6)。
- 同じ (groupId, event, subjectUserId) のシステムメッセージが直近 5 秒以内(`SYSTEM_DEDUPE_SEC`)にあれば生成せず null を返す(同じイベントが二重に発行された場合の対策)。 [案、デモ範囲外・見送り(統一仕様 16.2): 04 が遷移を 1 回だけ実行するため通常は発生しない。実装は任意]
- グループ作成時は `group_created` だけが発行され、幹事の `member_joined` は発行されない(統一仕様 4.6・5.1)。06 は `group_created` から「グループが作成されました。」を作り、幹事の参加メッセージは作らない。対象が幹事の `member_joined` を除く条件は設けない。
- 名前は表示時に 09 の `visibleProfile(viewer, userId, { kind: "member", groupId })` が返す `displayName`(`Profile.displayName`)から解決する。`DemoUser.displayName` は使わない(統一仕様 3.6)。参加中でない利用者・未知のユーザーは `visibleProfile` を呼ばずに「元メンバー」とする [決定 18]。`visibleProfile` が `not_found` を投げた場合(ブロック関係など)は「メンバー」と表示する [案。ブロック関係による表示の出し分けの細部は見送り(統一仕様 16.2)]。1 回の応答の中では userId ごとに結果を使い回す。名前はユーザー入力のため、React の既定エスケープで表示する。
- システムメッセージには投稿頻度・禁止表現チェック・通知を適用しない。通報不可。
- 中止後(`canChat=false`)でも内部処理のため追加できる(「中止になりました」は中止後に入るため)。この例外は `postSystemMessage` が権限チェックを持たないことで満たす。

## 7. 入力検証・セキュリティ

### 7.1 入力検証

| 項目 | 規則 |
|---|---|
| `body`(投稿) | string 必須(kind=normal)。00 の `sanitizeText` の後、トリム後 1〜500 コードポイント、10 行以内(`LIMITS.CHAT`)。禁止表現(09 `assertTextAllowed`、context `chat_message`)。型が string 以外は invalid_input |
| `ackReview` | boolean、任意。本文スキーマに `v.boolean({ optional: true })` で宣言する(統一仕様 6.2)。true のとき 09 の review 判定を通す(deny は通さない) |
| `templateId` | 列挙値のみ(TemplateId)。それ以外は invalid_input |
| `kind` | `"normal"` または `"template"` のみ。`system` はクライアントから受け付けない(送られたら invalid_input) |
| `limit` | 整数 1〜100。小数・文字列・範囲外は invalid_input(丸めない) |
| `sinceId`/`before` | `v.id("msg")`(00 の `isId`)。形式不正・同時指定は invalid_input |
| `lastReadId` | `v.id("msg")`。形式不正は invalid_input。同じグループのメッセージであること(別グループ・不在は 09 `assertInGroup` で not_found) |
| `[groupId]`/`[messageId]` | `c.id("groupId", "g")`、`c.id("messageId", "msg")`。形式不正は not_found。`[messageId]` は `[groupId]` のグループに属すること(別グループ・不在は `assertInGroup` で not_found) |
| `reason`(通報) | 09 の `ReportReason` の列挙値 |
| `body`(通報) | `LIMITS.REPORT_BODY`(0〜500 文字)。09 の `createReport` が `sanitizeText` を通す。表示時はエスケープ |
| 本文全体 | 64KB まで(00 の `route()`。超過は 413) |
| 権限 | 閲覧・投稿・既読・通報はいずれもメンバーのみ(`assertGroupAccess(…, "member")`)。サーバー側で判定 |
| 送信者 | 常に `c.user`。クライアントから `senderId` を受け取らない |

- 本文は他のモジュールの入力欄と同じ「保存する入力は 09 の `assertTextAllowed` を通す」方針(統一仕様 6.2)に従う。
- 連絡先・本名を含む投稿は 09 の辞書で拒否する(承諾前は連絡先が見えない、docs/design 10 章)。チャットは参加成立後の機能だが、外部の連絡先への誘導は拒否対象とする。

### 7.2 セキュリティ対策(OWASP Top 10 の代表項目との対応)

| 分類 | 06 での対策 |
|---|---|
| アクセス制御・IDOR | 全 API でサーバー側が `c.user` と 09 `assertGroupAccess(…, "member")` から権限を判定する。`[messageId]`・`lastReadId` は 09 `assertInGroup` で `[groupId]` に属するかを確認し、別グループの ID は not_found にする。非公開グループの非メンバーには not_found を返す。`postSystemMessage` は API から呼べない内部関数とする |
| 入力検証・インジェクション | 7.1 の検証をサーバー側で行う。ID は 00 の `isId` だけで検証する。SQL・シェル・ファイルパスにユーザー入力を渡さない(インメモリストアのみ)。本文の未知のキーは捨てる(マスアサインメント対策) |
| XSS | 6.4 のとおり。React の既定エスケープのみで表示し、`dangerouslySetInnerHTML` と URL の自動リンク化を使わない。CSP は設けない(統一仕様 11.2、本書 7.3) |
| CSRF | 00 の `route()` が、変更系 API で `Content-Type: application/json` 以外を 415、`Origin` が `Host` と異なる場合を 403 にする。Cookie は `SameSite=Lax`(00) |
| 認証・セッション(デモ) | ログイン不要のため、現在ユーザーは Cookie `demoUser` で表すモックとする。画面に「モック(ローカル)」を常時表示する |
| セキュリティ設定 | API の応答に `Cache-Control: no-store`・`X-Content-Type-Options: nosniff` を付ける(00 の `route()`)。全ページに `X-Frame-Options: DENY`・`X-Content-Type-Options: nosniff`・`Referrer-Policy: no-referrer` を付ける(00 の `next.config.ts`、統一仕様 11.2)。CORS ヘッダは付けない。WebSocket・SSE・外部通信を使わない |
| 機密データの扱い | `reportedBy`・`reportState` は応答に含めず、`reportedByMe` のみ返す。非表示件数を返さない(6.6)。通知に本文・投稿者名を載せない(8.2) |
| ログ | ログには `requestId`・エラーコード・groupId・messageId のみを出し、本文・通報本文は出さない。エラー応答に入力本文を含めない |
| 過大入力・連投 | 本文 64KB 上限(00)、`limit` 最大 100、投稿頻度 60 秒に 10 件(09 `checkRate("chat_post")`) |

### 7.3 既知の制約

- Cookie `demoUser` は利用者が書き換えられるため、なりすましを防げない(ログイン不要のデモの前提。実運用では認証が必要)。
- 投稿頻度の計数は 09 の `checkRate`(globalThis の Map、固定ウィンドウ)が持つため、プロセス再起動・ストアの初期化で計数が戻る。Cookie の切替で別ユーザーとして数えられる(09 10.6 の既知の制約と同じ)。
- CSP は設けない。インラインスクリプトの注入を防ぐ仕組みは React のエスケープと `dangerouslySetInnerHTML` の禁止のみ(統一仕様 11.2)。
- 応答時間の差や、ポーリング結果の差分からの推測(ブロック・通報の有無など)、大量のリクエストによる負荷への対策は行わない(デモ範囲外・見送り(統一仕様 16.2))。

## 8. エラー処理・画面表示

### 8.1 エラーコード(CHT-ERR)

「対象 API」列の番号は CHT-API の番号。エラーコードは 00 の `ErrorCode`(統一仕様 3.3)だけを使い、06 固有のコードは作らない。

| ID | コード(HTTP) | 分類 | 発生条件 | 対象 API | 画面の表示・挙動(原因と次の行動) |
|---|---|---|---|---|---|
| CHT-ERR-01 | forbidden(403) | 権限なし | 公開グループの非メンバー(申請中、却下、退会、辞退) | 01〜04 | 「チャットは参加が成立したメンバーだけが使えます。」+グループ詳細へ戻る導線。リスト・入力欄は出さない |
| CHT-ERR-02 | not_found(404) | 対象なし | グループ不在、非公開グループの非メンバー、ブロック関係の相手がいるグループの非メンバー、パスの ID の形式不正、`[messageId]`・`lastReadId` が不在または別グループ | 01〜04 | 「グループが見つかりません。」+グループ一覧へ戻る導線(00 の方針)。通報・既読の対象が無い場合は「対象のメッセージが見つかりません。画面を更新してください。」 |
| CHT-ERR-03 | invalid_input(400) | 入力不正 | 本文が `LIMITS.CHAT` の範囲外(空、501 文字以上、11 行以上)、定型文 ID 不正、`kind` 不正、`CHAT_FREE_INPUT=false` で `kind:"normal"` | 02 | 入力欄の下に `fields` のメッセージ(「1〜500 文字で入力してください」等)を表示する。入力内容は消さない |
| CHT-ERR-04 | invalid_input(400) | 入力不正 | 禁止表現の deny(`fields.body`) | 02 | 「この内容は送信できません(理由)。言い換えて送信してください。」。入力内容は消さない |
| CHT-ERR-05 | unavailable_state(409) | 状態不正 | 投稿不可の状態(`canChat=false`。完了・中止・再企画済み)。`reason: "state_readonly"`、`detail.state` | 02 | 「完了(または中止・再企画済み)のため、新しい投稿はできません。履歴は読めます。」。入力欄・定型文を無効化し、理由を表示する |
| CHT-ERR-06 | rate_limited(429) | 連投 | 投稿: 60 秒に 10 件を超えた(09 `checkRate("chat_post")`)。通報: 09 の `report` の回数制限 | 02、03 | 「投稿が続いています。しばらく待ってから送信してください。」(00 の `ErrorNotice` で `message` を表示)。入力内容は保持する。残り秒数(`detail.retryAfterSec`)の表示は見送り(統一仕様 16.2) |
| CHT-ERR-07 | internal(500) | 想定外 | 業務エラー(AppError)以外の例外 | 全 API | 「問題が発生しました。画面を再読み込みするか、デモを初期化してください。」(00 の `ErrorNotice`) |
| CHT-ERR-08 | invalid_input(400) | 入力不正 | クエリ不正(`sinceId`・`before`・`limit` の形式、`sinceId` と `before` の同時指定)、本文の `lastReadId` の形式不正 | 01、04 | 通常の画面操作では発生しない。取得エラーとして扱い、「メッセージを取得できませんでした」+「再試行」(9.3) |
| CHT-ERR-09 | invalid_input(400) | 入力不正 | 通報: 自分の投稿・システムメッセージが対象、`reason` が列挙外、`body` が `LIMITS.REPORT_BODY.max` を超える | 03 | 通報ダイアログ内に `fields` のメッセージを表示する。自分の投稿・システムには通報メニューを出さないため、前者は通常の画面操作では発生しない |
| CHT-ERR-10 | (クライアント)network | 通信失敗 | fetch の失敗、JSON でない応答(00 の `gapi` が生成) | 01〜04 | ポーリング中はリスト上部に「更新できませんでした。再試行しています」を表示し、既存の表示を保持する(5 秒の固定間隔で再試行。段階的な延長は見送り。5.3)。投稿・通報では入力内容を保持してエラーを表示する |
| CHT-ERR-11 | invalid_input(400) | 要確認 | 禁止表現の review(`fields.body`、`detail.reviewRequired: true`)。URL など誤検知の可能性があるもの | 02 | 理由と「このまま送信」ボタンを表示する。押すと `ackReview: true` を付けて再送する。入力内容は消さない |

- 00 の `route()` が返す共通エラー(415 unsupported_media_type、403 forbidden(Origin 不一致)、413 payload_too_large)は 00 8 章の表示に従う。通常の画面操作では発生しない。
- 競合(409 conflict)は使わない。メッセージは追記のみで更新の競合が無く、二重の通報は冪等(200)として扱うため。投稿の二重送信は画面側で送信中のボタンを無効にして防ぐ(9.1)。

### 8.2 通知との関係(10 との契約)[決定 1(余力)/案] [見送り(統一仕様 16.2)]

- 通知 `chat_new` は余力として扱う [決定 1、統一仕様 9.1]。デモの最小構成では通知を作らず、未読バッジ(CHT-TASK-13)で代替する。作る場合の優先度は B(CHT-TASK-15)。主ルートの実装では作らない(見送り。統一仕様 16.2)。本節は作る場合の契約として残す。
- 呼び出し: `postMessage` の成功後に 10 の `notify(input: NotifyInput)` を 1 回呼ぶ(位置引数の形は使わない。統一仕様 9.1)。

```ts
notify({
  kind: "chat_new", groupId, eventKey: "chat",
  params: { groupTitle: group.name, count: 1 },
  recipients: [{ type: "groupMembers", excludeUserIds: [user.id, ...blockedRecipients] }], // groupId は NotifyInput の値を使う(10)
});
// blockedRecipients: 参加中メンバー(00 activeMembers(group))のうち、09 isBlockedByMe(recipientId, user.id) が真の者
```

- 除外: システムメッセージ(通知を呼ばない)、投稿者本人、投稿者をブロックしている受信者(`isBlockedByMe(recipient, sender)`。統一仕様 6.3)。
- 集約: 同じ (宛先, グループ) に未読の `chat_new` がある場合の集約(件数の加算)は 10 が行う(10 の NTF-COALESCE)。06 は未読の有無を確認しない。
- 通知の本文は 10 のテンプレートで作られ、メッセージ本文・投稿者名を含まない(06 は `params` に `groupTitle` と `count` だけを渡す)。
- 通知の既読化は、10 の通知画面で項目を開いたときの `POST /api/me/notifications/read`(本文 `{ id }`)で行う(統一仕様 7.7・9.2)。`read-all` は余力で見送り(統一仕様 2.2・16.2)。チャットを開いたことによる `chat_new` の既読化は行わない(06 の `markReadWhere`・`hasUnread` の要望は取り下げた)。
- 画面内の「新着◯件」バッジ(未読数)は通知とは別に `unreadCount` から出す(グループ詳細のチャットタブに表示)。
- 通知の呼び出しが失敗しても投稿は成功として扱う(6.3 の手順 7)。

## 9. 画面コンポーネント構成(CHT-UI)

配置: `app/src/features/groups/chat/ui/`。既存の Mantine(ScrollArea、Textarea、Button、Badge、Alert、Menu、Modal、Skeleton)を使う。全コンポーネントは `"use client"`。

```
ChatPanel (CHT-UI-01)                 props: { groupId: string }
 ├─ ChatNotice            (CHT-UI-02) 「モック(ローカル)」バッジ+説明
 ├─ MessageList           (CHT-UI-03) props: { messages, hasMoreOlder, loadingOlder, onLoadOlder, onReport }
 │   ├─ MessageItem       (CHT-UI-04) props: { message: MessageDto, onReport }
 │   └─ SystemMessageItem (CHT-UI-05) props: { message }
 ├─ NewMessagesPill       (CHT-UI-06) props: { count, onClick } 新着ボタン
 ├─ TemplateBar           (CHT-UI-07) props: { templates, disabled, onPick }
 ├─ MessageComposer       (CHT-UI-08) props: { disabled, disabledReason?, error?, reviewRequired, submitting, onSubmit }
 └─ ReportDialog          (CHT-UI-09) props: { message, opened, onClose, onSubmit }
ui/useChat.ts             (CHT-UI-10) ポーリング・投稿・差分取り込み・既読・通報
```

props の型:

```ts
type MessageListProps = { messages: MessageDto[]; hasMoreOlder: boolean; loadingOlder: boolean;
  onLoadOlder: () => void; onReport: (m: MessageDto) => void };            // 自分の投稿かは MessageDto.isMine で判定
type MessageItemProps = { message: MessageDto; onReport: (m: MessageDto) => void };
type NewMessagesPillProps = { count: number; onClick: () => void };
type TemplateBarProps = { templates: readonly ChatTemplate[]; disabled: boolean; onPick: (id: TemplateId) => void };
type MessageComposerProps = { disabled: boolean; disabledReason?: string; error?: string;
  reviewRequired: boolean;                                                  // true のとき「このまま送信」を表示(CHT-ERR-11)
  submitting: boolean;
  onSubmit: (body: string, ackReview: boolean) => Promise<boolean> };       // true のとき入力欄を空にする
type ReportDialogProps = { message: MessageDto | null; opened: boolean; onClose: () => void;
  onSubmit: (reason: ReportReason, body: string) => Promise<boolean> };    // true のとき完了表示にする
```

### 9.1 状態とデータ取得

- `useChat(groupId)` の戻り値:

```ts
interface UseChatResult {
  messages: MessageDto[];                 // 昇順
  access: ChatAccess | null;              // 初回取得前は null
  unreadCount: number;
  hasMoreOlder: boolean;                  // 保持中の nextCursor !== null
  status: "loading" | "ready" | "error";  // error は初回取得の失敗。ポーリングの失敗は pollError で示す
  error: ApiError | null;                 // 直近の操作のエラー(00 の ApiError。reason・detail を含む)
  pollError: boolean;                     // ポーリングが連続して失敗している間 true
  pendingNew: number;                     // 最下部にいない間に届いた新着の件数(NewMessagesPill)
  post(input: PostMessageInput): Promise<boolean>;
  loadOlder(): Promise<void>;
  refresh(): Promise<void>;
  markRead(): void;                       // READ_DEBOUNCE_MS でまとめて CHT-API-04 を呼ぶ
  report(messageId: Id, reason: ReportReason, body?: string): Promise<boolean>;
}
```

- 内部状態: `messagesById: Map<Id, MessageDto>`、`latestId`、`nextCursor`、`atBottom: boolean`、`consecutiveFailures: number`。
- 取得は 00 の `gapi`、投稿・既読・通報は `gpost`(`lib/groups-api.ts`。内部で `cache: "no-store"`)を使う。既存 `useApi` は `/api/v2` 固定のため使わない。定型文は `templates.ts` を静的 import する。
- 投稿は送信中ボタン無効(二重送信防止)。成功したら応答の `MessageDto` を Map に追加し、入力欄を空にして最下部へスクロール。失敗時は入力欄を保持。`error.detail.reviewRequired` が true のときは `reviewRequired` を立てる。

### 9.2 スクロール位置と新着表示

- 最下部から 80px 以内なら「最下部にいる」。そのとき新着が来たら自動で最下部へ。離れている場合は自動スクロールせず、`NewMessagesPill`(「新着 3 件 ↓」)を出し、押すと最下部へ。
- 過去分の読み込みでは、追加前に先頭にあった要素が同じ表示位置に残るようにスクロール位置を補正する。
- 初回表示は最下部、または既読位置の直後(最初の未読)に「ここから未読」の区切りを入れる [案]。デモの最小構成は最下部のみ。
- 開いて最下部に到達したら `markChatRead(latestId)` を呼ぶ(デバウンス 1 秒、`READ_DEBOUNCE_MS`)。

### 9.3 空状態・読み込み・エラー・読み取り専用

| 状態 | 表示 |
|---|---|
| 読み込み中 | スケルトン(Mantine Skeleton)3 行 |
| 0 件 | 「まだメッセージがありません。定型文から始めてみましょう。」+定型文ボタンを強調 |
| 取得エラー | `Alert`(赤):「メッセージを取得できませんでした」+「再試行」ボタン。既存表示は保持 |
| 非メンバー | CHT-ERR-01 の説明。入力欄・リストは出さない |
| グループが見つからない | CHT-ERR-02 の説明とグループ一覧への導線 |
| 読み取り専用(完了・中止・再企画済み) | 入力欄と定型文を無効化し、理由を `Alert`(青)で表示 |
| 禁止表現/頻度/長さ | コンポーザー直下にエラー(`aria-describedby`)。入力は保持。review のときは「このまま送信」を併記 |

### 9.4 通報導線

- 他人の `normal`/`template` の各メッセージにメニュー(「…」)→「通報する」。自分のメッセージ・システムには出さない。
- `ReportDialog`: 理由(09 の `ReportReason` から選択)と任意の本文(`LIMITS.REPORT_BODY`)。送信後は「通報を受け付けました。相手には通知されません。」を表示し、そのメッセージに「通報済み」を表示(自分の画面のみ。`reportedByMe`)。通報は 09 に記録するだけで、デモでは受付の表示までとし、対応の処理は行わない。 [案]
- ブロックへの導線(メンバー一覧への案内)は 09/01 の画面に委ねる。06 の「…」メニューに「ブロックする」を置くかは [未決 #8]。置く場合は 09 のブロック API(`POST /api/me/blocks`)を呼び、成功後に `refresh()` を呼んで非表示を反映する。

### 9.5 アクセシビリティ

- メッセージリストのコンテナに `role="log"`、`aria-live="polite"`、`aria-relevant="additions"`、`aria-label="グループチャットのメッセージ"`。読み上げ対象を新着に限るため、過去分の追加中は `aria-busy="true"` にする(過去分をまとめて読み上げない)。
- リストは `ul`、各メッセージは `li` とし、「送信者名、時刻、本文」の順に並べる。自分の発言はテキストで「自分」を付ける(色だけで区別しない)。システムメッセージも同じリスト内の通常の `li` とし、`role="status"` は付けない。
- 入力欄は `<label>`(視覚的に非表示可)付きの `Textarea`。Enter では送信せず、`Ctrl+Enter` またはボタンで送信する(日本語入力の変換確定の Enter による誤送信を避ける)。 [案]
- 文字数カウンタ「120 / 500」を `aria-live="off"` で表示し、上限超過時のみエラーとして通知する。
- 定型文ボタンは `button`、`aria-label` に全文を入れる。キーボードだけで通報まで到達できる(メニューは Mantine の Menu でフォーカス管理)。
- 新着 Pill は `button`。「モック(ローカル)」バッジはテキストで常時表示。
- スマホ幅: 入力欄を下部固定(下部タブ(04 章)と重ならないよう余白)。タップ領域 44px 以上。

## 10. 試験観点(10 章)と受け入れ条件

試験基盤は Vitest(00 の `vitest.config.ts`、`npm test`)[決定 11]。API 試験は 00 の `callRoute`、前提データは 00 の `resetForTest` と `fixtures.ts` を使う(統一仕様 11.3)。

前提データ: 00 の `fixtures.ts` の定数(統一仕様 11.3)を使い、試験コードに ID 文字列を直接書かない。本章の表の ID と定数の対応は次のとおり。clock は `clock.set` で差し替える。

| 本章の表記 | 定数・データ |
|---|---|
| g-001(募集中) | `GROUP_BY_STATUS.recruiting`。参加中は u-001(幹事)と u-002(メンバー)、申請中は u-004 |
| 非メンバー | u-003(g-001 のメンバーでも申請者でもない) |
| g-013(中止)/ g-010(完了)/ g-006(再企画済み) | `GROUP_BY_STATUS.cancelled`・`completed`・`replanned`。投稿・取得は各グループの幹事(seed の `organizerId`)が行う |
| g-008(非公開) | `PRIVATE_GROUP`。参加中は幹事 u-005 だけ |
| ブロック関係 | `BLOCK_SAMPLE`(u-001 が u-006 をブロック)。試験の前処理で 00 の `insertMember` により u-006 を g-001 に加える |
| 退会者・辞退者 | `LEFT_MEMBER_SAMPLE`(g-011 の u-006、wd-002、実行確定で退会)。g-004 の u-006(wd-001、辞退)。g-011 の u-006 の退会前の投稿は 06 の seed 断片に含める(4.2) |
| 試験の中だけで作るデータ | 00 の `insertGroup`・`insertMember`・`insertBlock`。ID は 900 番台(`g-901`、`u-901` など。統一仕様 3.2・3.7) |

- 見送り(統一仕様 16.2)の試験は削除せず、期待結果に印を付ける(一部の値だけを見送る試験は、残す代表の値を併記する)。CHT-TASK-18 の完了条件から除く。

### 10.1 サービス・API

| ID | 入力 | 期待結果 |
|---|---|---|
| CHT-T-01 | 非メンバー(u-003)が `GET /api/groups/g-001/messages` | 403 forbidden。メッセージ内容を応答に含めない |
| CHT-T-02 | 申請中の u-004 が POST normal "こんにちは" | 403 forbidden。承諾前は使えない |
| CHT-T-03 | メンバーが POST `{kind:"normal", body:"集合は10時でどうですか"}` | 201。`kind:"normal"`、senderId=本人、id が `msg-` で始まり保存される |
| CHT-T-04 | メンバーが POST `{kind:"template", templateId:"tpl-01"}` | 201。`kind:"template"`、body が定型文 tpl-01 の文言 |
| CHT-T-05 | body が空 / 空白のみ | 400 invalid_input、`fields.body` あり |
| CHT-T-06 | body が 500 文字ちょうど / 501 文字 | 前者 201 / 後者 400(長さの境界の代表として残す) |
| CHT-T-07 | body が 11 行(改行 10 個) | [見送り(統一仕様 16.2)] 400 invalid_input |
| CHT-T-08 | body に連続改行 5 個を含む短文 | [見送り(統一仕様 16.2)] 201。保存本文の連続改行が 2 つに圧縮されている |
| CHT-T-09 | body に制御文字(U+0000、U+202E)を含む | [見送り(統一仕様 16.2)] 制御文字が除去された本文で 201(制御文字のみの本文なら 400) |
| CHT-T-10 | 禁止表現(09 の辞書の「LINE 交換しよう」相当)を含む body | 400 invalid_input、`fields.body`。`messages` の件数が変わらない |
| CHT-T-11 | 09 の辞書で deny となる `romance_hint` 区分の語を含む body | 400(同上) |
| CHT-T-12 | `templateId:"tpl-99"` | 400 invalid_input、`fields.templateId` |
| CHT-T-13 | `kind:"system"` を送る | 400 invalid_input |
| CHT-T-14 | `body:"<script>alert(1)</script>"` | 201。保存・応答は原文のまま。画面では文字として表示され、実行されない(CHT-T-30) |
| CHT-T-15 | 同一ユーザーが同じグループに 60 秒以内に 10 件投稿 → 11 件目。別グループへの投稿 | [見送り(統一仕様 16.2)] 11 件目は 429 rate_limited、`detail.retryAfterSec` あり。`clock.set` で 61 秒進めた後の投稿は 201。別グループのキーは独立して数える |
| CHT-T-16 | 禁止表現で 10 回拒否 → 11 回目に正常本文 | [見送り(統一仕様 16.2)] 201(拒否は件数に数えない) |
| CHT-T-17 | g-013(中止)に幹事が POST | 409 unavailable_state、`reason:"state_readonly"`、`detail.state:"cancelled"`。GET は 200 で `access.canPost=false`、`reason:"state_readonly"` |
| CHT-T-18 | g-010(完了)・g-006(再企画済み)に各幹事が POST / GET | POST は 409、GET は 200(読み取り専用) |
| CHT-T-19 | 退会者(g-011 の u-006)・辞退者(g-004 の u-006)が GET / POST | ともに 403 |
| CHT-T-20 | g-001 で u-006 が投稿し、u-001(u-006 をブロック済み)が GET | 応答に u-006 のメッセージが含まれない。システムメッセージは含まれる。u-002 の応答と u-006 自身の応答には含まれる。`latestId` は u-006 の投稿を含む値 |
| CHT-T-21 | 初回取得 → `sinceId=latestId` で再取得(新着なし) | `items: []`、`latestId` 不変、`nextCursor=null`。新規投稿後は新規 1 件のみ |
| CHT-T-22 | 60 件ある状態で limit なし → `before=<nextCursor>` | 初回は最新 50 件、`nextCursor` は返した最古の id。`before` で残り 10 件、`nextCursor=null`、`latestId=null` |
| CHT-T-23 | `limit=0` / `limit=101` / `limit=abc`、`sinceId`+`before` 同時、`sinceId=../x`、`sinceId=m-000001`(旧形式) | すべて 400 invalid_input。代表として `sinceId`+`before` 同時と `limit=101` を残し、他の値は[見送り(統一仕様 16.2)] |
| CHT-T-24 | 全 `ChatTemplate.text` を 09 の `checkText(text, "chat_message")` に通す(静的試験) | すべて `verdict:"ok"` |
| CHT-T-25 | 他メンバーのメッセージを通報(reason 有効) | 200 `{reported:true}`。09 の `reports` に `targetType:"message"` の記録 1 件。同じ操作を再度行うと 200 で記録は増えない(冪等) |
| CHT-T-26 | 自分の投稿 / system メッセージを通報 | 400 invalid_input |
| CHT-T-27 | 通報後、通報者の GET で当該メッセージ `reportedByMe=true`、他メンバーの GET では false | 通報の有無が他のメンバーに伝わらない。応答に `reportedBy`・`reportState` が含まれない |
| CHT-T-28 | メンバー追加(03 の承認 → 01 `addMember` → `member_joined` 発行)後 | system メッセージ `member_joined` が 1 件。`text` に対象の `Profile.displayName`(09 `visibleProfile` の値)。5 秒以内の重複発行で増えない(この確認はデモ範囲外・見送り) |
| CHT-T-29 | 状態が確定/中止/再企画済みに遷移(04 → `status_changed` 発行) | 対応する system メッセージ(`state_confirmed`/`state_cancelled`/`state_replanned`)が 1 件。中止後も system は追加できる。`to=withdrawal_period` では作られない |
| CHT-T-33 | メンバー A が投稿 → B に `chat_new`、投稿者 A と、A をブロック済みの C には通知なし。続けて A が再投稿 | [見送り(統一仕様 16.2)] `notify` が `kind:"chat_new"`、`excludeUserIds` に A と C を含めて呼ばれる。B の `chat_new` は 1 件のまま `count=2`(10 の集約) |
| CHT-T-34 | 通知の内容の確認 | [見送り(統一仕様 16.2)] `params` が `groupTitle` と `count` だけで、通知の本文・タイトルにメッセージ本文・投稿者名を含まない |
| CHT-T-35 | g-011 のメンバーが GET(u-006 の退会前の投稿を含む) | 履歴は残り、u-006 の投稿は `senderName="元メンバー"` |
| CHT-T-36 | 保持上限(500)超過 [デモ範囲外] | [見送り(統一仕様 16.2)] 501 件目の追加で最古 1 件が消え、件数は 500 |
| CHT-T-44 | 既読: メンバー B が `markChatRead(latestId)` → 他メンバーが 2 件投稿 → B が GET。続けて B が古い id で `markChatRead` | GET の `unreadCount=2`(B 自身の投稿は数えない)。古い id では既読位置が戻らない。`getUnreadCount` も同じ値 |
| CHT-T-45 | 別グループのメッセージ ID を `[messageId]`・`lastReadId` に指定して通報・既読(IDOR) | 404 not_found。09 に記録されず、既読位置も変わらない |
| CHT-T-46 | POST を `Content-Type: text/plain` で送る / `Origin` が別ホスト | 415 unsupported_media_type / 403 forbidden(00 の `route()` の適用確認)。保存されない |
| CHT-T-47 | `CHAT_FREE_INPUT=false` で `kind:"normal"` を POST | 400 invalid_input(`fields.body`)。`kind:"template"` は 201 |
| CHT-T-48 | 非公開グループ g-008 の非メンバー(u-001)が GET / POST、存在しないグループ ID で GET | すべて 404 not_found(403 にしない) |
| CHT-T-49 | URL(`https://example.com`)を含む body を `ackReview` なしで POST → 同じ本文を `ackReview:true` で POST | 1 回目は 400 invalid_input、`fields.body`、`detail.reviewRequired=true`、保存されない。2 回目は 201 |
| CHT-T-50 | パスの ID の形式不正: `GET /api/groups/..%2Fx/messages`、`POST /api/groups/g-001/messages/..%2Fx/report`、`[messageId]=m-000001`(旧形式。`m` は GroupMember の接頭辞) | すべて 404 not_found(400 にしない。統一仕様 3.2)。代表として `GET /api/groups/..%2Fx/messages` を残し、他の値は[見送り(統一仕様 16.2)] |
| CHT-T-51 | システムメッセージの生成で例外を起こす(試験用にグループを削除した状態で `status_changed` を発行) | 発行元の処理は成功し、状態変更は巻き戻らない。`console.error` にグループ ID とエラーコードだけが出る |
| CHT-T-52 | 幹事がグループを作成(01 が `group_created` を発行) | 新しいグループに system `group_created` が 1 件だけ作られる。幹事の `member_joined` は作られない(統一仕様 4.6・5.1) |
| CHT-T-53 | g-001 の u-002 が 04 の `POST G/withdraw` で辞退(04 が `member_left` を発行) | system `member_left` が 1 件作られ、`text` は「{名前}さんが辞退しました。」。u-002 はその後 GET・POST とも 403 |

### 10.2 画面

| ID | 操作 | 期待結果 |
|---|---|---|
| CHT-T-30 | 本文 `<script>…</script>` を投稿 | 文字としてそのまま表示される。DOM に `script` 要素は増えない。リンク化もされない(`https://example.invalid` を「このまま送信」で投稿しても `<a>` は無い) |
| CHT-T-31 | 禁止表現を送信 | 入力欄の本文が残り、理由と修正案が表示される。リストに追加されない |
| CHT-T-32 | 別ユーザー(Cookie 切替)で投稿 → 元の画面で 5 秒待つ | 新着が表示される。最下部にいなければ新着 Pill が出て、最下部にいれば自動で追従 |
| CHT-T-37 | 中止グループのチャットを開く | 履歴は読め、入力欄・定型文が無効で理由が表示される |
| CHT-T-38 | 0 件のグループを開く | 空状態の文言と定型文ボタン |
| CHT-T-39 | API 停止(エラー応答)でポーリング | 既存メッセージを保持し、エラー表示と 5 秒の固定間隔の再試行。復旧後に自動で戻る(段階的な間隔延長は確認しない。見送り) |
| CHT-T-40 | スクリーンリーダー/DOM 検査 | リストに `role="log"` と `aria-live="polite"`。入力欄にラベルがあり、エラーが `aria-describedby` で結び付く |
| CHT-T-41 | 「モック(ローカル)」バッジ | 常時表示される |
| CHT-T-42 | 通報導線 | 他人の投稿で通報メニュー→送信→「通報済み」表示。自分の投稿にはメニュー項目が無い |
| CHT-T-43 | タブが非表示になる間 | ポーリング要求が止まり、復帰時に 1 回取得される |

- 静的試験: 06 の文言・コードに、README 1 章で使わないと定めた語が含まれない(grep。語の一覧は 09 の静的検査 `scan-banned.mjs` の定数を使う)。外部ドメインへの fetch・WebSocket・EventSource が無い(grep)。

## 11. 依存するモジュールと契約

### 11.1 06 が呼ぶ関数

06 が実行時に import するのは 00、04、09、10 だけ(統一仕様 4.6)。01 は型(`Group`)だけを `import type` で参照する。

| 呼び先 | 関数 | 用途 |
|---|---|---|
| 00 | `db()`/`Repo<T>`/`tx()`、`newId("msg")`・`isId`・`idSeq`(`lib/ids.ts`)、`clock.nowIso()`、`AppError`、`route()`・`c.id`・`c.body`・`c.query`、`v`(`v.id` など)、`sanitizeText`、`LIMITS.CHAT`、`isMember`・`activeMembers`・`requireGroup`(`lib/authz.ts`)、`on`(`lib/events.ts`)、`CursorPage<T>`、`gapi`・`gpost`・`ApiError`(`lib/groups-api.ts`) | 基盤、ID、時刻、検証、メンバー判定、イベント購読、クライアント |
| 04 | `canChat(g): boolean`、`canReadHistory(g): boolean` | 投稿可否、閲覧可否 |
| 09 | `assertGroupAccess(userId, groupId, "member")`、`assertInGroup(item, groupId)`、`assertTextAllowed(text, "chat_message", "body", { ackReview })`、`checkText(text, "chat_message")`、`checkRate("chat_post", userId, groupId)`、`filterVisibleMessages(viewerId, msgs)`、`visibleProfile(viewer, userId, { kind: "member", groupId })`、`isBlockedByMe(viewerId, otherId)`(`chat_new` を送る場合のみ。見送り)、`createReport(user, { targetType: "message", targetId, reason, body?, groupId })`、型 `ReportReason` | アクセス判定、所属確認、禁止表現、投稿頻度、ブロック非表示、表示名、通知の宛先除外、通報 |
| 10 | `notify(input: NotifyInput)`(`kind: "chat_new"`) | 新着通知(8.2。余力・見送り) |

### 11.2 06 を呼ぶ側・06 が購読するイベント

| 呼び元 | 呼ぶもの | タイミング |
|---|---|---|
| 00 `features/bootstrap.ts` | `registerChatSubscribers()` | 起動時(フックの登録と同じ) |
| 01(発行) | `group_created`(`createGroup`・`createGroupInternal`)、`member_joined`(`addMember`。承認時のみ)。06 は `on(type, "chat", handler)` で購読 | 6.7 |
| 04(発行) | `member_left`(`withdraw`)、`status_changed`(状態が変わるすべての遷移)。06 は同じく `on` で購読 | 6.7 |
| 01(詳細ページ) | `<ChatPanel groupId>`。未読バッジはサーバー側で `getUnreadCount(user, groupId)`、画面からは CHT-API-01(`limit=1`)の `unreadCount` で取得 | タブ描画 |

- 循環回避: 発行側(01・04)は 06 を import しない(統一仕様 4.6)。06 → 04 は `canChat`・`canReadHistory` のみ。06 は 01 を実行時に import せず、メンバー判定は 00、グループの取得は 09 `assertGroupAccess`(イベント購読時は 00 `requireGroup`)で行う。
- `features/groups/chat/index.ts` が公開するのは `chatAccess`、`getUnreadCount`、`registerChatSubscribers`、`ChatPanel` と型だけ。`postSystemMessage` は公開しない。

## 12. ファイル構成と利用ライブラリ

### 12.1 ファイル一覧と責務

| パス | 責務 |
|---|---|
| `app/src/features/groups/chat/types.ts` | 4.1 の型 |
| `app/src/features/groups/chat/constants.ts` | 4.3 の制約値、`CHAT_FREE_INPUT` |
| `app/src/features/groups/chat/templates.ts` | 定型文 6 件の定数 `CHAT_TEMPLATES`(`tpl-01` 集合時間を相談したい / `tpl-02` 集合場所を確認したい / `tpl-03` 持ち物を確認したい / `tpl-04` 遅れそうです / `tpl-05` 了解です / `tpl-06` ありがとうございます)。画面とサービスが共用 |
| `app/src/features/groups/chat/messages.ts` | 画面・エラー・システムメッセージの文言(README 4.4 の集約方針) |
| `app/src/features/groups/chat/sanitize.ts` | CHT-FN-10、11 |
| `app/src/features/groups/chat/system-messages.ts` | CHT-FN-05、13 |
| `app/src/features/groups/chat/register.ts` | CHT-FN-09(ドメインイベントの購読) |
| `app/src/features/groups/chat/service.ts` | CHT-FN-01〜04、06〜08、14 |
| `app/src/features/groups/chat/handlers.ts` | CHT-API-01〜04 のハンドラ(00 の `route()` で包む。検証と応答整形だけの薄い層) |
| `app/src/app/api/groups/[groupId]/messages/route.ts`、`…/messages/[messageId]/report/route.ts`、`…/chat/read/route.ts` | `handlers.ts` の再エクスポートだけ(5.2) |
| `app/src/features/groups/chat/index.ts` | 公開 API の再エクスポート(11.2) |
| `app/src/features/groups/chat/ui/*.tsx`、`ui/useChat.ts` | 9 章のコンポーネントとフック |
| `app/src/data/group-seed.json`(00 管理) | デモ用メッセージの初期データ。06 は seed 断片を 00 に渡し、00 が統合する |
| テスト | `app/src/features/groups/chat/__tests__/*.test.ts`(Vitest。00 の `fixtures.ts`・`resetForTest`・`callRoute` を使う) |

- `features/bootstrap.ts`(00 管理)に `registerChatSubscribers()` の 1 行を追記する。
- 既存ファイル(`api.ts`、`server-store.ts`、`/api/v2`)は変更しない。

### 12.2 利用ライブラリ・モジュール

06 は新規の npm 依存を追加しない。バージョン欄の「維持」は `app/package.json` に記載の指定を変えないことを表す。

| 種別 | 名前 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| フレームワーク | Next.js(App Router、Route Handler) | チャット API(`app/api/groups/[groupId]/...`)、グループ詳細のタブ内の描画 | MIT | `16.4.5` を維持 |
| ライブラリ | React / React DOM | 画面コンポーネント、`useChat` の状態管理(`useState`・`useEffect`・`useRef`) | MIT | `19.3.0` を維持 |
| UI | @mantine/core | ScrollArea、Textarea、Button、Badge、Alert、Menu、Modal、Skeleton、VisuallyHidden | MIT | `^9.7.5` を維持 |
| UI | @mantine/hooks | `useDocumentVisibility`(ポーリング停止)、`useDebouncedCallback`(既読送信)。v9 で名称が異なる場合は同等の処理を `useChat` 内に書く(関数名は実装着手時に確認する事項。判断は不要。統一仕様 14.2) | MIT | `^9.7.5` を維持 |
| アイコン | @tabler/icons-react | 送信、メニュー(…)、新着の矢印 | MIT | `^3.51.0` を維持 |
| 日時表示 | dayjs | 送信時刻の表示(日本時間、`M/D HH:mm`)。サーバー側の現在時刻は 00 の `clock` を使い、dayjs は使わない | MIT | `^1.11.23` を維持 |
| テスト(開発時のみ) | Vitest | サービス関数・API の試験 | MIT | 00 が devDependency に追加する(CMN-TASK-12)[決定 11]。最新の安定版を使う |
| Web 標準 | fetch、URL / URLSearchParams、`document.visibilityState`、`setTimeout` | 取得・ポーリング・クエリ組み立て | - | ブラウザ標準 |
| Node 標準 | なし | 06 は `crypto`・`fs` を使わない(ID は 00 の `newId`、永続化は 00 の責務) | - | - |
| 自前(00) | `lib/groups-store.ts`、`lib/ids.ts`、`lib/clock.ts`、`lib/errors.ts`、`lib/api-route.ts`、`lib/validation.ts`、`lib/limits.ts`、`lib/authz.ts`、`lib/events.ts`、`lib/groups-api.ts` | ストア・ID(`newId`・`isId`・`idSeq`)・時計・エラー・API 共通処理・検証・上限値・メンバー判定・イベント・クライアント | - | 00 の実装に従う |
| 自前(04・09・10) | `canChat`・`canReadHistory`(04)、`assertGroupAccess`・`assertInGroup`・`assertTextAllowed`・`checkText`・`checkRate`・`filterVisibleMessages`・`visibleProfile`・`isBlockedByMe`・`createReport`(09)、`notify`(10) | 状態による可否、アクセス判定・禁止表現・投稿頻度・ブロック・表示名・通報、通知 | - | 各モジュールの実装に従う(11 章) |
| 自前(06) | `sanitize.ts`、`system-messages.ts`、`register.ts`、`ui/useChat.ts` | 本文整形、システム文言、イベント購読、ポーリング | - | 処理が小さく、外部ライブラリを入れるとライセンス確認と依存が増えるため自前で実装する |
| 不採用 | zustand | チャットの状態は 1 画面内で完結し、`useChat` の React state で足りるため使わない(依存には既にある) | MIT | - |

採用しないライブラリと理由:

- WebSocket・Socket.IO・SSE: ローカルのモックでポーリングに統一する方針(1 章、docs/design 01 章)のため。
- SWR・TanStack Query: ポーリング・差分取り込みは `useChat` 内の数十行で書け、依存とライセンス確認を増やさないため(統一仕様 11.1)。
- DOMPurify 等の HTML サニタイザ: HTML を描画しない(6.4)ため不要。
- URL の自動リンク化ライブラリ: 自動リンク化をしない方針(6.4)のため不要。
- 禁止語判定ライブラリ・レート制限ライブラリ: 辞書・判定・計数は 09 の責務のため、06 では使わない。

## 13. 実装タスク(CHT-TASK)

規模: S=半日未満、M=半日〜1 日、L=1 日以上。優先度は README 2 章(06 は A)。

前提列の「TASK-nn」は本章の CHT-TASK-nn、「00」「04」などはモジュール番号を表す。完了条件の試験は 10 章の CHT-T。

| ID | タスク | 規模 | 前提 | 優先 | 完了条件 |
|---|---|---|---|---|---|
| CHT-TASK-01 | 型・定数・文言・定型文(types/constants/templates/messages) | S | 00 の型(CMN-TASK-01)、`LIMITS` | S | `npx tsc --noEmit` が通る |
| CHT-TASK-02 | `sanitize.ts`(normalize/validate)+単体試験。連続改行の圧縮は見送り | S | TASK-01、00 の `sanitizeText`・`LIMITS.CHAT` | S | CHT-T-05、06(CHT-T-07〜09 は見送り) |
| CHT-TASK-03 | 投稿頻度: 09 `checkRate("chat_post", userId, groupId)` の組み込み(禁止表現の検査の後に呼ぶ) | S | TASK-04、09 の `checkRate`・`RATE_LIMITS.chat_post`(10 件/60 秒) | S | `postMessage` が禁止表現・長さの検査の後に 09 `checkRate("chat_post", user.id, groupId)` を呼ぶこと(CHT-T-15・16 は見送り。計数の試験は 09 の単体試験 1 件) |
| CHT-TASK-04 | `service.ts` の `chatAccess`、`postMessage`(定型文のみ先行)、DTO 化(`toDto`) | M | TASK-01、TASK-02、00 のストア・`newId`・`isMember`、04 の `canChat`・`canReadHistory`、09 の `assertGroupAccess` | S | CHT-T-02〜04、12、13、17〜19、35、47、48 |
| CHT-TASK-05 | `listMessages`(最新・sinceId・before・limit、`CursorPage`) | M | TASK-04 | S | CHT-T-01、21、22、23(代表のみ) |
| CHT-TASK-06 | `handlers.ts` と `route.ts`(CHT-API-01、02)、00 の `route()`・`c.id`・`v.id` の適用 | M | TASK-04、TASK-05、00 の `route()` | S | CHT-T-01〜23(見送りの試験を除く)を HTTP 経由で実行して通る、CHT-T-46、50(代表のみ) |
| CHT-TASK-07 | 禁止表現の組み込み(09 の `assertTextAllowed`、review の `ackReview`。本文スキーマに `ackReview: v.boolean({ optional: true })` を宣言)と拒否応答 | S | TASK-04、09 の `assertTextAllowed`・`checkText` | S | CHT-T-10、11、24、49(CHT-T-16 は見送り) |
| CHT-TASK-08 | `useChat`(取得・ポーリング・差分・投稿・非表示時の停止。失敗時の段階的な間隔延長は見送り) | M | TASK-06、00 の `lib/groups-api.ts` | S | CHT-T-39、43 |
| CHT-TASK-09 | `ChatPanel`/`MessageList`/`MessageItem`/`MessageComposer`/`TemplateBar`(空・エラー・読み取り専用・review の状態を含む) | L | TASK-08 | S | CHT-T-14、30、31、37、38、41 |
| CHT-TASK-10 | スクロール制御・新着 Pill・過去分読み込み | M | TASK-09 | A | CHT-T-32 |
| CHT-TASK-11 | アクセシビリティ(log/aria-live、ラベル、キーボード)と文字数カウンタ | S | TASK-09 | A | CHT-T-40 |
| CHT-TASK-12 | 通報(`reportMessage`、CHT-API-03、`ReportDialog`、`reportedByMe`) | M | TASK-04、TASK-09、09 の `createReport`・`assertInGroup` | A | CHT-T-25〜27、42、45 |
| CHT-TASK-13 | 既読位置(`markChatRead`、CHT-API-04、`getUnreadCount`)と未読バッジ | M | TASK-05、TASK-09 | A | CHT-T-44、45 |
| CHT-TASK-14 | システムメッセージ(`postSystemMessage`、`renderSystemText`、`registerChatSubscribers` によるイベント購読、`bootstrap.ts` への登録、09 `visibleProfile` による表示名、重複抑止 [デモ範囲外・見送り]) | M | TASK-04、00 の `lib/events.ts`、01・04 のイベント発行、09 の `visibleProfile` | A | CHT-T-28、29、51、52、53 |
| CHT-TASK-15 | 通知連携(`notify` の `chat_new`、宛先の除外)[見送り(統一仕様 16.2)] | S | TASK-04、10 の `notify`、09 の `isBlockedByMe` | B | CHT-T-33、34 |
| CHT-TASK-16 | ブロック非表示の結合(`filterVisibleMessages`) | S | TASK-05、09 の `filterVisibleMessages` | A | CHT-T-20 |
| CHT-TASK-17 | seed のデモメッセージ(10〜20 件。g-011 の u-006 の退会前の投稿 1 件を含む)の断片を 00 に渡す、リセット確認、保持上限 [デモ範囲外・見送り] | S | TASK-04、00 の `group-seed.json` | A | seed の読み込みと `POST /api/demo/reset` 後の件数が一致する。CHT-T-35 の前提がそろう。CHT-T-36 は見送り |
| CHT-TASK-18 | 試験の実施(10 章)、静的検査(外部通信・禁止語)、`npm run lint`/`build` | M | 全タスク | S | 10 章の全試験(見送り・デモ範囲外を除く)、`npm test`・`npm run lint`・`npm run build` が通る |

- 縮退順(時間が足りない場合): 定型文のみ(案 A 相当: TASK-01、04、05、06、08、09)→ 禁止表現・投稿頻度(TASK-07、03)→ 通報(TASK-12)→ システムメッセージ(TASK-14)→ 通知(TASK-15)。 [案]
- 見送り(統一仕様 16.2)の範囲: CHT-TASK-15 の全体、CHT-TASK-08 の段階的な間隔延長、CHT-TASK-14 の重複抑止、CHT-TASK-17 の保持上限、CHT-TASK-02 の連続改行の圧縮。試験は CHT-T-07〜09、15、16、33、34、36 と、CHT-T-23・50 の代表以外の値。
- クリティカルパス: 00 のストア・`route()`・`clock`・`isMember` → 09 の `assertGroupAccess` → 04 の `canChat` → CHT-TASK-04〜09。

## 14. 未決事項

| 番号 | 内容 | 本書の扱い |
|---|---|---|
| #9 | 入力方式(定型文のみ / 自由入力+通報 / 入力時に弾く) | 5.4 の推奨 C+定型文+通報 [案]。未決のまま |
| #8 | ブロック導線 | チャット内に「ブロックする」を置くかは未決(通報のみ設置)[案]。ブロックの方向は 09 の規則(自分がブロックした相手だけを隠す)で確定(統一仕様 6.3) |
| - | 退会者の履歴 | 残して「元メンバー」と表示 [決定 18] |
| - | 完了・中止・再企画済みのチャット | 読み取り専用(`canChat` が false、`canReadHistory` が true)で確定(統一仕様 4.4) |
| - | 通知 `chat_new` | 余力 [決定 1]。見送り(統一仕様 16.2)。作る場合は 10 が集約(8.2) |
| - | 投稿頻度 | 60 秒に 10 件 [決定 4]。計数は固定ウィンドウ(統一仕様 10.4) |
| - | テストランナー | Vitest [決定 11] |

## 15. 実装メモ(デモ範囲)

- 最小構成: 定型文投稿+自由入力(禁止表現チェック)+一覧(5 秒ポーリング、最新 50 件)。通報はボタンから 09 に記録するだけとする。システムメッセージは `member_joined` と `state_*` だけでもよい。通知は未読バッジで代替する。
- Next.js 16 の Route Handler・キャッシュの扱いは `app/node_modules/next/dist/docs/` を実装前に確認する [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)](本 worktree には `app/node_modules` が無い)。既存コードから、`params` が Promise であることと `cache: "no-store"` の使用は読み取れる [事実]。00 の `route()` は最初に `req.headers` を読み、`Cache-Control: no-store` を付ける方針のため、ポーリング応答がキャッシュされないかを `cacheComponents` の挙動とあわせて確認する [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)]。
- 使わないもの: WebSocket、SSE(EventSource)、外部の通信・Push、新規 npm 依存(12.2)。

## 16. 他モジュールへの要望

統一仕様で確定した事項(ルーティング、`rate_limited`、`CursorPage`、イベント購読、`filterVisibleMessages`、`notify` の形など)は要望から外した。残る要望は次のとおり。

| 宛先 | 要望 |
|---|---|
| 00 | (1) `Db` に `messages: Repo<GroupMessage>`、`chatReads: Repo<ChatReadMark>` を置く(統一仕様 3.1)。(2) `LIMITS.CHAT` に行数の上限(10 行)を持たせる。→ 解消(統一仕様 10.3。`LIMITS.CHAT = { min: 1, max: 500, maxLines: 10 }`)。(3) `group-seed.json` に 06 のデモ用メッセージ 10〜20 件を統合する。(4) `features/bootstrap.ts` に `registerChatSubscribers()` を登録する。(5) 試験用の seed に、同じグループ内のブロック関係と、退会者の過去メッセージを含める(10 章)。→ 解消(統一仕様 11.3。ブロック関係は `BLOCK_SAMPLE` と `insertMember`、退会者は `LEFT_MEMBER_SAMPLE` と 06 の seed 断片で用意する。00 への seed の追加は依頼しない)。 |
| 01 | (1) `createGroup` で幹事を追加するときに `member_joined` を発行するかを明記すること。→ 解消(統一仕様 4.6・5.1。作成時は `group_created` だけを発行し、幹事の `member_joined` は発行しない)。(2) グループ詳細のチャットタブに未読バッジを出す場合は `getUnreadCount` を使うこと。 |
| 04 | `status_changed` を `min_reached`・`confirmed`・`cancelled`・`in_progress`・`completed`・`replanned` への遷移で発行すること(6.7)。→ 解消(統一仕様 4.6。状態が変わるすべての遷移で発行する。`member_left` も 04 の `withdraw` が発行する)。 |
| 09 | `createReport` の `targetType: "message"` で、対象がシステムメッセージ・自分の投稿のときに invalid_input を返すこと(06 でも事前に検査する)。 |
| 10 | `chat_new` の `params.groupTitle` は 01 の `Group.name` から作る前提で受け取ること。 |

## 17. 設計上の確認事項(docs/design・他モジュールとの差異)

統一仕様で解消した差異(旧版の 3〜9、12 の大半)は本文に反映済みのため削除した。残る確認事項は次のとおり。

1. [未決 #9] の確定は docs/design 12 章で行う。本書は暫定で実装可能な構造(`CHAT_FREE_INPUT` フラグ)にした。
2. 統一仕様 4.4 で完了・中止・再企画済みは `canChat=false`、`canReadHistory=true` と確定した。docs/design 04 章(「チャット等を使えるまま維持」は実行確定の説明)に完了後・中止後のチャットの扱いの記載があるかは [要確認]。
3. `app/node_modules` が無いため Next.js 16 の Route Handler/キャッシュ・テスト実行の確認ができていない [要確認: 実装着手時に確認する事項(判断は不要。統一仕様 14.2)](15 章)。
4. チャットを開いたときに `chat_new` 通知を既読にする手段は、統一仕様に定めがない(06 の `markReadWhere` 要望は取り下げ)。本書は「通知の既読化は 10 の画面で行う」とした(8.2)。→ 解消(統一仕様 7.7・9.2。10 の通知画面で項目を開いたときに既読化する)。
5. 09 の `filterVisibleMessages<T extends {senderId: string}>` は `senderId` が null のシステムメッセージを受け取れないため、06 は system を除いて渡す(6.6)。→ 解消(統一仕様 6.3。09 の型は `senderId: Id | null` を受けてシステムメッセージを残す。06 は全件を渡し、回避策は削除した。6.6)。
