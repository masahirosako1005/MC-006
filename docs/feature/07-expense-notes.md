# 07 費用の分担メモ(07-expense-notes)

状態の凡例は [README](README.md) 1 章に従う。ID 接頭辞は `EXP`(EXP-DEC 判断、EXP-FN 関数、EXP-API API、EXP-UI 画面部品、EXP-T 試験、EXP-TASK 実装タスク)。モジュール間で共有する名前・署名・パス・値は [統一仕様](_unified-contracts.md)(以下「契約書」)を正とする。

## 1. 概要と責務 / 対応する柱

- 柱16「費用の分担メモ」。グループ内の費用項目(名目・金額・立て替えた人・対象メンバー・日付・メモ)を記録し、一覧と分担額の目安を計算して表示する。 [案]
- 利用できるのはグループが実行確定(`confirmed`)以降のときに限る。記録(追加・編集・削除)は `confirmed`、`in_progress`、`completed` で可能で、それ以前の状態と `cancelled`、`replanned` では閲覧のみ [決定 3]。完了後も編集できることは [決定 23] で確定した。可否は 04 の `canEditExpenses(g): boolean` で判定する(契約書 4.4、7.9)。
- **決済・送金・請求・外部決済サービスへの誘導は持たない**(docs/design 02・05・07 章。[案]として維持。オーナーの確定ではない)。画面には常に「記録のみ・送金はできない」を明記する。
- 本モジュールは金額を「表示用の目安」として計算するだけで、支払い済み・未払いなどの状態は持たない。
- 優先度は B(README 2 章)。実装順は 11 章のタスク分解に従い、最小は「追加・一覧・合計」、次に「分担の表示計算」、最後に「精算の目安」。

### 1.1 判断が必要な論点と選択肢(EXP-DEC)

