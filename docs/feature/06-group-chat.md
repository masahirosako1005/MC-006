# 06 グループチャット

状態の凡例は README 1 章に従う([事実]/[推定]/[決定]/[案]/[未決]/[要確認])。docs/design と矛盾する場合は docs/design を正とする。ID 接頭辞は `CHT`(CHT-TYPE 型 / CHT-FN 関数 / CHT-API API / CHT-UI 画面 / CHT-ERR エラー / CHT-TASK 実装タスク / CHT-T 試験)。

## 1. 概要と責務 / 対応する柱

- 参加が成立したメンバー間のメッセージ交換。外部サービス・WebSocket・外部 API は使わず、サーバー側インメモリ(Store.messages)+ポーリングのローカルのモックで表す。柱15。 [決定(モック)/案(詳細)]
- 責務: (1) 投稿・取得・ページング (2) 投稿前処理(整形、禁止表現、投稿頻度) (3) 権限(メンバーのみ、状態による投稿可否、ブロック非表示) (4) 通報の受け口(記録は 09) (5) システムメッセージ(参加・退会・状態変更)の生成 (6) 新着通知の連携 (7) チャット画面。
- 非責務: 禁止語辞書、通報・ブロックの記録(09)、通知の保存(10)、状態遷移(04)、メンバー管理(01)。
- ユーザーストーリー: 参加が成立したメンバーとして、集合時間や持ち物を相談したい。不快な書き込みは通報したい。ブロックした相手の書き込みは見たくない。 [案]

## 2. 既存機能との関係

- 新規。既存 `/api/v2`・`server-store.ts` は変更しない。通知(10)でメッセージ到着を知らせる(拡張。8.2 参照)。
- [事実] 既存 `src/lib/api.ts` の `api()` は `/api/v2` 固定のため、`/api/groups` を呼ぶには別のクライアント関数が要る(16 章の要望)。

## 3. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| チャット(タブ) | グループ詳細(旅程、チャット、費用メモ、スタンプへのタブ)/ グループチャット(ローカルのモック) | `/[campaign]/groups/[groupId]?tab=chat` |

- タブの親ページは 01 が持ち、`tab=chat` のとき 06 の `<ChatPanel groupId={groupId} />` を描画する。06 は独立したルートを作らない。 [案]
- 画面には常に「モック(ローカル)」バッジと、「この画面の内容は外部に送信されません」の文言を出す。リアルタイム通信は使わずポーリング(5.3、CHT-API-01)。

## 4. データ(05 章)

### 4.1 型定義(CHT-TYPE)

配置: `app/src/features/groups/chat/types.ts`。`DemoUser`・`Group` は 00 の型、`ReportReasonId` は 09 が公開する通報理由の列挙を import する。

```ts
// CHT-TYPE-01 種別
export type MessageKind = "normal" | "template" | "system";

// CHT-TYPE-02 通報状態(保存用。クライアントには出さない)
export type ReportState = "none" | "reported";

// CHT-TYPE-03 システムメッセージの事象
export type SystemEventType =
  | "group_created"      // グループ作成(幹事のみ)
  | "member_joined"      // 03 approve 後
  | "member_left"        // 01 leaveGroup 後
  | "state_min_reached"  // 04: 最少人数到達
  | "state_confirmed"    // 04: 実行確定
  | "state_cancelled"    // 04: 中止
  | "state_started"      // 04: 実施中
  | "state_completed"    // 04: 完了
  | "state_replanned";   // 04: 再企画済み

// CHT-TYPE-04 エンティティ(Store.messages の要素)
export interface GroupMessage {
  id: string;              // "m-000001" 形式。ストア全体の単調増加カウンタ(連番を 6 桁ゼロ埋め)
  seq: number;             // id の数値部。sinceId 比較・並び順に使う
  groupId: string;         // ^[a-z0-9-]{1,40}$
  senderId: string | null; // system のとき null
  kind: MessageKind;
  body: string;            // normal: 整形済み本文 / template: 定型文のスナップショット / system: ""(表示時に生成)
  templateId: string | null;   // kind==="template" のとき tpl-01 等
  systemEvent: SystemEventType | null; // kind==="system" のとき必須
  systemSubjectUserId: string | null;  // member_joined / member_left の対象ユーザー
  createdAt: string;       // ISO 8601(タイムゾーン付き)。clock.now() 由来
  reportState: ReportState;
  reportedBy: string[];    // 通報したユーザー ID(サーバー内部のみ。応答に含めない)
}

// CHT-TYPE-05 閲覧者ごとの既読位置(Store.chatReads。キーは `${groupId}:${userId}`)
// 行が無い場合は lastReadSeq=0(全件未読)として扱う。lastReadSeq は増える方向にのみ更新する
export interface ChatReadMark { groupId: string; userId: string; lastReadSeq: number; updatedAt: string }

// CHT-TYPE-06 API 応答用 DTO(送信者名は表示時に解決。内部項目は含めない)
export interface MessageDto {
  id: string;
  kind: MessageKind;
  senderId: string | null;
  senderName: string;        // system: "お知らせ" / 退会済み: "元メンバー" [案、#7]
  isMine: boolean;
  text: string;              // normal/template: body / system: 文言を生成した結果
  templateId: string | null;
  createdAt: string;
  reportedByMe: boolean;     // 他人の通報有無は返さない(報復防止 [案、#8])
}

// CHT-TYPE-07 取得応答
export interface ListMessagesResponse {
  messages: MessageDto[];          // 昇順(古い→新しい)
  latestId: string | null;         // 次回の sinceId に使う値(5.3)。最新取得: グループ内の最大 id(非表示分を含む。0 件なら null)
                                   // sinceId 取得: 走査した最後の id(新着なしなら sinceId と同じ値)/ before 取得: null(クライアントは更新しない)
  hasMoreOlder: boolean;           // 最新取得・before 取得で、返した範囲より古い表示対象があるか。sinceId 取得では常に false
  unreadCount: number;             // 自分の既読位置より後の、表示対象かつ他人/システムのメッセージ数
  access: ChatAccess;
  serverTime: string;              // ISO 8601
}

// CHT-TYPE-08 アクセス可否(GET 応答と画面の入力欄の制御に使う)
export interface ChatAccess {
  canRead: boolean;
  canPost: boolean;
  reason?: "not_member" | "state_readonly"; // canPost=false の理由。画面で説明する
}

// CHT-TYPE-09 投稿入力
export type PostMessageInput =
  | { kind: "normal"; body: string }
  | { kind: "template"; templateId: TemplateId };

// CHT-TYPE-10 定型文
export type TemplateId = "tpl-01" | "tpl-02" | "tpl-03" | "tpl-04" | "tpl-05" | "tpl-06";
export interface ChatTemplate { id: TemplateId; label: string; text: string }
```

### 4.2 Store 上の追加項目

| 項目 | 内容 | 備考 |
|---|---|---|
| `Store.messages: GroupMessage[]` | 追記のみ。順序は seq 昇順 | 00 の Store に既出 |
| `Store.chatSeq: number` | id 採番用カウンタ | 00 への要望(16 章) |
| `Store.chatReads: Record<string, ChatReadMark>` | 既読位置 | 同上 |

