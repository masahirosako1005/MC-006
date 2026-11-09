# 10 通知

> 本書は docs/feature/README.md の凡例に従う([決定] [案] [未決] [要確認] [推定])。ID 接頭辞は `NTF`(TYPE=型、FN=関数、API、T=試験、TASK=実装タスク)。仕様の正は docs/design。00 共通基盤は並行で詳細化中のため、確定までは 00 骨子の記述を契約とし、不一致は第 17 章に書く。「デモ範囲外」と付けた記述は設計として残すが、デモの実装・試験の対象にしない。

## 1. 概要と責務 / 対応する柱

- グループ関連のイベント(最少人数到達、辞退期間、実行確定、中止、再企画の案内、条件変更、参加申請の受付・承認・却下、チャット新着、締切接近)をアプリ内通知として生成・保存・取得・既読化する。柱18(実行条件と状態管理の通知)、4、13 を支える。
- 外部のプッシュ通知・メール・LINE は使わない。ローカルのダミーデータのみ。 [決定、rule.md 3・6、docs/design 05 章]
- 通知本文は「種類ごとの固定テンプレート+検証済みパラメータ」から生成し、個人が特定される情報(氏名、申請者名、チャット本文、連絡先、辞退者名)は載せない。 [案、docs/design 07 章 論点17]
- 既存の通知モック(`/api/v2/notifications`、`news`/`notice` 画面)は変更せず、別系統で作る。

## 2. 既存機能との関係

### 2.1 既存コードの実態 [事実、読み取り済み]
| 既存 | 内容 |
|---|---|
| `app/src/app/api/v2/[...path]/route.ts` の `notifications` | `GET /notifications` は固定 1 件(`{id:1,title,body,at,read:false}`)、`GET /notifications/unread` は常に `{count:1}`。書き込み・既読化なし |
| `app/src/app/[campaign]/news/page.tsx` | `useApi("/notifications")` の一覧をカード表示するだけ。`notice/page.tsx` は同じコンポーネントの再エクスポート |
| `app/src/components/AppShell.tsx` | ヘッダーのベル(`aria-label="通知"`)が `${base}/news` へ遷移。`/notifications/unread` の件数で赤い `Indicator` を出す。`[campaign]/layout.tsx` が全ページに適用 |

### 2.2 既存画面との関係(選択肢) [未決、オーナー判断。推奨は案 A]
既存コードを変更しない前提で比較する。

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A(推奨) | グループ通知は別画面 `/[campaign]/groups/notifications`。グループ系ページ共通ヘッダーに専用のベル+未読バッジ(`NotificationBell`)を置く。既存のベル/`news` は無変更 | 既存コード無変更で完結。既存の固定モックと混ざらず、試験・説明が単純 | ベルが 2 つ(全体のお知らせ/グループ通知)になり、利用者が両者を区別する必要がある。グループ系ページ以外ではグループ通知のバッジが出ない |
| B | 既存 `news` 画面にタブ(お知らせ/グループ通知)を足し、AppShell のバッジを合算する | ベルが 1 つで自然 | `news/page.tsx` と `AppShell.tsx` の変更が必要(「既存は変更しない」方針と衝突)。既存の固定 `unread=1` が常に残るためバッジが消えない |
| C | 案 A で作り、デモで見せる段階で B の最小改修(AppShell で件数合算、news に導線 1 行)を別タスクで行う | 実装リスクを分離できる | 既存改修の承認が別途必要 |

- [案] 本書は案 A で設計する。案 C へ移行しても本書の API・コンポーネントはそのまま使える(`NotificationBell` と `NotificationList` を再利用)。
- 既存 `/api/v2/notifications` は呼ばず、型・ID も共有しない(既存は数値 ID、本モジュールは文字列 ID)。画面上のお知らせ(運営からの案内)とグループ通知(本書)は別物として文言で区別する。

## 3. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| グループ通知一覧 | 「通知の一覧」(柱18) | `/[campaign]/groups/notifications`(`app/src/app/[campaign]/groups/notifications/page.tsx`) |
| 未読バッジ付きベル | 04 章に明記なし。一覧への入口として追加 | グループ系ページ共通ヘッダー(`NotificationBell`) |
| 通知からの遷移 | 通知 → グループ詳細/承認画面/チャット等 | 第 7.4 節 |

詳細は第 14 章。

## 4. 通知の種類(NTF-KIND)

### 4.1 種類一覧 [決定(上の 8 種類は docs/design 05 章)/案(追加 5 種類)]

docs/design 05 章の 8 種類は全て含める。05 章にない 5 種類は、骨子(03、06、04)が通知を要求しているため追加する案で、05 章への追加要否は第 17 章に挙げる。

| # | 種類(`kind`) | 05 章 | 優先度 | 発行元 |
|---|---|---|---|---|
| 1 | `min_reached` 最少人数到達 | 8 種類の 1 | S | 04 |
| 2 | `withdraw_period_started` 辞退期間の開始 | 8 種類の 2 | S | 04 |
| 3 | `withdraw_period_ending` 辞退期間の終了(まもなく確定) | 8 種類の 3 | S | 04 |
| 4 | `confirmed` 実行確定(実際の人数と参加者の概要つき) | 8 種類の 4 | S | 04 |
| 5 | `cancelled` 中止 | 8 種類の 5 | S | 04 |
| 6 | `replan_invited` 再企画の案内 | 8 種類の 6 | S | 04 |
| 7 | `withdrawal_received` 辞退の受付(幹事向け) | 8 種類の 7 | A | 04(辞退の操作の所有は 04 [要確認]) |
| 8 | `conditions_changed` 条件変更(最少人数・締切) | 8 種類の 8 | A | 04 |
| 9 | `join_requested` 参加申請の受付(幹事向け) | 追加 | S | 03 |
| 10 | `join_approved` 参加申請の承認 | 追加 | S | 03 |
| 11 | `join_rejected` 参加申請の却下(見送り) | 追加 | S | 03 |
| 12 | `chat_new` チャットの新着 | 追加 | B | 06 |
| 13 | `deadline_near` 締切接近 | 追加(00 骨子の「締切接近」) | B | 04 |

### 4.2 種類ごとの宛先・タイミング・文面・リンク(NTF-TPL)

テンプレート中の `{名前}` はパラメータの差し込み位置で、それ以外は固定文言とする。個人名・チャット本文・連絡先・性別は含めない。差し込み値は `renderNotification` が `params` から作る。数値はそのまま、日時(`withdrawUntil`、`deadline`)は `formatJst` で日本時間 `M月D日 H:mm`、`{changes}` は下記の連結文、`{summaryText}` は第 11.3 節の概要文字列(個人が特定されない粒度)とする。テンプレートのキーと差し込み値のキーは一致させる(不一致はプログラム誤りとして例外。第 9.2 節)。