**EXP-DEC-01 計算の範囲 [未決 #11]**

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| A 記録のみ | 項目の一覧と合計だけ。分担の計算なし | 実装量が最小。金銭トラブルに関わる範囲が最も小さい | 各自の負担額が分からず、メモとしての用途が限られる。柱16 の「分担」を満たしにくい |
| B 一人あたり目安(**本書の暫定採用**) | 項目ごとの一人あたり額と、メンバーごとの「立替額・負担額・差額」を表示 | 支出の合計と各自の負担額が分かる。決済の機能を持たずに済む | 端数ルールの説明が要る。計算を誤ると記録の信頼性が下がる |
| C 精算の目安まで | B に加え「誰が誰にいくら」を最少送金回数で提示 | 精算の手間が最も少ない | 送金の指示と受け取られやすいため、注意書きと文言の制御が必須。試験量が増える |

- [案] B を基本とし、C は同じ `GET G/expense-summary` の `transfers` として実装するが、定数 `EXPENSE_TRANSFER_HINT_ENABLED`(`constants.ts`)で表示を切れるようにする。#11 が A に決まったら `expense-summary` API と `split.ts` / `settlement.ts` を未使用にでき、一覧と合計だけが残る。

**EXP-DEC-02 端数処理(円未満の扱い)**

| 案 | 内容 | 合計の一致 | 特徴 |
|---|---|---|---|
| a 切り上げ | 一人あたりを切り上げ | 合計を超える | 単純だが合計と一致しない |
| b 切り捨て | 一人あたりを切り捨て | 合計に足りない | 同上 |
| c 最後の人に寄せる | 全員が切り捨て額、最後の人が残りを負担 | 一致 | 特定の人が常に多く負担 |
| d 先頭から 1 円ずつ(**本書の暫定採用**) | 切り捨て額を基本に、余り(円)を並び順の先頭から 1 円ずつ上乗せ | 一致(厳密) | 差は最大 1 円。並び順を固定すれば結果が決定的 |

- [案] d。並び順は対象メンバーの `userId` 昇順(文字列比較)。理由: 合計が必ず一致し、誰が多く負担するかが入力順や表示順に依存しない。差は最大 1 円で、画面に「端数は 1 円単位で調整」と注記する。

**EXP-DEC-03 編集権限**

| 案 | 内容 | メリット | デメリット |
|---|---|---|---|
| P1 メンバー全員が追加・編集・削除(**本書の暫定採用**) | docs/design 05 章の案と一致。`createdBy`/`updatedBy` を記録 | 幹事に負担が集中しない。05・06・07 で権限が揃う | 他人の項目を書き換えられる |
| P2 追加は全員、編集・削除は作成者または幹事 | 骨子(旧版)の案 | 誤編集を防ぐ | 幹事の権限範囲が未決(#13)。幹事不在時に誰も直せない |
| P3 追加は全員、編集・削除は作成者のみ | 最も単純な所有者制 | 責任が明確 | 作成者が退会すると修正できない |

- [案] P1。項目に最終更新者と更新日時を表示して誤編集を抑止し、楽観ロック(4.3)で他のメンバーの更新を上書きしないようにする。判定は `canModifyExpense`(EXP-FN-06)1 か所に集約し、P2/P3 へ切り替えても API・画面を変えずに済むようにする。docs/design 05 章が P1 を案として記しているため、骨子旧版の P2 から変更した(13 章 1)。

**EXP-DEC-04 退会したメンバーが関わる費用の扱い [決定 18]**

- 退会・辞退したメンバーの記録は残し、表示名を「元メンバー」とする(契約書 10.6)。項目は削除しない(削除すると精算の目安の計算結果が変わるため)。個人名は残さない。サマリには含め、「元メンバー」の印を付ける。
- 新規追加と編集後の保存では、元メンバーを立て替えた人・対象メンバーに新たに指定できない(既存の指定は維持できる)。元メンバー本人は退会後にこのタブを見られない(非メンバーとして扱う)。
- 退会の検知は `member_left` イベントの購読で行う(EXP-FN-08)。発行元は 04 の `withdraw` で、`Withdrawal` を作成した後に発行する(契約書 4.5、4.6)。01 の `markMemberLeft` はイベントを発行しない。
- 不採用とした案: (i) 退会時に退会者の項目を削除する(精算の目安が変わる)、(ii) 退会者の名前を残す(個人名が残る)。

## 2. 既存機能との関係

- 新規。既存の `/api/v2` モック・`server-store.ts` は変更しない(README 2 章)。ストアは 00 の `db().expenses`(`Repo<ExpenseNote>`、globalThis インメモリ)を使い、書き込みは 00 の `tx()` 内で行う(契約書 3.1)。
- 他モジュールの権限・状態に依存する(10 章)。実行時に import するのは 00、04、09 だけ(契約書 4.6 の依存の向き)。決済に関わる既存機能はない。

### 2.1 利用ライブラリ・モジュール

新規に追加するライブラリは Vitest(開発時のみ)だけとする(契約書 11.1)。それ以外は app/package.json の既存依存と自前モジュールで実装する。ライセンスは docs/design 08 章の一覧に載せる(EXP-TASK-01)。

| 名前 | 種別 | 用途 | ライセンス | バージョン方針 |
|---|---|---|---|---|
| Next.js(`next`) | フレームワーク(既存) | Route Handler(EXP-API)、App Router のページ | MIT | app/package.json の 16.4.5 を維持 |
| React / React DOM | ライブラリ(既存) | 画面部品(EXP-UI)、出力のエスケープ | MIT | 19.3.0 を維持 |
| `@mantine/core` | UI ライブラリ(既存) | `Modal`、`NumberInput`、`TextInput`、`Textarea`、`Checkbox.Group`、`Table`、`Card`、`Button`、`Alert` | MIT | ^9.7.5 を維持 |
| `@mantine/hooks` | UI ライブラリ(既存) | `useDisclosure`(モーダルの開閉)、`useMediaQuery`(表とカードの切替) | MIT | ^9.7.5 を維持 |
| `@tabler/icons-react` | アイコン(既存) | 注意書き・差額表示のアイコン(文字と併用) | MIT | ^3.51.0 を維持 |
| dayjs | ライブラリ(既存) | 日付・更新日時の表示整形(日本時間) | MIT | ^1.11.23 を維持 |
| TypeScript | 開発ツール(既存) | 型検査 | Apache-2.0 | ^5 を維持 |
| ESLint / `eslint-config-next` | 開発ツール(既存) | `npm run lint`(00 の `react/no-danger` 設定を含む) | MIT | ^9 / 16.4.5 を維持 |
| Vitest | 開発ツール(新規。devDependency) | 純粋関数・service・Route Handler の自動試験(9 章)。00 の `vitest.config.ts` と `npm test` を使う [決定 11] | MIT | 最新の安定版を使う |
| ECMAScript 標準(`Intl.NumberFormat`、`Number.isSafeInteger`、`Map`) | 言語標準 | 金額の桁区切り表示、整数判定、集計 | - | Node.js・ブラウザの標準機能 |
| 00 共通基盤(`lib/groups-store.ts` の `db()`・`tx()`、`errors.ts`、`validation.ts`(`v`・`sanitizeText`)、`limits.ts`(`LIMITS`)、`clock.ts`、`ids.ts`(`newId`・`isId`)、`authz.ts`(`activeMembers`)、`api-route.ts`(`route()`)、`query.ts`(`parsePage`・`paginate`)、`events.ts`(`on`)、`groups-api.ts`、`components/groups/common/*`) | 自前モジュール(他モジュール) | ストアと `tx`、エラー、検証、上限値、時計、ID 採番、メンバー一覧、API 共通ラッパー、ページング、ドメインイベント、クライアントの fetch、共通 UI | - | 00 に従う |
| 04・09 の公開関数 | 自前モジュール(他モジュール) | グループ状態による可否と状態の表示名(04)、アクセス判定・子資源の所属確認・禁止表現・公開範囲(09) | - | 10.1 の契約に従う |
| `split.ts`、`settlement.ts` | 自前モジュール(本モジュール) | 分担額・差額・精算の目安の計算 | - | 自前実装。円の整数の四則演算だけで足りるため、金額計算ライブラリ(dinero.js 等)は使わない |
| `validate.ts` | 自前モジュール(本モジュール) | 入力検証 | - | 自前実装。00 の `v` を使い、メンバー所属と元メンバーの扱いだけを加える(zod 等は追加しない。契約書 11.1) |
| `text-guard.ts` | 自前モジュール(本モジュール) | 決済・連絡先への誘導の検査 | - | 自前実装。語の配列と数個の正規表現で足りるため |

- 使わないもの: `@mantine/dates`(日付入力はブラウザ標準の `<input type="date">` を Mantine の `TextInput type="date"` で使う。値がそのまま `YYYY-MM-DD` になり、追加のスタイル読み込みが不要なため)、`@mantine/form`、zod、SWR(契約書 11.1)、Zustand(状態は画面部品の中で完結するため)、Node.js 標準モジュール(`crypto`、`fs` 等。ID 採番と時刻は 00 が扱う)。

## 3. 画面・UI(docs/design/04 章「費用の分担メモ」)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| 費用メモタブ(一覧+合計+注意書き) | 費用の分担メモ(「メモであり送金はできない」と明記) | `/[campaign]/groups/[groupId]?tab=expense` |
| 追加・編集フォーム(モーダル) | 同上 | 同タブ内 |
| 分担のまとめ(サマリ) | 同上 | 同タブ内(折りたたみ可) |

### 3.1 画面部品(EXP-UI)

配置: `app/src/features/groups/expense/ui/`。Mantine 9 を使う(既存画面と同じ)。クライアントコンポーネントには `"use client"` を付ける。データ取得は 00 の `lib/groups-api.ts`(`useGroupsApi`、`gpost`、`gput`、`gdelete`)を使う(契約書 3.5)。本モジュール専用の API クライアントは作らない。既存 `src/lib/api.ts` の `useApi` / `post` はパスに `/api/v2` を前置するため使わない [事実]。エラー表示は 00 の `ErrorNotice` と `useFormErrors` を使い、`ApiError.reason` で分岐する。

| ID | コンポーネント | props | 内部 state | 責務 |
|---|---|---|---|---|
| EXP-UI-01 | `ExpenseTab` | `{ groupId: string }` | `editing: ExpenseNoteView \| null`、`formOpen: boolean`、`deleteTarget: ExpenseNoteView \| null`、`refreshKey: number`、`offset: number` | 一覧と合計を取得(`GET G/expenses`)し、`ExpenseNotice`・`ExpenseList`・`ExpenseSummaryPanel` を配置する。`canEdit=false`(実行確定前、中止、再企画済み)のときは追加・編集・削除のボタンを出さず、`readOnlyReason` を表示する。`hasMore=true` のときは「さらに表示」で次の `offset` を取得して追記する。取得に失敗したときは `ErrorNotice`(原因と「もう一度試す」)を表示する。保存・削除の後は一覧を先頭から再取得し、`refreshKey` を 1 増やす |
| EXP-UI-02 | `ExpenseNotice` | `{ variant: "tab" \| "form" \| "summary" }` | なし | 常時表示の注意書き(7.3 の文言定数)。`role="note"`、アイコン+文字(色だけに頼らない) |
| EXP-UI-03 | `ExpenseList` | `{ items: ExpenseNoteView[]; canEdit: boolean; onEdit: (item: ExpenseNoteView) => void; onDelete: (item: ExpenseNoteView) => void }` | なし | 広い幅は `<table>`(caption あり)、スマホ幅はカードで表示する。並びは API の順(日付降順)。各項目に最終更新者(`updatedByName`)と更新日時を表示する |
| EXP-UI-04 | `ExpenseFormModal` | `{ groupId: string; members: MemberOption[]; initial?: ExpenseNoteView; opened: boolean; onClose: () => void; onSaved: (item: ExpenseNoteView) => void }` | フォーム値、`fieldErrors: Record<string,string>`、`submitting: boolean`、`conflict: ExpenseNoteView \| null`、`reviewRequired: boolean` | 追加(`initial` なし)と編集(`initial` あり)。保存で `gpost` / `gput` を呼ぶ(編集は `baseVersion: initial.version` を付ける)。`invalid_input` の `fields` を各入力欄に表示する。`detail.reviewRequired=true` のときは 09 の確認文を表示し、利用者が確認したら `ackReview: true` を付けて再送する。`conflict`(`reason:"version_mismatch"`)のときは `detail.current` の最新内容を表示し、「最新を読み込んで編集し直す」で `initial` を最新内容に差し替える。編集時、`initial` に含まれる元メンバーは選択済み・変更不可の選択肢として表示する |
| EXP-UI-05 | `ExpenseSummaryPanel` | `{ groupId: string; refreshKey: number }` | `showTransfers: boolean` | `GET G/expense-summary`。メンバー別の立替額・負担額・差額と、目安(`transfers`)を表示。注意書きを必ず併記 |
| EXP-UI-06 | `ExpenseDeleteConfirm` | `{ target: ExpenseNoteView; onConfirm: () => Promise<void>; onCancel: () => void }` | `submitting: boolean` | 削除の確認(項目名と金額を再表示)。`onConfirm` は `gdelete` で `G/expenses/[expenseId]?baseVersion=<target.version>` を呼ぶ。実行中はボタンを無効にする |

`G` は `/api/groups/[groupId]`(契約書 2.2)。`MemberOption`(4.1)は `ExpenseListResult.members`(参加中メンバー)から渡す。タブの親(01 のグループ詳細)が `?tab=expense` のときに `ExpenseTab` を描画する。

### 3.2 アクセシビリティ

- 全入力に `<label>`(Mantine の `label`)、必須は `required` と文言「必須」。エラーは項目に `error` を結び付け(`aria-describedby`)、送信失敗時は最初の誤り項目へフォーカス。フォーム上部に `role="alert"` で件数を通知。
- 金額入力は `NumberInput`(`allowDecimal={false}`、`min={LIMITS.AMOUNT.min}`、`max={LIMITS.AMOUNT.max}`、`inputMode="numeric"`、単位「円」を右ラベルで表示)。通貨の選択肢は出さない。
- 対象メンバーは `Checkbox.Group`(グループに `legend` 相当の説明)。「全員を選ぶ」ボタンを置く。
- 日付は `TextInput type="date"`(`min` は `EXPENSE_LIMITS.dateMin`、`max` は今日から `EXPENSE_LIMITS.dateFutureDays` 日後)。
- 合計・サマリの更新は `aria-live="polite"` の領域で通知。差額の正負は「受け取る側 / 支払う側」の文字でも示す(色だけにしない)。
- モーダルは開くときにフォーカスをモーダル内へ移し、閉じるときに開いたボタンへ戻す(Mantine `Modal` の既定動作 [要確認]。実装着手時に確認する事項で、判断は不要。契約書 14.2)。キーボードだけで全操作ができる(Esc で閉じる、Tab で移動)。ボタンの最小サイズは 44px(スマホ)。
- 表は `<caption>` と `scope`、スマホカードは見出し+定義リストで同じ情報を出す。

## 4. データ(docs/design/05 章)

### 4.1 型定義

配置: `app/src/features/groups/expense/types.ts`(エンティティの形は所有モジュールの `types.ts` に置く。契約書 3.1)。`Id`・`DateStr`・`IsoDateTime` は 00 の `lib/groups-types.ts`、`Page<T>` は 00、`GroupStatus` は 04 の `features/groups/lifecycle/types.ts` から import する。

```ts
/** 通貨は円のみ。通貨コード項目は持たない。 */
export type YenAmount = number; // 整数(Number.isSafeInteger)。範囲は 00 の LIMITS.AMOUNT(1〜1,000,000)

/** 保存形。決済・送金・支払い済みの状態は持たない(05 章)。 */
export interface ExpenseNote {
  id: Id;                // 00 の newId("ex") で採番。例: "ex-001"
  groupId: Id;
  title: string;         // 名目。LIMITS.EXPENSE_TITLE(1〜40 文字)
  amount: YenAmount;     // LIMITS.AMOUNT
  payerId: Id;           // 立て替えた人(userId)。groupId の現メンバーまたは元メンバー
  targetIds: Id[];       // 対象メンバー(userId)。1〜EXPENSE_LIMITS.targetsMax 件、重複なし、昇順で保存
  spentOn: DateStr;      // 日付 "YYYY-MM-DD"(実在する日付)
  memo: string;          // LIMITS.EXPENSE_MEMO(0〜200 文字、3 行以内)
  version: number;       // 楽観ロックの版。作成時 1、更新ごとに +1(契約書 2.3)
  createdBy: Id;         // userId
  createdAt: IsoDateTime; // clock.nowIso()(+09:00)
  updatedBy: Id;
  updatedAt: IsoDateTime;
}

/** 追加の入力。サーバーで検証する。 */
export interface ExpenseInput {
  title: string;
  amount: number;
  payerId: Id;
  targetIds: Id[];
  spentOn: DateStr;
  memo?: string;         // 省略は ""
  ackReview?: boolean;   // 09 の review 判定を確認済みとして送る。省略は false(契約書 6.2)
}

/** 更新の入力(PUT)。編集対象項目を全て送る(全置換)。memo の省略は "" として保存する(PUT の文字列の規則。契約書 3.4)。 */
export interface ExpenseUpdateInput extends ExpenseInput {
  baseVersion: number;   // 取得時の version。不一致なら conflict(version_mismatch)
}

/** 応答用。元メンバーは displayName を LEFT_MEMBER_LABEL(「元メンバー」)に置換する。 */
export interface ExpenseNoteView extends ExpenseNote {
  payerName: string;
  payerActive: boolean;
  targets: { userId: Id; displayName: string; active: boolean; share: number }[]; // share は EXP-DEC-02 の d 案(splitAmount)
  updatedByName: string;      // 最終更新者の表示名。元メンバーは LEFT_MEMBER_LABEL
}

/** フォームの選択肢。参加中メンバーのみ。 */
export interface MemberOption {
  userId: Id;
  displayName: string;
}

/** GET G/expenses の応答。一覧部分は 00 の Page<T>(契約書 2.3)。 */
export interface ExpenseListResult extends Page<ExpenseNoteView> {
  // items: 日付降順 → createdAt 降順 → id 昇順。total はグループの全件数
  totalAmount: number;        // グループの全項目の amount 合計(ページに依らない)
  members: MemberOption[];    // 参加中メンバー(userId 昇順)。フォームの選択肢
  canEdit: boolean;           // 呼び出しユーザーが追加・編集・削除できるか
  groupStatus: GroupStatus;   // group.lifecycle.status。画面の説明用
  groupStatusLabel: string;   // 04 の statusLabel(groupStatus)
  readOnlyReason: string;     // canEdit=false のときの説明(7.3 の文言)。canEdit=true のときは ""
}

export interface MemberBalance {
  userId: Id;
  displayName: string;
  active: boolean;
  paid: number;   // 立て替えた合計
  owed: number;   // 負担の合計(端数処理 d 案)
  net: number;    // paid - owed。正=立て替え過多(受け取る側の目安)、負=負担が多い側
}

export interface TransferHint {
  fromUserId: Id;   // 負担が多い側
  toUserId: Id;     // 立て替え過多の側
  amount: number;   // 円、整数 >= 1
}

export interface ExpenseSummary {
  currency: "JPY";
  totalAmount: number;
  count: number;
  members: MemberBalance[];       // userId 昇順
  transfers: TransferHint[];      // EXPENSE_TRANSFER_HINT_ENABLED が false なら []
  disclaimer: string;             // 7.3 の定数文言
  rounding: "first-n-get-one-yen"; // 端数ルール名(画面注記用)
}
```

配置: `constants.ts`。項目名・メモ・金額・件数の上限は 00 の `LIMITS` を唯一の定義とし、`LIMITS.EXPENSE_TITLE`(`{ min: 1, max: 40 }`)、`LIMITS.EXPENSE_MEMO`(`{ min: 0, max: 200, maxLines: 3 }`)、`LIMITS.AMOUNT`(`{ min: 1, max: 1_000_000 }`)、`LIMITS.EXPENSES.maxItems`(100)で参照する(契約書 3.4、10.3)。本モジュールでは値を再定義せず、数値を直書きしない。`EXPENSE_LIMITS` は本モジュールだけが使う値(日付範囲、一覧の既定件数)と、`LIMITS` から導く対象人数の上限だけを持つ。

```ts
export const EXPENSE_LIMITS = {
  targetsMax: LIMITS.CAPACITY.max,       // 対象メンバーの上限。グループの定員の上限(6)と同じ
  dateMin: "2020-01-01",
  dateFutureDays: 366,                   // clock.today() から先 366 日まで [案]
  pageLimit: 50,                         // GET G/expenses の limit の既定値。parsePage(q, { defaultLimit: EXPENSE_LIMITS.pageLimit })。最大は 00 の LIMITS.PAGE.maxLimit(50)
} as const;
export const EXPENSE_TRANSFER_HINT_ENABLED = true; // EXP-DEC-01 案 C
export const LEFT_MEMBER_LABEL = "元メンバー";      // [決定 18]、契約書 10.6
```

- 旧版の `perGroupMax`(件数 100)と `memoMaxLines`(メモの行数 3)は削除し、`LIMITS.EXPENSES.maxItems`・`LIMITS.EXPENSE_MEMO.maxLines` で参照する(契約書 10.3)。

### 4.2 エンティティと docs/design/05 章の対応

| 05 章の項目 | 本書 | 備考 |
|---|---|---|
| ExpenseNote: グループID、項目名、金額、立て替えた人、分担するメンバー、メモ日時 | `groupId`、`title`、`amount`、`payerId`、`targetIds`、`createdAt`/`updatedAt` | 追加項目: `spentOn`(日付)、`memo`、`version`、`createdBy`/`updatedBy`。「メモ日時」は `createdAt` と解釈 [推定]。日付・メモ・版番号の追加は契約書 12 章で docs/design 05 の更新項目になっている |
| 決済・送金状態は持たない | 持たない | 支払い済みフラグ、ステータス列を作らない(試験 EXP-T-30) |

保存先: 00 の `db().expenses: Repo<ExpenseNote>`(ID `ex-NNN`。契約書 3.1、3.2)。seed は 00 の `group-seed.json` に統合する(契約書 11.4)。費用メモの記録は実行確定以降のグループ(`GROUP_BY_STATUS` の `confirmed` = g-005、`in_progress` = g-011、`completed` = g-010。契約書 11.3)にだけ置き、4〜6 件のダミー(端数が出る例と元メンバーが絡む例を各 1 件)を手書きする。元メンバーが絡む例は、契約書 11.4 の見本 `LEFT_MEMBER_SAMPLE`(g-011 の u-006。wd-002、`phase: confirmed`、メンバー行は `left`)と、u-006 が退会前に記録した費用メモ 1 件とする。この見本が 00 の seed に入ることは契約書 11.4 で確定している。4〜6 件への追加は 00 に依頼する(10.3 の 1)。実ユーザー情報・sample-data は使わない。

### 4.3 楽観ロック [統一]

- 契約書 2.3 の共通方式に従う。版は `version: number`(作成時 1)、入力は `baseVersion`(PUT は本文、DELETE はクエリ `?baseVersion=`)。
- 更新・削除で `baseVersion` が保存中の `version` と一致しなければ `AppError("conflict", …, { reason: "version_mismatch", detail: { current: <最新の ExpenseNoteView> } })`(HTTP 409)。一致なら更新は `version + 1`、削除は項目を消す。
- ストアは単一プロセスのインメモリで、確認と書き込みを 00 の `tx` 内で同期的に行い、間に `await` を挟まない(確認から書き込みまでの間に他のリクエストが割り込まない)。

## 5. インターフェース

### 5.1 サービス関数(EXP-FN)

配置: `app/src/features/groups/expense/service.ts`(純粋関数は 5.2 の別ファイル、イベントの登録は `register.ts`)。`user` は 00 の `DemoUser`、例外は 00 の `AppError`。すべて同期関数。

| ID | 署名 | 戻り値 | 例外 |
|---|---|---|---|
| EXP-FN-01 | `listExpenses(user: DemoUser, groupId: Id, page: { limit: number; offset: number }): ExpenseListResult` | 一覧(ページ)・合計・canEdit | `not_found`(見えないグループ)、`forbidden`(公開グループの非メンバー) |
| EXP-FN-02 | `addExpense(user: DemoUser, groupId: Id, input: ExpenseInput): ExpenseNoteView` | 追加した項目(version=1) | `not_found`、`forbidden`、`unavailable_state`(編集不可の状態。`detail.state`)、`invalid_input`(fields 付き。review は `detail.reviewRequired`)、`conflict`(件数上限。`reason: "limit_exceeded"`) |
| EXP-FN-03 | `updateExpense(user: DemoUser, groupId: Id, expenseId: Id, input: ExpenseUpdateInput): ExpenseNoteView` | 更新後の項目 | 上記に加え `not_found`(項目なし・別グループの項目)、`conflict`(`reason: "version_mismatch"`、`detail.current` に最新) |
| EXP-FN-04 | `deleteExpense(user: DemoUser, groupId: Id, expenseId: Id, baseVersion: number): void` | - | `not_found`、`forbidden`、`unavailable_state`、`conflict`(`reason: "version_mismatch"`)。`baseVersion` の形式検査はハンドラが行う(`invalid_input`) |
| EXP-FN-05 | `getExpenseSummary(user: DemoUser, groupId: Id): ExpenseSummary` | サマリ | `not_found`、`forbidden` |
| EXP-FN-06 | `canModifyExpense(user: DemoUser, group: GroupRecord, note?: ExpenseNote): { ok: true } \| { ok: false; code: "forbidden" \| "unavailable_state"; message: string }` | 編集可否。P1 は「参加中メンバーである」かつ 04 `canEditExpenses(group)`。グループ状態で不可なら `code:"unavailable_state"`。P2/P3 に切り替えたときの作成者判定は `note` で行い、不可なら `code:"forbidden"`。`GroupRecord` は 09 の型(契約書 6.1) | なし |
| EXP-FN-07 | `unsettledBalanceOf(groupId: Id, userId: Id): number` | 当該ユーザーの `net`(0 なら差額なし)。07 の内部関数で、他モジュールに公開しない(契約書 4.5、7.9)。04 の退会確認ダイアログは画面から `GET G/expense-summary`(EXP-API-05)を取得して自分の `net` を読むため、本関数を呼ばない | なし |
| EXP-FN-08 | `onGroupMemberLeft(e: Extract<DomainEvent, { type: "member_left" }>): void` | 何もしない(項目は残す。EXP-DEC-04)。将来の匿名化処理を入れる場所として用意する。`register.ts` が `on("member_left", "expense", onGroupMemberLeft)` で登録し、`features/bootstrap.ts` に 1 行追記する(契約書 4.6)。例外は外へ出さず、捕捉して `console.error` に ID とコードだけを残す | なし |

- EXP-FN-01〜05 は 6.3 の順で権限を確認する。書き込みは 00 の `tx` 内で行う。`expenseId` で項目を取得したときは 09 の `assertInGroup(db().expenses.get(expenseId), groupId)` で所属を確認し、一致しなければ `not_found` とする(09 SAF-RULE-41)。
- メンバーの表示名は 09 の `visibleProfile({ id: user.id }, userId, { kind: "member", groupId })` から得る。元メンバー(`members` の status=`left`)は `LEFT_MEMBER_LABEL` に置き換え、`visibleProfile` を呼ばない。メンバー行は 00 の `db().members.filter(m => m.groupId === groupId)`、参加中メンバーは 00 の `activeMembers(groupId)` で得る。

### 5.2 純粋関数(DB・時計に依存しない。試験の中心)

配置: `split.ts`、`settlement.ts`、`validate.ts`、`text-guard.ts`。

```ts
// split.ts
/** EXP-DEC-02 d 案。targetIds は昇順にソートして扱う。戻り値の合計は必ず amount に一致。 */
export function splitAmount(amount: number, targetIds: readonly string[]): Record<string, number>;
//   n = targetIds.length (>=1)、base = floor(amount / n)、r = amount % n。
//   昇順の先頭 r 人が base+1、残りが base。n=0 または amount が整数でない場合は RangeError。

// settlement.ts
export function computeBalances(
  notes: readonly Pick<ExpenseNote, "amount" | "payerId" | "targetIds">[],
  memberIds: readonly string[],
): Record<string, { paid: number; owed: number; net: number }>;
//   memberIds に含まれない id が notes に現れても行を作る(元メンバー)。sum(net) === 0 を保証。
//   集計中のキーは検証済みの userId のみ。Map で集計し、戻り値は Object.create(null) で作る。

export function computeTransfers(net: Readonly<Record<string, number>>): TransferHint[];
//   貪欲法(下記)。入力の net 合計が 0 でなければ RangeError。

// validate.ts
export function validateExpenseInput(
  input: unknown,
  ctx: { activeMemberIds: ReadonlySet<string>; allowedLegacyIds?: ReadonlySet<string>; today: DateStr },
): ExpenseInput;
//   today は clock.today() の "YYYY-MM-DD"。allowedLegacyIds は編集時だけ渡す(既存項目の payerId・targetIds のうち元メンバーの ID)。
//   00 の v.object で検証する(未知のキーは捨てる。契約書 3.4)。payerId・targetIds は v.id("u")、spentOn は v.date()、
//   title・memo は v.string(内部で 00 の sanitizeText を通す。memo は multiline)。上限は 00 の LIMITS を参照する。
//   ackReview は v.boolean({ optional: true }) としてスキーマに宣言する(宣言しないと未知キーとして捨てられる。契約書 6.2)。
//   スキーマ検証の後に、メンバー所属・日付範囲・メモの行数を検査する。失敗時は AppError("invalid_input") に fields を付ける。

export function validateExpenseUpdateInput(
  input: unknown,
  ctx: Parameters<typeof validateExpenseInput>[1],
): ExpenseUpdateInput;
//   baseVersion(1 以上の整数。v.int({ min: 1 }))を検証し、残りの項目は validateExpenseInput と同じ規則で検証する。

// text-guard.ts
export function assertNoPaymentInducement(text: string, field: string): void;
//   決済サービス名・送金/振込/口座・QR・URL らしき文字列を含めば AppError("invalid_input")(fields[field])。7.2 参照
```

**精算の目安アルゴリズム(`computeTransfers`、`greedy-v1`)**
1. `net > 0` を受け取る側、`net < 0` を支払う側とし、各々を「金額の大きい順、同額は userId 昇順」に並べる。
2. 先頭の支払う側 d と受け取る側 c を組み、`m = min(-net[d], net[c])` を `TransferHint{from:d,to:c,amount:m}` として追加。双方から `m` を引き、0 になった側を外す。
3. どちらも空になるまで繰り返す。件数は最大で「関係者数 − 1」。最少件数(厳密な最適)は保証しない。この旨を注記し、同じ入力から常に同じ結果が出ることを優先する。

### 5.3 HTTP API(EXP-API)

ルーティングはリソースごとの `route.ts` とする(契約書 2.1)。ハンドラは `features/groups/expense/handlers.ts` に 00 の `route()` で包んで置き、`app/api/.../route.ts` は再エクスポートだけを書く。キャッチオール `[...path]` とハンドラ登録は使わない。

```ts
// app/src/app/api/groups/[groupId]/expenses/route.ts
export { listExpensesHandler as GET, addExpenseHandler as POST } from "@/features/groups/expense/handlers";
// app/src/app/api/groups/[groupId]/expenses/[expenseId]/route.ts
export { updateExpenseHandler as PUT, deleteExpenseHandler as DELETE } from "@/features/groups/expense/handlers";
// app/src/app/api/groups/[groupId]/expense-summary/route.ts
export { getExpenseSummaryHandler as GET } from "@/features/groups/expense/handlers";
```

ハンドラは `c.id("groupId", "g")`(と `c.id("expenseId", "ex")`)→ 本文・クエリの取得 → service → `ok` / `created` / `noContent` の順に呼ぶだけとし、業務ロジックを持たない。現在ユーザーは `c.user`(00 の `currentUser(req)`。Cookie `demoUser`)から得る(本文・クエリの userId は使わない)。形式は JSON(`Content-Type: application/json`)。

エラー本体は 00 の `ErrorBody`(契約書 3.3): `{ "error": "<code>", "reason"?: "<下位コード>", "message": "<説明>", "fields"?: { "<項目>": "<メッセージ>" }, "detail"?: { "current"?: ExpenseNoteView, "state"?: GroupStatus, "reviewRequired"?: true } }`。

`G` は `/api/groups/[groupId]`。

| ID | メソッド・パス | リクエスト | 成功レスポンス | エラー |
|---|---|---|---|---|
| EXP-API-01 | `GET G/expenses?limit=&offset=` | クエリ `limit`(1〜50、既定 50)、`offset`(0 以上、既定 0)。00 の `parsePage(q, { defaultLimit: 50 })`(`EXPENSE_LIMITS.pageLimit`。契約書 2.3) | 200 `ExpenseListResult` | 400 invalid_input(クエリ不正)、404 not_found、403 forbidden |
| EXP-API-02 | `POST G/expenses` | `ExpenseInput` | 201 `ExpenseNoteView` | 400 invalid_input、403 forbidden、404 not_found、409 unavailable_state、409 conflict(`limit_exceeded`) |
| EXP-API-03 | `PUT G/expenses/[expenseId]` | `ExpenseUpdateInput` | 200 `ExpenseNoteView` | 400、403、404、409 unavailable_state、409 conflict(`version_mismatch`、`detail.current` 同梱) |
| EXP-API-04 | `DELETE G/expenses/[expenseId]?baseVersion=<n>` | クエリ `baseVersion`(必須。1 以上の整数。`v.int({ min: 1, coerce: true })`)。本文なし。本文が無くても `Content-Type: application/json` を必須とする(00 の `route()` の入口検査。違反は 415。契約書 2.3) | 204(本文なし) | 400(`baseVersion` の欠落・不正)、403、404、409 unavailable_state、409 conflict(`version_mismatch`) |
| EXP-API-05 | `GET G/expense-summary` | なし。04 の退会確認ダイアログ(`WithdrawButton`)も画面から取得し、自分の `net` を読む(契約書 4.5) | 200 `ExpenseSummary` | 404、403 |

- メソッドは契約書 2.3 に従う(取得 GET、作成 POST 201、全置換 PUT、削除 DELETE 204)。変更系(POST・PUT・DELETE)は本文の有無にかかわらず `Content-Type: application/json` を付ける。クライアントの `gpost`・`gput`・`gdelete` と試験の `callRoute` は常に付ける(契約書 2.3)。
- パスの ID は 00 の `isId`(`c.id`)で検証し、形式不正は `not_found`(404)とする(契約書 3.2)。本文の ID(`payerId`・`targetIds`)の形式不正は `invalid_input`(400)。ID をファイルパスやクエリに使わない。
- 本文の未知のキーは捨てる(00 の `v.object`。契約書 3.4)。`groupId`、`version`、`createdBy` など保存項目は入力のスキーマに含めないため、リクエストで上書きされない(マスアサインメント防止)。本文の上限は 00 の `route()` の 64KB。

## 6. 状態遷移・権限

### 6.1 項目の状態

- 項目自体に状態遷移はない(作成 → 更新(version+1)→ 削除)。支払い済みなどの状態は持たない。

### 6.2 グループ状態と操作可否 [決定 3]

04 の `canEditExpenses(g): boolean`(契約書 4.4)をそのまま使う。閲覧はメンバーであれば状態にかかわらず可能。

| グループ状態(`GroupStatus`) | 閲覧 | 追加・編集・削除 | 読み取り専用の説明(7.3) |
|---|---|---|---|
| `recruiting`、`min_reached`、`withdrawal_period` | 可(項目は無い) | 不可(`unavailable_state`) | `readOnlyBeforeConfirmed` |
| `confirmed`、`in_progress` | 可 | 可 | - |
| `completed` | 可 | 可 [決定 23](旅行後の精算確認に使うため。契約書 4.4) | - |
| `cancelled`、`replanned` | 可(読み取りのみ) | 不可(`unavailable_state`) | `readOnlyClosed` |

- `unavailable_state` の本文は `detail.state`(現在の `GroupStatus`)を付ける。画面は 04 の `statusLabel(status)` で状態名を表示する。
- 再企画で作った新グループには費用メモを引き継がない(新グループは `recruiting` から始まるため。契約書 5.4)。

### 6.3 権限チェックの順序(全 API 共通)

0. パスの ID の形式不正 → `not_found`(00 の `c.id`)。JSON の構文・本文サイズ・`Content-Type`・`Origin` の検査は 00 の `route()` が行う。
1. 09 `assertGroupAccess(user.id, groupId, "member")`: グループが無い、非公開グループの非メンバー、ブロック関係 → `not_found`(存在を隠す)。公開グループの非メンバー(元メンバーを含む)→ `forbidden`(09 SAF-RULE-40 の表)。
2. 書き込み系のみ: `canModifyExpense` が `ok:false` → 戻り値の `code`(P1 では `unavailable_state`)。`message` に現在の状態と取れる操作を入れる。
3. 項目 ID を扱う操作(PUT・DELETE)のみ: 09 `assertInGroup(db().expenses.get(expenseId), groupId)` → 項目が無い、または別グループの項目なら `not_found`(09 SAF-RULE-41)。
4. 入力検証(`invalid_input`)→ 禁止表現(09 `assertTextAllowed`、7.2)→ 件数上限・version 照合(`conflict`)→ 保存。

## 7. 入力検証・セキュリティ

### 7.1 項目ごとの検証規則(`validate.ts`)

| 項目 | 型 | 規則 | エラーメッセージ(例) |
|---|---|---|---|
| title | string | `sanitizeText` 後 `LIMITS.EXPENSE_TITLE`(1〜40 文字)。制御文字は除去。全角空白のみは不可 | 「名目は 1〜40 文字で入力してください」 |
| amount | number | 整数(`Number.isSafeInteger`)、`LIMITS.AMOUNT`(1〜1,000,000)。小数・文字列・NaN・負数・0 は不可。通貨は円のみ(通貨項目なし) | 「金額は 1〜1,000,000 の整数(円)で入力してください」 |
| payerId | Id | `v.id("u")`。参加中メンバーの userId(編集時は既存の値のままなら元メンバーも可) | 「立て替えた人を参加中メンバーから選んでください」 |
| targetIds | Id[] | 1〜`EXPENSE_LIMITS.targetsMax`(`LIMITS.CAPACITY.max` = 6)件、重複なし、全員が参加中メンバー(編集時は既存の元メンバーを維持のみ可)。保存は昇順 | 「対象メンバーを 1 人以上選んでください」 |
| spentOn | DateStr | `v.date()`(`YYYY-MM-DD` の正規形で、暦として実在。`2026-02-30` は不可)。`2020-01-01` 以上、`clock.today()` から 366 日先まで | 「日付が正しくありません」 |
| memo | string | 省略は `""`(POST・PUT 共通。契約書 3.4)。`LIMITS.EXPENSE_MEMO`(0〜200 文字)。`sanitizeText({ multiline: true })`(改行 `\n` は許可し最大 `LIMITS.EXPENSE_MEMO.maxLines`(3)行) | 「メモは 200 文字以内、3 行以内で入力してください」 |
| ackReview | boolean | 省略可(既定 false)。本文の最上位のキー。09 の review 判定を確認済みとして保存するときに true。未知キーとして捨てられないよう、本文スキーマに `ackReview: v.boolean({ optional: true })` を宣言する(契約書 6.2) | - |
| baseVersion | number | 1 以上の整数(更新は本文、削除はクエリ `baseVersion` で同じ規則) | 「画面を再読み込みしてからやり直してください」 |
| (未知のキー) | - | 捨てる(00 の `v.object`。エラーにしない) | - |
| (件数) | - | 1 グループ `LIMITS.EXPENSES.maxItems`(100)件まで(追加時)。超過は `conflict` + `reason:"limit_exceeded"` | 「これ以上追加できません(100 件)」 |

- エラーメッセージ中の数値は `LIMITS` の値から組み立て、直書きしない(契約書 10.3)。
- 「今日」は `lib/clock.ts` の `clock.today()`(JST の暦日)で得る。日付範囲の試験ではデモ日付を差し替えられる。保存する日時は `clock.nowIso()`(`+09:00`)。

### 7.2 禁止表現と外部決済への誘導の制御(柱8、docs/design 07 章)

- `title` は 09 の `assertTextAllowed(title, "expense_item", "title", { ackReview })`、`memo` は `assertTextAllowed(memo, "expense_memo", "memo", { ackReview })` を通す(契約書 6.2。全入力に適用する方針、docs/design 07 章)。違反は `invalid_input` + `fields[field]`、review の判定で未確認のときは `detail.reviewRequired: true`。画面のライブ警告は 09 の `checkText(text, context)` を使う。
- 加えて本モジュールの `text-guard.ts` でも検査する。09 の辞書が未確定の間も、決済・送金・連絡先への誘導を含む入力を拒否するため:
  - 決済・送金サービスを連想させる語(例: 「PayPay」「ペイ」「送金」「振込」「口座」「銀行」「QR」「請求書」「立替払いアプリ」など。辞書は定数配列で 09 と協議 [未決])。
  - URL・メールアドレスらしき文字列(`https?://`、`www.`、`@` を含む英数列)、電話番号らしき数字列(10 桁以上)。連絡先交換の誘導を避ける。
- これらの検査と、画面・API のどちらにもリンクや「支払う」ボタンを設けないことを合わせて、「決済導線なし」を満たす根拠とする。サマリ画面の文言(7.3 の定数)にもサービス名・リンクを入れない。

### 7.3 画面に出す注意書き(定数。`messages.ts`)

```ts
export const EXPENSE_MESSAGES = {
  tabNotice:
    "この画面は費用の記録用メモです。アプリは送金・決済・請求を行いません。お金のやりとりは、メンバー同士で直接ご相談のうえ、各自の責任で行ってください。",
  summaryNotice:
    "これは記録をもとにした目安の計算です。支払いの義務や金額を決めるものではありません。端数は 1 円単位で調整しています。",
  formNotice: "金額は円の整数で入力します。連絡先や支払い方法は書かないでください。",
  readOnlyBeforeConfirmed: "費用メモは、旅行の実行が確定してから記録できます。",
  readOnlyClosed: "このグループは中止されたため、費用メモは閲覧のみです。",
  transferLine: (from: string, to: string, yen: string) =>
    `${from}さんは${to}さんに ${yen}円(目安)`,
  leftMember: "元メンバー",
} as const;
```

- `tabNotice` はタブの最上部に常時表示(折りたたみ不可)、`summaryNotice` はサマリ・目安の直上に必ず表示。文言に「支払ってください」「送金して」などの指示形を使わない(試験 EXP-T-31)。
- `readOnlyBeforeConfirmed` は `recruiting`・`min_reached`・`withdrawal_period`、`readOnlyClosed` は `cancelled`・`replanned` のときに `readOnlyReason` として返す(6.2)。

### 7.4 その他のセキュリティ対策

| 観点 | 対策 |
|---|---|
| アクセス制御・IDOR | 権限はすべてサーバー側で `c.user`(00 の `currentUser(req)`)から判定する(6.3)。グループのアクセス判定は 09 の `assertGroupAccess`、項目の所属確認は 09 の `assertInGroup` を使う。クライアントの `canEdit` は表示の切替にだけ使う。項目 ID で操作するときは、項目の `groupId` と URL の `groupId` の一致を確認する(6.3 の 3、EXP-T-41) |
| 入力検証・インジェクション | 7.1 の規則をサーバー側で必ず適用する。SQL・シェル・ファイルパスにユーザー入力を使わない。未知キーは 00 の `v.object` が捨て、`groupId`・`version`・`createdBy` 等の保存項目をリクエストで上書きさせない(マスアサインメント防止)。集計のキーは検証済みの userId だけとし、`Map` または `Object.create(null)` を使う |
| XSS | 出力は React の既定エスケープに任せ、`dangerouslySetInnerHTML` は使わない。URL を自動でリンクにしない(EXP-T-23) |
| CSRF | 00 の `route()` の対策に従う(Cookie の `SameSite=Lax`、変更系は `Content-Type: application/json` 必須、`Origin` と `Host` が異なれば拒否)。GET で状態を変えない |
| 認証・セッション(デモ) | ログイン不要のため、Cookie `demoUser` で現在ユーザーを表す(00 5.2)。本モジュール独自のセッションは持たない |
| セキュリティ設定 | API の応答ヘッダ(`Cache-Control: no-store`、`X-Content-Type-Options: nosniff`)と本文サイズ上限(64KB)は 00 の `route()` に従う。画面の応答ヘッダ(`X-Frame-Options`、`X-Content-Type-Options`、`Referrer-Policy`)は 00 の `next.config.ts` の設定に従い、CSP は設けない [決定 2](契約書 11.2) |
| 機密データ | 非メンバーには費用メモの存在を隠す(404/403)。応答の `displayName` は 09 の `visibleProfile(viewer, targetId, { kind: "member", groupId })` の範囲内の表示名だけとし、本名・連絡先を含めない。元メンバーは `LEFT_MEMBER_LABEL`(「元メンバー」)。費用メモの内容は通知(10)と自治体向け集計(12)に渡さない |
| ログ | 例外時は 00 に従い、`requestId` と例外だけを `console.error` に出す。リクエスト本文(名目・金額・メモ)はログに出さない |

- ブロック(09)による費用項目の非表示は行わない(非表示にすると精算の目安の計算結果が変わるため)。ブロック関係の相手がいるグループへのアクセスは 09 の `assertGroupAccess` の判定に従う。
- ブロック関係による表示名(立て替えた人・対象メンバー・最終更新者)の出し分けは見送り(契約書 16.2)。
- 既知の制約: Cookie `demoUser` は利用者が書き換えられる(ログイン不要のデモの前提。00 7 章)。大量リクエスト、総当たり、応答時間の差による推測への対策は設計しない(見送り。契約書 16.2)。

## 8. エラー処理

| コード | reason | HTTP | 条件 | 画面での表示・挙動 |
|---|---|---|---|---|
| invalid_input | - | 400 | 7.1 の検証失敗、禁止表現(09。review は `detail.reviewRequired`)、決済・連絡先への誘導、`baseVersion` の欠落や不正、クエリ `limit`・`offset` の不正 | 各入力欄に `fields` のメッセージを表示し、フォーム上部に件数を表示する。最初の誤り項目にフォーカスする。`reviewRequired` のときは確認文を表示し、確認後に `ackReview: true` で再送する |
| forbidden | - | 403 | 公開グループの非メンバー(元メンバーを含む) | 「メンバーだけが見られます」と、グループ詳細への導線 |
| not_found | - | 404 | パスの ID の形式不正、グループが無い・見えない(非公開・ブロック関係)、項目が無い(他のメンバーが削除済みの場合を含む)、項目が別グループのもの | 一覧へ戻る導線。編集中に項目が削除されていた場合は「この項目は削除されています」と表示し、一覧を再取得する |
| unavailable_state | - | 409 | グループの状態により編集できない(実行確定前、中止、再企画済み)。`detail.state` を付ける | `readOnlyReason`(7.3)で理由を説明する。閲覧はできる |
| conflict | `version_mismatch` | 409 | 他のメンバーが先に更新・削除した(`baseVersion` の不一致)。`detail.current` に最新の項目 | 最新内容を表示し、「最新を読み込んで編集し直す」を出す |
| conflict | `limit_exceeded` | 409 | 1 グループの上限(`LIMITS.EXPENSES.maxItems` = 100 件)に達している | 上限を説明する |
| (00 共通) | - | 403 / 405 / 413 / 415 | `Origin` の不一致、許可外のメソッド、本文 64KB 超、`Content-Type` が JSON でない | 00 8 章の表示に従う(通常の画面操作では発生しない) |
| internal | - | 500 | 想定外の例外(計算の不変条件違反を含む) | 「問題が発生しました」と再読み込みの案内(00 の `ErrorNotice`)。サマリは `sum(net)=0` を満たさなければ表示せず internal とする(デモ範囲外。見送り。契約書 16.2) |
| (クライアント) network | - | - | 通信失敗、JSON でない応答 | 00 の `ErrorNotice` で「サーバーに接続できません」と「もう一度試す」を表示する |

- 本モジュールは `rate_limited` を返さない(頻度制限の対象外。09 の `RATE_LIMITS` に費用の項目はない)。

## 9. 試験項目(docs/design/10 章と対応)

前提: 金額の単位は円。自動試験は Vitest(2.1)で実行し、API 試験は 00 の `callRoute` で Route Handler を呼ぶ(契約書 11.3)。

- 9.1 の a〜f は純粋関数に渡す userId の例で、ストアを使わない。
- 9.2〜9.4 の前提データは 00 の `resetForTest` と `fixtures.ts` で用意し、グループは `GROUP_BY_STATUS` で引く(契約書 11.3)。編集可のグループ g は `GROUP_BY_STATUS.in_progress`(g-011)、a〜d はその参加中メンバー(不足する人数は 00 の `insertMember` で 900 番台の ID(`u-901` など)を加える)、x は g の非メンバー、z は元メンバーの見本 `LEFT_MEMBER_SAMPLE`(g-011 の u-006、wd-002。u-006 が退会前に記録した費用メモ 1 件を含む。契約書 11.4)。h は g とは別のグループで、`GROUP_BY_STATUS.confirmed`(g-005)を使う。非公開グループは `PRIVATE_GROUP`(g-008)。状態ごとの試験(EXP-T-27・42)は `GROUP_BY_STATUS` の各状態のグループを使う。試験の中で作るデータの ID は 900 番台とし、形式外の ID は使わない(契約書 3.2)。
- 見送り(契約書 16.2): 境界値の網羅(EXP-T-15〜18・20・35・43 と EXP-T-44 の `limit=51`)。各試験に記した代表のケースは残す。EXP-T-28・29(順番に送る競合)は残す。同時リクエスト(`Promise.all`)による競合の試験は作らない。

### 9.1 単体(純粋関数。Vitest で実行)

| ID | 対象 | 入力 | 期待結果 |
|---|---|---|---|
| EXP-T-01 | splitAmount | 3000 円、[a,b,c] | a=1000, b=1000, c=1000 |
| EXP-T-02 | splitAmount | 1000 円、[a,b,c] | a=334, b=333, c=333(合計 1000) |
| EXP-T-03 | splitAmount | 100 円、[a,b,c,d,e,f] | a〜d=17、e,f=16(合計 100) |
| EXP-T-04 | splitAmount | 1 円、[a,b] | a=1, b=0 |
| EXP-T-05 | splitAmount | 1,000,000 円、6 人 | 先頭 4 人 166,667、残り 2 人 166,666(合計一致) |
| EXP-T-06 | splitAmount | 入力順 [c,a,b] で 1000 円 | 昇順に直して a=334, b=333, c=333(入力順に依存しない) |
| EXP-T-07 | splitAmount | targetIds=[]、または amount=10.5 | RangeError |
| EXP-T-08 | computeBalances+computeTransfers | 3000 円(a 立替、a,b,c 対象)+1000 円(b 立替、a,b,c 対象) | net: a=+1666, b=-333, c=-1333(合計 0)。transfers: c→a 1333、b→a 333 |
| EXP-T-09 | 同上 | 4000 円(a 立替、a〜d)+2000 円(b 立替、a〜d) | net: a=+2500, b=+500, c=-1500, d=-1500。transfers: c→a 1500、d→a 1000、d→b 500(3 件) |
| EXP-T-10 | 同上 | 1200 円(a 立替、対象 b,c) | b→a 600、c→a 600 |
| EXP-T-11 | 同上 | 1000 円(a 立替、対象 a のみ) | net 全員 0、transfers=[] |
| EXP-T-12 | 元メンバー | 項目に元メンバー z が対象 | z の行が `active:false` で存在し、sum(net)=0 |
| EXP-T-13 | computeTransfers | net 合計が 0 でない | RangeError |

### 9.2 検証(`validateExpenseInput` / API)

| ID | 入力 | 期待結果 |
|---|---|---|
| EXP-T-14 | amount=0 / -1 / 1.5 / "100" / 1000001 | 400 `invalid_input`、`fields.amount` |
| EXP-T-15 | amount=1 と amount=1000000 | 成功(境界)。見送り(契約書 16.2。金額の代表は EXP-T-14) |
| EXP-T-16 | title="" / 空白のみ / 41 文字 | 400 `fields.title`。40 文字は成功。代表は 41 文字の 400 だけを残し、他は見送り(契約書 16.2) |
| EXP-T-17 | memo 201 文字、または 4 行 | 400 `fields.memo`。200 文字・3 行は成功。代表は 201 文字の 400 だけを残し、4 行と成功の境界は見送り(契約書 16.2) |
| EXP-T-18 | targetIds=[] / 重複 / 7 件 / 非メンバー x を含む / 形式不正の ID(`"abc"`) | 400 `fields.targetIds`(要素の形式不正は `fields["targetIds.N"]`)。代表は `[]` と非メンバー x の 2 件を残し、重複・7 件・形式不正は見送り(契約書 16.2) |
| EXP-T-19 | payerId に非メンバー x、または形式不正の ID | 400 `fields.payerId` |
| EXP-T-20 | spentOn="2026-02-30" / "2026/02/01" / "2019-12-31" | 400 `fields.spentOn`。代表は `"2026-02-30"` だけを残し、他は見送り(契約書 16.2) |
| EXP-T-21 | 101 件目の追加 | 409 `conflict`、`reason:"limit_exceeded"` |
| EXP-T-22 | リクエストに `version:99`、`createdBy:"u-002"`、`groupId:"g-999"` を付けて POST | 201。未知のキーは捨てられ、保存値は `version=1`、`createdBy`=現在ユーザー、`groupId`=URL のグループ |
| EXP-T-23 | title="<script>alert(1)</script>" | 保存は可(禁止語でなければ)、画面では文字列としてそのまま表示され実行されない |

### 9.3 権限・状態・競合

| ID | 操作 | 期待結果 |
|---|---|---|
| EXP-T-24 | 公開グループの非メンバー x が GET/POST/PUT/DELETE/expense-summary | 403 `forbidden`(非公開グループ `PRIVATE_GROUP` では 404)。データが応答に含まれない |
| EXP-T-25 | 元メンバー z が GET | 403 |
| EXP-T-26 | メンバー b が a の作成した項目を PUT / DELETE(P1) | 成功。`updatedBy=b`、`version` が +1(DELETE は 204) |
| EXP-T-27 | グループ状態が `recruiting`・`min_reached`・`withdrawal_period`・`cancelled`・`replanned` で POST/PUT/DELETE | 409 `unavailable_state`、`detail.state` が現在の状態。GET は 200 で `canEdit:false`、`readOnlyReason` が 7.3 の該当文言 |
| EXP-T-28 | a と b が同じ version=1 を取得 → a が PUT(成功、version=2) → b が `baseVersion=1` で PUT | b は 409 `conflict`(`reason:"version_mismatch"`)、`detail.current.version=2`。データは a の更新のまま |
| EXP-T-29 | DELETE で `?baseVersion=` 欠落、または古い `baseVersion` | 400 `invalid_input` / 409 `conflict`(`version_mismatch`) |
| EXP-T-41 | メンバー a がグループ g の URL で、別グループ h の項目 ID を指定して PUT / DELETE | 404 `not_found`。h の項目は変更されない |
| EXP-T-42 | グループ状態が `confirmed`・`in_progress`・`completed` で POST | 201(`completed` でも記録できる。契約書 4.4) |
| EXP-T-43 | パスの ID の形式不正(`/api/groups/g-001/expenses/abc`、`/api/groups/xyz/expenses`) | 404 `not_found`。代表は `/api/groups/g-001/expenses/abc` だけを残し、他は見送り(契約書 16.2) |
| EXP-T-44 | GET `G/expenses?limit=2&offset=0`(項目 3 件) | 200。`items` 2 件、`total=3`、`hasMore=true`、`totalAmount` は 3 件の合計。`limit=51` の 400 は見送り(契約書 16.2) |

### 9.4 安全・表示

| ID | 確認 | 期待結果 |
|---|---|---|
| EXP-T-30 | 型・API・画面に支払い済み/決済/送金の項目・ボタン・外部リンクがない(静的検査と画面確認) | 該当なし |
| EXP-T-31 | 画面にタブ注意書き(`tabNotice`)が常時、サマリに `summaryNotice` がある。文言に指示形(「送金してください」等)がない | 満たす |
| EXP-T-32 | title・memo に「PayPayで送って」「振込先 口座」「https://example.com」「090-1234-5678」 | 400 `invalid_input`(決済誘導/連絡先。`fields.title` / `fields.memo`)。09 の `assertTextAllowed`(`expense_item`・`expense_memo`)の禁止語も拒否し、review の語は `detail.reviewRequired=true`、`ackReview:true` で保存できる |
| EXP-T-33 | サマリの表示 | transfers の各行に「(目安)」が付く。`EXPENSE_TRANSFER_HINT_ENABLED=false` で transfers が空になる |
| EXP-T-34 | 元メンバー z を含む項目の表示 | 名前は「元メンバー」。項目は残り、サマリに「元メンバー」の印 |
| EXP-T-35 | 日付範囲: clock を差し替え今日+366 日と +367 日 | 前者成功、後者 400。見送り(契約書 16.2。日付の代表は EXP-T-20) |
| EXP-T-45 | 04 の `withdraw` で確定後のメンバー c が退会(`member_left` が発行される) | c が関わる項目は削除されずに残り、表示名が「元メンバー」になる。購読関数 `onGroupMemberLeft` が例外を投げても `withdraw` は成功する(例外は外へ出さない) |
| EXP-T-46 | `unsettledBalanceOf(g, a)`(内部関数)と `GET G/expense-summary` の a の `net` | EXP-T-08 の項目のとき両方 1666、項目が無いとき両方 0(04 の退会確認ダイアログは後者を読む) |

### 9.5 画面・アクセシビリティ

| ID | 確認 | 期待結果 |
|---|---|---|
| EXP-T-36 | キーボードのみで追加→一覧→編集→削除 | 全操作可能。モーダル終了後に開いたボタンへフォーカスが戻る |
| EXP-T-37 | 検証エラー表示 | エラーが項目に紐づき(スクリーンリーダーで読める)、最初の誤り項目にフォーカス |
| EXP-T-38 | スマホ幅(360px) | 横スクロールなし。カード表示で全情報が読める。ボタンが 44px 以上 |
| EXP-T-39 | 差額の表示 | 「受け取る側/支払う側」が文字で判別でき、色だけに依存しない |
| EXP-T-40 | 合計の更新 | 追加・削除後に `aria-live` で合計が通知される |

## 10. 他モジュールとの契約

### 10.1 本モジュールが呼ぶもの

実行時に import するのは 00、04、09 だけ(契約書 4.6)。01 の関数は呼ばない。

| 相手 | 名称 | 用途 |
|---|---|---|
| 00 | `route()` / `ok` / `created` / `noContent` / `c.id` / `c.body` / `c.query`、`AppError`、`v` / `sanitizeText`、`LIMITS`、`clock.today()` / `clock.nowIso()`、`newId("ex")`、`db()` / `tx()`、`activeMembers(groupId)`、`parsePage` / `paginate`、`on("member_left", …)`(`lib/events.ts`)、`lib/groups-api.ts`(`useGroupsApi`、`gpost`、`gput`、`gdelete`、`ApiError.reason`)、`ErrorNotice` / `useFormErrors` | 共通処理 |
| 04 | `canEditExpenses(g): boolean`、`statusLabel(status: GroupStatus): string`、型 `GroupStatus` | 書き込み可否、状態の表示名 |
| 09 | `assertGroupAccess(userId, groupId, "member"): GroupRecord`、`assertInGroup(item, groupId)`、`assertTextAllowed(text, "expense_item" \| "expense_memo", field, { ackReview })`、`checkText(text, context)`、`visibleProfile(viewer, targetId, { kind: "member", groupId })` | アクセス判定、子資源の所属確認、禁止表現、表示名 |

### 10.2 本モジュールが公開するもの

| 相手 | 名称 | 用途 |
|---|---|---|
| 04(画面) | `GET G/expense-summary`(EXP-API-05) | 04 の退会確認ダイアログ(`WithdrawButton`)が画面から取得し、自分の `net` が 0 でなければ「費用メモに差額が残っている」旨を表示する(契約書 4.5)。画面からの API 利用で、import の依存ではない(契約書 4.6)。`unsettledBalanceOf`(EXP-FN-07)は 07 の内部関数で公開しない |
| 00(イベント) | `onGroupMemberLeft`(EXP-FN-08)を `member_left` の購読者として登録 | 退会の検知(契約書 4.6) |

- 通報の対象種別 `expense` は削除した。通報の対象はメッセージ・グループ・ユーザーの 3 種だけで [決定 28]、本モジュールの画面に通報の導線を置かない(契約書 6.3、7.9)。旧版の「09 の `ReportTargetType` に `expense` を追加する」記述と、導線を置くかの未決(12 章)は取り下げた。
- 通知(10)は送らない。費用の追加・更新の通知は契約書 9.1 の種類(必須 12 種・余力 2 種)に含まれない [決定 1・22]。

### 10.3 他モジュールへの要望(他ファイルは編集しない)

1. **00**: (a) 解消(契約書 10.3)。`LIMITS.EXPENSE_TITLE`・`EXPENSE_MEMO`(`maxLines: 3`)・`AMOUNT`・`EXPENSES` が確定した。(b) seed に費用メモ 4〜6 件(4.2)を置く。実行確定後に退会した元メンバーの見本(g-011 の u-006、wd-002 と、u-006 が記録した費用メモ 1 件)は契約書 11.4 で確定した(解消)。(c) `features/bootstrap.ts` に本モジュールの `register.ts` の 1 行を加える。
2. **04**: 解消(契約書 4.5、7.9)。04 の退会確認ダイアログは画面から `GET G/expense-summary` を取得して自分の `net` を読む。07 は API を提供するだけで、`unsettledBalanceOf` は 07 の内部関数とする(13 章 10)。
3. **09**: `TextContext` への `expense_memo` の追加は解消(契約書 6.2)。残る要望は、辞書に「決済・送金サービス名、振込・口座・QR など金銭の誘導語」を入れることと、静的検査(決済導線なし)の試験を 09 の試験に含めること。

- 解決済みの要望(契約書で確定): 01 の `listMembers`(00 の `db().members` と `activeMembers` で代替。契約書 3.1、6.1)、01 から `onGroupMemberLeft` を呼ぶこと(`member_left` の購読に変更。4.6)、04 の `canEditExpenses` の型(boolean。4.4)、00 の楽観ロックの方式・PUT/DELETE・`detail` の置き場所・`fields` の形(2.3、3.3)、10 の費用の通知(送らない。第 9 章)。

## 11. 実装タスクの分解

規模: S=半日以内、M=1 日前後、L=2 日以上。ファイルは `app/src/features/groups/expense/` に置く(画面部品は `ui/`)。

| ID | タスク | 規模 | 前提 |
|---|---|---|---|
| EXP-TASK-01 | テスト基盤の準備。00 の Vitest(`vitest.config.ts`、`npm test`)を使い、試験ファイル `*.test.ts` を本モジュールのディレクトリに置く。00 で未導入なら導入を 00 に依頼する。ライセンス(MIT)を docs/design 08 章の一覧に載せる | S | 00 のテスト基盤 |
| EXP-TASK-02 | `types.ts`、`constants.ts`、`messages.ts` を作成(4・7 章の型・定数・文言) | S | 00 の `LIMITS`、04 の `GroupStatus` |
| EXP-TASK-03 | `split.ts` の `splitAmount` と単体試験 EXP-T-01〜07 | S | EXP-TASK-01、02 |
| EXP-TASK-04 | `settlement.ts` の `computeBalances` / `computeTransfers` と EXP-T-08〜13 | M | EXP-TASK-03 |
| EXP-TASK-05 | `text-guard.ts`(決済誘導検査)と辞書、09 `assertTextAllowed`(`expense_item`・`expense_memo`)の結線 | S | EXP-TASK-02、09 の `assertTextAllowed` |
| EXP-TASK-06 | `validate.ts`(7.1。`validateExpenseInput`、`validateExpenseUpdateInput`)と EXP-T-14〜20、35(見送りの試験は 9 章の印に従う) | M | EXP-TASK-02、05 |
| EXP-TASK-07 | 00 の `group-seed.json` への費用メモ 4〜6 件の統合(4.2。`db().expenses` は 00 の `Db` に定義済み。元メンバーの例は契約書 11.4 の g-011・u-006 の 1 件を使う) | S | 00、EXP-TASK-02 |
| EXP-TASK-08 | `service.ts`: `canModifyExpense`、`listExpenses`(ページング)、`addExpense`(件数上限含む) | M | EXP-TASK-04、06、07、09 の `assertGroupAccess`・`visibleProfile`、04 の `canEditExpenses` |
| EXP-TASK-09 | `service.ts`: `updateExpense`(`baseVersion` 照合)、`deleteExpense`。09 の `assertInGroup` | M | EXP-TASK-08 |
| EXP-TASK-10 | `service.ts`: `getExpenseSummary`、`unsettledBalanceOf`(内部関数)。`register.ts`: `onGroupMemberLeft` を `on("member_left")` で登録し、`features/bootstrap.ts` に 1 行追記 | S | EXP-TASK-04、08、00 の `lib/events.ts` |
| EXP-TASK-11 | `handlers.ts`(00 の `route()` で包む)と `route.ts` 3 ファイル(`api/groups/[groupId]/expenses/route.ts`、`…/expenses/[expenseId]/route.ts`、`…/expense-summary/route.ts`)の再エクスポート(EXP-API-01〜05) | M | EXP-TASK-08、09、10 |
| EXP-TASK-12 | API 試験(EXP-T-21〜29、32、41〜46。見送りの試験は 9 章の印に従う)。00 の `callRoute` で Route Handler を呼ぶ。前提データは `GROUP_BY_STATUS` と `LEFT_MEMBER_SAMPLE`(9 章の前提) | M | EXP-TASK-11、04 の `withdraw`(EXP-T-45) |
| EXP-TASK-13 | `ExpenseNotice`、`ExpenseList`(表/カード)、`ExpenseTab`(取得・「さらに表示」・読み取り専用表示) | M | EXP-TASK-11 |
| EXP-TASK-14 | `ExpenseFormModal`(追加・編集、エラー表示、review の確認、conflict 表示)と `ExpenseDeleteConfirm` | L | EXP-TASK-13 |
| EXP-TASK-15 | `ExpenseSummaryPanel`(目安表示、注意書き併記、`aria-live`) | M | EXP-TASK-10、13 |
| EXP-TASK-16 | 01 のグループ詳細タブへの組み込み(`?tab=expense`)。04 の退会確認ダイアログの差額表示は、04 の画面が `GET G/expense-summary` を取得して行う(契約書 4.5)。07 の作業は EXP-API-05 の提供と、ダイアログが読む `net` の意味(4.1 の `MemberBalance`)を 04 に伝えることだけ | S | EXP-TASK-13、01、04 |
| EXP-TASK-17 | 画面・アクセシビリティ・安全の確認(EXP-T-23、30、31、33〜34、36〜40) | M | EXP-TASK-14、15、16 |
| EXP-TASK-18 | `npm test` / `npm run lint` / `npm run build` が通ることの確認 | S | EXP-TASK-17 |

最小のデモ範囲(優先度 B。1 章の「追加・一覧・合計」): EXP-TASK-01、02、03、05、06、07、08、11、13、14(追加のみ)、16(タブへの組み込みのみ)、18。次点: 09(編集・削除)、04・10・15(分担のまとめと精算の目安)、12、17。

## 12. 未決事項

- #11 計算の範囲(EXP-DEC-01。暫定 B、C は切替可能)。
- 端数ルール(EXP-DEC-02。暫定 d)、日付範囲(暫定値。オーナー判断)。金額上限・件数上限・メモの行数は契約書 10.3 の `LIMITS` で確定した(解消)。
- 編集権限(EXP-DEC-03。暫定 P1)。
- 禁止語・決済誘導語の辞書の範囲(09、#2)。
- 費用項目の通報: 解消(契約書 6.3)。通報の対象はメッセージ・グループ・ユーザーのみ [決定 28] のため、通報対象 `expense` を削除し、導線は置かない。
- 退会確認ダイアログが差額を得る経路: 解消(契約書 4.5、7.9)。04 の画面が `GET G/expense-summary` を取得して自分の `net` を読む(10.3 の 2、13 章 10)。
- [要確認] `app/node_modules` が無いため、Mantine 9 の `Modal` のフォーカス挙動を確認していない(実装着手時に確認する事項。判断は不要。契約書 14.2)。Next.js 16 の Route Handler の `params` の扱いは 00 の `route()` が吸収する(00 の [要確認] に従う)。

## 13. 設計上の確認事項(docs/design・他モジュールとの不一致・不足)

1. **編集権限**: 本骨子の旧版(「作成者または幹事」)と docs/design 05 章(「全員が更新可」[案])が異なっていた。05 に合わせて P1 に変更した。docs/design 側で最終確認が必要。
2. **金額の下限**: 旧骨子は「0 以上」。0 円の項目に意味がないため 1 以上とした(docs/design に記述なし)。契約書 10.3 で 1〜1,000,000 円が 00 の `LIMITS` の値になった。
3. **楽観ロック**: 解決済み。契約書 2.3 の共通方式(`version` と `baseVersion`、`version_mismatch`)に合わせた。
4. **メンバー一覧**: 解決済み。01 への要望は取り下げ、00 の `db().members` と `activeMembers` を使う(契約書 3.1、6.1)。
5. **利用できる状態**: 解決済み。実行確定以降のみ [決定 3]、可否は 04 の `canEditExpenses`(契約書 4.4)。完了後も編集できることは [決定 23] で確定した(契約書 4.4、14.1)。
6. **HTTP メソッド**: 解決済み。PUT/DELETE を採る(契約書 2.3)。
7. **docs/design 07 章は「項目名」に禁止表現を適用**と記すが、本書は `memo` も対象にした(メモ欄に連絡先・決済誘導が書かれ得るため)。契約書 6.2 で `expense_memo` が追加された。
8. **docs/design 05 章の ExpenseNote に日付項目がない**(「メモ日時」のみ)。依頼の「日付」を `spentOn` として追加し、「メモ日時」を `createdAt` と解釈した [推定]。契約書 12 章で docs/design 05 の更新項目(日付・メモ・版番号)になっている。
9. **00 の現行版との差異**: 解消(契約書 3.1、10.3、11.4)。 (a) 00 の `ExpenseNote` 型(`paidBy`・`sharedWith`)は、エンティティの形を所有モジュールに置く規則(契約書 3.1)により本書の型に置き換わる。(b) 00 の金額の範囲 0〜10,000,000 円は 1〜1,000,000 円に改まる(契約書 10.3)。(c) seed の費用メモは 00 の現行が 2 件(g-011)で、本書は 4〜6 件(4.2、10.3 の 1)。元メンバーの見本(g-011 の u-006 と費用メモ 1 件)は契約書 11.4 で確定し、4〜6 件への追加は 10.3 の 1 の要望として残す。
10. **退会確認ダイアログの差額表示**: 解消(契約書 4.5、4.6、7.9)。画面が `GET G/expense-summary` の自分の `net` を読む案に確定し、`unsettledBalanceOf` は 07 の内部関数とした。以下は旧版の記述: 契約書 4.5 は「04 の画面が 07 の `unsettledBalanceOf` を呼ぶ」とするが、契約書 4.6 の依存の向きに 04 → 07 が無い。また `unsettledBalanceOf` はサーバー側の関数で、画面から直接は呼べない。04 の API に差額を含める場合は 04 → 07 の依存を加える必要があり、加えない場合は画面が `GET G/expense-summary` の自分の `net` を読む。どちらにするかは 04 と調整する(10.3 の 2)。