- 1 グループあたり保持件数の上限は 500 件。超過分は古い順に削除する(メモリ使用量の上限)。 [案、デモ範囲外: デモ中に 500 件へ達する操作は想定しないため、実装は任意]
- リセット(`_reset`)で seed の初期状態に戻る。`group-seed.json` にデモ用のメッセージを 10〜20 件(通常・定型文・システム混在。うち 1 件は表示確認用の長文で、禁止表現を含まない)用意する。実在個人の発言や連絡先は入れない。 [案]
- 退会者のメッセージ履歴は削除せず残し、表示名は「元メンバー」とする [案、未決 #7]。除名・退会後は閲覧・投稿とも不可。

### 4.3 制約値(`constants.ts`)

| 名前 | 値 | 根拠・備考 |
|---|---|---|
| `BODY_MIN` / `BODY_MAX` | 1 / 500 文字 | トリム後。コードポイント数(`[...s].length`)で数える [案] |
| `BODY_MAX_LINES` | 10 行 | 改行数による縦長の投稿を抑止 [案] |
| `RATE_LIMIT_COUNT` / `RATE_LIMIT_WINDOW_SEC` | 5 件 / 60 秒 | ユーザー×グループ。`clock.now()` 基準、直近 60 秒の自分の投稿数(normal/template。system は除く)。「1 分あたり 5 件」 [案] |
| `PAGE_DEFAULT` / `PAGE_MAX` | 50 / 100 | 取得件数 |
| `POLL_INTERVAL_MS` | 5000 | 5.3 |
| `POLL_BACKOFF_MS` | [5000, 10000, 30000] | 5.3。連続失敗回数で段階を進め、30000 で止める |
| `READ_DEBOUNCE_MS` | 1000 | 9.2。既読位置の送信間隔 |
| `AT_BOTTOM_PX` | 80 | 9.2。「最下部にいる」と見なす距離 |
| `REPORT_NOTE_MAX` | 200 | 通報の任意メモ(7.1) |
| `SYSTEM_DEDUPE_SEC` | 5 | 6.7。システムメッセージの重複抑止 [デモ範囲外] |
| `GROUP_RETENTION` | 500 | 4.2 [デモ範囲外] |
| `CHAT_FREE_INPUT` | true | false で自由入力を無効にし、定型文のみにする(5.4) |

## 5. インターフェース

### 5.1 サービス関数(CHT-FN)

配置: `app/src/features/groups/chat/service.ts`。UI・HTTP に依存しない。全関数は同期(00 の規約)。例外は 00 の `AppError`。グループの取得とアクセス判定の順序は 6.2・6.3 に従う(グループ不在は `not_found`、非メンバーは `forbidden`。ただし非公開グループの非メンバーには `not_found` を返し、存在を隠す)。

```ts
// CHT-FN-01 一覧取得。取得方式は sinceId(新着)/ before(過去ページ)/ どちらもなし(最新 limit 件)の 3 通り(5.3)
export function listMessages(
  user: DemoUser,
  groupId: string,
  opts?: { sinceId?: string; before?: string; limit?: number },
): ListMessagesResponse;
// 例外: not_found(グループ不在、非公開グループの非メンバー)/ forbidden(公開グループの非メンバー)
//       / invalid_input(sinceId・before・limit の形式不正、sinceId と before の同時指定)

// CHT-FN-02 投稿
export function postMessage(user: DemoUser, groupId: string, input: PostMessageInput): MessageDto;
// 例外: not_found / forbidden / unavailable_state / invalid_input(fields.body または fields.templateId)/ rate_limited

// CHT-FN-03 通報(09 に委譲)
export function reportMessage(
  user: DemoUser, groupId: string, messageId: string, reason: ReportReasonId, note?: string,
): { reported: true };
// 例外: not_found(グループ不在、またはメッセージが不在・別グループのもの)/ forbidden(非メンバー)
//       / invalid_input(自分の投稿・システムメッセージは通報不可、reason・note 不正)
// 冪等: 通報済みなら成功を返し、09 に二重記録しない

// CHT-FN-04 既読位置の更新。lastReadId の seq が現在の既読位置以下なら更新しない(既読位置を戻さない)
export function markChatRead(user: DemoUser, groupId: string, lastReadId: string): { unreadCount: number };
// 例外: not_found(グループ不在、lastReadId が不在・別グループのもの)/ forbidden(非メンバー)/ invalid_input(形式不正)

// CHT-FN-05 システムメッセージ(01・03・04 から呼ばれる。権限チェックなし=内部呼び出し専用。API から呼ばない)
// 重複抑止(6.7)で生成しなかった場合は null を返す
export function postSystemMessage(
  groupId: string, event: SystemEventType, subjectUserId?: string,
): GroupMessage | null;
// 例外: not_found(グループ不在)

// CHT-FN-06 アクセス判定(画面の入力欄制御と各関数が共用。例外を投げない)
export function chatAccess(user: DemoUser, group: Group): ChatAccess;

// CHT-FN-07 定型文の取得
export function listTemplates(): ChatTemplate[];

// CHT-FN-08 未読数(01 のグループ詳細でチャットタブのバッジに使う)。非メンバーは 0 を返し、例外を投げない
export function getUnreadCount(user: DemoUser, groupId: string): number;
```

純粋関数(`sanitize.ts`、`rate-limit.ts`、`system-messages.ts`):

```ts
// CHT-FN-10 本文の整形。CRLF→LF、制御文字(改行以外)除去、先頭末尾トリム、連続 3 つ以上の改行を 2 つに圧縮
// 実装は 00 の sanitizeText(raw, { multiline: true })(改行の統一・制御文字除去・トリム)を呼び、その後に改行の圧縮を行う [案]
export function normalizeBody(raw: unknown): string;   // string 以外は AppError invalid_input(fields.body)を投げる
// CHT-FN-11 本文の検証(長さ・行数)。禁止表現は含めない
export function validateBody(body: string): { ok: true } | { ok: false; message: string };
// CHT-FN-12 投稿頻度の判定
export function checkRateLimit(messages: GroupMessage[], userId: string, groupId: string, now: Date):
  { ok: true } | { ok: false; retryAfterSec: number };
// CHT-FN-13 システムメッセージの文言生成(表示時に呼ぶ)
export function renderSystemText(m: GroupMessage, resolveName: (userId: string) => string): string;
// CHT-FN-14 DTO 化(送信者名の解決、reportedByMe の算出)
export function toDto(m: GroupMessage, viewerId: string, resolveName: (id: string) => string, isMemberNow: (id: string) => boolean): MessageDto;
```

### 5.2 API(CHT-API)

Route Handler 本体は薄く、`features/groups/chat/handlers.ts` の関数を呼ぶ(README 4.3 の方針)。共通:

- 各ハンドラは 00 の API 共通ラッパー `route()` を通す。ラッパーが変更系(POST)の `Origin`・`Content-Type: application/json` の検査、`Cache-Control: no-store`・`X-Content-Type-Options: nosniff` の付与、例外から応答への変換を行う(7.2)。
- 現在ユーザーは `currentUser(req)`(Cookie `demoUser`)から解決し、クライアントの申告を使わない。
- エラー応答は 00 の `ErrorBody`(`{ error, message, fields?, detail? }`)。エラーコードと画面の扱いは 8.1。

| ID | メソッド・パス | リクエスト | 成功応答 | 主なエラー |
|---|---|---|---|---|
| CHT-API-01 | `GET /api/groups/:groupId/messages` | クエリ `sinceId?` `before?` `limit?`(整数 1〜100、既定 50) | 200 `ListMessagesResponse` | 400 invalid_input / 403 forbidden / 404 not_found |
| CHT-API-02 | `POST /api/groups/:groupId/messages` | `{ kind:"normal", body }` または `{ kind:"template", templateId }` | 201 `MessageDto` | 400 invalid_input / 403 forbidden / 404 not_found / 409 unavailable_state / 429 rate_limited |
| CHT-API-03 | `POST /api/groups/:groupId/messages/:messageId/report` | `{ reason: ReportReasonId, note? }`(note は 0〜200 文字) | 200 `{ reported: true }` | 400 invalid_input / 403 forbidden / 404 not_found / 429 rate_limited(09 の通報回数制限) |
| CHT-API-04 | `POST /api/groups/:groupId/chat/read` | `{ lastReadId }` | 200 `{ unreadCount: number }` | 400 invalid_input / 403 forbidden / 404 not_found |
| CHT-API-05 | `GET /api/groups/chat/templates` | なし | 200 `{ templates: ChatTemplate[] }` | なし |

- `:groupId` と `:messageId` は `^[a-z0-9-]{1,40}$`、`sinceId`/`before`/`lastReadId` は `^m-\d{6,}$` で検証し、それ以外は invalid_input(パストラバーサル・注入対策)。
- 本文の未知のキー(`senderId`、`createdAt`、`kind:"system"` 用の項目など)は捨てる(00 の `v.object` の規則)。`kind` が `"normal"`・`"template"` 以外なら invalid_input。
- CHT-API-05 は固定値を返すだけで認証不要。画面は `templates.ts` を静的 import して定型文を表示するため、この API は画面から呼ばない。優先度は B(余力で実装)とする。 [案]
- CHT-API-05 のパスの `chat` は、グループ ID の形式(00 の ID 形式 `g-<連番>`)に一致しないため、`:groupId` との取り違えは起きない。キャッチオールで分岐する場合は、`groups/chat/templates` の判定を `:groupId` の判定より先に行う。
- パスの振り分け(キャッチオール `api/groups/[...path]` で誰が分岐するか)は 00/01 が持つ。16 章の要望を参照。

### 5.3 取得方式(ポーリング、差分、ページング)

- **初回**: `GET …/messages`(`sinceId` なし)で最新 50 件を昇順で取得。`latestId` と `hasMoreOlder` を保持。
- **ポーリング**: 5 秒ごとに `?sinceId=<保持中の latestId>`。新着のみ返る(通常は空配列)。`latestId` は応答の値で更新する。初回取得で `latestId=null`(0 件)の場合は、ポーリングも `sinceId` なしで行う。
- **sinceId 取得の件数**: `sinceId` より後のメッセージを古い順に走査し、表示対象を最大 `limit` 件返す。走査しきれなかった分は次のポーリングで返る(`latestId` が走査した最後の id のため)。 [デモ範囲外: 5 秒間に 50 件を超える投稿はデモで起きない]
- **過去分**: 「以前のメッセージを読み込む」ボタンで `?before=<画面上の最古の id>&limit=50`。`hasMoreOlder=false` でボタンを消す。無限スクロールは採らない(実装量を抑えるため)。 [案]
- ポーリング制御: タブが非表示(`document.visibilityState==="hidden"`)の間は停止し、復帰時に即時 1 回取得。失敗時は 5→10→30 秒と延ばし(`POLL_BACKOFF_MS`)、成功で 5 秒に戻す。手動「更新」ボタンも置く。
- 差分の整合: `sinceId` は seq の大小比較。ブロック非表示のメッセージも `latestId` の計算には含める(同じ id を再走査しないため)。メッセージは削除されない設計のため、差分の取りこぼしは起きない(保持上限による古い順の削除のみ。`before` で取得済みの範囲外が消えても影響なし)。
- 重複排除: クライアントは id をキーに Map で保持し、投稿直後のローカル追加とポーリングの重複を吸収する。

### 5.4 入力方式の選択肢と推奨([未決 #9])

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A 定型文のみ | 固定の定型文から選ぶ。自由入力なし | 禁止表現の制御・通報が不要で、不適切な書き込みが発生しない。実装量が最も少ない | 実用性が低く、チャットを見せる意義が薄い |
| B 自由入力+通報のみ | 制限なしの自由入力、事後に通報 | 実装が軽い | 不適切な書き込みが先に出る。デモで禁止表現が画面に出る可能性がある(docs/design 10 章の試験観点に反する) |
| C 自由入力+入力時に弾く | 09 の禁止表現チェックで拒否 | 事前に抑止。柱8 を適用して見せられる | 辞書の作成と誤検知への対応が要る |

**[案] 推奨: C を基本とし、A の定型文ボタンと B の通報導線を併設する(C に A・B を組み合わせる)。**

- 理由: docs/design 07 章「柱8 はチャット・メモ・費用メモの項目名にも適用」と整合し、禁止表現が画面・データに出ないことの試験(docs/design 10 章)を満たせる。定型文は「集合時間を相談したい」等を 1 回の操作で投稿でき、デモで示しやすい。通報は 09 の記録関数を呼ぶだけで実装できる。
- デモ範囲の実装順: 定型文ボタン(優先度 S、CHT-TASK-04・09)→ 自由入力+禁止表現(S、CHT-TASK-07)→ 通報ボタン(A、CHT-TASK-12)。時間が足りなければ案 A(定型文のみ)に縮退する。縮退時は `CHAT_FREE_INPUT=false`(constants)にし、API は `kind:"template"` のみを受け付ける。 [案]

## 6. 投稿処理・状態・シーケンス

### 6.1 状態遷移

メッセージ自体の状態遷移はない(追記のみ。通報状態 `none → reported` の一方向のみ。対応中・完了は 09 のデモ範囲外)。投稿可否はグループ状態で決まる(6.2)。

### 6.2 アクセス判定(CHT-FN-06、権限チェック)

| 条件 | canRead | canPost | 備考 |
|---|---|---|---|
| 非メンバー(申請中・却下・退会・除名を含む) | false | false | `reason:"not_member"`。API は forbidden。非公開グループ(`group.visibility==="private"`)の非メンバーには not_found を返し、存在を隠す(00 の方針) |
| メンバー、`canChat(group)===true` | true | true | 募集中、最少人数到達、辞退期間、実行確定、実施中 [案] |
| メンバー、`canChat(group)===false` | true | false | `reason:"state_readonly"`。中止・完了後は「読み取り専用」で履歴を残す [案] |

- 状態名と「中止後・完了後の扱い」は docs/design/04・12 章が未確定([未決] 中止時のチャットの扱い)。判定は 04 の `canChat(g)` に委ね、06 は状態名を直接比較しない。 [案]
- `canRead` は `isMember(user, group) && canReadHistory(group)`(04。現行の 04 案では全状態で true)とする。
- 「承諾前は使えない」: メンバー判定は `isMember(user, group)`(00 `lib/authz.ts` が実装し、01 が再エクスポートする関数)。申請中(03)はメンバーではない。

### 6.3 投稿シーケンス(CHT-FN-02)

1. `currentUser` で投稿者を確定(ハンドラ)。00 の `requireGroup(groupId)` でグループを取得する(不在は not_found)。
2. `chatAccess` を評価。`canRead=false` → forbidden(非公開グループなら not_found)、`canPost=false` → unavailable_state(`reason` に応じた文言、`detail.reason` に `"state_readonly"`)。
3. kind で分岐。
   - template: `templateId` が定型文表に存在するか検証。本文は定型文の text をスナップショットとして保存。禁止表現チェックは省略(固定文)。
   - normal: `CHAT_FREE_INPUT` が false なら invalid_input(`fields.body`)。`normalizeBody` → `validateBody`(1〜500 文字、10 行以内)→ **`checkText(body, "chat")`(09)**。
4. `checkRateLimit`(直近 60 秒に 5 件以上なら rate_limited。`message` に待ち秒数を含め、`detail.retryAfterSec` に数値で返す)。
5. 00 の `tx` 内で、`newId` ではなく `Store.chatSeq++` で seq と id を採番し、`createdAt` を `clock` の現在時刻(ISO 8601)にして追加する。保持上限を超えたら古い順に削除する [デモ範囲外]。
6. 通知(8.2)を呼び、`MessageDto` を 201 で返す。通知の呼び出しが例外になった場合は `console.error` に記録し(本文は出さない)、投稿は成功として返す。

順序の理由: 安価な検証→高価な検証→状態変更の順。禁止表現で拒否された投稿は保存されないため、投稿頻度の件数に数えない。

### 6.4 サニタイズ(XSS)

- 保存は「プレーンテキスト」。HTML エスケープ文字列を保存すると二重エスケープになるため、保存時は変換しない。
- 表示は React の既定エスケープのみ。`dangerouslySetInnerHTML` は使わない。URL を自動リンク化しない(外部誘導の抑止、`<a>` を生成しない)。改行は CSS `white-space: pre-wrap` で表示する。
- `normalizeBody` は制御文字(U+0000〜U+0008、U+000B、U+000C、U+000E〜U+001F、U+007F、双方向制御 U+202A〜U+202E・U+2066〜U+2069)を除去する。表示崩れと、文字の向きを操作した偽装表示を防ぐため。00 の `sanitizeText` はこれを含む範囲(C1 制御文字、ゼロ幅文字、NFC 正規化を追加)を処理するため、06 の要件を満たす。 [案]
- 通知・ログ・エラー文言に本文を埋め込まない(8.2、7.2)。

### 6.5 禁止表現の拒否(09 との契約)

- 呼び出し: `checkText(body, "chat")`。09 骨子の戻り値は「OK または禁止語の理由」。06 は次の形を期待する(不一致は 17 章)。

```ts
type CheckTextResult =
  | { ok: true }
  | { ok: false; category: "romance" | "contact" | "other"; matched: string; hint: string };
```

- 拒否時: 400 `invalid_input`、`fields: { body: "<メッセージ>" }`。投稿は保存せず、入力欄の本文を保持したまま、欄の下に理由と修正案を表示(例:「外部の連絡先や別のアプリへの誘導は送信できません。言い換えてください。」)。matched の語を応答に含めるかは 09 の方針に従う(09 骨子は「どの語がどの欄で不可か」を表示)。
- 禁止の例(デモ用の辞書側で定義): 恋愛・異性交際を連想させる語、電話番号・メールアドレス・外部 SNS の ID や URL への誘導(「LINE 交換しよう」等)。辞書の中身は 09 の責務で、06 は持たない。
- 定型文は禁止表現チェックを通さないが、定型文の追加・変更時に 09 の `checkText` を通す静的試験(CHT-T-24)を置く。

### 6.6 ブロックの非表示([案]、#8)

- `listMessages` で `isBlocked(viewer, m.senderId)` が true の発言者のメッセージを応答から除外する(サーバー側で適用。クライアントに送らない)。system と自分のメッセージは常に表示。
- 09 の `isBlocked(a,b)` が対称かは未決(09 7 章)。06 は「閲覧者が相手をブロックしている」の 1 方向を前提に `isBlocked(viewer, sender)` を呼ぶ。双方向になっても呼び出しは変えない。
- 非表示にした件数は応答に含めない(非表示のメッセージの有無を応答から推測できないようにするため)。ブロックした相手が同じグループにいる場合も、グループの構成は変更しない(案A)。
- 通報は、ブロックの有無と関係なく行える。

### 6.7 システムメッセージ(CHT-FN-05)

| 事象 | 呼び出し元 | 時点 | 文言(`renderSystemText`) |
|---|---|---|---|
| group_created | 01 `createGroup` | 作成直後 | 「グループが作成されました。」 |
| member_joined | 03 `approve`(01 `addMember` の後) | 承認によるメンバー追加後 | 「{名前}さんが参加しました。」 |
| member_left | 01 `leaveGroup` | 退会後 | 「{名前}さんが退会しました。」 |
| state_min_reached | 04 | 最少人数到達に遷移した後 | 「最少人数に達しました。まだ実行は確定していません。」 |
| state_confirmed | 04 `confirm`/`evaluate` | 実行確定後 | 「実行が確定しました。」 |
| state_cancelled | 04 `cancel`/`evaluate` | 中止後 | 「このグループは中止になりました。」 |
| state_started / state_completed | 04 | 実施中/完了の遷移後 | 「旅行が始まりました。」「旅行が完了しました。」 |
| state_replanned | 04 `replan` | 再企画後 | 「このグループは再企画されました。」 |

- 呼び出しは **状態変更が成功した後**に行い、システムメッセージの失敗(例外)で状態変更を巻き戻さない。06 は例外をそのまま送出し、呼び出し側が try/catch で捕捉して `console.error` に記録するだけにする。 [案]
- 同じ (groupId, event, subjectUserId) のシステムメッセージが直近 5 秒以内(`SYSTEM_DEDUPE_SEC`)にあれば生成せず null を返す(04 の遅延評価が二重に実行された場合の対策)。 [案、デモ範囲外: 04 が遷移を 1 回だけ実行するため通常は発生しない。実装は任意]
- 名前は表示時に解決(退会者・未知のユーザーは「元メンバー」)。名前はユーザー入力のため、React の既定エスケープで表示する。
- システムメッセージにはレート制限・禁止表現チェック・通知を適用しない。通報不可。
- 中止後(`canChat=false`)でも内部呼び出しのため追加可(「中止になりました」は中止後に入るため)。この例外は `postSystemMessage` が権限チェックを持たないことで満たす。

## 7. 入力検証・セキュリティ

### 7.1 入力検証

| 項目 | 規則 |
|---|---|
| `body` | string 必須(kind=normal)。トリム後 1〜500 コードポイント、10 行以内。禁止表現(09)。型が string 以外は invalid_input |
| `templateId` | 列挙値のみ(TemplateId)。それ以外は invalid_input |
| `kind` | `"normal"` または `"template"` のみ。`system` はクライアントから受け付けない(送られたら invalid_input) |
| `limit` | 整数 1〜100。小数・文字列・範囲外は invalid_input(丸めない) |
| `sinceId`/`before` | `^m-\d{6,}$`。同時指定は invalid_input |
| `lastReadId` | `^m-\d{6,}$`。同じグループのメッセージであること(別グループ・不在は not_found) |
| `:groupId`/`:messageId` | `^[a-z0-9-]{1,40}$`。`:messageId` は `:groupId` のグループに属すること(別グループ・不在は not_found) |
| `reason`(通報) | 09 の `ReportReasonId` の列挙値 |
| `note`(通報) | 0〜200 文字、制御文字除去。表示時はエスケープ |
| 権限 | 閲覧・投稿・既読・通報はいずれもメンバー(`isMember`)のみ。サーバー側で判定 |
| 送信者 | 常に `currentUser`。クライアントから `senderId` を受け取らない |

- 本文は他のモジュールの入力欄と同じ「全入力で 09 のフィルタを通す」方針(README 4.4)に従う。
- 連絡先・本名を含む投稿は 09 の辞書で拒否する(承諾前は連絡先が見えない、docs/design 10 章)。チャットは参加成立後の機能だが、外部の連絡先への誘導は拒否対象とする。

### 7.2 セキュリティ対策(OWASP Top 10 の代表項目との対応)

| 分類 | 06 での対策 |
|---|---|
| アクセス制御・IDOR | 全 API でサーバー側が `currentUser` と `isMember` から権限を判定する。`:messageId`・`lastReadId` は `:groupId` に属するかを確認し、別グループの ID は not_found にする。非公開グループの非メンバーには not_found を返す。`postSystemMessage` は API から呼べない内部関数とする |
| 入力検証・インジェクション | 7.1 の検証をサーバー側で行う。SQL・シェル・ファイルパスにユーザー入力を渡さない(インメモリストアのみ)。本文の未知のキーは捨てる(マスアサインメント対策) |
| XSS | 6.4 のとおり。React の既定エスケープのみで表示し、`dangerouslySetInnerHTML` と URL の自動リンク化を使わない |
| CSRF | 00 の `route()` が、変更系 API で `Content-Type: application/json` 以外を 415、`Origin` が `Host` と異なる場合を 403 にする。Cookie は `SameSite=Lax`(00) |
| 認証・セッション(デモ) | ログイン不要のため、現在ユーザーは Cookie `demoUser` で表すモックとする。画面に「モック(ローカル)」を常時表示する |
| セキュリティ設定 | 応答に `Cache-Control: no-store`・`X-Content-Type-Options: nosniff` を付ける(00)。CORS ヘッダは付けない。WebSocket・SSE・外部通信を使わない |
| 機密データの扱い | `reportedBy`・`reportState` は応答に含めず、`reportedByMe` のみ返す。非表示件数を返さない(6.6)。通知に本文・投稿者名を載せない(8.2) |
| ログ | ログには `requestId`・エラーコード・groupId・messageId のみを出し、本文・通報メモは出さない。エラー応答に入力本文を含めない |
| 過大入力・連投 | 本文 64KB 上限(00)、`limit` 最大 100、投稿頻度 1 分 5 件(4.3) |

### 7.3 既知の制約

- Cookie `demoUser` は利用者が書き換えられるため、なりすましを防げない(ログイン不要のデモの前提。実運用では認証が必要)。
- 応答時間の差や、ポーリング結果の差分からの推測(ブロック・通報の有無など)、大量のリクエストによる負荷への対策は行わない(デモ範囲外)。

## 8. エラー処理・画面表示

### 8.1 エラーコード(CHT-ERR)

「対象 API」列の番号は CHT-API の番号。

| ID | コード(HTTP) | 分類 | 発生条件 | 対象 API | 画面の表示・挙動(原因と次の行動) |
|---|---|---|---|---|---|
| CHT-ERR-01 | forbidden(403) | 権限なし | 公開グループの非メンバー(申請中、却下、退会、除名) | 01〜04 | 「チャットは参加が成立したメンバーだけが使えます。」+グループ詳細へ戻る導線。リスト・入力欄は出さない |
| CHT-ERR-02 | not_found(404) | 対象なし | グループ不在、非公開グループの非メンバー、`:messageId`・`lastReadId` が不在または別グループ | 01〜04 | 「グループが見つかりません。」+グループ一覧へ戻る導線(00 の方針)。通報・既読の対象が無い場合は「対象のメッセージが見つかりません。画面を更新してください。」 |
| CHT-ERR-03 | invalid_input(400) | 入力不正 | 本文が空、501 文字以上、11 行以上、定型文 ID 不正、`kind` 不正、`CHAT_FREE_INPUT=false` で `kind:"normal"` | 02 | 入力欄の下に `fields` のメッセージ(「1〜500 文字で入力してください」等)を表示する。入力内容は消さない |
| CHT-ERR-04 | invalid_input(400) | 入力不正 | 禁止表現(`fields.body`) | 02 | 「この内容は送信できません(理由)。言い換えて送信してください。」。入力内容は消さない |
| CHT-ERR-05 | unavailable_state(409) | 状態不正 | 投稿不可の状態(`canChat=false`。中止・完了) | 02 | 「中止(または完了)のため、新しい投稿はできません。履歴は読めます。」。入力欄・定型文を無効化し、理由を表示する |
| CHT-ERR-06 | rate_limited(429) | 連投 | 直近 60 秒に 5 件投稿済み(6 件目)。通報は 09 の回数制限 | 02、03 | 「投稿が続いています。あと◯秒待ってから送信してください。」(`detail.retryAfterSec`)。入力内容は保持する |
| CHT-ERR-07 | internal(500) | 想定外 | 業務エラー(AppError)以外の例外 | 全 API | 「問題が発生しました。画面を再読み込みするか、デモを初期化してください。」(00 の `ErrorNotice`) |
| CHT-ERR-08 | invalid_input(400) | 入力不正 | クエリ不正(`sinceId`・`before`・`limit` の形式、`sinceId` と `before` の同時指定)、`lastReadId` の形式不正 | 01、04 | 通常の画面操作では発生しない。取得エラーとして扱い、「メッセージを取得できませんでした」+「再試行」(9.3) |
| CHT-ERR-09 | invalid_input(400) | 入力不正 | 通報: 自分の投稿・システムメッセージが対象、`reason` が列挙外、`note` が 201 文字以上 | 03 | 通報ダイアログ内に `fields` のメッセージを表示する。自分の投稿・システムには通報メニューを出さないため、前者は通常の画面操作では発生しない |
| CHT-ERR-10 | (クライアント)network | 通信失敗 | fetch の失敗、JSON でない応答 | 01〜04 | ポーリング中はリスト上部に「更新できませんでした。再試行しています」を表示し、既存の表示を保持する(5.3 の間隔で再試行)。投稿・通報では入力内容を保持してエラーを表示する |

- 00 の `route()` が返す共通エラー(415 unsupported_media_type、403 forbidden(Origin 不一致)、413 payload_too_large)は 00 8 章の表示に従う。通常の画面操作では発生しない。
- 競合(409 conflict)は使わない。メッセージは追記のみで更新の競合が無く、二重の通報は冪等(200)として扱うため。投稿の二重送信は画面側で送信中のボタンを無効にして防ぐ(9.1)。
- `rate_limited` は 00 の共通コード体系に無い。追加を 16 章で要望。追加されない場合は `conflict` で代用し、`fields.body` に `rate_limited` を持たせる。 [案]

### 8.2 通知との関係(10 との契約)[案]

- 新着メッセージごとに通知を作ると通知一覧の大半をチャットの通知が占めるため、**通知は「未読の新着 1 件にまとめる」**(コアレス)。
- 通知対象: 投稿者(ユーザー)以外のメンバーで、チャットを現在開いていない者(既読位置が最新でない者)。条件: その (userId, groupId) に未読の `chat_new` 通知が無いときのみ `notify(userId, "chat_new", groupId, {})` を呼ぶ。
- 除外: システムメッセージ、投稿者本人、投稿者をブロックしている受信者(`isBlocked(recipient, sender)`)、グループ内で既に未読の `chat_new` がある受信者。
- 通知本文は固定テンプレート「グループに新しいメッセージがあります」。**本文・投稿者名を載せない**(10 の NTF-RULE-01)。変数なし。
- 既読化: 受信者がチャットを開き `markChatRead` が呼ばれたとき、06 が 10 の `markReadWhere(userId, { type:"chat_new", groupId })`(16 章の要望)を呼ぶ。
- 画面内の「新着◯件」バッジ(未読数)は通知とは別に `unreadCount` から出す(グループ詳細のチャットタブに表示)。
- 通知連携の優先度は B(余力で実装。CHT-TASK-15)。デモの最小構成では通知を作らず、未読バッジ(CHT-TASK-13)で代替する。
- 通知の呼び出しが失敗しても投稿は成功として扱う(6.3 の手順 6)。

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
 ├─ MessageComposer       (CHT-UI-08) props: { disabled, disabledReason?, error?, submitting, onSubmit }
 └─ ReportDialog          (CHT-UI-09) props: { message, opened, onClose, onSubmit }
ui/useChat.ts             (CHT-UI-10) ポーリング・投稿・差分取り込み・既読・通報
```

props の型:

```ts
type MessageListProps = { messages: MessageDto[]; hasMoreOlder: boolean; loadingOlder: boolean;
  onLoadOlder: () => void; onReport: (m: MessageDto) => void };            // 自分の投稿かは MessageDto.isMine で判定
type MessageItemProps = { message: MessageDto; onReport: (m: MessageDto) => void };
type NewMessagesPillProps = { count: number; onClick: () => void };
type TemplateBarProps = { templates: ChatTemplate[]; disabled: boolean; onPick: (id: TemplateId) => void };
type MessageComposerProps = { disabled: boolean; disabledReason?: string; error?: string; submitting: boolean;
  onSubmit: (body: string) => Promise<boolean> };                           // true のとき入力欄を空にする
type ReportDialogProps = { message: MessageDto | null; opened: boolean; onClose: () => void;
  onSubmit: (reason: ReportReasonId, note: string) => Promise<boolean> };  // true のとき完了表示にする
```

### 9.1 状態とデータ取得

- `useChat(groupId)` の戻り値:

```ts
interface UseChatResult {
  messages: MessageDto[];                 // 昇順
  access: ChatAccess | null;              // 初回取得前は null
  unreadCount: number;
  hasMoreOlder: boolean;
  status: "loading" | "ready" | "error";  // error は初回取得の失敗。ポーリングの失敗は pollError で示す
  error: ApiError | null;                 // 直近の操作のエラー(00 の ApiError)
  pollError: boolean;                     // ポーリングが連続して失敗している間 true
  pendingNew: number;                     // 最下部にいない間に届いた新着の件数(NewMessagesPill)
  post(input: PostMessageInput): Promise<boolean>;
  loadOlder(): Promise<void>;
  refresh(): Promise<void>;
  markRead(): void;                       // READ_DEBOUNCE_MS でまとめて CHT-API-04 を呼ぶ
  report(messageId: string, reason: ReportReasonId, note?: string): Promise<boolean>;
}
```

- 内部状態: `messagesById: Map<string, MessageDto>`、`latestId`、`atBottom: boolean`、`consecutiveFailures: number`。
- 取得・投稿は 00 の `/api/groups` 用クライアント関数(`lib/groups-api.ts`。内部で `cache: "no-store"`)を使う。既存 `useApi` は `/api/v2` 固定のため使わない(16 章)。
- 投稿は送信中ボタン無効(二重送信防止)。成功したら応答の `MessageDto` を Map に追加し、入力欄を空にして最下部へスクロール。失敗時は入力欄を保持。

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
| 読み取り専用(中止・完了) | 入力欄と定型文を無効化し、理由を `Alert`(青)で表示 |
| 禁止表現/頻度/長さ | コンポーザー直下にエラー(`aria-describedby`)。入力は保持 |

### 9.4 通報導線

- 他人の `normal`/`template` の各メッセージにメニュー(「…」)→「通報する」。自分のメッセージ・システムには出さない。
- `ReportDialog`: 理由(09 の `ReportReasonId` から選択)と任意メモ(200 文字)。送信後は「通報を受け付けました。相手には通知されません。」を表示し、そのメッセージに「通報済み」を表示(自分の画面のみ。`reportedByMe`)。通報は 09 に記録するだけで、デモでは受付の表示までとし、対応の処理は行わない。 [案]
- ブロックへの導線(メンバー一覧への案内)は 09/01 の画面に委ねる。06 の「…」メニューに「ブロックする」を置くかは [未決 #8]。置く場合は 09 のブロック API を呼び、成功後に `refresh()` を呼んで非表示を反映する。

### 9.5 アクセシビリティ

- メッセージリストのコンテナに `role="log"`、`aria-live="polite"`、`aria-relevant="additions"`、`aria-label="グループチャットのメッセージ"`。読み上げ対象を新着に限るため、過去分の追加中は `aria-busy="true"` にする(過去分をまとめて読み上げない)。
- リストは `ul`、各メッセージは `li` とし、「送信者名、時刻、本文」の順に並べる。自分の発言はテキストで「自分」を付ける(色だけで区別しない)。システムメッセージも同じリスト内の通常の `li` とし、`role="status"` は付けない。
- 入力欄は `<label>`(視覚的に非表示可)付きの `Textarea`。Enter では送信せず、`Ctrl+Enter` またはボタンで送信する(日本語入力の変換確定の Enter による誤送信を避ける)。 [案]
- 文字数カウンタ「120 / 500」を `aria-live="off"` で表示し、上限超過時のみエラーとして通知する。
- 定型文ボタンは `button`、`aria-label` に全文を入れる。キーボードだけで通報まで到達できる(メニューは Mantine の Menu でフォーカス管理)。
- 新着 Pill は `button`。「モック(ローカル)」バッジはテキストで常時表示。
- スマホ幅: 入力欄を下部固定(下部タブ(04 章)と重ならないよう余白)。タップ領域 44px 以上。

## 10. 試験観点(10 章)と受け入れ条件

前提データ(デモ用 seed、00 4.4): ユーザー u-org(幹事)、u-mem(メンバー)、u-out(非メンバー)、u-pend(申請中)、u-blk(u-mem がブロック済み)。グループ g-001(募集中、メンバー 3 人)、g-cancel(中止)、g-done(完了)、g-priv(非公開)。以降「幹事」「メンバー」と表記。clock は `clock.set` で差し替える。

- 上記の ID は本章の試験用の別名。実際の ID は 00 の `fixtures.ts`(seed の ID 定数)に対応付け、試験コードに ID 文字列を直接書かない。00 の seed に無い組み合わせ(同じグループ内のブロック関係など)は試験の前処理で作るか、00 に seed の追加を依頼する(CHT-TASK-17、16 章)。

### 10.1 サービス・API

| ID | 入力 | 期待結果 |
|---|---|---|
| CHT-T-01 | u-out が `GET /api/groups/g-001/messages` | 403 forbidden。メッセージ内容を応答に含めない |
| CHT-T-02 | u-pend(申請中)が POST normal "こんにちは" | 403 forbidden。承諾前は使えない |
| CHT-T-03 | メンバーが POST `{kind:"normal", body:"集合は10時でどうですか"}` | 201。`kind:"normal"`、senderId=本人、保存される |
| CHT-T-04 | メンバーが POST `{kind:"template", templateId:"tpl-01"}` | 201。`kind:"template"`、body が定型文 tpl-01 の文言 |
| CHT-T-05 | body が空 / 空白のみ | 400 invalid_input、`fields.body` あり |
| CHT-T-06 | body が 500 文字ちょうど / 501 文字 | 前者 201 / 後者 400 |
| CHT-T-07 | body が 11 行(改行 10 個) | 400 invalid_input |
| CHT-T-08 | body に連続改行 5 個を含む短文 | 201。保存本文の連続改行が 2 つに圧縮されている |
| CHT-T-09 | body に制御文字(U+0000、U+202E)を含む | 制御文字が除去された本文で 201(制御文字のみの本文なら 400) |
| CHT-T-10 | 禁止表現(09 の辞書の「LINE 交換しよう」相当)を含む body | 400 invalid_input、`fields.body`。Store.messages の件数が変わらない |
| CHT-T-11 | 恋愛を連想させる語を含む body | 400(同上) |
| CHT-T-12 | `templateId:"tpl-99"` | 400 invalid_input、`fields.templateId` |
| CHT-T-13 | `kind:"system"` を送る | 400 invalid_input |
| CHT-T-14 | `body:"<script>alert(1)</script>"` | 201。保存・応答は原文のまま。画面では文字として表示され、実行されない(CHT-T-30) |
| CHT-T-15 | 同一ユーザーが 60 秒以内に 5 件投稿 → 6 件目 | 6 件目は 429 rate_limited。`clock.set` で 61 秒進めた後の投稿は 201 |
| CHT-T-16 | 禁止表現で 5 回拒否 → 6 回目に正常本文 | 201(拒否は件数に数えない) |
| CHT-T-17 | g-cancel(中止)にメンバーが POST | 409 unavailable_state。GET は 200 で `access.canPost=false`、`reason:"state_readonly"` |
| CHT-T-18 | g-done(完了)に POST / GET | POST は 409、GET は 200(読み取り専用) |
| CHT-T-19 | 退会したユーザーが GET / POST | ともに 403 |
| CHT-T-20 | u-mem の画面で u-blk の投稿 | 応答に u-blk のメッセージが含まれない。u-org の応答には含まれる。`latestId` は u-blk の投稿を含む値 |
| CHT-T-21 | 初回取得 → `sinceId=latestId` で再取得(新着なし) | `messages: []`、`latestId` 不変。新規投稿後は新規 1 件のみ |
| CHT-T-22 | 60 件ある状態で limit なし → `before=<最古>` | 初回は最新 50 件、`hasMoreOlder=true`。`before=<その最古の id>` で残り 10 件、`hasMoreOlder=false`、`latestId=null` |
| CHT-T-23 | `limit=0` / `limit=101` / `limit=abc`、`sinceId`+`before` 同時、`sinceId=../x` | すべて 400 invalid_input |
| CHT-T-24 | 全 `ChatTemplate.text` を 09 の `checkText` に通す(静的試験) | すべて OK |
| CHT-T-25 | 他メンバーのメッセージを通報(reason 有効) | 200 `{reported:true}`。09 に記録 1 件。同じ操作を再度行うと 200 で記録は増えない(冪等) |
| CHT-T-26 | 自分の投稿 / system メッセージを通報 | 400 invalid_input |
| CHT-T-27 | 通報後、通報者の GET で当該メッセージ `reportedByMe=true`、他メンバーの GET では false | 通報の有無が他のメンバーに伝わらない。応答に `reportedBy`・`reportState` が含まれない |
| CHT-T-28 | メンバー追加(03 approve)後 | system メッセージ `member_joined` が 1 件。`text` に対象の表示名。5 秒以内の重複呼び出しで増えない(この確認はデモ範囲外) |
| CHT-T-29 | 状態が確定/中止に遷移(04) | 対応する system メッセージが 1 件。中止後も system は追加できる |
| CHT-T-33 | メンバー A が投稿 → B(未読通知なし)に `chat_new`、投稿者 A と、A をブロック済みの C には通知なし。続けて A が再投稿 | B の `chat_new` は 1 件のまま(コアレス)。B が `markChatRead` 後の再投稿で再び 1 件 |
| CHT-T-34 | 通知本文・変数の確認 | 本文テンプレートが固定で、メッセージ本文・投稿者名を含まない |
| CHT-T-35 | 退会者の過去メッセージ | 履歴は残り、`senderName="元メンバー"` |
| CHT-T-36 | 保持上限(500)超過 [デモ範囲外] | 501 件目の追加で最古 1 件が消え、件数は 500 |
| CHT-T-44 | 既読: メンバー B が `markChatRead(latestId)` → 他メンバーが 2 件投稿 → B が GET。続けて B が古い id で `markChatRead` | GET の `unreadCount=2`(B 自身の投稿は数えない)。古い id では既読位置が戻らない。`getUnreadCount` も同じ値 |
| CHT-T-45 | 別グループのメッセージ ID を `:messageId`・`lastReadId` に指定して通報・既読(IDOR) | 404 not_found。09 に記録されず、既読位置も変わらない |
| CHT-T-46 | POST を `Content-Type: text/plain` で送る / `Origin` が別ホスト | 415 unsupported_media_type / 403 forbidden(00 の `route()` の適用確認)。保存されない |
| CHT-T-47 | `CHAT_FREE_INPUT=false` で `kind:"normal"` を POST | 400 invalid_input(`fields.body`)。`kind:"template"` は 201 |
| CHT-T-48 | 非公開グループ g-priv の非メンバーが GET / POST、存在しないグループ ID で GET | すべて 404 not_found(403 にしない) |

### 10.2 画面

| ID | 操作 | 期待結果 |
|---|---|---|
| CHT-T-30 | 本文 `<script>…</script>` を投稿 | 文字としてそのまま表示される。DOM に `script` 要素は増えない。リンク化もされない(`https://example.invalid` を投稿しても `<a>` は無い) |
| CHT-T-31 | 禁止表現を送信 | 入力欄の本文が残り、理由と修正案が表示される。リストに追加されない |
| CHT-T-32 | 別ユーザー(Cookie 切替)で投稿 → 元の画面で 5 秒待つ | 新着が表示される。最下部にいなければ新着 Pill が出て、最下部にいれば自動で追従 |
| CHT-T-37 | 中止グループのチャットを開く | 履歴は読め、入力欄・定型文が無効で理由が表示される |
| CHT-T-38 | 0 件のグループを開く | 空状態の文言と定型文ボタン |
| CHT-T-39 | API 停止(エラー応答)でポーリング | 既存メッセージを保持し、エラー表示と再試行。復旧後に自動で戻る |
| CHT-T-40 | スクリーンリーダー/DOM 検査 | リストに `role="log"` と `aria-live="polite"`。入力欄にラベルがあり、エラーが `aria-describedby` で結び付く |
| CHT-T-41 | 「モック(ローカル)」バッジ | 常時表示される |
| CHT-T-42 | 通報導線 | 他人の投稿で通報メニュー→送信→「通報済み」表示。自分の投稿にはメニュー項目が無い |
| CHT-T-43 | タブが非表示になる間 | ポーリング要求が止まり、復帰時に 1 回取得される |

- 静的試験: 06 の文言・コードに、README 1 章で使わないと定めた語・恋愛を連想させる語が含まれない(grep。語の一覧は 09 の静的検査の定数を使う)。外部ドメインへの fetch・WebSocket・EventSource が無い(grep)。

## 11. 依存するモジュールと契約

### 11.1 06 が呼ぶ関数

| 呼び先 | 関数 | 用途 | 状態 |
|---|---|---|---|
| 00 | ストア(`db()`/`tx()`。README の `store()`)、`currentUser(req)`、`clock`、`AppError` と生成ヘルパー、`route()`、`v`/`parse`/`sanitizeText`、`isMember`/`requireGroup`(`lib/authz.ts`) | 基盤、メンバー判定、グループ取得 | 00 の詳細設計で定義済み |
| 01 | なし(`isMember` は 00 の実装を直接使う。01 は同じ関数を再エクスポートしている) | - | 06→01 の import を持たないことで、01→06(`postSystemMessage`)との循環を避ける [案] |
| 04 | `canChat(group)`、`canReadHistory(group)` | 投稿可否、閲覧可否 | 04 の詳細設計で定義済み |
| 09 | `checkText(text, field)`、`isBlocked(a, b)`、`report(user, target, reason, body)` | 禁止表現、ブロック非表示、通報 | 戻り値・引数に不足あり(16 章) |
| 10 | `notify(userId, type, groupId, vars)` | 新着通知(8.2) | 型 `chat_new` の追加を要望 |

### 11.2 06 を呼ぶ側

| 呼び元 | 呼ぶ関数 | タイミング |
|---|---|---|
| 01(`createGroup`) | `postSystemMessage(id, "group_created")` | 作成後 |
| 03(`approve`) | `postSystemMessage(id, "member_joined", userId)` | メンバー追加後 |
| 01(`leaveGroup`) | `postSystemMessage(id, "member_left", userId)` | 退会後 |
| 04(遷移全般) | `postSystemMessage(id, "state_*")` | 状態変更後 |
| 01(詳細ページ) | `<ChatPanel groupId>`。未読バッジはサーバー側で `getUnreadCount(user, groupId)`、画面からは CHT-API-01(`limit=1`)の `unreadCount` で取得 | タブ描画 |

- 循環回避: 06 → 04 は `canChat`・`canReadHistory` のみ、04 → 06 は `postSystemMessage` のみ。06 は 04 の状態名を import しない。06 は 01 を import せず、メンバー判定とグループ取得は 00 から import する。 [案]
- README 3 章の依存図との差: 図は 06→01 の辺を持ち、01・03・04→06(システムメッセージ)と 06→10(通知)の辺を持たない。図の更新を 16 章で依頼する。

## 12. ファイル構成と利用ライブラリ

### 12.1 ファイル一覧と責務

| パス | 責務 |
|---|---|
| `app/src/features/groups/chat/types.ts` | 4.1 の型 |
| `app/src/features/groups/chat/constants.ts` | 4.3 の制約値、`CHAT_FREE_INPUT` |
| `app/src/features/groups/chat/templates.ts` | 定型文 6 件(`tpl-01` 集合時間を相談したい / `tpl-02` 集合場所を確認したい / `tpl-03` 持ち物を確認したい / `tpl-04` 遅れそうです / `tpl-05` 了解です / `tpl-06` ありがとうございます) |
| `app/src/features/groups/chat/messages.ts` | 画面・エラー・システムメッセージの文言(README 4.4 の集約方針) |
| `app/src/features/groups/chat/sanitize.ts` | CHT-FN-10、11 |
| `app/src/features/groups/chat/rate-limit.ts` | CHT-FN-12 |
| `app/src/features/groups/chat/system-messages.ts` | CHT-FN-05、13 |
| `app/src/features/groups/chat/service.ts` | CHT-FN-01〜04、06〜08、14 |
| `app/src/features/groups/chat/handlers.ts` | CHT-API-01〜05 の Route 用ハンドラ(薄い。検証と応答整形) |
| `app/src/features/groups/chat/index.ts` | 公開 API の再エクスポート(`postSystemMessage`、`chatAccess`、`getUnreadCount`、`ChatPanel`) |
| `app/src/features/groups/chat/ui/*.tsx`、`ui/useChat.ts` | 9 章のコンポーネントとフック |
| `app/src/data/group-seed.json`(00 管理) | デモ用メッセージの初期データ。06 は追記内容を 00 に渡す |
| テスト | `app/src/features/groups/chat/__tests__/*.test.ts`(00 のテスト基盤(Vitest、CMN-TASK-12)と `fixtures.ts`・`resetForTest` を使う) |

- `app/src/app/api/groups/[...path]/route.ts` は 00/01 が管理するキャッチオール。06 のパス(`messages`、`chat`)の分岐追加を依頼する(16 章)。
- 既存ファイル(`api.ts`、`server-store.ts`、`/api/v2`)は変更しない。

### 12.2 利用ライブラリ・モジュール

06 は新規の npm 依存を追加しない。バージョン欄の「維持」は `app/package.json` に記載の指定を変えないことを表す。

| 種別 | 名前 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| フレームワーク | Next.js(App Router、Route Handler) | チャット API(`app/api/groups/...`)、グループ詳細のタブ内の描画 | MIT | `16.4.5` を維持 |
| ライブラリ | React / React DOM | 画面コンポーネント、`useChat` の状態管理(`useState`・`useEffect`・`useRef`) | MIT | `19.3.0` を維持 |
| UI | @mantine/core | ScrollArea、Textarea、Button、Badge、Alert、Menu、Modal、Skeleton、VisuallyHidden | MIT | `^9.7.5` を維持 |
| UI | @mantine/hooks | `useDocumentVisibility`(ポーリング停止)、`useDebouncedCallback`(既読送信)。v9 で名称が異なる場合は同等の処理を `useChat` 内に書く | MIT | `^9.7.5` を維持 |
| アイコン | @tabler/icons-react | 送信、メニュー(…)、新着の矢印 | MIT | `^3.51.0` を維持 |
| 日時表示 | dayjs | 送信時刻の表示(日本時間、`M/D HH:mm`)。サーバー側の現在時刻は 00 の `clock` を使い、dayjs は使わない | MIT | `^1.11.23` を維持 |
| テスト(開発時のみ) | Vitest | サービス関数・API の試験 | MIT | 00 が devDependency に追加する(CMN-TASK-12)。最新の安定版を使う |
| Web 標準 | fetch、URL / URLSearchParams、`document.visibilityState`、`setTimeout` | 取得・ポーリング・クエリ組み立て | - | ブラウザ標準 |
| Node 標準 | なし | 06 は `crypto`・`fs` を使わない(ID は連番、永続化は 00 の責務) | - | - |
| 自前(00) | `lib/groups-store.ts`、`lib/clock.ts`、`lib/errors.ts`、`lib/api-route.ts`、`lib/validation.ts`、`lib/authz.ts`、`lib/groups-api.ts` | ストア・時計・エラー・API 共通処理・検証・メンバー判定・クライアント | - | 00 の実装に従う |
| 自前(04・09・10) | `canChat`・`canReadHistory`(04)、`checkText`・`isBlocked`・通報記録(09)、`notify`・`markReadWhere`(10) | 状態による可否、禁止表現・ブロック・通報、通知 | - | 各モジュールの実装に従う(11 章) |
| 自前(06) | `sanitize.ts`、`rate-limit.ts`、`system-messages.ts`、`ui/useChat.ts` | 本文整形、投稿頻度、システム文言、ポーリング | - | 処理が小さく、外部ライブラリを入れるとライセンス確認と依存が増えるため自前で実装する |
| 不採用 | zustand | チャットの状態は 1 画面内で完結し、`useChat` の React state で足りるため使わない(依存には既にある) | MIT | - |

採用しないライブラリと理由:

- WebSocket・Socket.IO・SSE: ローカルのモックでポーリングに統一する方針(1 章、docs/design 01 章)のため。
- SWR・TanStack Query: ポーリング・差分取り込みは `useChat` 内の数十行で書け、依存とライセンス確認を増やさないため。
- DOMPurify 等の HTML サニタイザ: HTML を描画しない(6.4)ため不要。
- URL の自動リンク化ライブラリ: 自動リンク化をしない方針(6.4)のため不要。
- 禁止語判定ライブラリ: 辞書と判定は 09 の責務のため、06 では使わない。

## 13. 実装タスク(CHT-TASK)

規模: S=半日未満、M=半日〜1 日、L=1 日以上。優先度は README 2 章(06 は A)。

前提列の「TASK-nn」は本章の CHT-TASK-nn、「00」「04」などはモジュール番号を表す。完了条件の試験は 10 章の CHT-T。

| ID | タスク | 規模 | 前提 | 優先 | 完了条件 |
|---|---|---|---|---|---|
| CHT-TASK-01 | 型・定数・文言・定型文(types/constants/templates/messages) | S | 00 の型(CMN-TASK-01) | S | `npx tsc --noEmit` が通る |
| CHT-TASK-02 | `sanitize.ts`(normalize/validate)+単体試験 | S | TASK-01、00 の `sanitizeText` | S | CHT-T-05〜09 |
| CHT-TASK-03 | `rate-limit.ts`+単体試験 | S | TASK-01、00 の `clock` | S | CHT-T-15 |
| CHT-TASK-04 | `service.ts` の `chatAccess`、`postMessage`(定型文のみ先行)、DTO 化(`toDto`) | M | TASK-01〜03、00 のストア・`isMember`・`requireGroup`、04 の `canChat`・`canReadHistory` | S | CHT-T-02〜04、12、13、17〜19、35、47、48 |
| CHT-TASK-05 | `listMessages`(最新・sinceId・before・limit) | M | TASK-04 | S | CHT-T-01、21〜23 |
| CHT-TASK-06 | ハンドラと API(CHT-API-01、02、05)、00 の `route()` の適用、キャッチオールへの登録 | M | TASK-04、TASK-05、00 の `route()` | S | CHT-T-01〜23 を HTTP 経由で実行して通る、CHT-T-46 |
| CHT-TASK-07 | 禁止表現の組み込み(09 の `checkText`)と拒否応答 | S | TASK-04、09 の `checkText` | S | CHT-T-10、11、16、24 |
| CHT-TASK-08 | `useChat`(取得・ポーリング・差分・投稿・失敗時の間隔延長・非表示時の停止) | M | TASK-06、00 の `lib/groups-api.ts` | S | CHT-T-39、43 |
| CHT-TASK-09 | `ChatPanel`/`MessageList`/`MessageItem`/`MessageComposer`/`TemplateBar`(空・エラー・読み取り専用状態を含む) | L | TASK-08 | S | CHT-T-14、30、31、37、38、41 |
| CHT-TASK-10 | スクロール制御・新着 Pill・過去分読み込み | M | TASK-09 | A | CHT-T-32 |
| CHT-TASK-11 | アクセシビリティ(log/aria-live、ラベル、キーボード)と文字数カウンタ | S | TASK-09 | A | CHT-T-40 |
| CHT-TASK-12 | 通報(`reportMessage`、CHT-API-03、`ReportDialog`、`reportedByMe`) | M | TASK-04、TASK-09、09 の通報記録 | A | CHT-T-25〜27、42、45 |
| CHT-TASK-13 | 既読位置(`markChatRead`、CHT-API-04、`getUnreadCount`)と未読バッジ | M | TASK-05、TASK-09 | A | CHT-T-44、45 |
| CHT-TASK-14 | システムメッセージ(`postSystemMessage`、`renderSystemText`、重複抑止 [デモ範囲外])と 01/03/04 への組み込み依頼 | M | TASK-04 | A | CHT-T-28、29 |
| CHT-TASK-15 | 通知連携(`chat_new` のコアレス、既読時の既読化) | M | TASK-13、TASK-14、10 の `notify`・`markReadWhere` | B | CHT-T-33、34 |
| CHT-TASK-16 | ブロック非表示の結合(`isBlocked`) | S | TASK-05、09 の `isBlocked` | A | CHT-T-20 |
| CHT-TASK-17 | seed のデモメッセージ(10〜20 件)、リセット確認、保持上限 [デモ範囲外] | S | TASK-04 | A | seed の読み込みとリセット後の件数が一致する。CHT-T-36 は任意 |
| CHT-TASK-18 | 試験の実施(10 章)、静的検査(外部通信・禁止語)、`npm run lint`/`build` | M | 全タスク | S | 10 章の全試験(デモ範囲外を除く)、`npm test`・`npm run lint`・`npm run build` が通る |

- 縮退順(時間が足りない場合): 定型文のみ(案 A 相当: TASK-01、04、05、06、08、09)→ 禁止表現(TASK-07)→ 通報(TASK-12)→ システムメッセージ(TASK-14)→ 通知(TASK-15)。 [案]
- クリティカルパス: 00 のストア・`currentUser`・`clock`・`isMember`・`requireGroup` → 04 の `canChat` → CHT-TASK-04〜09。

## 14. 未決事項

| 番号 | 内容 | 本書の暫定 |
|---|---|---|
| #9 | 入力方式(定型文のみ / 自由入力+通報 / 入力時に弾く) | 5.4 の推奨 C+定型文+通報 [案] |
| #8 | ブロックの対称性と通報・ブロックの挙動 | 閲覧者側の非表示のみ(案A)。通報者を伏せる(案C)を `reportedByMe` で反映 [案] |
| #7 | 退会者の履歴(残す/匿名化) | 残し、「元メンバー」表示 [案] |
| 中止・完了後のチャット | docs/design/04・12 に明記なし | 読み取り専用 [案] |
| 通知 | `chat_new` を作るか | コアレスで 1 件 [案] |
| ブロック導線 | チャット内に「ブロックする」を置くか | 未設置(通報のみ) [案] |
| テストランナー | 導入要否 | 00 が Vitest を導入する案(CMN-TASK-12)に従う [案] |

## 15. 実装メモ(デモ範囲)

- 最小構成: 定型文投稿+自由入力(禁止表現チェック)+一覧(5 秒ポーリング、最新 50 件)。通報はボタンから 09 に記録するだけとする。システムメッセージは `member_joined` と `state_*` だけでもよい。通知は未読バッジで代替する。
- Next.js 16 の Route Handler・キャッシュの扱いは `app/node_modules/next/dist/docs/` を実装前に確認する [要確認](本 worktree には `app/node_modules` が無い)。既存コードから、`params` が Promise であることと `cache: "no-store"` の使用は読み取れる [事実]。ポーリング応答がキャッシュされないよう GET Route に `dynamic = "force-dynamic"` 相当が要るか確認する [要確認]。00 の `route()` は最初に `req.headers` を読み、`Cache-Control: no-store` を付ける方針(00 5.5)のため、これで足りるかを確認する。
- 使わないもの: WebSocket、SSE(EventSource)、外部の通信・Push、新規 npm 依存(12.2)。

## 16. 他モジュールへの要望

| 宛先 | 要望 |
|---|---|
| 00 | (1) Store に `chatSeq: number`、`chatReads: Record<string, ChatReadMark>` を追加。(2) エラーコード `rate_limited`(429)の追加。(3) `/api/groups` 用のクライアント(00 の `lib/groups-api.ts`)。(4) `api/groups/[...path]` のルーティング分岐に 06 のパスを登録する方式(分岐表にハンドラを渡す)。(5) テスト基盤(CMN-TASK-12)の提供。(6) `group-seed.json` にデモ用メッセージ 10〜20 件(06 が内容を提供)。(7) 定型文など固定値の `features/*/messages.ts` 方式の確認。(8) README 3 章の依存図に 01・03・04→06 と 06→10 の辺を追加し、06→01 を 06→00 にする(11.2)。 |
| 01 | (1) `isMember(user, group)` が「参加中」のみ真(退会・除名・申請中は偽)であること(00 の実装を再エクスポートする前提)。(2) `createGroup`/`leaveGroup` から `postSystemMessage` を呼ぶこと。(3) グループ詳細のチャットタブに未読バッジを出す場合は `getUnreadCount` を使うこと。 |
| 03 | `approve` で 01 `addMember` の後に `postSystemMessage(groupId, "member_joined", applicantId)` を呼ぶこと。 |
| 04 | (1) `canChat(g)` が中止・完了後に false を返すこと(読み取りは 06 が許す)。(2) 状態遷移の各所で `postSystemMessage` を呼ぶこと。状態遷移時のイベントと `SystemEventType` の対応は 6.7。(3) `Group.state` の列挙名を公開すること。 |
| 09 | (1) `checkText(text, field)` の戻り値を 6.5 の `CheckTextResult`(category、hint 付き)にし、`field` に `"chat"` を追加。(2) `report(user, target, reason, body)` の `target` に `{ type:"message", id, groupId }` を許すこと、`ReportReasonId` の列挙を公開すること、対象が自分の投稿でないことの検証。(3) `isBlocked(viewer, target)` の方向性(viewer がブロックしているか)を明記すること。(4) 通報の冪等(同一ユーザー・同一対象の二重記録なし)。 |
| 10 | (1) 通知種別 `chat_new` を追加(固定テンプレート、変数なし)。(2) 条件付き既読化 `markReadWhere(userId, { type, groupId })`。(3) 「未読の同種通知が既にあるか」を返す `hasUnread(userId, type, groupId)`。 |

## 17. 設計上の確認事項(docs/design・他骨子との差異)

1. docs/design は中止後・完了後のチャット可否を決めていない(04 章「チャット等を使えるまま維持」は実行確定の説明。中止時のチャットの扱いは 04 骨子が「未決」)。本書は「中止・完了は読み取り専用」(案)とした。要確認。
2. 06 骨子は `canChat` を返す boolean に使うが、非メンバーは `isMember` で別判定が必要。`canChat(g)` は「状態のみ」で判定する前提でよいか(04 骨子は Group のみを引数にしている)。
3. 骨子の API パスは `[id]`、README の配置案は `[groupId]`。本書は `[groupId]` で統一した。
4. 09 骨子の `checkText` は「OK または禁止語の理由」で、`field` の取りうる値・戻り値型が未定義。6.5 の形を要望。
5. 09 骨子の `report(user, target, reason, body)` は対象の型が未定義(ユーザーか、メッセージか)。
6. 10 骨子の `notify` の `type` 列挙が未定義。`chat_new` を要望。10 骨子の「通知にチャット本文・連絡先を載せない」は 06 の方針(8.2)と一致。
7. README の API 形式は `{ error: "<code>", message?, fields? }` で、`rate_limited` が無い(16 章 00 の要望)。
8. 06 骨子の「連投制限(件数/秒)」は本書で「1 分 5 件」に具体化(案)。数値は [案] で、10 章に試験値の指定は無い。
9. README 3 章の依存図に 01・03・04→06 の辺が無い(システムメッセージ)。06→04 は `canChat`・`canReadHistory` のみ、06→01 は持たない(11.2)ため循環は生じない。依存図の更新を確認する。
10. [未決 #9] の確定は docs/design 12 章で行う。本書は暫定で実装可能な構造(`CHAT_FREE_INPUT` フラグ)にした。
11. `app/node_modules` が無いため Next.js 16 の Route Handler/キャッシュ・テスト実行の確認ができていない [要確認](15 章)。
12. 並行して作成中の他モジュールの詳細設計との差異(本書では直さず、統合時に確認する) [要確認]:
    - 00: `GroupMessage` の型(id 形式 `msg-001`、`kind: "text" | "template"`、`reported: boolean`)、採番(00 は `counters`、本書は `chatSeq`)、通知種別名(00 は `chatMessage`)、ID 形式不正の扱い(00 は not_found、本書は invalid_input)、ページングの規約(00 は limit 最大 50・offset 方式、本書は最大 100・id 基準)、試験用 seed の ID(00 は u-001 等)。
    - 04: 完了後のチャットを 04 は「閉じる」と記述し、本書は読み取り専用とした。可否表の値(`canChat=false`、`canReadHistory=true`)は一致する。
    - 09: `isBlocked` は双方向で、一方向の判定は `isBlockedByMe`・`filterVisibleMessages`。禁止表現は `assertTextAllowed(text, "chat_message", field)`、投稿頻度は `checkRate("chat_post")`(5 件/10 秒)、通報は `createReport`、理由の型名は `ReportReason`。本書 6.5・6.6・4.3 と名前・数値が異なる。
    - 10: `notify` は入力オブジェクト(`kind`、`eventKey`、除外ユーザー)を受け取り、`chat_new` の集約は 10 が行う。本文に `{groupTitle}`・`{count}` を含む。本書 8.2(06 が未読の有無を確認し、変数なしで呼ぶ)と異なる。
