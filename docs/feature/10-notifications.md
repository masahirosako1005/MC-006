# 10 通知

> 本書は docs/feature/README.md の凡例に従う([決定] [統一] [案] [未決] [要確認] [推定])。ID 接頭辞は `NTF`(TYPE=型、FN=関数、API、T=試験、TASK=実装タスク)。仕様の正は docs/design。モジュール間の契約(名前・署名・パス・値・状態値)は [_unified-contracts.md](_unified-contracts.md)(以下「統一仕様書」)を正とし、本文の [統一] はその章番号を併記する。「デモ範囲外」と付けた記述は設計として残すが、デモの実装・試験の対象にしない。「見送り(統一仕様書 16.2)」と付けた試験・タスク・記述は、主ルート(統一仕様書 16.1)を優先するために作り込みを見送る範囲で、設計として残し、実装・試験は主ルートの完了後に余力で行う。

## 1. 概要と責務 / 対応する柱

- グループ関連のイベント(最少人数到達、辞退期間、実行確定、中止、再企画の案内、辞退の受付、条件変更、参加申請の受付・承認・却下・受付終了、チャット新着、締切接近)をアプリ内通知として生成・保存・取得・既読化する。柱18(実行条件と状態管理の通知)、4、13 を支える。
- 外部のプッシュ通知・メール・LINE は使わない。ローカルのダミーデータのみ。 [決定、rule.md 3・6、docs/design 05 章]
- 通知本文は「種類ごとの固定テンプレート+検証済みパラメータ」から生成し、個人が特定される情報(氏名、申請者名、チャット本文、連絡先、辞退者名)は載せない。 [案、docs/design 07 章 論点17]
- 通知の発行は本モジュールの `notify(input: NotifyInput)` だけで行う。 [統一 9.1]
- 既存の通知モック(`/api/v2/notifications`、`news`/`notice` 画面)は変更せず、別系統で作る。

## 2. 既存機能との関係

### 2.1 既存コードの実態 [事実、読み取り済み]
| 既存 | 内容 |
|---|---|
| `app/src/app/api/v2/[...path]/route.ts` の `notifications` | `GET /notifications` は固定 1 件(`{id:1,title,body,at,read:false}`)、`GET /notifications/unread` は常に `{count:1}`。書き込み・既読化なし |
| `app/src/app/[campaign]/news/page.tsx` | `useApi("/notifications")` の一覧をカード表示するだけ。`notice/page.tsx` は同じコンポーネントの再エクスポート |
| `app/src/components/AppShell.tsx` | ヘッダーのベル(`aria-label="通知"`)が `${base}/news` へ遷移。`/notifications/unread` の件数で赤い `Indicator` を出す。`[campaign]/layout.tsx` が全ページに適用 |

### 2.2 既存画面との関係 [決定(案 A)、統一仕様書 9.2]
既存コードを変更しない前提で比較し、案 A を採用した。

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A(採用) | グループ通知は別画面 `/[campaign]/notifications`。グループ系ページ共通ヘッダーに専用のベル+未読バッジ(`NotificationBell`)を置く。既存のベル/`news` は無変更 | 既存コード無変更で完結。既存の固定モックと混ざらず、試験・説明が単純 | ベルが 2 つ(全体のお知らせ/グループ通知)になり、利用者が両者を区別する必要がある。グループ系ページ以外ではグループ通知のバッジが出ない |
| B | 既存 `news` 画面にタブ(お知らせ/グループ通知)を足し、AppShell のバッジを合算する | ベルが 1 つで自然 | `news/page.tsx` と `AppShell.tsx` の変更が必要(「既存は変更しない」方針と衝突)。既存の固定 `unread=1` が常に残るためバッジが消えない |
| C | 案 A で作り、デモで見せる段階で B の最小改修(AppShell で件数合算、news に導線 1 行)を別タスクで行う | 実装リスクを分離できる | 既存改修の承認が別途必要 |

- 案 C へ移行しても本書の API・コンポーネントはそのまま使える(`NotificationBell` と `NotificationList` を再利用)。
- 既存 `/api/v2/notifications` は呼ばず、型・ID も共有しない(既存は数値 ID、本モジュールは `n-NNN` の文字列 ID)。画面上のお知らせ(運営からの案内)とグループ通知(本書)は別物として文言で区別する。

## 3. 画面・UI(04 章)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| グループ通知一覧 | 「通知の一覧」(柱18) | `/[campaign]/notifications`(`app/src/app/[campaign]/notifications/page.tsx`)[統一 2.2] |
| 未読バッジ付きベル | 04 章に明記なし。一覧への入口として追加 | グループ系ページ共通ヘッダー(`NotificationBell`) |
| 通知からの遷移 | 通知 → グループ詳細/承認画面/チャット等 | 第 7.4 節 |

詳細は第 14 章。

## 4. 通知の種類(NTF-KIND)

### 4.1 種類一覧 [決定(docs/design 05 章の 8 種類、オーナー判断 #1・#22)/統一 9.1]

必須 12 種類(docs/design 05 章の 8 種類+参加申請の受付・承認・却下+`join_expired`)と、任意(余力)2 種類(チャット新着・締切接近)の計 14 種類とする。これ以外の種類(04 の `lc_*` 系の名前と追加案、03 の `join_withdrawn`、08 の `rally_reward`)は作らない。種類名は snake_case とする。