| kind | 誰に(`recipients`) | いつ(発行契機) | タイトル | 本文テンプレート | リンク先(`link.view`) |
|---|---|---|---|---|---|
| `min_reached` | グループの参加中メンバー全員(幹事含む) | 04 が状態を「最少人数到達」にしたとき | 最少人数に達しました | 「{groupTitle}」が最少人数({minParticipants}人)に達しました。現在{count}人です。まだ実行確定ではありません。 | `detail` |
| `withdraw_period_started` | 参加中メンバー全員 | 04 が締切到来で状態を「辞退期間」にしたとき | 辞退期間が始まりました | 「{groupTitle}」の辞退期間が始まりました。{withdrawUntil}までペナルティなしで辞退できます。現在{count}人です。 | `detail` |
| `withdraw_period_ending` | 参加中メンバー全員 | 04 が辞退期間の終了を判定したとき(確定直前) | まもなく実行確定します | 「{groupTitle}」の辞退期間が終わります。まもなく実行が確定します。現在{count}人です。 | `detail` |
| `confirmed` | 参加中メンバー全員 | 04 が状態を「実行確定」にしたとき | 実行が確定しました | 「{groupTitle}」の実行が確定しました。参加は{count}人です。参加者の概要: {summaryText} | `detail` |
| `cancelled` | 参加中メンバー全員+申請中の申請者(`pendingApplicants`。扱いは 03/04 の未決 [未決]) | 04 が状態を「中止」にしたとき | 中止になりました | 理由別(下表)。末尾に「日程などを見直して再企画できます。」 | `detail` |
| `replan_invited` | 元グループの参加中メンバー(再企画した幹事本人を除く。辞退者は除く [未決 #23]) | 04 の `replan` が新グループを作ったとき | 再企画のご案内 | 「{groupTitle}」を見直して、新しい募集が始まりました。参加するには、もう一度お申し込みください。 | `detail`(新グループ。`link.groupId` = `newGroupId`) |
| `withdrawal_received` | 幹事のみ(`organizer`) | 参加者が辞退したとき | 辞退を受け付けました | 「{groupTitle}」で辞退がありました。現在{count}人(最少{minParticipants}人)です。 | `detail` |
| `conditions_changed` | 参加中メンバー全員 | 幹事が最少人数・締切を変更したとき | 募集の条件が変わりました | 「{groupTitle}」の条件が変わりました。{changes} | `detail` |
| `join_requested` | 幹事のみ | 03 の `requestJoin` 成功時 | 参加申請が届いています | 「{groupTitle}」に参加申請があります。未対応は{pendingCount}件です。 | `requests` |
| `join_approved` | 申請者のみ(`users`) | 03 の `approve` 成功時 | 参加が承認されました | 「{groupTitle}」への参加が承認されました。メンバーとして利用できます。 | `detail` |
| `join_rejected` | 申請者のみ | 03 の `reject` 成功時 | 申請の結果 | 「{groupTitle}」への参加申請は、今回は見送りとなりました。ほかのグループもご覧ください。 | `list` |
| `chat_new` | 参加中メンバー(送信者本人とブロック関係の相手を除く) | 06 の `postMessage` 成功時(1 件に集約。第 6.4 節) | チャットに新着があります | 「{groupTitle}」に新しいメッセージが{count}件あります。 | `chat` |
| `deadline_near` | 参加中メンバー全員 | 04 の遅延評価で「締切 24 時間前以内」を初めて検出したとき [案、24 時間は未決] | 締切が近づいています | 「{groupTitle}」の締切は{deadline}です。現在{count}人(最少{minParticipants}人)です。 | `detail` |

`cancelled` の理由別本文 [案、理由は 04 の状態と対応]:

| `reason` | 本文(`{groupTitle}` `{minParticipants}`) |
|---|---|
| `min_not_reached` | 「{groupTitle}」は、締切までに最少人数({minParticipants}人)に達しなかったため、自動で中止になりました。 |
| `organizer_cancelled` | 「{groupTitle}」は、幹事の操作により中止になりました。 |
| `withdrawals_below_min` | 「{groupTitle}」は、辞退により最少人数({minParticipants}人)を下回ったため、中止になりました。 |

`min_not_reached` と `withdrawals_below_min` では `params.minParticipants` を必須とする(第 9.1 節)。

`conditions_changed` の `{changes}`: 変更項目ごとに連結。最少人数: 「最少人数が{from}人から{to}人になりました。」/締切: 「締切が{from}から{to}になりました。」(ともに日本時間表記)。変更が無い項目は含めない。

載せないもの(NTF-RULE-01): 申請者・辞退者・送信者・参加者の氏名/表示名/ID、チャット本文、ひとこと、却下理由、連絡先、性別。`join_rejected` に却下理由を入れるか(12 #15)は [未決]。入れる場合も定型 ID から作る固定文のみとする。

## 5. データ(05 章)

### 5.1 型定義(NTF-TYPE)
`app/src/features/notify/types.ts`

```ts
export const NOTIFICATION_KINDS = [
  "min_reached", "withdraw_period_started", "withdraw_period_ending", "confirmed",
  "cancelled", "replan_invited", "withdrawal_received", "conditions_changed",
  "join_requested", "join_approved", "join_rejected", "chat_new", "deadline_near",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export type CancelReason = "min_not_reached" | "organizer_cancelled" | "withdrawals_below_min";

/** 全 kind 共通。グループ名は発行時点のスナップショット(sanitize 済み、1〜40 文字)。 */
interface Base { groupTitle: string }

export interface ParamsByKind {
  min_reached: Base & { minParticipants: number; count: number };
  withdraw_period_started: Base & { count: number; withdrawUntil: string /* ISO 8601 */ };
  withdraw_period_ending: Base & { count: number };
  /** summaryText は notify が 09 memberSummary から設定する。呼び出し側は渡さない。 */
  confirmed: Base & { count: number; summaryText?: string };
  /** minParticipants は reason が min_not_reached / withdrawals_below_min のとき必須(第 9.1 節)。 */
  cancelled: Base & { reason: CancelReason; minParticipants?: number };
  replan_invited: Base & { newGroupId: string };
  withdrawal_received: Base & { count: number; minParticipants: number };
  conditions_changed: Base & {
    minParticipants?: { from: number; to: number };
    deadline?: { from: string; to: string }; /* ISO 8601 */
  };
  join_requested: Base & { pendingCount: number };
  join_approved: Base;
  join_rejected: Base;
  chat_new: Base & { count: number };
  deadline_near: Base & { deadline: string; count: number; minParticipants: number };
}
export type ParamsOf<K extends NotificationKind> = ParamsByKind[K];

/** Store.notifications の要素(05 章 Notification と対応)。 */
export interface GroupNotification<K extends NotificationKind = NotificationKind> {
  id: string;               // newId("n")。例 "n-012"(形式は 00 の newId に従う)。検証は ^[a-z0-9-]{1,40}$
  userId: string;           // 宛先ダミーユーザー ID
  kind: K;
  groupId: string;          // 対象グループ。replan_invited は「元グループ」
  params: ParamsOf<K>;      // 本文に埋める値のみ。個人情報・自由入力本文は持たない
  dedupeKey: string;        // 第 6.3 節。同一イベントの二重発行防止
  createdAt: string;        // ISO 8601(clock.now())。chat_new は集約のたびに更新
  readAt: string | null;    // null = 未読。ISO = 既読
}

export type NotificationView = "detail" | "requests" | "chat" | "members" | "list";

/** API が返す形。userId・params・dedupeKey は返さず、サーバーで描画済みの文面を返す。 */
export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  groupId: string;
  title: string;            // プレーンテキスト(HTML ではない)
  body: string;             // プレーンテキスト
  link: { groupId: string; view: NotificationView };
  createdAt: string;
  read: boolean;
}

export interface NotificationPage {
  items: NotificationDto[];
  nextCursor: string | null;
  unreadCount: number;
}
```

### 5.2 保存先
| エンティティ | 項目 | 保存先 |
|---|---|---|
| Notification | 上の `GroupNotification` | `Store.notifications: GroupNotification[]`(00 の `groups-store.ts`。配列は作成順。`globalThis` インメモリ) |
- 05 章の項目(通知ID、宛先、種類、グループID、本文=定型文+値、作成日時、既読)と対応する。追加は `dedupeKey`(冪等性)と `readAt`(既読日時。真偽値より情報が多く、バッジ計算は `readAt === null`)。 [案]
- `resetStore()`(00)で seed に戻る。seed には、デモ用に各ダミーユーザー 0〜4 件の通知を `group-seed.json` へ置く(同じ `GroupNotification` 形式、`createdAt` は seed 基準日)。 [案、00 への要望 R-1]
- 通知にはユーザー ID を宛先以外に持たない(送信者・申請者・辞退者の ID を保存しない)。したがって API・画面から他者を特定できない。 [決定した設計制約]

## 6. インターフェース

### 6.1 公開関数(他モジュールが呼ぶ)

`app/src/features/notify/index.ts` から再エクスポートする。他モジュールは `@/features/notify` だけを import する。

```ts
export type RecipientSpec =
  | { type: "users"; userIds: string[] }                              // 指定ユーザー(申請者のみ 等)
  | { type: "groupMembers"; groupId: string; excludeUserIds?: string[] } // 参加中メンバー全員(幹事含む)
  | { type: "organizer"; groupId: string }                            // 幹事のみ
  | { type: "pendingApplicants"; groupId: string };                   // 申請中の申請者

export interface NotifyInput<K extends NotificationKind = NotificationKind> {
  kind: K;
  groupId: string;
  /** 同一イベントを識別する呼び出し側のキー。第 6.3 節の表に従う。^[A-Za-z0-9:_.@+-]{1,80}$ */
  eventKey: string;
  params: ParamsOf<K>;
  recipients: RecipientSpec[];
}

export interface NotifyResult {
  created: GroupNotification[];     // 新規作成(または chat_new の集約更新)
  skippedDuplicate: string[];       // dedupeKey 重複でスキップした宛先 userId
  recipientCount: number;           // 解決後の宛先数(重複除去後)
}
```

| ID | 関数 | 引数 | 戻り値 | 例外(`AppError`) | 呼び出し元 |
|---|---|---|---|---|---|
| NTF-FN-01 | `notify<K>(input: NotifyInput<K>): NotifyResult` | 上記 | `NotifyResult` | `invalid_input`(未知の kind、params 検証違反、eventKey 形式不正)、`not_found`(groupId が存在しない) | 03、04、06 |
| NTF-FN-02 | `listNotifications(user: DemoUser, opts?: { limit?: number; cursor?: string; unreadOnly?: boolean; groupId?: string }): NotificationPage` | `limit` 既定 30・最大 100。取得前に `pruneNotifications(user.id, clock.now())` を実行 | `NotificationPage`(新しい順) | `invalid_input`(limit 範囲外、cursor 不明) | GET API |
| NTF-FN-03 | `unreadCount(user: DemoUser): number` | - | 未読件数(`readAt === null`) | なし | GET API、`NotificationBell` |
| NTF-FN-04 | `markRead(user: DemoUser, id: string): NotificationDto` | 通知 ID | 既読後の DTO(既に既読でも成功、`readAt` は変えない) | `not_found`(存在しない/他人の通知。区別しない)、`invalid_input`(ID 形式) | POST API |
| NTF-FN-05 | `markAllRead(user: DemoUser, groupId?: string): number` | 任意でグループ絞り込み | 既読にした件数 | `invalid_input`(ID 形式) | POST API |
| NTF-FN-06 | `renderNotification(n: GroupNotification): { title: string; body: string; link: NotificationDto["link"] }` | - | 描画済み(純粋関数) | `Error`(未知の kind、差し込み値の不足。プログラム誤りとして扱い、API では `internal`) | 内部、試験 |
| NTF-FN-07 | `resolveRecipients(specs: RecipientSpec[]): string[]` | - | 重複除去済み userId 配列(昇順) | `not_found`(groupId なし) | `notify` 内部 |
| NTF-FN-08 | `pruneNotifications(userId: string, now: Date): number` | - | 削除件数 | なし | `notify`、`listNotifications` |

挙動の要点:
- `notify` は同期関数とする(ストアがインメモリのため)。呼び出し側は状態の更新を終えた後、処理の最後に呼ぶ。`notify` の `invalid_input` は呼び出し側のプログラム誤りを示すため、呼び出し側でキャッチせず上位へ伝える(デモでは画面にエラーが表示される)。 [案]
- `confirmed` では `notify` が `09.memberSummary(...)` を呼んで `summaryText` を設定する(第 11.3 節)。
- `markRead` の「他人の通知」は `forbidden` ではなく `not_found` を返し、他人の通知が存在するかどうかを応答から判別できないようにする。 [案、骨子は not_found/forbidden]
- ユーザーは必ず `currentUser(req)`(00)で取得する。クライアントが userId を渡す API はない。

### 6.2 `notify` の処理順(NTF-FN-01)
1. `kind` が `NOTIFICATION_KINDS` に含まれるか、`eventKey` が形式に合うかを検証。
2. `params` を kind ごとの検証器(第 9 章)で検証し、`groupTitle` を `sanitizeText` で正規化(新しいオブジェクトを作る。入力は変更しない)。
3. `groupId` が `Store.groups` に存在するか確認(なければ `not_found`)。
4. `resolveRecipients` で宛先を解決(重複除去、`excludeUserIds` を除外)。0 件なら `recipientCount: 0` で終了(エラーにしない)。
5. `confirmed` のみ `summaryText` を 09 から取得して `params` に追加。
6. 宛先ごとに `dedupeKey = [kind, groupId, userId, eventKey].join(":")` を計算。`chat_new` 以外で同じ `dedupeKey` が既にあれば `skippedDuplicate` に入れて次へ。`chat_new` は第 6.4 節の集約。
7. `GroupNotification` を作成し `Store.notifications` に追加(`createdAt = clock.now().toISOString()`、`readAt = null`)。
8. 宛先ごとに `pruneNotifications` を実行。`NotifyResult` を返す。

### 6.3 冪等性: eventKey の付け方(NTF-IDEM)
同じイベントで `notify` が 2 回呼ばれても、通知は 1 件だけ作る(04 の遅延評価で `evaluate` が複数回実行されるため)。同じグループでも別イベント(2 件の申請など)は別の `eventKey` にする。

| kind | `eventKey` | 備考 |
|---|---|---|
| `min_reached` | `reached` | グループにつき 1 回。人数が減って再到達しても再通知しない [案] |
| `withdraw_period_started` | `wp-start` | |
| `withdraw_period_ending` | `wp-end` | |
| `confirmed` | `confirmed` | |
| `cancelled` | `cancelled` | |
| `replan_invited` | `replan:<newGroupId>` | 同じ元グループから複数回再企画しても各 1 回 |
| `withdrawal_received` | `wd:<辞退の記録 ID(05 章 GroupWithdrawal の ID)>` | 辞退ごと。辞退者の userId は使わない(`dedupeKey` に宛先以外のユーザー ID を残さないため。第 5.2 節) |
| `conditions_changed` | `cond:<04 が採番する変更の通し番号>` | 変更ごと。同じ値へ戻す変更も別の通知にする |
| `join_requested` | `jr:<requestId>` | |
| `join_approved` | `ja:<requestId>` | |
| `join_rejected` | `jx:<requestId>` | |
| `chat_new` | `chat`(無視される。集約) | 第 6.4 節 |
| `deadline_near` | `dl:<締切のISO>` | 締切が延長されたら別キー(再通知) |

### 6.4 `chat_new` の集約(NTF-COALESCE)
チャットはメッセージ数が多いため、1 メッセージにつき 1 通知にはしない。同じ (宛先, グループ) に未読の `chat_new` が既にある場合は、新規作成せず既存の `params.count` に加算し(上限 999。超える分は加算しない)、`createdAt` を現在時刻に更新して配列末尾へ移す(新しい順の一覧で先頭に表示される)。既読後の次のメッセージは新規作成。送信者本人には通知しない(06 が `excludeUserIds` に自分と、09 `isBlocked` の相手を入れる)。

### 6.5 宛先の解決(NTF-FN-07)
`Store.members` / `Store.joinRequests` を読み取り専用で参照する(01/03 の関数を経由しない。00 の Store 型が契約。 [案])。

| spec | 解決規則 |
|---|---|
| `groupMembers` | `groupId` の `GroupMember` のうち状態が「参加中」(幹事含む)。退会・辞退・却下は除く。`excludeUserIds` を除外 |
| `organizer` | `Group.organizerId` の 1 人(参加中でなければ空) |
| `pendingApplicants` | `JoinRequest` の状態が「申請中」の `applicantId` |
| `users` | 指定 ID のうち `Store.users` に存在するもの(存在しない ID は無視) |
- 複数 spec は和集合、重複除去。順序は `userId` の昇順 [案]。
- `Store` のフィールド名(状態文字列、`organizerId`)は 01/03/00 の確定に合わせる。 [要確認]

### 6.6 API(NTF-API)

パスは 00 骨子の「`/api/groups/notifications`」を踏襲する。`app/src/app/api/groups/notifications/` 配下に Route Handler を置く。静的セグメントがキャッチオール `api/groups/[...path]` より優先されると推定する [推定]。Next.js のドキュメントが node_modules に無く未確認のため [要確認]。00 詳細設計(並行作業中)はリソースごとの `route.ts` を案としており、その方式ではキャッチオールとの競合は生じない。グループ ID と衝突しないよう、グループ ID は `g-` 始まりで、`notifications` を予約語として 01 が拒否する(R-3)。
Cookie `demoUser` で現在ユーザーを決める。全 API は `Cache-Control: no-store`(既存 `api.ts` が `cache: "no-store"`)。エラーは `{ error, message? }`(00 の `toResponse`)。Route Handler は 00 の API 共通部(共通ラッパー)を通し、POST(NTF-API-03・04)では `Content-Type: application/json` と `Origin` を検査する(第 9.5 節)。クライアントは本文が無い場合も `{}` を JSON で送る。

| ID | メソッド・パス | リクエスト | 成功レスポンス | エラー |
|---|---|---|---|---|
| NTF-API-01 | `GET /api/groups/notifications` | クエリ: `limit`(1〜100、既定 30)、`cursor`(前回の `nextCursor`)、`unread`(`1` のみ有効)、`groupId`(`^[a-z0-9-]{1,40}$`) | 200 `NotificationPage` | 400 `invalid_input`(`fields` に `limit`/`cursor`/`groupId`) |
| NTF-API-02 | `GET /api/groups/notifications/unread-count` | なし | 200 `{ "count": number }` | なし(本人の件数のみ) |
| NTF-API-03 | `POST /api/groups/notifications/:id/read` | 本文 `{}`(内容は使わない) | 200 `NotificationDto`(`read: true`)。既読済みでも 200 | 404 `not_found`(存在しない/他人。区別しない)、400 `invalid_input`(ID 形式)、403 `forbidden`・415 `unsupported_media_type`(共通ラッパーの CSRF 検査) |
| NTF-API-04 | `POST /api/groups/notifications/read-all` | 本文 `{ "groupId"?: string }` | 200 `{ "updated": number }` | 400 `invalid_input`(`groupId` の形式不正。`fields.groupId`)、403・415(同上) |

- 通知を作る HTTP API は設けない(発行はサーバー内の `notify` のみ)。クライアントから任意の通知を作れないようにする。 [決定した設計制約]
- `GET` 系の前処理: 遅延評価のため `04.evaluateGroupsForUser(user.id, clock.now())` を呼んでから一覧/件数を計算する(R-4)。これにより、通知画面だけを開いている利用者にも、自動中止や辞退期間開始の通知が表示される。
- `cursor` は直前に返した最後の通知の `id`。新しい順(配列の逆順)で、その次から `limit` 件。
- ページ送りの途中で `cursor` の通知が保持規則(第 7.2 節)で削除された場合も `invalid_input` になり、先頭からの再取得で回復する。この場合の利用者向けの個別表示は設けない。 [デモ範囲外]

## 7. 取得方式・バッジ・保持(NTF-RET)

### 7.1 取得方式 [案]
- ポーリング。サーバー送信イベント・WebSocket は使わない(依存ライブラリと実装量を増やさないため)。
- バッジ: `useUnreadCount(intervalMs = 15000)` が `GET …/unread-count` を 15 秒間隔で取得。`document.visibilityState === "hidden"` の間は止め、可視に戻ったとき・ウィンドウ focus 時・ページ遷移時に即時取得。
- 一覧画面: 表示中は 10 秒間隔で先頭ページを再取得(`nextCursor` で読み込み済みの追加ページは保持)。
- 即時反映: グループ系の POST が成功したら `window.dispatchEvent(new Event("ntf:refresh"))` を発火し、バッジが即時再取得する。「日付を進める」(04/00)操作の後も同じイベントを発火する。 [要望 R-5]
- 件数表示は 99 を超えたら「99+」。

### 7.2 保持件数・古い通知 [案]
| 項目 | 値 |
|---|---|
| 1 ユーザーあたり上限 | 100 件。超えたら既読の古い順に削除、それでも超える場合は全体の古い順に削除(`pruneNotifications`) |
| 既読の保持期間 | 14 日(`clock.now()` 基準)を過ぎた既読は削除(`notify` 時と一覧取得時に実行) |
| 未読 | 期間では削除しない(上限のみ) |
| 一覧の件数 | 1 ページ 30 件、続きは「もっと見る」(`cursor`) |
| リセット | `resetStore()` で seed に戻る |
- デモ用の日付を進める操作で既読が一括削除されるのを避けるため、期間判定は `createdAt` ではなく `readAt` からの経過で行う。 [案]

### 7.3 件数(未読バッジ)
未読数 = 宛先ユーザーの `readAt === null` の件数。一覧 API(`unreadCount`)と専用 API の両方で返す。

### 7.4 通知からの遷移(リンク規則)
`link.view` からクライアントが `campaign` を付けてパスを作る(`campaign` は `useParams`)。

| view | パス |
|---|---|
| `detail` | `/${campaign}/groups/${link.groupId}` |
| `requests` | `/${campaign}/groups/${link.groupId}/requests`(03) |
| `chat` | `/${campaign}/groups/${link.groupId}?tab=chat`(06) |
| `members` | `/${campaign}/groups/${link.groupId}/members`(01) |
| `list` | `/${campaign}/groups`(02) |
- リンクは内部パスのみ。外部 URL をパラメータで受けない(オープンリダイレクト防止)。`groupId` は ID 形式検証済みの値だけ使う。遷移先でアクセス権がなければ遷移先(01/02)の `forbidden`/`not_found` 表示に従う(通知側で再判定しない)。

## 8. 状態遷移

- 通知: 未読(`readAt = null`)→ 既読(`readAt = ISO`)のみ。既読から未読には戻さない。`chat_new` のみ、未読の間は集約更新で `count`/`createdAt` が変わる。
- 削除は保持規則(第 7.2 節)による自動削除のみ。ユーザー操作での削除は設けない。 [案]

## 9. 入力検証・セキュリティ(NTF-VAL)

### 9.1 検証規則
| 対象 | 規則 |
|---|---|
| `kind` | `NOTIFICATION_KINDS` のいずれか |
| `groupId`、`newGroupId`、通知 ID、`cursor` | `^[a-z0-9-]{1,40}$` |
| `eventKey` | `^[A-Za-z0-9:_.@+-]{1,80}$` |
| `groupTitle` | 文字列、`sanitizeText` 後 1〜40 文字(超過は 39 文字+「…」に切り詰め) |
| `count`、`pendingCount` | 整数 0〜999(`count` は 1 以上を要する kind もあるが、検証は 0〜999 で統一) |
| `minParticipants`(`from`/`to` を含む) | 整数 1〜99(範囲は 12 #19 の確定に合わせる) |
| `withdrawUntil`、`deadline`(`from`/`to` を含む) | ISO 8601(タイムゾーン付き)として解釈可能な文字列 |
| `reason` | `CancelReason` の 3 値 |
| `conditions_changed` | `minParticipants` と `deadline` の少なくとも一方があること |
| `limit` | 整数 1〜100。非数・範囲外は 400 |
| `unread` | `"1"` のみ有効。それ以外は無視 |
| `cancelled` の `minParticipants` | `reason` が `min_not_reached`・`withdrawals_below_min` のとき必須 |
| `summaryText` | `notify` 内部で設定。1〜80 文字(第 11.3 節)。呼び出し側が渡した場合は `invalid_input` |
| 未知のキー | `params` に定義外のキーがあれば `invalid_input`(未知キーを捨てるのではなく拒否する。自由入力の混入防止) |

### 9.2 テンプレートと XSS 対策(NTF-XSS)
- 通知はプレーンテキストとして描画する。`renderNotification` は文字列を返し、HTML を返さない。画面は `<Text>` で出し、`dangerouslySetInnerHTML` は使わない。リンク化もしない。
- 置換は `tpl.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))` の関数形式のみとする(`$&` 等の特殊置換パターンが効かない)。テンプレートに無いキー、`values` に無いキーはプログラム誤りとして例外。キーの有無は `Object.hasOwn(values, key)` で確認し、プロトタイプのプロパティ(`__proto__`、`constructor` 等)を参照しない。
- `sanitizeText(s)`: 制御文字(U+0000〜U+001F、U+007F)、双方向制御文字(U+202A〜U+202E、U+2066〜U+2069)、ゼロ幅文字(U+200B〜U+200D、U+FEFF)を除去し、前後空白を除き、40 文字で切り詰める。`<` `>` はそのまま保存してよい(React が描画時にエスケープ)。二重エスケープを避けるため、保存時に HTML エスケープしない。 [案]
- 唯一のユーザー入力由来の値は `groupTitle`(幹事が入力、作成時に 09 `checkText` 済み)。他は数値・日時・列挙値のみ。チャット本文やひとことは通知に渡さない(型に存在しない)。

### 9.3 禁止表現・個人特定の防止
- テンプレートは固定文言。静的試験(NTF-T-40)で全テンプレートを 09 `checkText` に通し、かつ「相乗り」「マッチング」「恋愛を連想させる語」が含まれないこと、性別・年齢での絞り込みを連想させる文言がないことを確認する。
- 通知に載せる集計は人数と年代帯の概要のみ(第 11.3 節)。辞退した人・申請者の名前は載せない。 [決定(通知する)/案(粒度)、07 章 論点17]

### 9.4 権限
- 閲覧・既読化は宛先本人のみ。`userId` は `currentUser(req)` から取り、`Store.notifications` の `userId` 一致を必ず確認する(IDOR 対策)。他人の通知 ID は `not_found`。
- 発行はサーバー内の `notify` のみ。呼び出し側(03/04/06)が自分で権限判定した後に呼ぶ。`notify` 自体は権限判定をしない(宛先を機械的に解決するだけ)。
- 宛先解決は「参加中」状態のみ。退会・辞退・却下された人に、グループ内部の情報(人数、概要)を通知しない。

### 9.5 OWASP Top 10 との対応
| 観点 | 本モジュールの対処 |
|---|---|
| アクセス制御・IDOR(A01) | 第 9.4 節。一覧・件数・既読化は `currentUser(req)` の通知だけを対象にし、他人の通知 ID は `not_found`。`read-all` の `groupId` 指定も本人宛の通知の中だけで絞り込む |
| インジェクション(A03) | SQL は使わない。ID・`cursor` は正規表現で検証し、ファイルパス・コードに使わない。テンプレート置換は関数形式で、差し込み値の参照は `Object.hasOwn` で確認(第 9.2 節) |
| XSS | 第 9.2 節。プレーンテキストのみ、`dangerouslySetInnerHTML` 不使用、リンクは内部パスのみ(第 7.4 節) |
| CSRF | 変更系は POST の 2 本(NTF-API-03・04)のみ。00 の共通ラッパーで `Content-Type: application/json` 必須と `Origin` 検査を行い、Cookie は `SameSite=Lax`(00)。GET は利用者の操作による状態変更を行わない(保持規則による自動削除と 04 の遅延評価は行う) |
| 認証・セッション(デモ) | ログインは無く、Cookie `demoUser` で視点を切り替える(00)。Cookie は利用者が書き換えられるため、本番相当の認証ではない(第 9.6 節) |
| セキュリティ設定(A05) | 全応答に `Cache-Control: no-store`。CORS ヘッダは付けない。通知を作る API を公開しない(第 6.6 節)。許可外メソッドは 405 |
| 機密データの扱い(A02) | 通知に個人名・連絡先・チャット本文・ひとことを持たない(NTF-RULE-01、第 5.2 節)。DTO は `userId`・`params`・`dedupeKey` を返さない |
| ログ(A09) | サーバーログは requestId、kind、通知 ID、エラーコードのみ。`groupTitle`・本文・Cookie の値は出さない |

### 9.6 既知の制約
- Cookie `demoUser` を書き換えると他のダミーユーザーの通知を閲覧できる(ログイン不要のデモの前提。対策は設計しない)。
- 通知 ID は連番のため推測できる。他人の ID への操作は `not_found` になるが、件数の推測は防がない。
- ポーリングによる負荷、人数の変化の差分から参加者を推測される可能性(09)は、デモ規模のため対策を設計しない。

## 10. エラー処理

| コード | 発生条件 | HTTP | 画面での表示・挙動 |
|---|---|---|---|
| `invalid_input` | API: `limit`/`cursor`/`groupId`/通知 ID の形式不正、`read-all` の本文不正(`fields` に項目名)。関数: `notify` の kind・eventKey・params の検証違反(呼び出し側のプログラム誤り) | 400 | 通常の画面操作では発生しない。一覧画面では下の `internal` と同じエラー表示を出す |
| `not_found` | 存在しない通知・他人の通知の既読化(区別しない)。`notify` の `groupId` が存在しない | 404 | 一覧画面: 「この通知は見つかりません」を表示し、一覧を再取得する。通知をクリックした場合は遷移を続ける(NTF-T-52) |
| `forbidden` | POST の `Origin` が `Host` と異なる(00 の共通ラッパー) | 403 | 通常の画面操作では発生しない。「画面を再読み込みしてやり直してください」 |
| `unsupported_media_type` | POST の `Content-Type` が `application/json` でない(00 の共通ラッパー) | 415 | 同上 |
| `method_not_allowed` | 許可外のメソッド(例: `POST /api/groups/notifications`) | 405 | 画面からは発生しない |
| `internal` | 想定外の例外(描画時のテンプレート不整合 等) | 500 | 一覧画面: 「通知を読み込めませんでした。再読み込みしてください」+ 再試行ボタン |
| `network`(クライアントのみ) | 通信失敗、応答が JSON でない | - | `internal` と同じ |

- 本モジュールで発生しないコード: 権限なしは `forbidden` ではなく `not_found` で返す(第 9.4 節)。既読化は冪等で前提となる状態が無いため、状態不正(`unavailable_state`)と競合(`conflict`)は使わない。
- 既読化(楽観更新)が失敗した場合は、一覧の該当行を未読表示に戻す。
- 一覧取得が失敗しても、既存の画面(グループ詳細等)は操作できる状態を保つ。`NotificationBell` の取得に失敗した場合は、エラーを表示せず、バッジに前回取得した件数を表示し続ける。
- 通知の描画失敗(1 件)で一覧全体を失敗させない: `renderNotification` が例外を出した行は汎用文面「新しい通知があります」を表示し、サーバーログに kind と ID のみ記録する。 [案、デモ範囲外]

## 11. 他モジュールとの契約

### 11.1 本モジュールを呼ぶ側(呼び出しの具体形)
```ts
// 03 requestJoin 成功後(幹事へ)
notify({ kind: "join_requested", groupId, eventKey: `jr:${req.id}`,
  params: { groupTitle: g.title, pendingCount },
  recipients: [{ type: "organizer", groupId }] });
// 03 approve 成功後(申請者へ)
notify({ kind: "join_approved", groupId, eventKey: `ja:${req.id}`,
  params: { groupTitle: g.title }, recipients: [{ type: "users", userIds: [req.applicantId] }] });
// 04 実行確定時(メンバー全員へ。summaryText は notify が付与)
notify({ kind: "confirmed", groupId, eventKey: "confirmed",
  params: { groupTitle: g.title, count }, recipients: [{ type: "groupMembers", groupId }] });
// 06 postMessage 後(送信者・ブロック関係を除く)
notify({ kind: "chat_new", groupId, eventKey: "chat",
  params: { groupTitle: g.title, count: 1 },
  recipients: [{ type: "groupMembers", groupId, excludeUserIds: [sender.id, ...blockedIds] }] });
```

### 11.2 本モジュールが呼ぶ側(依存)
| 呼び先 | 関数 | 用途 |
|---|---|---|
| 00 | `store()`(`notifications`、`members`、`groups`、`joinRequests`)、`currentUser(req)`、`clock.now()`、`newId("n")`、`AppError`/`toResponse`、日時整形 `formatJst(iso, pattern)` [要望 R-2] | 全般 |
| 09 | `memberSummary(members)`(確定時の概要)、`checkText`(試験のみ) | 第 11.3 節、NTF-T-40 |

### 11.3 参加者の概要(確定通知)と 09 の公開範囲ガード
- `notify` が `confirmed` を作る直前に、宛先と同じ参加中メンバーを `09.memberSummary(members)` に渡し、返った表示用文字列(例: 「20代〜30代が中心」「人数のみ」)を `params.summaryText` に保存する(発行時点のスナップショット)。通知側で年代帯を再集計・分類しない。
- 少人数(例: 2〜3 人)で分布だけで個人が推測されうる場合の丸めは 09 の責務(07 章 論点17)。09 が「人数のみ」を返した場合、`summaryText` には固定文「人数のみ(年代の内訳は表示しません)」を入れる。 [案、09 の返り値は R-6]
- `summaryText` は長さ 1〜80 文字に検証する。`memberSummary` が例外を投げた場合、または空文字を返した場合も、`summaryText` に同じ固定文「人数のみ(年代の内訳は表示しません)」を入れる(個人を推測できる情報を出さないため)。

### 11.4 他モジュールへの要望
| ID | 宛先 | 要望 |
|---|---|---|
| R-1 | 00 | `Store.notifications: GroupNotification[]`(本書の型)と、`group-seed.json` に初期通知(各ユーザー 0〜4 件)。`newId("n")`。`resetStore()` で通知も初期化 |
| R-2 | 00 | `lib/clock.ts` に日本時間表記の整形関数 `formatJst(iso: string, pattern?: string): string`(dayjs)。`clock.now()` は `Date` を返す前提 |
| R-3 | 00/01 | グループ ID は `^g-[a-z0-9-]+$` とし、`notifications` などをグループ ID に使えないよう予約。ルートの競合確認(`api/groups/notifications` 対 `api/groups/[...path]`) |
| R-4 | 04 | `evaluateGroupsForUser(userId: string, now: Date): void`: 利用者が所属・申請中のグループを遅延評価し、必要なら 04 内で `notify` を呼ぶ。通知 GET の前に 10 が呼ぶ |
| R-5 | 00/04 | グループ系 POST 成功時とデモの日付変更操作の後に `window.dispatchEvent(new Event("ntf:refresh"))` を発火(クライアント共通の fetch ラッパーで 1 箇所に) |
| R-6 | 09 | `memberSummary(members: GroupMember[]): { text: string; coarse: boolean }`(`coarse`=人数のみに丸めたか)。2〜3 人など少人数の丸め規則を 09 が持つ |
| R-7 | 01/02 | グループ系ページ共通レイアウト(`app/src/app/[campaign]/groups/layout.tsx`)のヘッダーに `NotificationBell` を置く。レイアウトの所有者を 01 または 02 に決め、10 は部品(`@/features/notify/ui`)のみ提供 |
| R-8 | 03 | `reject` で却下理由を通知に出す場合は定型理由 ID と固定文の対応表を 03 が持つ(出さない場合は不要) |
| R-9 | 04 | 辞退の操作・辞退の記録(05 章 GroupWithdrawal)の所有者を決め、`withdrawal_received` を呼ぶ側にする |
| R-10 | 04 | `cancelled` 発行時に申請中の申請者(`pendingApplicants`)を宛先に含める可否の決定(03 の未決と共通) |

## 12. 試験観点(10 章)と受け入れ条件(NTF-T)

共通の前提: `resetStore()` 後の seed。ダミーユーザー A(幹事)、B・C(メンバー)、D(申請者)。グループ G(最少 3、定員 6)。単体試験は関数を直接呼ぶ。テストランナーは 00 の決定に従う(00 詳細設計の案は Vitest。第 15.2 節)。HTTP 試験は Cookie `demoUser` を切り替えて行う。

### 12.1 発行・宛先・冪等性
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-01 | D が G に申請 → `notify(join_requested, organizer)` | A に 1 件(`readAt = null`)。B・C・D には作られない。本文に D の名前がない |
| NTF-T-02 | 03 の `approve` → `join_approved`(users:[D]) | D に 1 件。A には作られない。`link.view = "detail"` |
| NTF-T-03 | `reject` → `join_rejected` | D に 1 件。本文に却下理由が含まれない。`link.view = "list"` |
| NTF-T-04 | 最少人数到達(`min_reached`、groupMembers) | A、B、C に各 1 件。`count`/`minParticipants` が本文に入る。D(非メンバー)には作られない |
| NTF-T-05 | 同じ `eventKey="reached"` で `notify` を 2 回 | 2 回目は `created=[]`、`skippedDuplicate` に全宛先。`Store.notifications` 件数は増えない |
| NTF-T-06 | 異なる `eventKey`(`jr:r1` と `jr:r2`)で 2 回 | 2 件作成される |
| NTF-T-07 | 実行確定 `confirmed`(メンバー 3 人) | 3 人に各 1 件。本文に件数と 09 の概要文字列。名前・ID・性別なし |
| NTF-T-08 | `confirmed` で `memberSummary` が少人数丸めを返す(2 人) | 本文に年代の分布が出ず、概要が「人数のみ(年代の内訳は表示しません)」になる |
| NTF-T-09 | `cancelled`(reason `min_not_reached`、メンバー 2 人+申請中 1 人。宛先に `pendingApplicants` を含める場合。R-10) | 3 人に各 1 件、本文が理由別テンプレートに一致 |
| NTF-T-10 | 中止後に再企画 → `replan_invited`(元メンバー 3 人。再企画した幹事 A を除く) | B、C のみ。`link.groupId = newGroupId`、通知の `groupId` は元グループ |
| NTF-T-11 | 辞退後に `withdrawal_received` | A のみ。本文に辞退者名がない。現在人数が正しい |
| NTF-T-12 | 辞退済み・退会済みメンバーを含むグループへ `min_reached` | 参加中のみ受信 |
| NTF-T-13 | `conditions_changed`(締切のみ変更)/(最少人数のみ)/(両方なし) | 前 2 つは該当文のみ本文に出る。3 つ目は `invalid_input` |
| NTF-T-14 | `chat_new` を B が送信 → A、C へ(B を除外) | A、C に各 1 件。B に作られない |
| NTF-T-15 | 続けて 2 通目(A が未読のまま) | A の `chat_new` は 1 件のまま `count=2`、`createdAt` 更新、一覧の先頭。A が既読にした後の 3 通目は新規 1 件 |
| NTF-T-16 | `excludeUserIds` に B と相互ブロックの C | C に作られない |
| NTF-T-17 | `deadline_near` を同じ締切で 2 回/締切延長後 | 前者は 1 件、後者は新キーで再通知 |
| NTF-T-18 | `recipients` が空または全員除外 | 例外なし、`recipientCount = 0`、通知増えない |

### 12.2 取得・既読・件数・権限
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-20 | A で `GET /api/groups/notifications` | A 宛のみ、新しい順。各要素に `title`/`body`/`link`/`read`。`params`・`userId`・`dedupeKey` を含まない |
| NTF-T-21 | B に切り替えて同 GET | B 宛のみ(A 宛の通知 ID が出ない) |
| NTF-T-22 | 未読 3 件の A で `unread-count` | `{count:3}` |
| NTF-T-23 | A が通知 1 件に `POST …/:id/read` | 200、`read:true`。`unread-count` が 2 |
| NTF-T-24 | 同じ通知にもう一度 `read` | 200、`readAt` 不変、件数不変 |
| NTF-T-25 | B が A の通知 ID に `read` | 404 `not_found`。A の通知は未読のまま |
| NTF-T-26 | 存在しない ID `n-999999` | 404 `not_found`。ID が `../x`(形式不正) は 400 `invalid_input` |
| NTF-T-27 | `read-all`(グループ指定なし) | `updated` = 未読数。以後 `unread-count = 0` |
| NTF-T-28 | `read-all` に `groupId = G` | G の通知のみ既読。他グループの通知は未読 |
| NTF-T-29 | `?unread=1` | 未読のみ |
| NTF-T-30 | `?limit=0`、`?limit=101`、`?limit=abc`、不明な `cursor` | いずれも 400 `invalid_input` |
| NTF-T-31 | 通知 35 件で `limit` 省略 → `nextCursor` で続き | 1 回目 30 件+`nextCursor`、2 回目 5 件+`nextCursor:null`。重複・欠落なし |
| NTF-T-32 | `resetStore()` | 通知が seed の状態に戻る |
| NTF-T-33 | `POST /api/groups/notifications`(作成を試みる) | 405 または 404。通知を作る API はない |
| NTF-T-34 | `POST …/:id/read` を (a) `Content-Type: text/plain` (b) `Origin: http://evil.example` で送る | (a) 415 (b) 403。いずれも通知は未読のまま |

### 12.3 保持・テンプレート・安全
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-35 | 1 ユーザーに 101 件発行 | 100 件に保たれ、既読の古い順に削除。全て未読なら全体の最古を削除 |
| NTF-T-36 | 既読後 15 日経過(`clock.set`)で `notify`/一覧 | その既読は削除。未読は残る |
| NTF-T-37 | `groupTitle = "<script>alert(1)</script>"` で発行 → 画面表示 | DOM に `<script>` 要素が生成されず、文字列としてそのまま表示される |
| NTF-T-38 | `groupTitle = "$&$1‮\u0000あ"` | 描画結果に `$&` がそのまま出て二重展開なし。制御・双方向制御文字が除去される |
| NTF-T-39 | `groupTitle` 41 文字以上/空/空白のみ | 39 文字+「…」へ切り詰め/`invalid_input`/`invalid_input` |
| NTF-T-40 | 全 13 種類 × 全理由のテンプレートを 09 `checkText` と禁止語リスト(相乗り、マッチング、恋愛連想語)で走査 | 違反 0 件 |
| NTF-T-41 | `params` に未定義キー(`message: "..."`)を渡す | `invalid_input`(自由入力の混入を拒否) |
| NTF-T-42 | `count = -1`、`1.5`、`1000`、`"3"` | いずれも `invalid_input` |
| NTF-T-43 | 既存 `/api/v2/notifications` と `/api/v2/notifications/unread` | 本機能の追加前後で応答が同一(固定 1 件、`count:1`) |
| NTF-T-44 | 全 kind の本文・API 応答の文字列を検索 | 申請者名・辞退者名・送信者名・チャット本文・ひとことが含まれない |

### 12.4 画面(手動確認 または E2E)
| ID | 手順 | 期待結果 |
|---|---|---|
| NTF-T-50 | 未読 0 件のユーザーで通知画面 | 空状態の文言と「グループを探す」リンクが出る(第 14.3 節) |
| NTF-T-51 | 未読 3 件でグループ一覧を開く | ベルに「3」のバッジ。`aria-label` が「グループの通知(未読3件)」 |
| NTF-T-52 | 未読の通知をクリック | 既読になり、リンク先(第 7.4 節)へ遷移。既読化に失敗しても遷移する |
| NTF-T-53 | 別タブ(幹事)で承認 → 申請者タブで 15 秒以内 | バッジが増える(ポーリング)。画面を手動更新しなくても反映 |
| NTF-T-54 | 「日付を進める」で締切を超えて中止 | `ntf:refresh` 後に中止の通知がバッジに反映(遅延評価経由) |
| NTF-T-55 | キーボードのみで一覧を操作(Tab、Enter) | 全項目・ボタンに到達・操作可能。フォーカスが見える |
| NTF-T-56 | スマホ幅(幅 360px) | 横スクロールなし。タップ領域 44px 以上 |
| NTF-T-57 | ネットワーク失敗(API 500) | エラー文言と再試行ボタン。既存画面は使える |

## 13. 実装タスク(NTF-TASK)

規模: S=半日以内、M=1 日程度、L=複数日。「前提」は先に完了が必要なタスク。00 の項目は 00 の実装に依存。

| ID | タスク | 規模 | 前提 | 完了条件 |
|---|---|---|---|---|
| NTF-TASK-01 | 型定義 `features/notify/types.ts`(第 5.1 節)と種類のメタ情報(`kinds.ts`: kind ごとの `defaultView`、宛先の既定) | S | 00 の Store 型 | `tsc` が通る |
| NTF-TASK-02 | 文言 `features/notify/messages.ts`(第 4.2 節のテンプレート)、`render.ts` の `fillTemplate`・`formatChanges`、`params.ts` の `sanitizeText` | S | NTF-TASK-01 | NTF-T-37〜39 の単体が通る |
| NTF-TASK-03 | パラメータ検証 `features/notify/params.ts`(第 9.1 節、未知キー拒否) | M | NTF-TASK-01 | NTF-T-41・42 |
| NTF-TASK-04 | `renderNotification`(純粋関数、未知 kind で例外)と DTO 変換 | S | NTF-TASK-02、03 | NTF-T-40 |
| NTF-TASK-05 | `resolveRecipients`(第 6.5 節) | S | NTF-TASK-01(+00 の Store) | NTF-T-04・12・14・16・18 |
| NTF-TASK-06 | `notify`(冪等、集約、`confirmed` の概要付与)と `pruneNotifications` | M | NTF-TASK-03〜05、09 `memberSummary`(未完成ならスタブ) | NTF-T-01〜18、35、36 |
| NTF-TASK-07 | `listNotifications`、`unreadCount`、`markRead`、`markAllRead`(`service.ts`) | M | NTF-TASK-01、04 | NTF-T-20〜31 の単体部分 |
| NTF-TASK-08 | Route Handler 4 本(NTF-API-01〜04)。`currentUser`、`toResponse`、`no-store`、00 の共通ラッパーによる CSRF 検査、04 の `evaluateGroupsForUser` 呼び出し(未提供なら空関数で代替) | M | NTF-TASK-07、00 の API 共通部 | NTF-T-20〜34(HTTP) |
| NTF-TASK-09 | seed の初期通知(`group-seed.json` へ追加、00 と調整)と `resetStore` 確認 | S | NTF-TASK-01 | NTF-T-32 |
| NTF-TASK-10 | クライアント `features/notify/client.ts`(fetch)、`useUnreadCount`、`useNotifications`(ポーリング、`ntf:refresh`、visibility 停止) | M | NTF-TASK-08 | NTF-T-53 |
| NTF-TASK-11 | UI 部品 `NotificationBell`、`NotificationList`、`NotificationItem`(アクセシビリティ込み) | M | NTF-TASK-10 | NTF-T-50〜52、55、56 |
| NTF-TASK-12 | 画面 `app/[campaign]/groups/notifications/page.tsx` と、グループ共通レイアウトへのベル設置(01/02 と調整。R-7) | S | NTF-TASK-11 | NTF-T-51 |
| NTF-TASK-13 | 他モジュール(03/04/06)への組み込み支援: 呼び出し例のレビュー、eventKey の対応表の確認、結合試験 | M | NTF-TASK-06、08(03/04/06 の実装) | NTF-T-01〜16 を実データで通す |
| NTF-TASK-14 | 静的試験(禁止語走査 NTF-T-40、既存モック無変更 NTF-T-43、個人情報の非掲載 NTF-T-44) | S | NTF-TASK-04、13 | 違反 0 件 |
| NTF-TASK-15 | `chat_new` と `deadline_near`(B 優先)の組み込み・試験(NTF-T-14〜17) | S | NTF-TASK-13 | 同左 |

推奨順: NTF-TASK-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 10 → 11 → 12 → 13 → 14 → 15。NTF-TASK-09(seed)は NTF-TASK-01 の完了後いつでも着手できる。S 優先の通知(種類 1〜6、9〜11)は NTF-TASK-13 までで揃う。 [案]

## 14. 画面コンポーネント構成(NTF-UI)

### 14.1 ファイル
```
app/src/features/notify/
  index.ts            公開 API(notify, 型, RecipientSpec)
  types.ts            第 5.1 節の型
  kinds.ts            kind のメタ情報(defaultView 等)
  messages.ts         テンプレート文言(kind × 理由)
  params.ts           params 検証、sanitizeText
  render.ts           fillTemplate, renderNotification, toDto
  recipients.ts       resolveRecipients
  service.ts          notify, list, unreadCount, markRead, markAllRead, prune
  client.ts           ブラウザ用 fetch ラッパー(/api/groups/notifications)
  ui/
    NotificationBell.tsx
    NotificationList.tsx
    NotificationItem.tsx
    useUnreadCount.ts
    useNotifications.ts
app/src/app/api/groups/notifications/route.ts                 NTF-API-01
app/src/app/api/groups/notifications/unread-count/route.ts    NTF-API-02
app/src/app/api/groups/notifications/read-all/route.ts        NTF-API-04
app/src/app/api/groups/notifications/[id]/read/route.ts       NTF-API-03
app/src/app/[campaign]/groups/notifications/page.tsx          一覧ページ(クライアントコンポーネント)
```
`ui/` は `"use client"`。`service.ts` 等のサーバー側コードをクライアントから import しない(型は `import type` のみ)。Route Handler の `params` は Promise(既存コードと同じ形)。Next.js 16 の Route Handler のキャッシュ設定は [要確認](node_modules 未導入のためドキュメント未確認)。

### 14.2 コンポーネント
| コンポーネント | props | state・データ取得 | 責務 |
|---|---|---|---|
| `NotificationBell` | `{ base: string }`(`/${campaign}`) | `useUnreadCount()` | ベルアイコン+未読バッジ。`${base}/groups/notifications` へのリンク。Mantine `Indicator`(`label` に件数、99 超は「99+」、0 なら非表示)。`aria-label` は「グループの通知(未読N件)」。視覚的に隠した `aria-live="polite"` 領域で件数が増えたとき「新しい通知があります」を告知 |
| `NotificationList`(ページ本体) | なし | `filter: "all" \| "unread"`、`items`、`nextCursor`、`status: "loading" \| "ready" \| "error"`、`useNotifications({ filter })` | ヘッダー(「グループの通知」+「モック(ローカル)」表示)、フィルタ(すべて/未読)、「すべて既読にする」、リスト、「もっと見る」、空/エラー状態 |
| `NotificationItem` | `{ item: NotificationDto; onOpen: (item) => void }` | なし | 1 件の表示。全体を 1 つのリンク(`Link`)にする。`onClick` で `onOpen`(`markRead`)を開始し、完了を待たずに `Link` の遷移を行う(既読化の失敗は遷移を妨げない。NTF-T-52)。タイトル、本文、日時(`formatJst` の絶対表記。相対表記は使わない)、未読ラベル |
| `useUnreadCount(intervalMs?)` | 既定 15000 | `count`、`refresh()` | ポーリング、可視性制御、`ntf:refresh`/focus で再取得 |
| `useNotifications(opts)` | `{ filter, groupId? }` | `items`、`nextCursor`、`loadMore()`、`markRead(id)`、`markAll()`、`reload()` | 一覧の取得・追加読み込み・既読化・10 秒ポーリング。既読化は楽観更新し、失敗時は戻す |

### 14.3 表示規則
- 一覧は `<ul>` の `<li>` 構成(スクリーンリーダーが件数を読める)。新しい順。日付は `formatJst`(日本時間)。
- 未読: 太字+「未読」テキストのバッジ(色だけに頼らない)+左の帯。既読は通常の太さ。
- 状態:
  - 読み込み中: スケルトン(`aria-busy="true"`)。
  - 空状態: 「通知はまだありません。グループに参加を申し込むと、承認や実行確定のお知らせがここに届きます。」+「グループを探す」ボタン(`${base}/groups`)。「未読のみ」で 0 件なら「未読の通知はありません」+「すべて表示」。
  - エラー: 「通知を読み込めませんでした」+「もう一度読み込む」ボタン。
- 「モック(ローカル)」: 画面上部に小さく「この通知はデモ用のローカルのお知らせです(外部には送信されません)」と表示。運営の「お知らせ」(`/news`)との違いを示すため、画面名は「グループの通知」とする。
- アクセシビリティ: すべて操作可能な要素はボタン/リンク(`div` に `onClick` を付けない)。フォーカスリングを消さない。タップ領域 44px 以上。コントラストは Mantine の既定テーマ(既存と同じ)を使用。未読数の変化は `aria-live` で伝える。リンクの名前にタイトル+本文を含める(「中止になりました」だけにしない)。`prefers-reduced-motion` では Indicator のアニメーションを使わない。 [案]
- 文面は全て日本語(i18n 未確定。文言は `messages.ts` に集約。00 の方針に合わせる)。

## 15. 依存するモジュール・利用ライブラリ

### 15.1 依存するモジュール
- 00(Store、`currentUser`、`clock`、`newId`、`AppError`、`formatJst`)。09(`memberSummary`、試験で `checkText`)。
- 呼ぶ側: 03(`join_requested`、`join_approved`、`join_rejected`)、04(`min_reached`、`withdraw_period_started`、`withdraw_period_ending`、`confirmed`、`cancelled`、`replan_invited`、`withdrawal_received`、`conditions_changed`、`deadline_near`、`evaluateGroupsForUser` は 10 から呼ばれる)、06(`chat_new`)。
- README の依存図は 10 → 00 のみ。本書で 10 → 09(概要取得)、10 → 04(`evaluateGroupsForUser`、遅延評価の起動)が加わる。04 → 10 と循環するため、10 のサービス層(`service.ts`)は 04 を import せず、API ルート(`app/api/...`)の層で 04 を呼ぶ。 [案]

### 15.2 利用ライブラリ・モジュール
既存の依存(app/package.json)の範囲で実装し、本モジュールのために実行時の依存ライブラリを追加しない。 [案]

| 種別 | 名前 | 本モジュールでの用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| フレームワーク | Next.js(`next`) | Route Handler(NTF-API-01〜04)、`next/link` の `Link`、`next/navigation` の `useParams` | MIT | app/package.json の 16.4.5 を維持 |
| UI | React、React DOM(`react`、`react-dom`) | 画面部品、`useState`/`useEffect` による取得とポーリング | MIT | 19.3.0 を維持 |
| UI | Mantine Core(`@mantine/core`) | `Indicator`(未読バッジ)、`ActionIcon`、`Text`、`Badge`、`Button`、`SegmentedControl`(すべて/未読)、`Skeleton`、`Alert`、`VisuallyHidden` | MIT | ^9.7.5 を維持 |
| UI | Mantine Hooks(`@mantine/hooks`) | `useDocumentVisibility`(非表示中のポーリング停止)、`useWindowEvent`(`focus`・`ntf:refresh`)、`useReducedMotion` | MIT | ^9.7.5 を維持(フック名は実装時に node_modules の型定義で確認) |
| アイコン | Tabler Icons(`@tabler/icons-react`) | `IconBell`(既存ベルと同じアイコン) | MIT | ^3.51.0 を維持 |
| 日時 | Day.js(`dayjs`、同梱プラグイン `utc`) | `formatJst`(00 へ要望 R-2)による日本時間 `M月D日 H:mm` の表示と本文への差し込み | MIT | ^1.11.23 を維持(プラグインは同じパッケージに含まれる) |
| 試験(開発時のみ) | Vitest | 単体・HTTP 試験(NTF-T) | MIT | 00 が devDependency として導入する(00 の決定に従う)。新規に追加する場合は最新の安定版を使う |
| 型・静的検査(開発時のみ) | TypeScript、ESLint、`eslint-config-next` | 型検査、`react/no-danger` による `dangerouslySetInnerHTML` の検出 | Apache-2.0、MIT、MIT | 現行(^5、^9、16.4.5)を維持 |
| Node 標準モジュール | なし | サーバー側は TypeScript のみで書き、`node:*` を直接 import しない(ID 採番は 00 の `newId`) | - | - |
| 自前(00) | `lib/groups-store.ts`、`lib/clock.ts`、`lib/errors.ts`、API 共通部、検証関数 | Store、`currentUser`、`clock`、`newId`、`AppError`/`toResponse`、CSRF 検査、`formatJst` | - | 00 の確定に従う |
| 自前(09) | `memberSummary`、`checkText` | 確定通知の概要(第 11.3 節)、禁止語の試験(NTF-T-40) | - | 09 の確定に従う |

自前実装にするもの・使わないもの:

| 機能 | 採用 | 理由 |
|---|---|---|
| テンプレートの差し込み | 自前の `fillTemplate` | 置換対象が `{key}` のみで、正規表現 1 行で足りるため(Handlebars 等は使わない) |
| params の検証 | 自前の `params.ts` | kind ごとの固定スキーマと未知キーの拒否だけで足り、zod 等を追加しない(00 の方針と同じ)ため |
| 取得・ポーリング | 自前のフック(`setInterval` + `fetch`) | 対象 API が 2 本で、SWR・TanStack Query のキャッシュ制御が不要なため |
| リアルタイム通知 | 使わない(SSE、WebSocket、Web Push) | ポーリングで足り、localhost 完結・外部サービス不使用(rule.md 3・6)に従うため |
| 状態管理 | Zustand は使わない | 状態はコンポーネント内の state とイベント `ntf:refresh` で足りるため |
| 相対日時 | dayjs の `relativeTime` は使わない | デモ時計で日時を進めるため、絶対表記の方が状態と対応づけやすい |
| i18n | ライブラリを使わない | デモは日本語のみ(README 4.4)。文言は `messages.ts` に集約する |

## 16. 未決事項(docs/design 12 章との対応)

- #26 通知の種類(本書は 05 章の 8 種類+5 種類を案)、日時判定のデモ方法(DemoClock と `clock.now()` の関係)。
- #23 再企画の案内の対象(辞退者を含むか。本書は除く)、確定・中止の概要の粒度(07 章 論点17)。
- #15 却下理由を `join_rejected` に載せるか。
- 締切接近の発行時刻(24 時間前)と、04 の遅延評価・日付を進める操作との整合。
- 既存ベル/`news` との接続(第 2.2 節 案 A/B/C)。
- 保持件数(100 件)・期間(14 日)・ポーリング間隔(15/10 秒)の値。
- `cancelled` を申請中の申請者へ送る可否。
- 通知の永続化(00 の永続化方針に従う。インメモリなら再起動で seed に戻る)。
- 通知の削除ボタン・通知設定(種類ごとのオフ)は設けない [案]。

## 17. 設計上の確認事項(docs/design・他骨子との差異・不足)

1. **05 章の種類との差異**: 05 章は 8 種類。本書は 13 種類(追加: 参加申請の受付、承認、却下、チャット新着、締切接近)。追加は骨子 03・06・00 が通知を要求しているため。05 章・04 章(通知一覧の種類の列挙)への追加要否は [要確認]。 [差異]
2. **04 章の画面記述**: 通知は「通知の一覧」のみで、未読バッジ・既読操作・遷移先の記載がない。本書は案 A(別画面+専用ベル)で補った。 [不足]
3. **README/骨子との差異**: 骨子の `notify(userId, type, groupId, vars)` を `notify(input: NotifyInput)`(kind、groupId、eventKey、params、recipients)へ変更。`listNotifications`/`unreadCount`/`markRead` は維持。通知エンティティを 05 章に合わせ `readAt`、`dedupeKey` を追加。 [差異]
4. **00 骨子との差異**: 00 は `Store.notifications` のみ記載(型なし)。`formatJst`、`newId("n")` の使用を本書が仮定(R-1、R-2)。00 確定後に再確認。
5. **04 との循環**: 04 は通知を発行し、10 は遅延評価のために 04 を呼ぶ。API 層で呼ぶ構成にした(第 15 章)。04 に `evaluateGroupsForUser` が無い場合、通知 GET だけでは自動中止の通知が出ない(R-4)。
6. **辞退の扱い**: 05 章は GroupMember 状態に「辞退」(退会と区別は未決)。01 骨子は「退会」。宛先解決は「参加中のみ」で吸収しているが、状態文字列の確定後に確認。辞退の操作の所有モジュールが骨子にない(R-9)。
7. **既存 `/api/v2/notifications/unread`**: 常に `count:1` を返すため、既存ベルのバッジは常に表示される。本機能のバッジとは独立。混乱を避けるため画面名を分ける。既存挙動の変更はしない。
8. **日時**: 05 章は DemoClock(日付を進める)、00 骨子は `clock.now()/set`。同一視して設計。`createdAt` はデモ時刻。
9. **ルート競合**: `api/groups/notifications`(静的)と 00 の `api/groups/[...path]`(キャッチオール)、およびグループ ID 予約。Next.js 16 のルーティング優先を、ドキュメント確認後に検証する [要確認]。
10. **テストランナー**: app/ には未導入。00 の決定に従う(00 詳細設計の案は Vitest。第 15.2 節)。
11. **Next.js ドキュメント**: `app/node_modules` が無く、`next/dist/docs/` を未確認。Route Handler の署名は既存コードに合わせた(`params` は Promise)が、キャッシュ・動的レンダリングの扱いは実装前に確認 [要確認]。
12. **並行中の他モジュール詳細設計との差異**(2026-11-09 時点。本書には未反映で、各モジュールの確定後に合わせる) [要確認]:
    - 00: 通知の型(`Notification` の `type`/`vars`/`read`、`NotificationType` は lowerCamelCase)、ページネーション(`limit`/`offset`、最大 50、`Page<T>`)、ID 形式(`^n-\d{3,8}$`)、保存日時は `clock.nowIso()`(`+09:00`)、`store()` から `db()`/`tx` への改称、`sanitizeText` の除去範囲、検証関数は未知キーを捨てる方式、`CancelReason` の値(`organizerLeft` を含む)。
    - 04: `notify(userId, type, groupId, vars, opts?: { dedupeKey?; at? })` の署名と `createdAt` の指定、種類名(`lc_*`)と追加種類(`lc_min_lost`、`lc_headcount_changed`、`lc_capacity_full`)、確定時の概要を 04 の `summarizeParticipants` で作る案、全 API の先頭での `evaluateAll`(R-4 との差異)、宛先(条件変更は幹事を除き申請中を含む、中止は失効した申請者を含む)、締切が日付(`DateStr`)である点。
    - 03: 種類 `join_withdrawn`・`join_expired` の追加要望、却下理由ラベルを本文に入れる案(R-8)、`notify` の例外を 03 がキャッチしてログに残す案(第 6.1 節の「キャッチしない」と差異)。
    - 06: 集約の判定を 06 側で行う案(`hasUnread`、`markReadWhere` の要望)、`chat_new` の本文を変数なしの固定文とする案。
    - 09: `memberSummary` の戻り値が `{ count, buckets, hiddenReason }`(文字列ではない。R-6 との差異)。

## 18. 実装メモ(デモ範囲)

- 最小実装(S 優先): 種類 1〜6・9〜11(NTF-TASK-01〜12 の最小版)。バッジは遷移時+30 秒ポーリングでもよい。
- 後回し可: `chat_new` の集約、`deadline_near`、`conditions_changed`、`withdrawal_received`(B/A)、`read-all`、保持期間(14 日)。
- 外部通知・メール・LINE、リアルタイム通信、通知設定画面は作らない。
- 既存コード(`api/v2`、`news`、`notice`、`AppShell`、`server-store.ts`)は変更しない。