| # | 種類(`kind`) | 05 章 | 区分 | 発行元 |
|---|---|---|---|---|
| 1 | `min_reached` 最少人数到達 | 8 種類の 1 | 必須 | 04(T2) |
| 2 | `withdraw_period_started` 辞退期間の開始 | 8 種類の 2 | 必須 | 04(T5) |
| 3 | `withdraw_period_ending` 辞退期間の終了(まもなく確定) | 8 種類の 3 | 必須 | 04(評価) |
| 4 | `confirmed` 実行確定(実際の人数と参加者の概要つき) | 8 種類の 4 | 必須 | 04(T6) |
| 5 | `cancelled` 中止 | 8 種類の 5 | 必須 | 04(T4、T7、T8、T11、T12) |
| 6 | `replan_invited` 再企画の案内 | 8 種類の 6 | 必須 | 04(`replan`。元グループの `cancelled` → `replanned`) |
| 7 | `withdrawal_received` 辞退の受付(幹事向け) | 8 種類の 7 | 必須 | 04(`withdraw`) |
| 8 | `conditions_changed` 条件変更(最少人数・締切) | 8 種類の 8 | 必須 | 04(`changeConditions`) |
| 9 | `join_requested` 参加申請の受付(幹事向け) | 追加 | 必須 | 03(`requestJoin`) |
| 10 | `join_approved` 参加申請の承認 | 追加 | 必須 | 03(`approve`) |
| 11 | `join_rejected` 参加申請の却下 | 追加 | 必須 | 03(`reject`) |
| 12 | `join_expired` 参加申請の受付終了 | 追加 | 必須 [決定 #22] | 03(`status_changed` の購読による申請の失効) |
| 13 | `chat_new` チャットの新着 | 追加 | 任意(余力)。見送り(統一仕様書 16.2) | 06(`postMessage`) |
| 14 | `deadline_near` 締切接近 | 追加 | 任意(余力)。見送り(統一仕様書 16.2) | 04(評価) |

### 4.2 種類ごとの宛先・タイミング・文面・リンク(NTF-TPL)

テンプレート中の `{名前}` はパラメータの差し込み位置で、それ以外は固定文言とする。個人名・チャット本文・連絡先・性別は含めない。差し込み値は `renderNotification` が `params` から作る。数値はそのまま、日時(`withdrawUntil`)と日付(`deadline`、`{changes}` 内の締切)は 00 の `formatJst`(`IsoDateTime` は既定 `M月D日 H:mm`、`DateStr` は既定 `M月D日`)で日本時間に整形し [統一 3.7]、`{changes}` は下記の連結文、`{summaryText}` は第 11.3 節の概要文字列とする。テンプレートのキーと差し込み値のキーは一致させる(不一致はプログラム誤りとして例外。第 9.2 節)。宛先の `recipients` は発行元(03・04・06)が指定する(第 6.5 節)。下表の宛先は統一仕様書 5.3・5.4・9.1 で決まった指定で、10 は宛先の既定値を持たない。

| kind | 誰に(`recipients`) | いつ(発行契機) | タイトル | 本文テンプレート | リンク先(`link.view`) |
|---|---|---|---|---|---|
| `min_reached` | 参加中メンバー全員(幹事含む。`groupMembers`) | 04 が状態を `recruiting` → `min_reached` にしたとき(T2) | 最少人数に達しました | 「{groupTitle}」が最少人数({minParticipants}人)に達しました。現在{count}人です。まだ実行確定ではありません。 | `detail` |
| `withdraw_period_started` | 参加中メンバー全員 | 04 が締切到来で状態を `withdrawal_period` にしたとき(T5) | 辞退期間が始まりました | 「{groupTitle}」の辞退期間が始まりました。{withdrawUntil}までペナルティなしで辞退できます。現在{count}人です。 | `detail` |
| `withdraw_period_ending` | 参加中メンバー全員 | 04 の評価で辞退期間の終了が近いと判定したとき(判定時刻は 04 が決める) | まもなく実行確定します | 「{groupTitle}」の辞退期間が終わります。まもなく実行が確定します。現在{count}人です。 | `detail` |
| `confirmed` | 参加中メンバー全員 | 04 が状態を `confirmed` にしたとき(T6) | 実行が確定しました | 「{groupTitle}」の実行が確定しました。参加は{count}人です。参加者の概要: {summaryText} | `detail` |
| `cancelled` | 参加中メンバー全員+申請中の申請者(`groupMembers`+`pendingApplicants`)。04 は申請の失効より先に `notify` を呼ぶ [統一 5.3] | 04 が状態を `cancelled` にしたとき(T4、T7、T8、T11、T12) | 中止になりました | 理由別(下表) | `detail` |
| `replan_invited` | 元グループの参加中メンバー(再企画した幹事を除く)+失効した申請者。辞退者は除く [統一 5.4] | 04 の `replan` が新グループを作り、元グループを `replanned` にしたとき(T13) | 再企画のご案内 | 「{groupTitle}」を見直して、新しい募集が始まりました。参加するには、もう一度お申し込みください。 | `detail`(新グループ。`link.groupId` = `newGroupId`) |
| `withdrawal_received` | 幹事のみ(`organizer`) | 参加者が 04 の `withdraw` で辞退・退会したとき | 辞退を受け付けました | 「{groupTitle}」で辞退がありました。現在{count}人(最少{minParticipants}人)です。 | `detail` |
| `conditions_changed` | 幹事を除く参加中メンバー+申請中の申請者(`groupMembers` の `excludeOrganizer: true`+`pendingApplicants`。最少人数への同意に関わるため) [統一 9.1] | 幹事が最少人数・締切を変更したとき(04 `changeConditions`) | 募集の条件が変わりました | 「{groupTitle}」の条件が変わりました。{changes} | `detail` |
| `join_requested` | 幹事のみ | 03 の `requestJoin` 成功時 | 参加申請が届いています | 「{groupTitle}」に参加申請があります。未対応は{pendingCount}件です。 | `requests` |
| `join_approved` | 申請者のみ(`users`) | 03 の `approve` 成功時 | 参加が承認されました | 「{groupTitle}」への参加が承認されました。メンバーとして利用できます。 | `detail` |
| `join_rejected` | 申請者のみ | 03 の `reject` 成功時 | 申請の結果 | 「{groupTitle}」への参加申請は、今回は見送りとなりました。ほかのグループもご覧ください。 | `list` |
| `join_expired` | 申請者のみ(`users`。申請 1 件につき 1 回) | 締切で最少人数に達して辞退期間に移るとき(04 の T5 が `status_changed`(`to: "withdrawal_period"`)を発行し、03 がまだ承認されていない申請を `expired` にしたとき) [決定 #22] | 参加申請の受付が終了しました | 「{groupTitle}」は募集の締切を迎えたため、申請中の参加申請は受け付けられなくなりました。ほかのグループもご覧ください。 | `list` |
| `chat_new` | 参加中メンバー(送信者本人と、送信者をブロックしている受信者を除く) | 06 の `postMessage` 成功時(1 件に集約。第 6.4 節)。見送り(統一仕様書 16.2) | チャットに新着があります | 「{groupTitle}」に新しいメッセージが{count}件あります。 | `chat` |
| `deadline_near` | 参加中メンバー全員 | 04 の評価で「締切 24 時間前以内」を初めて検出したとき [案、24 時間は未決]。見送り(統一仕様書 16.2) | 締切が近づいています | 「{groupTitle}」の締切は{deadline}です。現在{count}人(最少{minParticipants}人)です。 | `detail` |

`join_expired` の補足:
- 中止(`cancelled`)で申請が失効する場合は `join_expired` を送らない。申請中の申請者には `cancelled` が届くため(統一仕様書 5.3 の順序で、失効より先に `pendingApplicants` に送る)。
- 本文はグループ名だけを差し込み、グループの人数・参加者の概要・最少人数に達したことは載せない(申請者はメンバーではないため、グループ内部の情報を渡さない。第 9.4 節)。
- リンクは一覧(`list`)とする。非公開グループの詳細は招待コードがないと表示できず、申請もできないため。

`cancelled` の理由別本文 [統一 4.3・10.2。理由は 04 の `CancelReasonCode` 5 値]:

| `reason` | 本文(`{groupTitle}` `{minParticipants}`) | 末尾の案内 |
|---|---|---|
| `min_not_reached` | 「{groupTitle}」は、締切までに最少人数({minParticipants}人)に達しなかったため、中止になりました。 | あり |
| `below_min_in_withdrawal` | 「{groupTitle}」は、辞退期間中の辞退で最少人数({minParticipants}人)を下回ったため、中止になりました。 | あり |
| `below_floor` | 「{groupTitle}」は、実行確定後の辞退で参加者が2人未満になったため、中止になりました。 | あり |
| `organizer_cancelled` | 「{groupTitle}」は、幹事の操作により中止になりました。 | あり |
| `organizer_left` | 「{groupTitle}」は、幹事が不在になったため、中止になりました。 | なし [案] |

- 末尾の案内: 「幹事は日程などを見直して再企画できます。再企画されると、参加者に案内が届きます。」。再企画の操作は元の幹事だけが行える(統一仕様書 4.4 `canReplan`)ため、幹事以外の宛先にも誤解のない文にする。`organizer_left` は元の幹事が不在のため付けない [案]。
- `min_not_reached` と `below_min_in_withdrawal` では `params.minParticipants` を必須とする(第 9.1 節)。

`conditions_changed` の `{changes}`: 変更項目ごとに連結。最少人数: 「最少人数が{from}人から{to}人になりました。」/締切: 「締切が{from}から{to}になりました。」(締切は日付 `M月D日` で表記)。変更が無い項目は含めない。

載せないもの(NTF-RULE-01): 申請者・辞退者・送信者・参加者の氏名/表示名/ID、チャット本文、ひとこと、却下理由、連絡先、性別。`join_rejected` に却下理由は入れない。却下理由は申請者の画面(03 の申請パネル)で表示する(解消。統一仕様書 5.2・9.1)。`cancelled`(`organizer_cancelled`)にも幹事が選んだ中止理由(04 の `OrganizerCancelReason`)は入れず、画面で 04 の `LifecycleView.organizerCancelReason` から表示する(解消。統一仕様書 4.3)。

## 5. データ(05 章)

### 5.1 型定義(NTF-TYPE)
`app/src/features/notify/types.ts`

```ts
import type { Id, IsoDateTime, DateStr, CursorPage } from "@/lib/groups-types"; // 00(CursorPage は統一仕様書 3.7)
import type { CancelReasonCode } from "@/features/groups/lifecycle/types"; // 所有 04(統一仕様書 4.3)

export const NOTIFICATION_KINDS = [
  "min_reached", "withdraw_period_started", "withdraw_period_ending", "confirmed",
  "cancelled", "replan_invited", "withdrawal_received", "conditions_changed",
  "join_requested", "join_approved", "join_rejected", "join_expired",
  "chat_new", "deadline_near",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

/** 必須 12 種類。任意(余力)は chat_new と deadline_near(見送り。統一仕様書 16.2)。 */
export const OPTIONAL_KINDS = ["chat_new", "deadline_near"] as const satisfies readonly NotificationKind[];

/** 全 kind 共通。グループ名(Group.name)は発行時点のスナップショット(sanitizeText 済み、長さは LIMITS.GROUP_NAME の範囲)。 */
interface Base { groupTitle: string }

export interface ParamsByKind {
  min_reached: Base & { minParticipants: number; count: number };
  withdraw_period_started: Base & { count: number; withdrawUntil: IsoDateTime /* lifecycle.withdrawalEndsAt */ };
  withdraw_period_ending: Base & { count: number };
  /** summaryText は notify が 09 の ageBandsOf・memberSummary・formatMemberSummary から設定する。呼び出し側は渡さない。 */
  confirmed: Base & { count: number; summaryText?: string };
  /** minParticipants は reason が min_not_reached / below_min_in_withdrawal のとき必須(第 9.1 節)。 */
  cancelled: Base & { reason: CancelReasonCode; minParticipants?: number };
  replan_invited: Base & { newGroupId: Id };
  withdrawal_received: Base & { count: number; minParticipants: number };
  conditions_changed: Base & {
    minParticipants?: { from: number; to: number };
    deadline?: { from: DateStr; to: DateStr };  // lifecycle.deadlineDate の変更前後
  };
  join_requested: Base & { pendingCount: number };
  join_approved: Base;
  join_rejected: Base;
  join_expired: Base;
  chat_new: Base & { count: number };
  deadline_near: Base & { deadlineDate: DateStr; deadlineAt: IsoDateTime; count: number; minParticipants: number };
}
export type ParamsOf<K extends NotificationKind> = ParamsByKind[K];

/** db().notifications の要素(05 章 Notification と対応)。 */
export interface GroupNotification<K extends NotificationKind = NotificationKind> {
  id: Id;                   // newId("n")。例 "n-012"。検証は 00 の isId("n", v)
  userId: Id;               // 宛先ダミーユーザー ID
  kind: K;
  groupId: Id;              // 対象グループ。replan_invited は「元グループ」
  params: ParamsOf<K>;      // 本文に埋める値のみ。個人情報・自由入力本文は持たない
  dedupeKey: string;        // 第 6.3 節。同一イベントの二重発行防止
  createdAt: IsoDateTime;   // clock.nowIso()(+09:00)。chat_new は集約のたびに更新
  readAt: IsoDateTime | null; // null = 未読。日時 = 既読
}

export type NotificationView = "detail" | "requests" | "chat" | "members" | "list";

/** API が返す形。userId・params・dedupeKey は返さず、サーバーで描画済みの文面を返す。 */
export interface NotificationDto {
  id: Id;
  kind: NotificationKind;
  groupId: Id;
  title: string;            // プレーンテキスト(HTML ではない)
  body: string;             // プレーンテキスト
  link: { groupId: Id; view: NotificationView };
  createdAt: IsoDateTime;
  read: boolean;
}

/** 一覧の応答。CursorPage<T> は 00 の lib/groups-types.ts の型(統一仕様書 3.7)。limit の既定・最大は本モジュールの定数(統一仕様書 2.3)。 */
export type NotificationPage = CursorPage<NotificationDto> & { unreadCount: number };
```

### 5.2 保存先
| エンティティ | 項目 | 保存先 |
|---|---|---|
| Notification | 上の `GroupNotification` | `db().notifications: Repo<GroupNotification>`(00 の Store。ID は `n-NNN`。`globalThis` インメモリ) [統一 3.1・3.2] |
- 05 章の項目(通知ID、宛先、種類、グループID、本文=定型文+値、作成日時、既読)と対応する。追加は `dedupeKey`(冪等性)と `readAt`(既読日時。真偽値より情報が多く、バッジ計算は `readAt === null`)。 [案]
- アクセスは 00 の `db()`/`Repo<T>`/`tx()` だけを使う(`store()` は使わない)。書き込みは呼び出し側の `tx` の中で行う(第 6.2 節)。
- `resetStore()`(00。`POST /api/demo/reset`)で seed に戻る。seed には、デモ用に各ダミーユーザー 0〜4 件の通知を置く(同じ `GroupNotification` 形式、`createdAt` は seed 基準日の `+09:00`)。断片は 10 が用意し、00 が `group-seed.json` に統合する [統一 11.4]。例: 再企画済みの見本(g-006 → g-007)に対応する `replan_invited`(`groupId: "g-006"`、`params.newGroupId: "g-007"`)。seed の通知は必須 12 種から選び、任意の `chat_new`・`deadline_near` は入れない [統一 11.4]。
- 通知にはユーザー ID を宛先以外に持たない(送信者・申請者・辞退者の ID を保存しない)。したがって API・画面から他者を特定できない。 [決定した設計制約]

## 6. インターフェース

### 6.1 公開関数(他モジュールが呼ぶ)

`app/src/features/notify/index.ts` から再エクスポートする。他モジュールは `@/features/notify` だけを import する。

```ts
/** 宛先の指定。いずれも NotifyInput.groupId のグループを対象に解決する。 */
export type RecipientSpec =
  | { type: "users"; userIds: Id[] }                    // 指定ユーザー(申請者のみ、失効した申請者 等)
  | { type: "groupMembers"; excludeOrganizer?: boolean; excludeUserIds?: Id[] } // 参加中メンバー(幹事含む。excludeOrganizer: true で幹事を除く。統一仕様書 9.1)
  | { type: "organizer" }                               // 幹事のみ
  | { type: "pendingApplicants" };                      // 申請中の申請者

export interface NotifyInput<K extends NotificationKind = NotificationKind> {
  kind: K;
  groupId: Id;
  /** 同一イベントを識別する呼び出し側のキー。第 6.3 節の表に従う。^[A-Za-z0-9:_.@+-]{1,80}$ */
  eventKey: string;
  params: ParamsOf<K>;
  recipients: RecipientSpec[];
}

export interface NotifyResult {
  created: GroupNotification[];     // 新規作成(または chat_new の集約更新)
  skippedDuplicate: Id[];           // dedupeKey 重複でスキップした宛先 userId
  recipientCount: number;           // 解決後の宛先数(重複除去後)
}
```

| ID | 関数 | 引数 | 戻り値 | 例外(`AppError`) | 呼び出し元 |
|---|---|---|---|---|---|
| NTF-FN-01 | `notify<K>(input: NotifyInput<K>): NotifyResult` | 上記 | `NotifyResult` | `invalid_input`(未知の kind、params 検証違反、eventKey 形式不正)、`not_found`(groupId が存在しない) | 03、04、06 |
| NTF-FN-02 | `listNotifications(user: DemoUser, opts?: { limit?: number; cursor?: Id; unreadOnly?: boolean; groupId?: Id }): NotificationPage` | `limit` 既定 30・最大 100。取得前に `pruneNotifications(user.id, clock.now())` を実行(見送り。統一仕様書 16.2) | `NotificationPage`(新しい順) | `invalid_input`(limit 範囲外、cursor 不明) | NTF-API-01 |
| NTF-FN-03 | `unreadCount(user: DemoUser): number` | - | 未読件数(`readAt === null`) | なし | NTF-API-01・02 |
| NTF-FN-04 | `markRead(user: DemoUser, id: Id): NotificationDto` | 通知 ID | 既読後の DTO(既に既読でも成功、`readAt` は変えない) | `not_found`(存在しない/他人の通知。区別しない) | NTF-API-03 |
| NTF-FN-05 | `markAllRead(user: DemoUser, groupId?: Id): number` | 任意でグループ絞り込み | 既読にした件数 | なし(形式は API 層で検証済み) | NTF-API-04。見送り(統一仕様書 16.2) |
| NTF-FN-06 | `renderNotification(n: GroupNotification): { title: string; body: string; link: NotificationDto["link"] }` | - | 描画済み(純粋関数) | `Error`(未知の kind、差し込み値の不足。プログラム誤りとして扱い、API では `internal`) | 内部、試験 |
| NTF-FN-07 | `resolveRecipients(groupId: Id, specs: RecipientSpec[]): Id[]` | - | 重複除去済み userId 配列(昇順) | `not_found`(groupId なし) | `notify` 内部 |
| NTF-FN-08 | `pruneNotifications(userId: Id, now: Date): number` | - | 削除件数 | なし | `notify`、`listNotifications`。見送り(統一仕様書 16.2) |

挙動の要点:
- `notify` は同期関数とする(ストアがインメモリのため)。呼び出し側は状態の更新と同じ `tx` の中で呼ぶ(00 R-ALL-1)。呼び出し側の処理が後で例外になった場合、`tx` の巻き戻しで通知も作られなかった状態に戻る。
- `notify` の `invalid_input` は呼び出し側のプログラム誤りを示す。通常の呼び出し側(03 の `requestJoin`・`approve`・`reject`、04 の遷移・操作、06 の `postMessage`)ではキャッチせず上位へ伝える(デモでは画面にエラーが表示される)。ドメインイベントの購読処理の中で呼ぶ場合(03 の `join_expired`)は、統一仕様書 4.6 の規則に従い購読側が捕捉し、`console.error` に ID とエラーコードだけを残す。 [案/統一 4.6]
- `confirmed` では `notify` が 09 の `ageBandsOf`・`memberSummary`・`formatMemberSummary` を順に呼んで `summaryText` を設定する(第 11.3 節)。
- `markRead` の「他人の通知」は `forbidden` ではなく `not_found` を返し、他人の通知が存在するかどうかを応答から判別できないようにする。 [案]
- ユーザーは必ず 00 の `route()` が解決した `c.user`(`currentUser(req)`)を使う。クライアントが userId を渡す API はない。
- 本モジュールはドメインイベント(統一仕様書 4.6)を購読しない。通知は発行側(03・04・06)が `notify` を呼んで作る。

### 6.2 `notify` の処理順(NTF-FN-01)
1. `kind` が `NOTIFICATION_KINDS` に含まれるか、`eventKey` が形式に合うかを検証。
2. `params` を kind ごとのスキーマ(第 9.1 節。00 の `v` で定義)で検証する。文字列は 00 の `sanitizeText` で正規化され、定義外のキーは捨てられる(新しいオブジェクトを作る。入力は変更しない)。
3. `groupId` が `db().groups` に存在するか確認(なければ `not_found`)。
4. `resolveRecipients` で宛先を解決(重複除去、`excludeUserIds` を除外)。0 件なら `recipientCount: 0` で終了(エラーにしない)。
5. `confirmed` のみ、宛先と同じ参加中メンバーの userId から 09 の `ageBandsOf` → `memberSummary` → `formatMemberSummary` で `summaryText` を作って `params` に追加(第 11.3 節)。
6. 宛先ごとに `dedupeKey = [kind, groupId, userId, eventKey].join(":")` を計算。`chat_new` 以外で同じ `dedupeKey` が既にあれば `skippedDuplicate` に入れて次へ。`chat_new` は第 6.4 節の集約。
7. `GroupNotification` を作成し `db().notifications.insert`(`id = newId("n")`、`createdAt = clock.nowIso()`、`readAt = null`)。
8. 宛先ごとに `pruneNotifications` を実行(見送り。統一仕様書 16.2)。`NotifyResult` を返す。

### 6.3 冪等性: eventKey の付け方(NTF-IDEM)
同じイベントで `notify` が 2 回呼ばれても、通知は 1 件だけ作る(04 の評価が要求ごとに実行されるため)。同じグループでも別イベント(2 件の申請など)は別の `eventKey` にする。04 の `opts.dedupeKey` 方式は使わない [統一 7.5]。

| kind | `eventKey` | 備考 |
|---|---|---|
| `min_reached` | `reached` | グループにつき 1 回。T3(`min_reached` → `recruiting`)の後に再到達しても再通知しない [案] |
| `withdraw_period_started` | `wp-start` | |
| `withdraw_period_ending` | `wp-end` | |
| `confirmed` | `confirmed` | |
| `cancelled` | `cancelled` | `cancelled` には 1 グループで 1 回しか遷移しない(再企画すると終端の `replanned` になる) |
| `replan_invited` | `replan:<newGroupId>` | 元グループは `replanned` で終端になるため、元グループにつき 1 回 |
| `withdrawal_received` | `wd:<Withdrawal.id>` | 辞退ごと [統一 9.1]。辞退者の userId は使わない(`dedupeKey` に宛先以外のユーザー ID を残さないため。第 5.2 節) |
| `conditions_changed` | `cond:<変更後の lifecycle.revision>` | 変更ごと。同じ値へ戻す変更も別の通知にする |
| `join_requested` | `jr:<requestId>` | |
| `join_approved` | `ja:<requestId>` | |
| `join_rejected` | `jx:<requestId>` | |
| `join_expired` | `je:<requestId>` | 申請ごと。申請 ID(`jr-NNN`)は申請者自身の申請を指し、他者の ID を含まない |
| `chat_new` | `chat`(無視される。集約) | 第 6.4 節。見送り(統一仕様書 16.2) |
| `deadline_near` | `dl:<deadlineDate>` | 締切が延長されたら別キー(再通知)。見送り(統一仕様書 16.2) |

### 6.4 `chat_new` の集約(NTF-COALESCE)
任意の種類のため見送り(統一仕様書 16.2)。チャットはメッセージ数が多いため、1 メッセージにつき 1 通知にはしない。同じ (宛先, グループ) に未読の `chat_new` が既にある場合は、新規作成せず既存の `params.count` に加算し(上限 999。超える分は加算しない)、`createdAt` を現在時刻に更新する(一覧は `createdAt` の新しい順のため先頭に表示される)。既読後の次のメッセージは新規作成。06 は投稿ごとに `notify` を 1 回呼び、`excludeUserIds` に送信者本人と、09 の `isBlockedByMe(recipient, sender)` が真の受信者を入れる [統一 6.3・7.7]。未読の有無の確認と集約は 10 が行う(06 の `markReadWhere`・`hasUnread` の要望は取り下げ)。`chat_new` の既読化は、10 の通知画面で項目を開いたとき(`POST /api/me/notifications/read`)に行う。チャットを開いても通知は既読にしない [統一 7.7・9.2]。

### 6.5 宛先の解決(NTF-FN-07)
`db().members`、`db().groups`、`db().joinRequests`、`db().users` を読み取り専用で参照する(01/03 の関数を経由しない。項目名は統一仕様書の型に従う)。

| spec | 解決規則 |
|---|---|
| `groupMembers` | `groupId` の `GroupMember` のうち `status === "active"`(幹事含む)。`excludeOrganizer: true` のときは `Group.organizerId` を除く。`left`(辞退・退会)は除く。`excludeUserIds` を除外 |
| `organizer` | `Group.organizerId` の 1 人(`active` でなければ空) |
| `pendingApplicants` | `groupId` の `JoinRequest` のうち `status === "pending"` の `applicantId` |
| `users` | 指定 ID のうち `db().users` に存在するもの(存在しない ID は無視) |
- 複数 spec は和集合、重複除去。順序は `userId` の昇順 [案]。
- 失効した申請者(`expired`)は `pendingApplicants` に含まれない。`replan_invited` で失効した申請者に送る場合、04 が対象の userId を `users` で渡す。

### 6.6 API(NTF-API)

パスは統一仕様書 2.2 の `/api/me/*` とする [統一 2.1・2.2]。各ルートは `app/src/app/api/me/.../route.ts` に置き、`features/notify/handlers.ts` の 00 `route()` で包んだハンドラを再エクスポートするだけにする。現在ユーザーは Cookie `demoUser`(00 の `c.user`)。00 の `route()` が次を共通で行う: `beforeRequest` フック(04 の `evaluateAll` による状態の評価)、変更系(POST)の `Origin`・`Content-Type: application/json` の検査、本文 64KB の上限、全応答への `Cache-Control: no-store`・`X-Content-Type-Options: nosniff`、エラー応答の形 `{ error, reason?, message, fields?, detail? }`。変更系は本文の有無にかかわらず `Content-Type: application/json` を必須とする(本文を省略できる NTF-API-04 も同じ。統一仕様書 2.3)。クライアントは 00 の `gpost` を使い、本文が無い場合も `{}` を JSON で送る。

```ts
// app/src/app/api/me/notifications/route.ts
export { listNotificationsHandler as GET } from "@/features/notify/handlers";
```

| ID | メソッド・パス | リクエスト | 成功レスポンス | エラー |
|---|---|---|---|---|
| NTF-API-01 | `GET /api/me/notifications` | クエリ: `limit`(1〜100、既定 30)、`cursor`(前回の `nextCursor`。`isId("n")`)、`unread`(`1` のみ有効)、`groupId`(`isId("g")`)。それ以外のキーは `c.query` の strict 検証で `invalid_input` | 200 `NotificationPage` | 400 `invalid_input`(`fields` に `limit`/`cursor`/`groupId`/未知のキー) |
| NTF-API-02 | `GET /api/me/unread-count` | なし | 200 `{ "count": number }` | なし(本人の件数のみ) |
| NTF-API-03 | `POST /api/me/notifications/read` | 本文 `{ "id": string }`(`v.id("n")`) | 200 `NotificationDto`(`read: true`)。既読済みでも 200 | 404 `not_found`(存在しない/他人。区別しない)、400 `invalid_input`(`id` の形式不正。`fields.id`)、403 `forbidden`・415 `unsupported_media_type`・413 `payload_too_large`(00 の `route()` の入口検査) |
| NTF-API-04 | `POST /api/me/notifications/read-all`(余力。見送り。統一仕様書 2.2・16.2) | 本文 `{ "groupId"?: string }`(`v.id("g")`、省略可) | 200 `{ "updated": number }` | 400 `invalid_input`(`groupId` の形式不正。`fields.groupId`)、403・415・413(同上) |

- 通知を作る HTTP API は設けない(発行はサーバー内の `notify` のみ)。クライアントから任意の通知を作れないようにする。 [決定した設計制約]
- 状態の評価は 00 の `route()` の `beforeRequest` で一覧・件数の計算より前に済んでいる。これにより、通知画面だけを開いている利用者にも、自動中止や辞退期間開始の通知が表示される。本モジュールは 04 の評価関数を呼ばない [統一 3.5]。
- クエリは 00 の `c.query(schema)` で strict に検証し、未知のキーは `invalid_input`(`fields.<key>`)とする。本文の未知のキーは捨てる(00 の `v.object`) [統一 3.4・3.7]。ID の形式不正は本文・クエリのため `invalid_input`(400) [統一 3.2]。
- `cursor` は直前に返した最後の通知の `id`。一覧の並び(`createdAt` の降順、同時刻は ID の連番の降順)で、その次から `limit` 件。
- ページ送りの途中で `cursor` の通知が保持規則(第 7.2 節)で削除された場合も `invalid_input`(`reason: "cursor_not_found"`)になり、先頭からの再取得で回復する。この場合の利用者向けの個別表示は設けない。 [デモ範囲外。見送り(統一仕様書 16.2)]

## 7. 取得方式・バッジ・保持(NTF-RET)

### 7.1 取得方式 [案]
- ポーリング。サーバー送信イベント・WebSocket は使わない(依存ライブラリと実装量を増やさないため)。
- バッジ: `useUnreadCount(intervalMs = 15000)` が `GET /api/me/unread-count` を 15 秒間隔で取得。`document.visibilityState === "hidden"` の間は止め、可視に戻ったとき・ウィンドウ focus 時・ページ遷移時に即時取得。
- 一覧画面: 表示中は 10 秒間隔で先頭ページを再取得(`nextCursor` で読み込み済みの追加ページは保持)。
- 即時反映: 00 の `gpost`/`gpatch`/`gput`/`gdelete` が成功すると `window.dispatchEvent(new Event("ntf:refresh"))` を発火する [統一 3.5]。バッジと一覧はこのイベントで再取得する。「日付を進める」(`POST /api/demo/clock`)も `gpost` を通るため同じイベントが発火する。
- 通信失敗時のポーリング間隔の段階的な延長は見送り(統一仕様書 16.2)。失敗しても同じ間隔で再取得する。
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
- 保持件数(100 件)・保持期間(14 日)による削除(`pruneNotifications`)は見送り(統一仕様書 16.2)。一覧の件数とリセットは主ルートで使う。

### 7.3 件数(未読バッジ)
未読数 = 宛先ユーザーの `readAt === null` の件数。一覧 API(`unreadCount`)と専用 API の両方で返す。

### 7.4 通知からの遷移(リンク規則)
`link.view` からクライアントが `campaign` を付けてパスを作る(`campaign` は `useParams`)。画面のパスは統一仕様書 2.2 に従う。

| view | パス |
|---|---|
| `detail` | `/${campaign}/groups/${link.groupId}` |
| `requests` | `/${campaign}/groups/${link.groupId}/requests`(03) |
| `chat` | `/${campaign}/groups/${link.groupId}?tab=chat`(06) |
| `members` | `/${campaign}/groups/${link.groupId}/members`(01) |
| `list` | `/${campaign}/groups`(02) |
- リンクは内部パスのみ。外部 URL をパラメータで受けない(オープンリダイレクト防止)。`groupId` は ID 形式検証済みの値だけ使う。遷移先でアクセス権がなければ遷移先(01/02)の `forbidden`/`not_found` 表示に従う(通知側で再判定しない)。

## 8. 状態遷移

- 通知: 未読(`readAt = null`)→ 既読(`readAt` = 既読にした日時)のみ。既読から未読には戻さない。`chat_new` のみ、未読の間は集約更新で `count`/`createdAt` が変わる。
- 削除は保持規則(第 7.2 節。見送り。統一仕様書 16.2)による自動削除のみ。ユーザー操作での削除は設けない。 [案]
- グループの状態(統一仕様書 4.1 の 8 値)との対応: 通知を発行するのは 04 の遷移 T2(`min_reached`)、T5(`withdrawal_period`。メンバーへ `withdraw_period_started`、03 経由で申請者へ `join_expired`)、T6(`confirmed`)、T4・T7・T8・T11・T12(`cancelled`)、T13(`cancelled` → `replanned`。`replan_invited`)。T3(`min_reached` → `recruiting`)、T9(`in_progress`)、T10(`completed`)では通知しない [統一 7.5]。

## 9. 入力検証・セキュリティ(NTF-VAL)

### 9.1 検証規則
`notify` の `params` は kind ごとのスキーマを 00 の `v` で定義して検証する(`features/notify/params.ts`)。API の入力も 00 の `v`(`c.query`・`c.body`)で検証する。

| 対象 | 規則 |
|---|---|
| `kind` | `NOTIFICATION_KINDS` のいずれか |
| `groupId`、`newGroupId` | `isId("g", v)`(00) |
| 通知 ID、`cursor` | `isId("n", v)`(00) |
| `eventKey` | `^[A-Za-z0-9:_.@+-]{1,80}$` |
| `groupTitle` | 文字列。00 の `sanitizeText` 後の長さが `LIMITS.GROUP_NAME` の範囲。範囲外は `invalid_input` |
| `count`、`pendingCount` | 整数 0〜999(`count` は 1 以上を要する kind もあるが、検証は 0〜999 で統一) |
| `minParticipants`(`from`/`to` を含む) | 整数。`LIMITS.MIN_MEMBERS` の範囲 |
| `withdrawUntil`、`deadline_near.deadlineAt` | `IsoDateTime`(00 の `v.datetime`。`+09:00` に正規化) |
| `deadline_near.deadlineDate`、`conditions_changed.deadline.from`/`to` | `DateStr`(00 の `v.date`。実在する日付) |
| `reason` | `CancelReasonCode` の 5 値(04 の型) |
| `conditions_changed` | `minParticipants` と `deadline` の少なくとも一方があること |
| `limit` | 整数 1〜100。非数・範囲外は 400 |
| `unread` | `"1"` のみ有効。それ以外は無視 |
| `cancelled` の `minParticipants` | `reason` が `min_not_reached`・`below_min_in_withdrawal` のとき必須 |
| `summaryText` | `notify` 内部で設定。1〜80 字(第 11.3 節)。呼び出し側が渡した値は使わない(入力スキーマに含めず捨てる) |
| 未知のキー | `params`・API の本文の定義外のキーは捨てる(00 の `v.object`)。保存する `params` は定義済みのキーだけで作り直すため、自由入力が通知に混入しない。API のクエリの未知のキーは `c.query` の strict 検証で `invalid_input` [統一 3.4] |

### 9.2 テンプレートと XSS 対策(NTF-XSS)
- 通知はプレーンテキストとして描画する。`renderNotification` は文字列を返し、HTML を返さない。画面は `<Text>` で出し、`dangerouslySetInnerHTML` は使わない。リンク化もしない。
- 置換は `tpl.replace(/\{(\w+)\}/g, (_, key) => String(values[key]))` の関数形式のみとする(`$&` 等の特殊置換パターンが効かない)。テンプレートに無いキー、`values` に無いキーはプログラム誤りとして例外。キーの有無は `Object.hasOwn(values, key)` で確認し、プロトタイプのプロパティ(`__proto__`、`constructor` 等)を参照しない。
- 文字列の正規化は 00 の `sanitizeText`(制御文字・ゼロ幅文字・双方向制御文字の除去、前後空白の除去、改行は拒否)だけを使い、本モジュールで独自の正規化は作らない [統一 3.4]。`<` `>` はそのまま保存してよい(React が描画時にエスケープ)。二重エスケープを避けるため、保存時に HTML エスケープしない。
- 唯一のユーザー入力由来の値は `groupTitle`(幹事が入力、作成時に 09 `assertTextAllowed` 済み)。他は数値・日時・日付・列挙値のみ。チャット本文やひとことは通知に渡さない(型に存在しない)。

### 9.3 禁止表現・個人特定の防止
- テンプレートは固定文言。静的試験(NTF-T-40)で全テンプレートを 09 `checkText` に通し、かつ「相乗り」「マッチング」「恋愛を連想させる語」が含まれないこと、性別・年齢での絞り込みを連想させる文言がないことを確認する。
- 通知に載せる集計は人数と年代帯の概要のみ(第 11.3 節)。辞退した人・申請者の名前は載せない。 [決定(通知する)/案(粒度)、07 章 論点17]

### 9.4 権限
- 閲覧・既読化は宛先本人のみ。`userId` は `c.user` から取り、`db().notifications` の `userId` 一致を必ず確認する(IDOR 対策)。他人の通知 ID は `not_found`。
- 発行はサーバー内の `notify` のみ。呼び出し側(03/04/06)が自分で権限判定した後に呼ぶ。`notify` 自体は権限判定をしない(宛先を機械的に解決するだけ)。
- 宛先解決は「参加中」状態のみ。退会・辞退・却下された人に、グループ内部の情報(人数、概要)を通知しない。申請者向けの種類(`join_approved`、`join_rejected`、`join_expired`、`cancelled`・`conditions_changed` の申請者宛て)にも人数・概要を載せない(`cancelled` の `minParticipants` と `conditions_changed` の最少人数・締切は、募集条件として申請時に表示済みの値とその変更)。

### 9.5 OWASP Top 10 との対応
| 観点 | 本モジュールの対処 |
|---|---|
| アクセス制御・IDOR(A01) | 第 9.4 節。一覧・件数・既読化は `c.user` の通知だけを対象にし、他人の通知 ID は `not_found`。`read-all`(見送り)の `groupId` 指定も本人宛の通知の中だけで絞り込む |
| インジェクション(A03) | SQL は使わない。ID・`cursor` は 00 の `isId` で検証し、ファイルパス・コードに使わない。テンプレート置換は関数形式で、差し込み値の参照は `Object.hasOwn` で確認(第 9.2 節) |
| XSS | 第 9.2 節。プレーンテキストのみ、`dangerouslySetInnerHTML` 不使用、リンクは内部パスのみ(第 7.4 節) |
| CSRF | 変更系は POST の 2 本(NTF-API-03・04。04 は見送り)のみ。00 の `route()` で `Content-Type: application/json` 必須と `Origin` 検査を行い、Cookie は `SameSite=Lax`(00)。GET は利用者の操作による状態変更を行わない(保持規則による自動削除と、00 の `beforeRequest` による状態の評価は行う) |
| 認証・セッション(デモ) | ログインは無く、Cookie `demoUser` で視点を切り替える(00)。Cookie は利用者が書き換えられるため、本番相当の認証ではない(第 9.6 節) |
| セキュリティ設定(A05) | 全応答に `Cache-Control: no-store`。CORS ヘッダは付けない。通知を作る API を公開しない(第 6.6 節)。許可外メソッドは 405。画面のセキュリティヘッダーは `next.config.ts` の共通設定(統一仕様書 11.2)に従う |
| 機密データの扱い(A02) | 通知に個人名・連絡先・チャット本文・ひとことを持たない(NTF-RULE-01、第 5.2 節)。DTO は `userId`・`params`・`dedupeKey` を返さない |
| ログ(A09) | サーバーログは requestId、kind、通知 ID、エラーコードのみ。`groupTitle`・本文・Cookie の値は出さない |

### 9.6 既知の制約
- Cookie `demoUser` を書き換えると他のダミーユーザーの通知を閲覧できる(ログイン不要のデモの前提。対策は設計しない)。
- 通知 ID は連番のため推測できる。他人の ID への操作は `not_found` になるが、件数の推測は防がない。
- ポーリングによる負荷、人数の変化の差分から参加者を推測される可能性(09)は、デモ規模のため対策を設計しない。差分による推測への対策は見送り(統一仕様書 16.2)。

## 10. エラー処理

エラー応答は 00 の `{ error, reason?, message, fields?, detail? }`。`fields` の値は文字列 1 つ [統一 3.3]。

| コード | `reason` | 発生条件 | HTTP | 画面での表示・挙動 |
|---|---|---|---|---|
| `invalid_input` | -(`cursor` 不明のみ `cursor_not_found`) | API: `limit`/`cursor`/`groupId`/通知 ID の形式不正、クエリの未知のキー、本文が JSON でない(`fields` に項目名)。関数: `notify` の kind・eventKey・params の検証違反(呼び出し側のプログラム誤り) | 400 | 通常の画面操作では発生しない。一覧画面では下の `internal` と同じエラー表示を出す |
| `not_found` | - | 存在しない通知・他人の通知の既読化(区別しない)。`notify` の `groupId` が存在しない | 404 | 一覧画面: 「この通知は見つかりません」を表示し、一覧を再取得する。通知をクリックした場合は遷移を続ける(NTF-T-52) |
| `forbidden` | - | POST の `Origin` が `Host` と異なる(00 の `route()`) | 403 | 通常の画面操作では発生しない。「画面を再読み込みしてやり直してください」 |
| `unsupported_media_type` | - | POST の `Content-Type` が `application/json` でない(00 の `route()`) | 415 | 同上 |
| `payload_too_large` | - | 本文が 64KB を超える(00 の `route()`) | 413 | 同上 |
| `method_not_allowed` | - | 許可外のメソッド(例: `POST /api/me/notifications`) | 405 | 画面からは発生しない |
| `internal` | - | 想定外の例外(描画時のテンプレート不整合 等) | 500 | 一覧画面: 「通知を読み込めませんでした。再読み込みしてください」+ 再試行ボタン |
| `network`(クライアントのみ) | - | 通信失敗、応答が JSON でない(00 の `ApiError`) | - | `internal` と同じ |

- 本モジュールで発生しないコード: 権限なしは `forbidden` ではなく `not_found` で返す(第 9.4 節)。既読化は冪等で前提となる状態が無いため、状態不正(`unavailable_state`)と競合(`conflict`)は使わない。頻度制限(`rate_limited`)は設けない。
- 既読化(楽観更新)が失敗した場合は、一覧の該当行を未読表示に戻す。
- 一覧取得が失敗しても、既存の画面(グループ詳細等)は操作できる状態を保つ。`NotificationBell` の取得に失敗した場合は、エラーを表示せず、バッジに前回取得した件数を表示し続ける。
- 通知の描画失敗(1 件)で一覧全体を失敗させない: `renderNotification` が例外を出した行は汎用文面「新しい通知があります」を表示し、サーバーログに kind と ID のみ記録する。 [案、デモ範囲外。見送り(統一仕様書 16.2)]

## 11. 他モジュールとの契約

### 11.1 本モジュールを呼ぶ側(呼び出しの具体形)
```ts
// 03 requestJoin 成功後(幹事へ)
notify({ kind: "join_requested", groupId, eventKey: `jr:${req.id}`,
  params: { groupTitle: g.name, pendingCount },
  recipients: [{ type: "organizer" }] });
// 03 approve 成功後(申請者へ)
notify({ kind: "join_approved", groupId, eventKey: `ja:${req.id}`,
  params: { groupTitle: g.name }, recipients: [{ type: "users", userIds: [req.applicantId] }] });
// 03 status_changed の購読(to が "withdrawal_period" のとき)。申請を expired にした後、申請ごとに
on("status_changed", "join", (e) => {
  if (e.to !== "withdrawal_period") return;   // cancelled への遷移では join_expired を送らない(cancelled が届く)
  try {
    for (const req of expired) {   // expired: この購読処理で pending から expired にした申請
      notify({ kind: "join_expired", groupId: e.groupId, eventKey: `je:${req.id}`,
        params: { groupTitle: g.name }, recipients: [{ type: "users", userIds: [req.applicantId] }] });
    }
  } catch (err) { console.error("[join] notify failed", e.groupId, codeOf(err)); }  // 統一仕様書 4.6
});
// 04 実行確定時(メンバー全員へ。summaryText は notify が付与)
notify({ kind: "confirmed", groupId, eventKey: "confirmed",
  params: { groupTitle: g.name, count }, recipients: [{ type: "groupMembers" }] });
// 04 中止時(applyLifecyclePatch の後、emit(status_changed) の前。統一仕様書 5.3)
notify({ kind: "cancelled", groupId, eventKey: "cancelled",
  params: { groupTitle: g.name, reason: "min_not_reached", minParticipants: g.lifecycle.minMembers },
  recipients: [{ type: "groupMembers" }, { type: "pendingApplicants" }] });
// 04 再企画時(元グループを replanned にした後。統一仕様書 5.4)
notify({ kind: "replan_invited", groupId: original.id, eventKey: `replan:${newGroup.id}`,
  params: { groupTitle: original.name, newGroupId: newGroup.id },
  recipients: [{ type: "groupMembers", excludeUserIds: [user.id] }, { type: "users", userIds: expiredApplicantIds }] });
// 04 withdraw 成功後(幹事へ)
notify({ kind: "withdrawal_received", groupId, eventKey: `wd:${withdrawal.id}`,
  params: { groupTitle: g.name, count, minParticipants: g.lifecycle.minMembers },
  recipients: [{ type: "organizer" }] });
// 04 changeConditions 成功後(幹事を除く参加中メンバーと申請中の申請者へ。統一仕様書 9.1)
notify({ kind: "conditions_changed", groupId, eventKey: `cond:${lifecycle.revision}`,
  params: { groupTitle: g.name, minParticipants: { from: 3, to: 2 } },
  recipients: [{ type: "groupMembers", excludeOrganizer: true }, { type: "pendingApplicants" }] });
// 06 postMessage 後(任意。見送り。送信者と、09 の isBlockedByMe(recipient, sender) が真の受信者を除く)
notify({ kind: "chat_new", groupId, eventKey: "chat",
  params: { groupTitle: g.name, count: 1 },
  recipients: [{ type: "groupMembers", excludeUserIds: [sender.id, ...recipientsBlockingSender] }] });
```

### 11.2 本モジュールが呼ぶ側(依存)
| 呼び先 | 関数 | 用途 |
|---|---|---|
| 00 | `db()`(`notifications`、`members`、`groups`、`joinRequests`、`users`)、`tx()`、`route()`・`c.user`・`c.query`、`clock.now()`・`clock.nowIso()`、`formatJst`、`newId("n")`、`isId`、`v`・`sanitizeText`、`AppError`、`CursorPage<T>`、`LIMITS`、クライアントの `gapi`・`gpost` | 全般 |
| 04(型のみ) | `import type { CancelReasonCode }` | `cancelled.params.reason` [統一 4.3] |
| 09 | `ageBandsOf(userIds)`・`memberSummary(members)`・`formatMemberSummary(s)`(確定時の概要)、`checkText`(試験のみ) | 第 11.3 節、NTF-T-40 |

### 11.3 参加者の概要(確定通知)と 09 の公開範囲ガード
- `notify` が `confirmed` を作る直前に、宛先と同じ参加中メンバーの userId を 09 の `ageBandsOf(userIds)` に渡して年代帯を得て(10 は `db().profiles` を直接読まない)、それを `memberSummary` に渡し、その結果を `formatMemberSummary` で文字列にして `params.summaryText` に保存する(発行時点のスナップショット) [統一 6.3・9.1]。通知側で年代帯を再集計・分類しない。
- 少人数(4 人未満)で年代を出さない規則は 09 の `memberSummary` が持つ(`buckets = null`、`hiddenReason = "few_members"`)。その場合の文言も `formatMemberSummary` が返す。
- `summaryText` は長さ 1〜80 字に検証する。`ageBandsOf`・`memberSummary`・`formatMemberSummary` が例外を投げた場合、または空文字・81 字以上を返した場合は、`summaryText` に固定文「人数のみ(年代の内訳は表示しません)」を入れる(個人を推測できる情報を出さないため)。

### 11.4 他モジュールへの要望
統一仕様書で解決した要望は削除した(旧 R-1 の型・`newId("n")` は統一仕様書 3.1・3.2、旧 R-3 のルート競合は 2.1、旧 R-4 の `evaluateGroupsForUser` は 3.5 の `beforeRequest` で不要、旧 R-5 の `ntf:refresh` は 3.5、旧 R-6 の概要は 6.3 の `formatMemberSummary`、旧 R-9 の辞退の所有は 4.5、旧 R-10 の中止時の申請者は 5.3、旧 R-8 の却下理由の対応表は 5.2・9.1 で却下理由を通知に入れないため不要)。ID は欠番のまま残す。

| ID | 宛先 | 要望 |
|---|---|---|
| R-1 | 00 | seed の統合: 10 が用意する初期通知(各ユーザー 0〜4 件、`n-NNN`)を `group-seed.json` に含め、`resetStore()` で通知も初期化する [統一 11.4] |
| R-2 | 00 | 解消(統一仕様書 3.7): 00 の `formatJst(value: IsoDateTime \| DateStr, pattern?)` を使う。10 の `format.ts` は作らない |
| R-7 | 01/02 | グループ系ページ共通レイアウト(`app/src/app/[campaign]/groups/layout.tsx`)のヘッダーに `NotificationBell` を置く。`new-group`、`invite`、`notifications` の各ページにも同じヘッダーを使う。レイアウトの所有者を 01 または 02 に決め、10 は部品(`@/features/notify/ui`)のみ提供 |
| R-11 | 03 | `status_changed` の購読で、`to === "withdrawal_period"` のとき失効させた申請ごとに `join_expired` を発行する(eventKey `je:<requestId>`、宛先は申請者のみ)。`to === "cancelled"` では発行しない [決定 #22。統一仕様書 5.3・7.4] |

## 12. 試験観点(10 章)と受け入れ条件(NTF-T)

共通の前提: 00 の `resetForTest()` 後の seed と `fixtures.ts`(`GROUP_BY_STATUS` ほか統一仕様書 11.3 の見本)。ダミーユーザー A(幹事)、B・C(メンバー)、D・E(申請者)は seed のダミーユーザー(`fixtures.ts` の ID)を使う。グループ G(最少 3、定員 6)とそのメンバー行は、試験の中で 00 の `insertGroup`・`insertMember` を使い 900 番台の ID(G = `g-901`)で作る [統一 3.7・11.3]。「見送り」と付けた試験は統一仕様書 16.2 の範囲で、主ルートの完了後に行う。テストランナーは Vitest(00 の `vitest.config.ts`、`npm test`) [統一 11.3]。単体試験は関数を直接呼ぶ。HTTP 試験は 00 の `callRoute` で、Cookie `demoUser` を切り替えて行う。

### 12.1 発行・宛先・冪等性
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-01 | D が G に申請 → `notify(join_requested, organizer)` | A に 1 件(`readAt = null`)。B・C・D には作られない。本文に D の名前がない |
| NTF-T-02 | 03 の `approve` → `join_approved`(users:[D]) | D に 1 件。A には作られない。`link.view = "detail"` |
| NTF-T-03 | `reject` → `join_rejected` | D に 1 件。本文に却下理由が含まれない。`link.view = "list"` |
| NTF-T-04 | 最少人数到達(`min_reached`、groupMembers) | A、B、C に各 1 件。`count`/`minParticipants` が本文に入る。D(非メンバー)には作られない |
| NTF-T-05 | 同じ `eventKey="reached"` で `notify` を 2 回 | 2 回目は `created=[]`、`skippedDuplicate` に全宛先。`db().notifications` の件数は増えない |
| NTF-T-06 | 異なる `eventKey`(`jr:jr-001` と `jr:jr-002`)で 2 回 | 2 件作成される |
| NTF-T-07 | 実行確定 `confirmed`(メンバー 4 人) | 4 人に各 1 件。本文に件数と `formatMemberSummary` の概要文字列。名前・ID・性別なし |
| NTF-T-08 | `confirmed`(メンバー 3 人。`memberSummary` が `hiddenReason = "few_members"` を返す)/`formatMemberSummary` が例外 | 前者は本文に年代の分布が出ず、`formatMemberSummary` の文言になる。後者は概要が「人数のみ(年代の内訳は表示しません)」になる |
| NTF-T-09 | `cancelled`(reason `min_not_reached`、メンバー 2 人+申請中 1 人。`groupMembers`+`pendingApplicants`、失効より前に呼ぶ) | 3 人に各 1 件、本文が理由別テンプレートに一致 |
| NTF-T-10 | 中止後に再企画 → 元グループが `replanned`、`replan_invited`(元メンバー A・B・C、失効した申請者 E を `users` で指定、再企画した幹事 A を除外) | B、C、E のみ。`link.groupId = newGroupId`、通知の `groupId` は元グループ |
| NTF-T-11 | 辞退後に `withdrawal_received`(eventKey `wd:wd-001`) | A のみ。本文に辞退者名がない。現在人数が正しい |
| NTF-T-12 | 辞退済み・退会済み(`left`)メンバーを含むグループへ `min_reached` | 参加中(`active`)のみ受信 |
| NTF-T-13 | `conditions_changed`(締切のみ変更)/(最少人数のみ)/(両方なし)。宛先は `groupMembers`(`excludeOrganizer: true`)+`pendingApplicants` | 前 2 つは該当文のみ本文に出る(締切は `M月D日`)。幹事 A には作られず、B・C と申請中の D に作られる。3 つ目は `invalid_input` |
| NTF-T-14 | 見送り(統一仕様書 16.2)。`chat_new` を B が送信 → A、C へ(B を除外) | A、C に各 1 件。B に作られない |
| NTF-T-15 | 見送り(統一仕様書 16.2)。続けて 2 通目(A が未読のまま) | A の `chat_new` は 1 件のまま `count=2`、`createdAt` 更新、一覧の先頭。A がチャットを開いただけでは既読にならない。A が通知画面で項目を開いて既読にした後(`POST /api/me/notifications/read`)の 3 通目は新規 1 件 |
| NTF-T-16 | 見送り(統一仕様書 16.2)。B をブロックしている C を `excludeUserIds` に入れて B が送信 | C に作られない |
| NTF-T-17 | 見送り(統一仕様書 16.2)。`deadline_near` を同じ `deadlineDate` で 2 回/締切延長後 | 前者は 1 件、後者は新キーで再通知 |
| NTF-T-18 | `recipients` が空または全員除外 | 例外なし、`recipientCount = 0`、通知増えない |
| NTF-T-19 | G(人数 3、申請中 D・E)が締切で `withdrawal_period` へ(T5)→ 03 が D・E の申請を `expired` にして `join_expired` を発行。別に、中止(T4)で申請が失効するケース | 前者: D、E に各 1 件(`link.view = "list"`、本文に人数・概要・他者の名前がない)。メンバー A・B・C には `withdraw_period_started` のみ。同じ申請で再度呼んでも増えない。後者: 申請者には `cancelled` のみで `join_expired` は作られない |

### 12.2 取得・既読・件数・権限
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-20 | A で `GET /api/me/notifications` | A 宛のみ、新しい順。各要素に `title`/`body`/`link`/`read`。`params`・`userId`・`dedupeKey` を含まない |
| NTF-T-21 | B に切り替えて同 GET | B 宛のみ(A 宛の通知 ID が出ない) |
| NTF-T-22 | 未読 3 件の A で `GET /api/me/unread-count` | `{count:3}` |
| NTF-T-23 | A が通知 1 件に `POST /api/me/notifications/read`(`{id}`) | 200、`read:true`。`unread-count` が 2 |
| NTF-T-24 | 同じ通知にもう一度 `read` | 200、`readAt` 不変、件数不変 |
| NTF-T-25 | B が A の通知 ID で `read` | 404 `not_found`。A の通知は未読のまま |
| NTF-T-26 | 存在しない ID `n-999999`/形式不正 `../x` | 前者は 404 `not_found`。後者は 400 `invalid_input`(`fields.id`) |
| NTF-T-27 | 見送り(統一仕様書 16.2)。`read-all`(グループ指定なし) | `updated` = 未読数。以後 `unread-count = 0` |
| NTF-T-28 | 見送り(統一仕様書 16.2)。`read-all` に `groupId = G` | G の通知のみ既読。他グループの通知は未読 |
| NTF-T-29 | `?unread=1` | 未読のみ |
| NTF-T-30 | `?limit=0`(代表)。`?limit=101`、`?limit=abc`、不明な `cursor`(`n-999999`)は見送り(統一仕様書 16.2) | いずれも 400 `invalid_input`(不明な `cursor` は `reason: "cursor_not_found"`) |
| NTF-T-31 | 通知 35 件で `limit` 省略 → `nextCursor` で続き | 1 回目 30 件+`nextCursor`、2 回目 5 件+`nextCursor:null`。重複・欠落なし |
| NTF-T-32 | `resetStore()`(`POST /api/demo/reset`) | 通知が seed の状態に戻る |
| NTF-T-33 | `POST /api/me/notifications`(作成を試みる) | 405。通知を作る API はない |
| NTF-T-34 | `POST /api/me/notifications/read` を (a) `Content-Type: text/plain` (b) `Origin: http://evil.example` で送る | (a) 415 (b) 403。いずれも通知は未読のまま |

### 12.3 保持・テンプレート・安全
| ID | 入力 | 期待結果 |
|---|---|---|
| NTF-T-35 | 見送り(統一仕様書 16.2)。1 ユーザーに 101 件発行 | 100 件に保たれ、既読の古い順に削除。全て未読なら全体の最古を削除 |
| NTF-T-36 | 見送り(統一仕様書 16.2)。既読後 15 日経過(`clock.set`)で `notify`/一覧 | その既読は削除。未読は残る |
| NTF-T-37 | `groupTitle = "<script>alert(1)</script>"` で発行 → 画面表示 | DOM に `<script>` 要素が生成されず、文字列としてそのまま表示される |
| NTF-T-38 | `groupTitle = "$&$1‮\u0000あ"` | 描画結果に `$&` がそのまま出て二重展開なし。制御・双方向制御文字が除去される(00 の `sanitizeText`) |
| NTF-T-39 | `groupTitle` が `LIMITS.GROUP_NAME.max` + 1 字(代表)。空・空白のみは見送り(統一仕様書 16.2) | いずれも `invalid_input` |
| NTF-T-40 | 全 14 種類 × `cancelled` の全理由(5 値)のテンプレートを 09 `checkText` と禁止語リスト(相乗り、マッチング、恋愛連想語)で走査 | 違反 0 件 |
| NTF-T-41 | `params` に未定義キー(`message: "..."`)と `confirmed` の `summaryText` を渡す | 例外にならず、保存された `params` に `message` が無い。`summaryText` は 10 が作った値に置き換わる |
| NTF-T-42 | `count = -1`(代表)。`1.5`、`1000`、`"3"` は見送り(統一仕様書 16.2) | いずれも `invalid_input` |
| NTF-T-43 | 既存 `/api/v2/notifications` と `/api/v2/notifications/unread` | 本機能の追加前後で応答が同一(固定 1 件、`count:1`) |
| NTF-T-44 | 全 kind の本文・API 応答の文字列を検索 | 申請者名・辞退者名・送信者名・チャット本文・ひとことが含まれない |
| NTF-T-45 | `cancelled` を 5 理由で発行(`min_not_reached`・`below_min_in_withdrawal` は `minParticipants` あり/なし) | 各理由の本文(第 4.2 節)になる。`organizer_left` は末尾の案内なし。`minParticipants` 欠落の 2 ケースは `invalid_input`。列挙外の `reason` も `invalid_input` |
| NTF-T-46 | 呼び出し側の `tx` 内で `notify` の後に例外 | `db().notifications` の件数と `newId("n")` の連番が開始前と同じ(巻き戻し) |
| NTF-T-47 | `GET /api/me/notifications?foo=1`(未知のクエリキー)/`POST /api/me/notifications/read` に本文 `{ "id": <A の通知 ID>, "foo": 1 }` | 前者は 400 `invalid_input`(`fields.foo`)。後者は未知のキーが捨てられて 200 [統一 3.4] |

### 12.4 画面(手動確認 または E2E)
| ID | 手順 | 期待結果 |
|---|---|---|
| NTF-T-50 | 未読 0 件のユーザーで通知画面 | 空状態の文言と「グループを探す」リンクが出る(第 14.3 節) |
| NTF-T-51 | 未読 3 件でグループ一覧を開く | ベルに「3」のバッジ。`aria-label` が「グループの通知(未読3件)」 |
| NTF-T-52 | 未読の通知をクリック | 既読になり、リンク先(第 7.4 節)へ遷移。既読化に失敗しても遷移する |
| NTF-T-53 | 別タブ(幹事)で承認 → 申請者タブで 15 秒以内 | バッジが増える(ポーリング)。画面を手動更新しなくても反映 |
| NTF-T-54 | 「日付を進める」で締切を超えて中止 | `ntf:refresh` 後の取得で、`beforeRequest` の評価により中止の通知がバッジに反映 |
| NTF-T-55 | キーボードのみで一覧を操作(Tab、Enter) | 全項目・ボタンに到達・操作可能。フォーカスが見える |
| NTF-T-56 | スマホ幅(幅 360px) | 横スクロールなし。タップ領域 44px 以上 |
| NTF-T-57 | ネットワーク失敗(API 500) | エラー文言と再試行ボタン。既存画面は使える |

## 13. 実装タスク(NTF-TASK)

規模: S=半日以内、M=1 日程度、L=複数日。「前提」は先に完了が必要なタスク。00 の項目は 00 の実装に依存。

| ID | タスク | 規模 | 前提 | 完了条件 |
|---|---|---|---|---|
| NTF-TASK-01 | 型定義 `features/notify/types.ts`(第 5.1 節)と種類のメタ情報(`kinds.ts`: kind ごとの `defaultView`、必須/任意の区分) | S | 00 の型(`Id`、`IsoDateTime`、`DateStr`、`CursorPage`)、04 の `CancelReasonCode` | `tsc` が通る |
| NTF-TASK-02 | 文言 `features/notify/messages.ts`(第 4.2 節のテンプレート。`cancelled` は 5 理由)、`render.ts` の `fillTemplate`・`formatChanges`(日時・日付の整形は 00 の `formatJst`。`format.ts` は作らない [統一 3.7]) | S | NTF-TASK-01、00 の `formatJst` | NTF-T-37・38 の単体が通る |
| NTF-TASK-03 | パラメータ検証 `features/notify/params.ts`(第 9.1 節。00 の `v` で kind ごとのスキーマ、未知キーは捨てる) | M | NTF-TASK-01、00 の `v` | NTF-T-39・41・42 |
| NTF-TASK-04 | `renderNotification`(純粋関数、未知 kind で例外)と DTO 変換 | S | NTF-TASK-02、03 | NTF-T-40・45 |
| NTF-TASK-05 | `resolveRecipients`(第 6.5 節) | S | NTF-TASK-01(+00 の `db()`) | NTF-T-04・12・14・16・18 |
| NTF-TASK-06 | `notify`(冪等、`confirmed` の概要付与。`chat_new` の集約は見送り)と `pruneNotifications`(見送り。統一仕様書 16.2) | M | NTF-TASK-03〜05、09 `ageBandsOf`・`memberSummary`・`formatMemberSummary`(未完成ならスタブ) | NTF-T-01〜13、18、46(NTF-T-14〜17・35・36 は見送り) |
| NTF-TASK-07 | `listNotifications`、`unreadCount`、`markRead`、`markAllRead`(見送り)(`service.ts`) | M | NTF-TASK-01、04 | NTF-T-20〜26・29〜31 の単体部分(NTF-T-27・28 は見送り) |
| NTF-TASK-08 | `handlers.ts`(00 の `route()` で包んだハンドラ 4 本)と `app/api/me/` の `route.ts` 4 本(再エクスポートのみ。NTF-API-01〜04。NTF-API-04 は見送り。統一仕様書 16.2) | M | NTF-TASK-07、00 の `route()` | NTF-T-20〜26・29〜34・47(HTTP。NTF-T-27・28 は見送り) |
| NTF-TASK-09 | seed の初期通知の断片(必須 12 種から選ぶ。00 が `group-seed.json` に統合)と `resetStore` 確認 | S | NTF-TASK-01 | NTF-T-32 |
| NTF-TASK-10 | クライアント `features/notify/client.ts`(00 の `gapi`・`gpost` を呼ぶ薄い関数)、`useUnreadCount`、`useNotifications`(ポーリング、`ntf:refresh`、visibility 停止) | M | NTF-TASK-08 | NTF-T-53 |
| NTF-TASK-11 | UI 部品 `NotificationBell`、`NotificationList`、`NotificationItem`(アクセシビリティ込み) | M | NTF-TASK-10 | NTF-T-50〜52、55、56 |
| NTF-TASK-12 | 画面 `app/[campaign]/notifications/page.tsx` と、グループ共通レイアウトへのベル設置(01/02 と調整。R-7) | S | NTF-TASK-11 | NTF-T-51 |
| NTF-TASK-13 | 他モジュール(03/04)への組み込み支援: 呼び出し例のレビュー、eventKey の対応表の確認、03 の `join_expired`(R-11)、結合試験 | M | NTF-TASK-06、08(03/04 の実装) | NTF-T-01〜13、19 を実データで通す |
| NTF-TASK-14 | 静的試験(禁止語走査 NTF-T-40、既存モック無変更 NTF-T-43、個人情報の非掲載 NTF-T-44) | S | NTF-TASK-04、13 | 違反 0 件 |
| NTF-TASK-15 | 見送り(統一仕様書 16.2)。任意(余力)の `chat_new`(06)と `deadline_near`(04)の組み込み・試験 | S | NTF-TASK-13 | NTF-T-14〜17 |

推奨順: NTF-TASK-01 → 02 → 03 → 04 → 05 → 06 → 07 → 08 → 10 → 11 → 12 → 13 → 14 → 15。NTF-TASK-09(seed)は NTF-TASK-01 の完了後いつでも着手できる。必須の通知(種類 1〜12)は NTF-TASK-13 までで揃う。NTF-TASK-15 と、各タスクの中の「見送り」の項目は主ルートの完了後に行う(統一仕様書 16.2)。 [案]

## 14. 画面コンポーネント構成(NTF-UI)

### 14.1 ファイル
```
app/src/features/notify/
  index.ts            公開 API(notify, 型, RecipientSpec)
  types.ts            第 5.1 節の型
  kinds.ts            kind のメタ情報(defaultView、必須/任意)
  messages.ts         テンプレート文言(kind × 理由)
  params.ts           params の検証スキーマ(00 の v)
  render.ts           fillTemplate, renderNotification, toDto
  recipients.ts       resolveRecipients
  service.ts          notify, list, unreadCount, markRead, markAllRead, prune
  handlers.ts         00 の route() で包んだ Route Handler の実体(NTF-API-01〜04)
  client.ts           ブラウザ用。00 の gapi/gpost を呼ぶ薄い関数(/api/me/...)
  ui/
    NotificationBell.tsx
    NotificationList.tsx
    NotificationItem.tsx
    useUnreadCount.ts
    useNotifications.ts
app/src/app/api/me/notifications/route.ts             NTF-API-01(GET を再エクスポート)
app/src/app/api/me/unread-count/route.ts              NTF-API-02
app/src/app/api/me/notifications/read/route.ts        NTF-API-03
app/src/app/api/me/notifications/read-all/route.ts    NTF-API-04(見送り)
app/src/app/[campaign]/notifications/page.tsx         一覧ページ(クライアントコンポーネント)
```
`ui/` は `"use client"`。`service.ts` 等のサーバー側コードをクライアントから import しない(型は `import type` のみ)。`api/me/notifications/` の下は静的セグメント(`read`、`read-all`)だけで、動的セグメントを並べない(統一仕様書 2.1 R-2)。`_` で始まるフォルダは作らない(R-1)。Next.js 16 の Route Handler と `cacheComponents` の挙動は、実装着手時に確認する事項(判断は不要。統一仕様書 14.2)とし、00 の `route()` が `req.headers` を最初に読む対策に従う。

### 14.2 コンポーネント
| コンポーネント | props | state・データ取得 | 責務 |
|---|---|---|---|
| `NotificationBell` | `{ base: string }`(`/${campaign}`) | `useUnreadCount()` | ベルアイコン+未読バッジ。`${base}/notifications` へのリンク。Mantine `Indicator`(`label` に件数、99 超は「99+」、0 なら非表示)。`aria-label` は「グループの通知(未読N件)」。視覚的に隠した `aria-live="polite"` 領域で件数が増えたとき「新しい通知があります」を告知 |
| `NotificationList`(ページ本体) | なし | `filter: "all" \| "unread"`、`items`、`nextCursor`、`status: "loading" \| "ready" \| "error"`、`useNotifications({ filter })` | ヘッダー(「グループの通知」+「モック(ローカル)」表示)、フィルタ(すべて/未読)、「すべて既読にする」(`read-all`。見送り。統一仕様書 16.2)、リスト、「もっと見る」、空/エラー状態 |
| `NotificationItem` | `{ item: NotificationDto; onOpen: (item) => void }` | なし | 1 件の表示。全体を 1 つのリンク(`Link`)にする。`onClick` で `onOpen`(`markRead`)を開始し、完了を待たずに `Link` の遷移を行う(既読化の失敗は遷移を妨げない。NTF-T-52)。タイトル、本文、日時(00 の `formatJst` の絶対表記。相対表記は使わない)、未読ラベル |
| `useUnreadCount(intervalMs?)` | 既定 15000 | `count`、`refresh()` | ポーリング、可視性制御、`ntf:refresh`/focus で再取得 |
| `useNotifications(opts)` | `{ filter, groupId? }` | `items`、`nextCursor`、`loadMore()`、`markRead(id)`、`markAll()`(見送り)、`reload()` | 一覧の取得・追加読み込み・既読化・10 秒ポーリング。既読化は楽観更新し、失敗時は戻す |

### 14.3 表示規則
- 一覧は `<ul>` の `<li>` 構成(スクリーンリーダーが件数を読める)。新しい順。日時は 00 の `formatJst`(日本時間)。
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
- 00(`db()`・`tx()`、`route()`、`clock`、`formatJst`、`newId`・`isId`、`v`・`sanitizeText`、`AppError`、`CursorPage`、`LIMITS`、`gapi`・`gpost`)。09(`ageBandsOf`・`memberSummary`・`formatMemberSummary`、試験で `checkText`)。04 は型(`CancelReasonCode`)だけを `import type` で参照する。
- 実行時の依存の向きは 10 → 00、09 だけ [統一 4.6]。10 から 04 を呼ばない(状態の評価は 00 の `beforeRequest` が行う)。
- 呼ぶ側: 03(`join_requested`、`join_approved`、`join_rejected`、`join_expired`)、04(`min_reached`、`withdraw_period_started`、`withdraw_period_ending`、`confirmed`、`cancelled`、`replan_invited`、`withdrawal_received`、`conditions_changed`、任意の `deadline_near`。見送り)、06(任意の `chat_new`。見送り)。08 は通知を呼ばない(`rally_reward` は作らない [統一 7.8])。

### 15.2 利用ライブラリ・モジュール
既存の依存(app/package.json)の範囲で実装し、本モジュールのために実行時の依存ライブラリを追加しない。 [案]

| 種別 | 名前 | 本モジュールでの用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| フレームワーク | Next.js(`next`) | Route Handler(NTF-API-01〜04)、`next/link` の `Link`、`next/navigation` の `useParams` | MIT | app/package.json の 16.4.5 を維持 |
| UI | React、React DOM(`react`、`react-dom`) | 画面部品、`useState`/`useEffect` による取得とポーリング | MIT | 19.3.0 を維持 |
| UI | Mantine Core(`@mantine/core`) | `Indicator`(未読バッジ)、`ActionIcon`、`Text`、`Badge`、`Button`、`SegmentedControl`(すべて/未読)、`Skeleton`、`Alert`、`VisuallyHidden` | MIT | ^9.7.5 を維持 |
| UI | Mantine Hooks(`@mantine/hooks`) | `useDocumentVisibility`(非表示中のポーリング停止)、`useWindowEvent`(`focus`・`ntf:refresh`)、`useReducedMotion` | MIT | ^9.7.5 を維持(フック名は実装着手時に確認する事項。判断は不要。統一仕様書 14.2) |
| アイコン | Tabler Icons(`@tabler/icons-react`) | `IconBell`(既存ベルと同じアイコン) | MIT | ^3.51.0 を維持 |
| 試験(開発時のみ) | Vitest | 単体・HTTP 試験(NTF-T) | MIT | 00 が devDependency として導入する(最新の安定版。統一仕様書 11.1・11.3) |
| 型・静的検査(開発時のみ) | TypeScript、ESLint、`eslint-config-next` | 型検査、`react/no-danger` による `dangerouslySetInnerHTML` の検出 | Apache-2.0、MIT、MIT | 現行(^5、^9、16.4.5)を維持 |
| Node 標準モジュール | なし | サーバー側は TypeScript のみで書き、`node:*` を直接 import しない(ID 採番は 00 の `newId`) | - | - |
| 自前(00) | `lib/groups-store.ts`(`db`・`tx`・`resetStore`)、`lib/clock.ts`、`lib/datetime.ts`(`formatJst`)、`lib/ids.ts`、`lib/errors.ts`、`lib/api-route.ts`、`lib/validation.ts`、`lib/limits.ts`、`lib/groups-api.ts` | Store、`route()`(入口検査・`beforeRequest`)、`clock`、`formatJst`(本文と画面の日時の整形)、`newId`・`isId`、`AppError`、`v`・`sanitizeText`、`LIMITS`、クライアントの `gapi`・`gpost`(`ntf:refresh` の発火) | - | 00 の確定に従う |
| 自前(09) | `ageBandsOf`、`memberSummary`、`formatMemberSummary`、`checkText` | 確定通知の概要(第 11.3 節)、禁止語の試験(NTF-T-40) | - | 09 の確定に従う |

自前実装にするもの・使わないもの:

| 機能 | 採用 | 理由 |
|---|---|---|
| 日時の整形 | 00 の `formatJst` | サーバーの本文と画面の表示で同じ関数を使い、dayjs に依存しないため(統一仕様書 3.7)。本モジュールは dayjs を import しない |
| テンプレートの差し込み | 自前の `fillTemplate` | 置換対象が `{key}` のみで、正規表現 1 行で足りるため(Handlebars 等は使わない) |
| params の検証 | 00 の `v` で kind ごとのスキーマを `params.ts` に定義 | kind ごとの固定スキーマで足り、zod 等を追加しない(統一仕様書 11.1)。未知キーの扱いと文字列の正規化を 00 にそろえるため |
| 取得・ポーリング | 自前のフック(`setInterval` + 00 の `gapi`) | 対象 API が 2 本で、SWR・TanStack Query のキャッシュ制御が不要なため |
| リアルタイム通知 | 使わない(SSE、WebSocket、Web Push) | ポーリングで足り、localhost 完結・外部サービス不使用(rule.md 3・6)に従うため |
| 状態管理 | Zustand は使わない | 状態はコンポーネント内の state とイベント `ntf:refresh` で足りるため |
| 相対日時 | 相対表記は使わない | デモ時計で日時を進めるため、絶対表記の方が状態と対応づけやすい |
| i18n | ライブラリを使わない | デモは日本語のみ(README 4.4)。文言は `messages.ts` に集約する |

## 16. 未決事項(docs/design 12 章との対応)

- #26 通知の種類: 必須 12 種類・任意 2 種類で確定 [決定 #1・#22]。日時判定のデモ方法は 00 の `clock` と `/api/demo/clock` に従う。
- #23 再企画の案内の対象: 中止時の参加者と失効した申請者。辞退者と幹事を除く [統一 5.4]。確定・中止の概要の粒度は 09 の `memberSummary` の規則に従う。
- #15 却下理由を `join_rejected` に載せるか: 解消(統一仕様書 5.2・9.1)。載せない。却下理由は申請者の画面で表示する。
- `organizer_cancelled` の本文に幹事が選んだ中止理由(04 の `OrganizerCancelReason`)の定型文を含めるか: 解消(統一仕様書 4.3)。含めない。幹事の中止理由は 04 の `LifecycleView.organizerCancelReason` で画面に表示する。
- 締切接近の発行時刻(24 時間前)と、04 の評価・日付を進める操作との整合(任意の種類のため実装時に決める)。見送り(統一仕様書 16.2)。
- 保持件数(100 件)・期間(14 日)の値(削除の処理は見送り。統一仕様書 16.2)、ポーリング間隔(15/10 秒)の値。
- 通知の永続化(00 の永続化方針に従う。インメモリなら再起動で seed に戻る)。見送り(統一仕様書 16.2)。
- 通知の削除ボタン・通知設定(種類ごとのオフ)は設けない [案]。

## 17. 設計上の確認事項(docs/design・統一仕様書・他モジュールとの差異)

1. **05 章の種類との差異**: 05 章は 8 種類。本書は必須 12 種類+任意 2 種類(追加: 参加申請の受付・承認・却下・受付終了、チャット新着、締切接近)。05 章・04 章(通知一覧の種類の列挙)と 02 章(柱 18 の要件)の更新が必要(統一仕様書 第 12 章で 8 → 12 種類に更新する)。 [差異]
2. **`join_expired`(オーナー判断 #22)**: 解消(統一仕様書 5.3・7.4・9.1・第 12 章)。統一仕様書は必須 12 種に更新済みで、本書の `join_expired`(03 の `status_changed` 購読で `to === "withdrawal_period"` のときだけ発行。R-11)と一致する。
3. **04 章の画面記述**: 通知は「通知の一覧」のみで、未読バッジ・既読操作・遷移先の記載がない。本書は案 A(別画面+専用ベル)で補った。 [不足]
4. **README との差異**: 骨子の `notify(userId, type, groupId, vars)` は廃止し、`notify(input: NotifyInput)` に統一(統一仕様書 9.1)。依存図は 10 → 00、09 にする(統一仕様書 4.6)。
5. **00 との差異**: 00 の `Notification`(`type`/`vars`/`read`)と `NotificationType`(lowerCamelCase)は本書の `GroupNotification` に置き換える(統一仕様書 3.1。00 は型の所在一覧に縮小)。通知の一覧は `CursorPage`(00 の `lib/groups-types.ts`)で、`limit` の既定 30・最大 100 は本モジュールの定数とする(解消。統一仕様書 2.3・3.7)。日本時間の整形は 00 の `formatJst` を使い、10 の `format.ts` は作らない(解消。統一仕様書 3.7。R-2)。
6. **既存 `/api/v2/notifications/unread`**: 常に `count:1` を返すため、既存ベルのバッジは常に表示される。本機能のバッジとは独立。混乱を避けるため画面名を分ける。既存挙動の変更はしない。
7. **他モジュールの詳細設計との差異**(2026-11-09 時点。各モジュールは統一仕様書に合わせて改訂中) [要確認]:
   - 03: `join_withdrawn` の追加要望は採らない(統一仕様書 9.1)。`join_expired` の発行元を遅延失効 `settleRequestsIfClosed` から `status_changed` の購読に移し、送るのは `withdrawal_period` への遷移時だけにする(R-11)。`notify` の例外をキャッチする案は、購読処理の中だけに限る(第 6.1 節)。却下理由は本文に入れない(解消。統一仕様書 5.2・9.1。R-8 は欠番)。
   - 04: `lc_*` の種類名・追加案(`lc_min_lost`、`lc_headcount_changed`、`lc_capacity_full`)、`opts.dedupeKey`、`summarizeParticipants` は廃止(統一仕様書 7.5・6.3)。条件変更の宛先: 解消(統一仕様書 9.1)。幹事を除く参加中メンバーと申請中の申請者で、04 が `recipients: [{type:"groupMembers", excludeOrganizer: true}, {type:"pendingApplicants"}]` で指定する。
   - 06: 集約は 10 が行い、06 は投稿ごとに `notify` を呼ぶ(統一仕様書 7.7)。`chat_new` の既読化は 10 の通知画面で行う(統一仕様書 7.7・9.2)。`chat_new` は見送り(統一仕様書 16.2)。
8. **日時**: 保存は `clock.nowIso()`(`+09:00`)、締切は `deadlineDate`(日付)を表示し、`deadline_near` は `deadlineAt` も保持する(統一仕様書 4.2)。

## 18. 実装メモ(デモ範囲)

- 最小実装: 必須の種類 1〜12(NTF-TASK-01〜13)。バッジは遷移時+30 秒ポーリングでもよい。
- 見送り(統一仕様書 16.2): 任意の `chat_new`・`deadline_near`(NTF-TASK-15、NTF-T-14〜17)、`read-all`(NTF-API-04、NTF-FN-05、NTF-T-27・28、「すべて既読にする」、`markAll()`)、保持件数 100 件・保持期間 14 日による削除(`pruneNotifications`、NTF-T-35・36)、ポーリング間隔の段階的な延長、通知の永続化、差分による推測への対策、形式不正の網羅試験(NTF-T-30・39・42 は代表のケースだけを行う)、`cursor_not_found` の個別表示、描画失敗時の汎用文面。
- 外部通知・メール・LINE、リアルタイム通信、通知設定画面は作らない。
- 既存コード(`api/v2`、`news`、`notice`、`AppShell`、`server-store.ts`)は変更しない。
