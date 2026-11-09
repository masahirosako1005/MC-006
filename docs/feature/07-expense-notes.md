# 07 費用の分担メモ(07-expense-notes)

状態の凡例は [README](README.md) 1 章に従う。ID 接頭辞は `EXP`(EXP-DEC 判断、EXP-FN 関数、EXP-API API、EXP-UI 画面部品、EXP-T 試験、EXP-TASK 実装タスク)。

## 1. 概要と責務 / 対応する柱

- 柱16「費用の分担メモ」。グループ内の費用項目(名目・金額・立て替えた人・対象メンバー・日付・メモ)を記録し、一覧と分担額の目安を計算して表示する。 [案]
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

- [案] B を基本とし、C は同じ `GET …/expenses/summary` の `transfers` として実装するが、定数 `EXPENSE_TRANSFER_HINT_ENABLED`(`constants.ts`)で表示を切れるようにする。#11 が A に決まったら `summary` API と `split.ts` / `settlement.ts` を未使用にでき、一覧と合計だけが残る。

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

- [案] P1。項目に最終更新者と更新日時を表示して誤編集を抑止し、楽観的ロック(4.3)で他のメンバーの更新を上書きしないようにする。判定は `canModifyExpense`(EXP-FN-06)1 か所に集約し、P2/P3 へ切り替えても API・画面を変えずに済むようにする。docs/design 05 章が P1 を案として記しているため、骨子旧版の P2 から変更した(13 章 1)。

**EXP-DEC-04 退会したメンバーが関わる費用の扱い [未決 #7 に従属]**

- [案] 項目は削除しない(削除すると精算の目安の計算結果が変わるため)。表示名は「退会したメンバー」に置き換える(匿名化。個人名を残さない)。サマリには含め、「退会」の印を付ける。新規追加と編集後の保存では、退会者を立て替えた人・対象メンバーに新たに指定できない(既存の指定は維持できる)。退会者本人は退会後にこのタブを見られない(非メンバーとして扱う)。
- 他案: (i) 退会時に退会者の項目を削除する(精算の目安が変わる。不採用)、(ii) 退会者の名前を残す(個人名が残る。#7 の決定に従う)。

## 2. 既存機能との関係

- 新規。既存の `/api/v2` モック・`server-store.ts` は変更しない(README 2 章)。ストアは 00 の `groups-store.ts`(globalThis インメモリ)の `Store.expenses` を使い、書き込みは 00 の `tx` 内で行う。
- 他モジュールの権限・状態に依存する(10 章)。決済に関わる既存機能はない。

### 2.1 利用ライブラリ・モジュール

新規に追加するライブラリは Vitest(開発時のみ)だけとする。それ以外は app/package.json の既存依存と自前モジュールで実装する。ライセンスは docs/design 08 章の一覧に載せる(EXP-TASK-01)。

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
| Vitest | 開発ツール(新規。devDependency) | 純粋関数・service・Route Handler の自動試験(9 章)。00 9.1 のテスト基盤を使う | MIT | 最新の安定版を使う |
| ECMAScript 標準(`Intl.NumberFormat`、`Number.isSafeInteger`、`Map`) | 言語標準 | 金額の桁区切り表示、整数判定、集計 | - | Node.js・ブラウザの標準機能 |
| 00 共通基盤(`lib/groups-store.ts`、`errors.ts`、`validation.ts`、`clock.ts`、`ids.ts`、`current-user.ts`、`authz.ts`、`api-route.ts`、`groups-api.ts`、`components/groups/common/*`) | 自前モジュール(他モジュール) | ストアと `tx`、エラー、検証、時計、ID 採番、現在ユーザー、権限判定、API 共通ラッパー、クライアントの fetch、共通 UI | - | 00 に従う |
| 01・04・09 の公開関数 | 自前モジュール(他モジュール) | メンバー判定と表示名、グループ状態による可否、禁止表現と公開範囲 | - | 10.1 の契約に従う |
| `split.ts`、`settlement.ts` | 自前モジュール(本モジュール) | 分担額・差額・精算の目安の計算 | - | 自前実装。円の整数の四則演算だけで足りるため、金額計算ライブラリ(dinero.js 等)は使わない |
| `validate.ts` | 自前モジュール(本モジュール) | 入力検証 | - | 自前実装。00 の `v` を使い、未知キーの拒否と退会者の扱いだけを加える(zod 等は追加しない。00 5.10) |
| `text-guard.ts` | 自前モジュール(本モジュール) | 決済・連絡先への誘導の検査 | - | 自前実装。語の配列と数個の正規表現で足りるため |

- 使わないもの: `@mantine/dates`(日付入力はブラウザ標準の `<input type="date">` を Mantine の `TextInput type="date"` で使う。値がそのまま `YYYY-MM-DD` になり、追加のスタイル読み込みが不要なため)、Zustand(状態は画面部品の中で完結するため)、Node.js 標準モジュール(`crypto`、`fs` 等。ID 採番と時刻は 00 が扱う)。

## 3. 画面・UI(docs/design/04 章「費用の分担メモ」)

| 画面 | 04 章の項目 | パス |
|---|---|---|
| 費用メモタブ(一覧+合計+注意書き) | 費用の分担メモ(「メモであり送金はできない」と明記) | `/[campaign]/groups/[id]?tab=expense` |
| 追加・編集フォーム(モーダル) | 同上 | 同タブ内 |
| 分担のまとめ(サマリ) | 同上 | 同タブ内(折りたたみ可) |

### 3.1 画面部品(EXP-UI)

配置: `app/src/features/groups/expense/ui/`。Mantine 9 を使う(既存画面と同じ)。クライアントコンポーネントには `"use client"` を付ける。データ取得は 00 の `lib/groups-api.ts`(`useGroupsApi`、`gpost`、`gdelete`。PUT は `gapi(path, { method: "PUT", body: JSON.stringify(input) })`)を使う。既存 `src/lib/api.ts` の `useApi` / `post` はパスに `/api/v2` を前置するため使わない [事実]。エラー表示は 00 の `ErrorNotice` と `useFormErrors` を使う。

| ID | コンポーネント | props | 内部 state | 責務 |
|---|---|---|---|---|
| EXP-UI-01 | `ExpenseTab` | `{ groupId: string }` | `editing: ExpenseNoteView \| null`、`formOpen: boolean`、`deleteTarget: ExpenseNoteView \| null`、`refreshKey: number` | 一覧と合計を取得(`GET …/expenses`)し、`ExpenseNotice`・`ExpenseList`・`ExpenseSummaryPanel` を配置する。`canEdit=false`(中止など)のときは追加・編集・削除のボタンを出さず、`readOnlyReason` を表示する。取得に失敗したときは `ErrorNotice`(原因と「もう一度試す」)を表示する。保存・削除の後は一覧を再取得し、`refreshKey` を 1 増やす |
| EXP-UI-02 | `ExpenseNotice` | `{ variant: "tab" \| "form" \| "summary" }` | なし | 常時表示の注意書き(7.3 の文言定数)。`role="note"`、アイコン+文字(色だけに頼らない) |
| EXP-UI-03 | `ExpenseList` | `{ items: ExpenseNoteView[]; canEdit: boolean; onEdit: (item: ExpenseNoteView) => void; onDelete: (item: ExpenseNoteView) => void }` | なし | 広い幅は `<table>`(caption あり)、スマホ幅はカードで表示する。並びは API の順(日付降順)。各項目に最終更新者(`updatedByName`)と更新日時を表示する |
| EXP-UI-04 | `ExpenseFormModal` | `{ groupId: string; members: MemberOption[]; initial?: ExpenseNoteView; opened: boolean; onClose: () => void; onSaved: (item: ExpenseNoteView) => void }` | フォーム値、`fieldErrors: Record<string,string>`、`submitting: boolean`、`conflict: ExpenseNoteView \| null` | 追加(`initial` なし)と編集(`initial` あり)。保存で POST/PUT を呼ぶ。`invalid_input` の `fields` を各入力欄に表示する。`conflict`(`reason:"version"`)のときは同梱の最新内容を表示し、「最新を読み込んで編集し直す」で `initial` を最新内容に差し替える。編集時、`initial` に含まれる退会者は選択済み・変更不可の選択肢として表示する |
| EXP-UI-05 | `ExpenseSummaryPanel` | `{ groupId: string; refreshKey: number }` | `showTransfers: boolean` | `GET …/expenses/summary`。メンバー別の立替額・負担額・差額と、目安(`transfers`)を表示。注意書きを必ず併記 |
| EXP-UI-06 | `ExpenseDeleteConfirm` | `{ target: ExpenseNoteView; onConfirm: () => Promise<void>; onCancel: () => void }` | `submitting: boolean` | 削除の確認(項目名と金額を再表示)。`onConfirm` の実行中はボタンを無効にする |

`MemberOption`(4.1)は `ExpenseListResult.members`(参加中メンバー)から渡す。タブの親(01 のグループ詳細)が `?tab=expense` のときに `ExpenseTab` を描画する。

### 3.2 アクセシビリティ

- 全入力に `<label>`(Mantine の `label`)、必須は `required` と文言「必須」。エラーは項目に `error` を結び付け(`aria-describedby`)、送信失敗時は最初の誤り項目へフォーカス。フォーム上部に `role="alert"` で件数を通知。
- 金額入力は `NumberInput`(`allowDecimal={false}`、`min=1`、`max=1000000`、`inputMode="numeric"`、単位「円」を右ラベルで表示)。通貨の選択肢は出さない。
- 対象メンバーは `Checkbox.Group`(グループに `legend` 相当の説明)。「全員を選ぶ」ボタンを置く。
- 日付は `TextInput type="date"`(`min` は `EXPENSE_LIMITS.dateMin`、`max` は今日から 366 日後)。
- 合計・サマリの更新は `aria-live="polite"` の領域で通知。差額の正負は「受け取る側 / 支払う側」の文字でも示す(色だけにしない)。
- モーダルは開くときにフォーカスをモーダル内へ移し、閉じるときに開いたボタンへ戻す(Mantine `Modal` の既定動作 [要確認])。キーボードだけで全操作ができる(Esc で閉じる、Tab で移動)。ボタンの最小サイズは 44px(スマホ)。
- 表は `<caption>` と `scope`、スマホカードは見出し+定義リストで同じ情報を出す。

## 4. データ(docs/design/05 章)

### 4.1 型定義

配置: `app/src/features/groups/expense/types.ts`。

```ts
/** 通貨は円のみ。通貨コード項目は持たない。 */
export type YenAmount = number; // 整数(Number.isSafeInteger)。1〜EXPENSE_LIMITS.amountMax

/** 保存形。決済・送金・支払い済みの状態は持たない(05 章)。 */
export interface ExpenseNote {
  id: string;            // 00 の newId("ex") で採番。例: "ex-001"
  groupId: string;
  title: string;         // 名目。1〜40 文字
  amount: YenAmount;     // 1〜1,000,000
  payerId: string;       // 立て替えた人(userId)。groupId の元/現メンバー
  targetIds: string[];   // 対象メンバー(userId)。1〜6 件、重複なし、昇順で保存
  spentOn: string;       // 日付 "YYYY-MM-DD"(実在する日付)
  memo: string;          // 0〜200 文字
  version: number;       // 楽観的ロック。作成時 1、更新ごとに +1
  createdBy: string;     // userId
  createdAt: string;     // ISO 8601(タイムゾーン付き)。clock.now() 由来
  updatedBy: string;
  updatedAt: string;
}

/** 追加の入力。サーバーで検証する。 */
export interface ExpenseInput {
  title: string;
  amount: number;
  payerId: string;
  targetIds: string[];
  spentOn: string;
  memo?: string;         // 省略は ""
}

/** 更新の入力。編集対象項目を全て送る(全置換)。 */
export interface ExpenseUpdateInput extends ExpenseInput {
  expectedVersion: number; // 取得時の version。不一致なら conflict
}

/** 応答用。退会者は displayName を「退会したメンバー」に置換する。 */
export interface ExpenseNoteView extends ExpenseNote {
  payerName: string;
  payerActive: boolean;
  targets: { userId: string; displayName: string; active: boolean; share: number }[]; // share は EXP-DEC-02 の d 案(splitAmount)
  updatedByName: string;      // 最終更新者の表示名。退会者は LEFT_MEMBER_LABEL
}

/** フォームの選択肢。参加中メンバーのみ。 */
export interface MemberOption {
  userId: string;
  displayName: string;
}

export interface ExpenseListResult {
  items: ExpenseNoteView[];   // 日付降順 → createdAt 降順 → id 昇順
  totalAmount: number;        // items の amount 合計
  count: number;
  members: MemberOption[];    // 参加中メンバー(userId 昇順)。フォームの選択肢
  canEdit: boolean;           // 呼び出しユーザーが追加・編集・削除できるか
  groupStatus: GroupState;    // 00 の groups-types.ts から import。画面の説明用
  readOnlyReason?: string;    // canEdit=false のときの説明
}

export interface MemberBalance {
  userId: string;
  displayName: string;
  active: boolean;
  paid: number;   // 立て替えた合計
  owed: number;   // 負担の合計(端数処理 d 案)
  net: number;    // paid - owed。正=立て替え過多(受け取る側の目安)、負=負担が多い側
}

export interface TransferHint {
  fromUserId: string;   // 負担が多い側
  toUserId: string;     // 立て替え過多の側
  amount: number;       // 円、整数 >= 1
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

配置: `constants.ts`。

```ts
export const EXPENSE_LIMITS = {
  titleMax: 40, memoMax: 200,
  amountMin: 1, amountMax: 1_000_000,   // 1 項目あたり。[案]
  targetsMax: 6,                         // グループ人数上限 6(01)
  perGroupMax: 100,                      // 1 グループの項目数上限 [案]
  dateMin: "2020-01-01",
  dateFutureDays: 366,                   // clock.today() から先 366 日まで [案]
} as const;
export const EXPENSE_TRANSFER_HINT_ENABLED = true; // EXP-DEC-01 案 C
export const LEFT_MEMBER_LABEL = "退会したメンバー";
```

### 4.2 エンティティと docs/design/05 章の対応

| 05 章の項目 | 本書 | 備考 |
|---|---|---|
| ExpenseNote: グループID、項目名、金額、立て替えた人、分担するメンバー、メモ日時 | `groupId`、`title`、`amount`、`payerId`、`targetIds`、`createdAt`/`updatedAt` | 追加項目: `spentOn`(日付)、`memo`、`version`、`createdBy`/`updatedBy`。「メモ日時」は `createdAt` と解釈 [推定] |
| 決済・送金状態は持たない | 持たない | 支払い済みフラグ、ステータス列を作らない(試験 EXP-T-30) |

保存先: `Store.expenses: ExpenseNote[]`(00)。seed(`group-seed.json`)に 4〜6 件のダミー(端数が出る例と退会者が絡む例を各 1 件)を手書きする。実ユーザー情報・sample-data は使わない。

### 4.3 楽観的ロック

- docs/design・00 に方式の記載がない [要確認]。05(旅程メモ)の骨子は「最後の保存が勝つ」案だった(05 の現行版は version 方式。13 章 9 (j))。費用は金額の取り違えが起きやすいため、本モジュールは `version` による楽観的ロックとする [案]。00 の標準方式が決まったら合わせる。
- 更新・削除は `expectedVersion` を要求し、保存時の `version` と一致しなければ `AppError("conflict", …)`(HTTP 409、本体に最新の `ExpenseNoteView`)。一致なら `version + 1`。ストアは単一プロセスのインメモリで、確認と書き込みを 00 の `tx` 内で同期的に行い、間に `await` を挟まない(確認から書き込みまでの間に他のリクエストが割り込まない)。

## 5. インターフェース

### 5.1 サービス関数(EXP-FN)

配置: `app/src/features/groups/expense/service.ts`(純粋関数は 5.2 の別ファイル)。`user` は 00 の `DemoUser`、例外は 00 の `AppError`。

| ID | 署名 | 戻り値 | 例外 |
|---|---|---|---|
| EXP-FN-01 | `listExpenses(user: DemoUser, groupId: string): ExpenseListResult` | 一覧・合計・canEdit | `not_found`(見えないグループ)、`forbidden`(非メンバー) |
| EXP-FN-02 | `addExpense(user: DemoUser, groupId: string, input: ExpenseInput): ExpenseNoteView` | 追加した項目(version=1) | `not_found`、`forbidden`、`unavailable_state`(編集不可の状態)、`invalid_input`(fields 付き)、`conflict`(件数上限。`reason: "limit"`) |
| EXP-FN-03 | `updateExpense(user: DemoUser, groupId: string, expenseId: string, input: ExpenseUpdateInput): ExpenseNoteView` | 更新後の項目 | 上記に加え `not_found`(項目なし)、`conflict`(`reason: "version"`、最新を同梱) |
| EXP-FN-04 | `deleteExpense(user: DemoUser, groupId: string, expenseId: string, expectedVersion: number): void` | - | `not_found`、`forbidden`、`unavailable_state`、`invalid_input`(`expectedVersion` が 1 以上の整数でない)、`conflict`(`reason: "version"`) |
| EXP-FN-05 | `getExpenseSummary(user: DemoUser, groupId: string): ExpenseSummary` | サマリ | `not_found`、`forbidden` |
| EXP-FN-06 | `canModifyExpense(user: DemoUser, group: Group, note?: ExpenseNote): { ok: true } \| { ok: false; code: "forbidden" \| "unavailable_state"; reason: string }` | 編集可否。P1 は「メンバーである」かつ `canEdit(group)`。グループ状態で不可なら `code:"unavailable_state"`。P2/P3 に切り替えたときの作成者判定は `note` で行い、不可なら `code:"forbidden"` | なし |
| EXP-FN-07 | `unsettledBalanceOf(groupId: string, userId: string): number` | 当該ユーザーの `net`(退会前の確認表示用。0 なら差額なし) | なし |
| EXP-FN-08 | `onGroupMemberLeft(groupId: string, userId: string): void` | 何もしない(項目は残す。EXP-DEC-04)。将来の匿名化処理を入れる場所として用意する | なし |

- EXP-FN-01〜05 は 6.3 の順で権限を確認する。書き込みは 00 の `tx` 内で行う。`expenseId` で項目を取得したときは `note.groupId === groupId` を確認し、一致しなければ `not_found` とする(09 SAF-RULE-41)。

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
//   memberIds に含まれない id が notes に現れても行を作る(退会者)。sum(net) === 0 を保証。
//   集計中のキーは検証済みの userId のみ。Map で集計し、戻り値は Object.create(null) で作る。

export function computeTransfers(net: Readonly<Record<string, number>>): TransferHint[];
//   貪欲法(下記)。入力の net 合計が 0 でなければ RangeError。

// validate.ts
export function validateExpenseInput(
  input: unknown,
  ctx: { activeMemberIds: ReadonlySet<string>; allowedLegacyIds?: ReadonlySet<string>; today: string },
): ExpenseInput;
//   today は clock.today() の "YYYY-MM-DD"。allowedLegacyIds は編集時だけ渡す(既存項目の payerId・targetIds のうち退会者の ID)。
//   未知キーは invalid_input。00 の v.object は未知キーを捨てるため、許可キーとの照合を先に行う。
//   失敗時は AppError("invalid_input") に fields を付ける。title・memo は 00 の sanitizeText を通した値(trim 済み・制御文字除去済み)を返す。

export function validateExpenseUpdateInput(
  input: unknown,
  ctx: Parameters<typeof validateExpenseInput>[1],
): ExpenseUpdateInput;
//   expectedVersion(1 以上の整数)を検証し、残りの項目は validateExpenseInput と同じ規則で検証する。

// text-guard.ts
export function assertNoPaymentInducement(text: string, field: string): void;
//   決済サービス名・送金/振込/口座・QR・URL らしき文字列を含めば AppError("invalid_input")。7.2 参照
```

**精算の目安アルゴリズム(`computeTransfers`、`greedy-v1`)**
1. `net > 0` を受け取る側、`net < 0` を支払う側とし、各々を「金額の大きい順、同額は userId 昇順」に並べる。
2. 先頭の支払う側 d と受け取る側 c を組み、`m = min(-net[d], net[c])` を `TransferHint{from:d,to:c,amount:m}` として追加。双方から `m` を引き、0 になった側を外す。
3. どちらも空になるまで繰り返す。件数は最大で「関係者数 − 1」。最少件数(厳密な最適)は保証しない。この旨を注記し、同じ入力から常に同じ結果が出ることを優先する。

### 5.3 HTTP API(EXP-API)

Route Handler は README 4.1 の `app/api/groups/[...path]/route.ts` から `features/groups/expense/handlers.ts` へ振り分ける。ハンドラは `currentUser(req)` → 検証 → service → `toResponse` の順に呼ぶだけとし、業務ロジックを持たない。00 4.1 はリソースごとの `route.ts` と共通ラッパー `route()` を案としているため、00 の確定に合わせる [要確認]。形式は JSON(`Content-Type: application/json`)。現在ユーザーは Cookie `demoUser` から得る(本文・クエリの userId は使わない)。

共通エラー本体: `{ "error": "<code>", "message": "<説明>", "fields"?: { "<項目>": "<メッセージ>" }, "reason"?: "version"|"limit", "current"?: ExpenseNoteView }`。

| ID | メソッド・パス | リクエスト | 成功レスポンス | エラー |
|---|---|---|---|---|
| EXP-API-01 | `GET /api/groups/:id/expenses` | なし | 200 `ExpenseListResult` | 404 not_found、403 forbidden |
| EXP-API-02 | `POST /api/groups/:id/expenses` | `ExpenseInput` | 201 `ExpenseNoteView` | 400 invalid_input、403 forbidden、404 not_found、409 unavailable_state、409 conflict(limit) |
| EXP-API-03 | `PUT /api/groups/:id/expenses/:eid` | `ExpenseUpdateInput` | 200 `ExpenseNoteView` | 400、403、404、409 unavailable_state、409 conflict(version、`current` 同梱) |
| EXP-API-04 | `DELETE /api/groups/:id/expenses/:eid?version=<n>` | クエリ `version`(必須。1 以上の整数) | 204(本文なし) | 400(version の欠落・不正)、403、404、409 unavailable_state、409 conflict(version) |
| EXP-API-05 | `GET /api/groups/:id/expenses/summary` | なし | 200 `ExpenseSummary` | 404、403 |

- 注: README 4.3 は「状態を変える操作は POST」としているが、05(旅程メモ)が `PUT` を用いているため、更新は `PUT`、削除は `DELETE` とした(資源指向)。00 で統一が決まれば合わせる [要確認]。
- `:id`、`:eid` は `^[a-z0-9-]{1,40}$` 以外を 400。ファイルパスやクエリに使わない。
- 不明なフィールドは無視ではなく拒否(`invalid_input`)。`groupId`、`version`、`createdBy` など保存項目をリクエストで上書きさせない(マスアサインメント防止)。

## 6. 状態遷移・権限

### 6.1 項目の状態

- 項目自体に状態遷移はない(作成 → 更新(version+1)→ 削除)。支払い済みなどの状態は持たない。

### 6.2 グループ状態と操作可否 [案。正は 04 と docs/design]

| グループ状態(04 暫定) | 閲覧 | 追加・編集・削除 |
|---|---|---|
| 募集中、最少人数到達、辞退期間、実行確定、実施中 | 可 | 可 |
| 完了 | 可 | 可(旅行後の精算確認に使うため。[案]) |
| 中止 | 可(読み取りのみ) | 不可(`unavailable_state`)。中止時の費用メモの扱いは 04 の未決(骨子 11 章)に従う |

- 04 の `canEdit(g)` は「旅程等の編集可否」の一般関数で、完了後の扱いが費用と一致しない可能性がある。暫定では `canEdit(group)` を呼び、完了後の可否は 10.3 の要望 2 の `canEditExpenses(group)` に置き換える。

### 6.3 権限チェックの順序(全 API 共通)

1. `getGroup(user, groupId)` でグループが見えない、または存在しない → `not_found`(存在を隠す。00 8 章)。
2. `isMember(user, group)` が偽(退会者を含む)→ `forbidden`。
3. 書き込み系のみ: `canModifyExpense` が `ok:false` → 戻り値の `code`(P1 では `unavailable_state`)。メッセージに現在の状態と取れる操作を入れる。
4. 項目 ID を扱う操作(PUT・DELETE)のみ: 項目が無い、または `note.groupId !== groupId` → `not_found`(別グループの項目 ID を指定した場合を含む。09 SAF-RULE-41)。
5. 入力検証(`invalid_input`)→ version 照合(`conflict`)→ 保存。

- JSON の構文・本文サイズ・`Content-Type`・`Origin` の検査は、00 の API 共通ラッパーが 1 より前に行う。

## 7. 入力検証・セキュリティ

### 7.1 項目ごとの検証規則(`validate.ts`)

| 項目 | 型 | 規則 | エラーメッセージ(例) |
|---|---|---|---|
| title | string | trim 後 1〜40 文字。制御文字(`\u0000-\u001F\u007F`)は除去。全角空白のみは不可 | 「名目は 1〜40 文字で入力してください」 |
| amount | number | 整数(`Number.isSafeInteger`)、1〜1,000,000。小数・文字列・NaN・負数・0 は不可。通貨は円のみ(通貨項目なし) | 「金額は 1〜1,000,000 の整数(円)で入力してください」 |
| payerId | string | 参加中メンバーの userId(編集時は既存の値のままなら退会者も可) | 「立て替えた人を参加中メンバーから選んでください」 |
| targetIds | string[] | 1〜6 件、重複なし、全員が参加中メンバー(編集時は既存の退会者を維持のみ可)。保存は昇順 | 「対象メンバーを 1 人以上選んでください」 |
| spentOn | string | `YYYY-MM-DD` の正規形で、暦として実在(`2026-02-30` は不可)。`2020-01-01` 以上、`clock.today()` から 366 日先まで | 「日付が正しくありません」 |
| memo | string | 0〜200 文字。制御文字除去(改行 `\n` は許可し最大 3 行) | 「メモは 200 文字以内、3 行以内で入力してください」 |
| expectedVersion | number | 1 以上の整数(更新のみ。削除はクエリ `version` で同じ規則) | 「画面を再読み込みしてからやり直してください」 |
| (未知のキー) | - | `ExpenseInput` / `ExpenseUpdateInput` にないキーは不可 | 「受け付けない項目が含まれています」 |
| (件数) | - | 1 グループ 100 件まで(追加時) | 「これ以上追加できません(100 件)」 |

- 「今日」は `lib/clock.ts` の `clock.today()`(JST の暦日)で得る。日付範囲の試験ではデモ日付を差し替えられる。

### 7.2 禁止表現と外部決済への誘導の制御(柱8、docs/design 07 章)

- `title`、`memo` は 09 の `checkText(text, "expense.title" | "expense.memo")` を通す(全入力に適用する方針、docs/design 07 章)。NG なら `invalid_input` に語と言い換え案(09 の返却に従う)。
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
  readOnly: "このグループは中止されたため、費用メモは閲覧のみです。",
  transferLine: (from: string, to: string, yen: string) =>
    `${from}さんは${to}さんに ${yen}円(目安)`,
  leftMember: "退会したメンバー",
} as const;
```

- `tabNotice` はタブの最上部に常時表示(折りたたみ不可)、`summaryNotice` はサマリ・目安の直上に必ず表示。文言に「支払ってください」「送金して」などの指示形を使わない(試験 EXP-T-31)。

### 7.4 その他のセキュリティ対策

| 観点 | 対策 |
|---|---|
| アクセス制御・IDOR | 権限はすべてサーバー側で `currentUser(req)` から判定する(6.3)。クライアントの `canEdit` は表示の切替にだけ使う。項目 ID で操作するときは、項目の `groupId` と URL の `groupId` の一致を確認する(6.3 の 4、EXP-T-41) |
| 入力検証・インジェクション | 7.1 の規則をサーバー側で必ず適用する。SQL・シェル・ファイルパスにユーザー入力を使わない。未知キーを拒否し、`groupId`・`version`・`createdBy` 等の保存項目をリクエストで上書きさせない(マスアサインメント防止)。集計のキーは検証済みの userId だけとし、`Map` または `Object.create(null)` を使う |
| XSS | 出力は React の既定エスケープに任せ、`dangerouslySetInnerHTML` は使わない。URL を自動でリンクにしない(EXP-T-23) |
| CSRF | 00 の API 共通ラッパーの対策に従う(Cookie の `SameSite=Lax`、変更系は `Content-Type: application/json` 必須、`Origin` と `Host` が異なれば拒否)。GET で状態を変えない |
| 認証・セッション(デモ) | ログイン不要のため、Cookie `demoUser` で現在ユーザーを表す(00 5.2)。本モジュール独自のセッションは持たない |
| セキュリティ設定 | 応答ヘッダ(`Cache-Control: no-store`、`X-Content-Type-Options: nosniff`)と本文サイズ上限(64KB)は 00 のラッパーに従う |
| 機密データ | 非メンバーには費用メモの存在を隠す(404/403)。応答の `displayName` は 09 の `visibleProfile(viewer, target, "member")` の範囲内の表示名だけとし、本名・連絡先を含めない。退会者は `LEFT_MEMBER_LABEL`。費用メモの内容は通知(10)と自治体向け集計(12)に渡さない |
| ログ | 例外時は 00 に従い、`requestId` と例外だけを `console.error` に出す。リクエスト本文(名目・金額・メモ)はログに出さない |

- ブロック(09 `isBlocked`)による費用項目の非表示は行わない(非表示にすると精算の目安の計算結果が変わるため)。ブロック相手を含むグループの扱いは 09 の #8 の決定に従う [未決]。
- 既知の制約: Cookie `demoUser` は利用者が書き換えられる(ログイン不要のデモの前提。00 7 章)。大量リクエスト、総当たり、応答時間の差による推測への対策は設計しない。

## 8. エラー処理

| コード | HTTP | 条件 | 画面での表示・挙動 |
|---|---|---|---|
| invalid_input | 400 | 7.1 の検証失敗、禁止表現、決済・連絡先への誘導、未知のキー、`expectedVersion`・`version` の欠落や不正、パスの ID 形式不正(5.3) | 各入力欄に `fields` のメッセージを表示し、フォーム上部に件数を表示する。最初の誤り項目にフォーカスする |
| forbidden | 403 | 非メンバー(退会者を含む) | 「メンバーだけが見られます」と、グループ詳細への導線 |
| not_found | 404 | グループが見えない・存在しない、項目が無い(他のメンバーが削除済みの場合を含む)、項目が別グループのもの | 一覧へ戻る導線。編集中に項目が削除されていた場合は「この項目は削除されています」と表示し、一覧を再取得する |
| unavailable_state | 409 | グループの状態により編集できない(中止など) | `EXPENSE_MESSAGES.readOnly` で現在の状態を説明する。閲覧はできる |
| conflict | 409 | `reason:"version"`: 他のメンバーが先に更新した。`reason:"limit"`: 1 グループの上限(100 件)に達している | version: 同梱の最新内容を表示し、「最新を読み込んで編集し直す」を出す。limit: 上限を説明する |
| (00 共通) | 403 / 405 / 413 / 415 | `Origin` の不一致、許可外のメソッド、本文 64KB 超、`Content-Type` が JSON でない | 00 8 章の表示に従う(通常の画面操作では発生しない) |
| internal | 500 | 想定外の例外(計算の不変条件違反を含む) | 「問題が発生しました」と再読み込みの案内(00 の `ErrorNotice`)。サマリは `sum(net)=0` を満たさなければ表示せず internal とする(デモ範囲外) |
| (クライアント) network | - | 通信失敗、JSON でない応答 | 00 の `ErrorNotice` で「サーバーに接続できません」と「もう一度試す」を表示する |

## 9. 試験項目(docs/design/10 章と対応)

前提: ダミーユーザー a, b, c, d(参加中)、x(非メンバー)、z(退会済みの元メンバー)。e, f は純粋関数の試験だけで使う ID。グループ g は編集可の状態で、h は g とは別のグループ。金額の単位は円。自動試験は Vitest(2.1)で実行し、ユーザー・グループは 00 の `test/fixtures.ts` の seed ID に対応させる。

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
| EXP-T-12 | 退会者 | 項目に退会者 z が対象 | z の行が `active:false` で存在し、sum(net)=0 |
| EXP-T-13 | computeTransfers | net 合計が 0 でない | RangeError |

### 9.2 検証(`validateExpenseInput` / API)

| ID | 入力 | 期待結果 |
|---|---|---|
| EXP-T-14 | amount=0 / -1 / 1.5 / "100" / 1000001 | 400 `invalid_input`、`fields.amount` |
| EXP-T-15 | amount=1 と amount=1000000 | 成功(境界) |
| EXP-T-16 | title="" / 空白のみ / 41 文字 | 400 `fields.title`。40 文字は成功 |
| EXP-T-17 | memo 201 文字、または 4 行 | 400 `fields.memo`。200 文字・3 行は成功 |
| EXP-T-18 | targetIds=[] / 重複 / 7 件 / 非メンバー x を含む | 400 `fields.targetIds` |
| EXP-T-19 | payerId に非メンバー x | 400 `fields.payerId` |
| EXP-T-20 | spentOn="2026-02-30" / "2026/02/01" / "2019-12-31" | 400 `fields.spentOn` |
| EXP-T-21 | 101 件目の追加 | 409 `conflict`、`reason:"limit"` |
| EXP-T-22 | リクエストに `version:99`、`createdBy:"b"` を付けて POST | 400 `invalid_input`(未知フィールド) |
| EXP-T-23 | title="<script>alert(1)</script>" | 保存は可(禁止語でなければ)、画面では文字列としてそのまま表示され実行されない |

### 9.3 権限・状態・競合

| ID | 操作 | 期待結果 |
|---|---|---|
| EXP-T-24 | 非メンバー x が GET/POST/PUT/DELETE/summary | 403(グループが見えない場合は 404)。データが応答に含まれない |
| EXP-T-25 | 退会済みの元メンバーが GET | 403 |
| EXP-T-26 | メンバー b が a の作成した項目を PUT / DELETE(P1) | 成功。`updatedBy=b`、`version` が +1 |
| EXP-T-27 | グループ状態が中止で POST/PUT/DELETE | 409 `unavailable_state`。GET は 200 で `canEdit:false` |
| EXP-T-28 | a と b が同じ version=1 を取得 → a が PUT(成功、version=2) → b が expectedVersion=1 で PUT | b は 409 `conflict`(`reason:"version"`)、`current.version=2`。データは a の更新のまま |
| EXP-T-29 | DELETE で `?version=` 欠落、または古い version | 400 / 409 |
| EXP-T-41 | メンバー a がグループ g の URL で、別グループ h の項目 ID を指定して PUT / DELETE | 404 `not_found`。h の項目は変更されない |

### 9.4 安全・表示

| ID | 確認 | 期待結果 |
|---|---|---|
| EXP-T-30 | 型・API・画面に支払い済み/決済/送金の項目・ボタン・外部リンクがない(静的検査と画面確認) | 該当なし |
| EXP-T-31 | 画面にタブ注意書き(`tabNotice`)が常時、サマリに `summaryNotice` がある。文言に指示形(「送金してください」等)がない | 満たす |
| EXP-T-32 | title に「PayPayで送って」「振込先 口座」「https://example.com」「090-1234-5678」 | 400 `invalid_input`(決済誘導/連絡先)。09 の禁止語も拒否 |
| EXP-T-33 | サマリの表示 | transfers の各行に「(目安)」が付く。`EXPENSE_TRANSFER_HINT_ENABLED=false` で transfers が空になる |
| EXP-T-34 | 退会した z を含む項目の表示 | 名前は「退会したメンバー」。項目は残り、サマリに「退会」の印 |
| EXP-T-35 | 日付範囲: clock を差し替え今日+366 日と +367 日 | 前者成功、後者 400 |

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

| 相手 | 名称(README・骨子の表記) | 用途 |
|---|---|---|
| 00 | `currentUser(req)`、`AppError` / `toResponse`、`validate`(00 では `v` / `parse` / `sanitizeText`)、`clock.today()` / `clock.nowIso()`、`newId("ex")`、`store()`(00 では `db()` / `tx()`)、`lib/groups-api.ts`、`ErrorNotice` / `useFormErrors` | 共通処理 |
| 01 | `getGroup(user, id)`、`isMember(user, group)` | 閲覧権限(退会者・非メンバー判定、存在を隠す) |
| 04 | `canEdit(g)`(暫定。後述の要望で `canEditExpenses(g)`)、グループ状態名 | 書き込み可否 |
| 09 | `checkText(text, field)`、`visibleProfile(viewer, target, "member")` | 禁止表現、表示名 |

### 10.2 本モジュールが公開するもの

| 相手 | 名称 | 用途 |
|---|---|---|
| 01 | `unsettledBalanceOf(groupId, userId)`(EXP-FN-07)、`onGroupMemberLeft(groupId, userId)`(EXP-FN-08) | 退会画面で「費用メモに差額が残っている」旨を表示、退会時フック |
| 04 | なし(読み取りのみ) | - |

### 10.3 他モジュールへの要望(他ファイルは編集しない)

1. **01**: 退会者を含むメンバー参照が必要。`listMembers(groupId, opts?: { includeLeft?: boolean }): GroupMember[]` と、`GroupMember` に `status: "active"|"left"` と `displayName` 取得経路(または `getMember(groupId, userId)`)を提供してほしい。骨子には `isMember` のみ。退会時に `onGroupMemberLeft` を呼ぶこと、退会画面で `unsettledBalanceOf` を表示することも依頼。
2. **04**: `canEdit(g)` の意味が「旅程等」か「全機能共通」か不明。費用メモ用に `canEditExpenses(g: Group): { ok: boolean; reason?: string }`(中止は不可、完了は可。理由文つき)を提供してほしい。状態名の列挙型の公開も。
3. **09**: `checkText` の戻り値(`{ok:true}|{ok:false, word, reason, suggestion}` か例外か)の確定。`field` の種別に `expense.title` / `expense.memo` を追加し、辞書に「決済・送金サービス名、振込・口座・QR など金銭の誘導語」を入れてほしい。静的検査(決済導線なし)の試験を 09 の試験に含める。
4. **00**: 楽観的ロックの共通方式(`version` 整数か `updatedAt` か)、PUT/DELETE の採否、`AppError` の `details`(`reason`、`current`)を持てるか、`validate` の返す `fields` の形の確定。テスト基盤は 00 9.1 の Vitest に合わせる(EXP-TASK-01)。
5. **10**(任意): 費用の追加・更新を通知しない方針とするが、必要なら「費用が追加された」通知の要否を確認。

## 11. 実装タスクの分解

規模: S=半日以内、M=1 日前後、L=2 日以上。ファイルは `app/src/features/groups/expense/` に置く(画面部品は `ui/`)。

| ID | タスク | 規模 | 前提 |
|---|---|---|---|
| EXP-TASK-01 | テスト基盤の準備。00 9.1 の Vitest(最新の安定版、devDependency)を使い、試験ファイル `*.test.ts` を本モジュールのディレクトリに置く。00 で未導入なら導入を 00 に依頼する。ライセンス(MIT)を docs/design 08 章の一覧に載せる | S | 00 のテスト基盤 |
| EXP-TASK-02 | `types.ts`、`constants.ts`、`messages.ts` を作成(4・7 章の型・定数・文言) | S | - |
| EXP-TASK-03 | `split.ts` の `splitAmount` と単体試験 EXP-T-01〜07 | S | EXP-TASK-01、02 |
| EXP-TASK-04 | `settlement.ts` の `computeBalances` / `computeTransfers` と EXP-T-08〜13 | M | EXP-TASK-03 |
| EXP-TASK-05 | `text-guard.ts`(決済誘導検査)と辞書、09 `checkText` 呼び出しの結線 | S | EXP-TASK-02、09 の `checkText` |
| EXP-TASK-06 | `validate.ts`(7.1。`validateExpenseInput`、`validateExpenseUpdateInput`)と EXP-T-14〜20、22、35 | M | EXP-TASK-02、05 |
| EXP-TASK-07 | `Store.expenses` の型追加(00 の `groups-store.ts`)と seed 4〜6 件(`group-seed.json`) | S | 00、EXP-TASK-02 |
| EXP-TASK-08 | `service.ts`: `canModifyExpense`、`listExpenses`、`addExpense`(件数上限含む) | M | EXP-TASK-04、06、07、および 01 の `getGroup`/`isMember`/`listMembers`、04 の `canEdit` |
| EXP-TASK-09 | `service.ts`: `updateExpense`(version 照合)、`deleteExpense` | M | EXP-TASK-08 |
| EXP-TASK-10 | `service.ts`: `getExpenseSummary`、`unsettledBalanceOf`、`onGroupMemberLeft` | S | EXP-TASK-04、08 |
| EXP-TASK-11 | `handlers.ts` と `app/api/groups/[...path]/route.ts` への結線(EXP-API-01〜05)。Next.js 16 の Route Handler 仕様(`params` が Promise)を `app/node_modules/next/dist/docs/` で確認 [要確認] | M | EXP-TASK-08、09、10 |
| EXP-TASK-12 | API 試験(EXP-T-21〜29、32、41)。00 の `callRoute` で Route Handler を呼ぶ | M | EXP-TASK-11、01 |
| EXP-TASK-13 | `ExpenseNotice`、`ExpenseList`(表/カード)、`ExpenseTab`(取得・読み取り専用表示) | M | EXP-TASK-11 |
| EXP-TASK-14 | `ExpenseFormModal`(追加・編集、エラー表示、conflict 表示)と `ExpenseDeleteConfirm` | L | EXP-TASK-13 |
| EXP-TASK-15 | `ExpenseSummaryPanel`(目安表示、注意書き併記、`aria-live`) | M | EXP-TASK-10、13 |
| EXP-TASK-16 | 01 のグループ詳細タブへの組み込み(`?tab=expense`)、退会画面への差額表示の結線(01 との調整) | S | EXP-TASK-13、01 |
| EXP-TASK-17 | 画面・アクセシビリティ・安全の確認(EXP-T-23、30、31、33〜34、36〜40) | M | EXP-TASK-14、15、16 |
| EXP-TASK-18 | `npm run lint` / `npm run build` が通ることの確認 | S | EXP-TASK-17 |

最小のデモ範囲(優先度 B。1 章の「追加・一覧・合計」): EXP-TASK-01、02、03、05、06、07、08、11、13、14(追加のみ)、16(タブへの組み込みのみ)、18。次点: 09(編集・削除)、04・10・15(分担のまとめと精算の目安)、12、17。

## 12. 未決事項

- #11 計算の範囲(EXP-DEC-01。暫定 B、C は切替可能)。
- 端数ルール(EXP-DEC-02。暫定 d)、金額上限 1,000,000 円・件数上限 100・日付範囲(暫定値。オーナー判断)。
- 編集権限(EXP-DEC-03。暫定 P1)、退会者の履歴(#7、EXP-DEC-04)、中止後の費用メモの扱い(04 の未決)。
- 禁止語・決済誘導語の辞書の範囲(09、#2)。
- 楽観的ロックの共通方式(00)。
- [要確認] `app/node_modules` が無いため、Next.js 16 の Route Handler の仕様(`app/node_modules/next/dist/docs/`)と Mantine 9 の `Modal` のフォーカス挙動を確認していない。

## 13. 設計上の確認事項(docs/design・他骨子との不一致・不足)

1. **編集権限**: 本骨子の旧版(「作成者または幹事」)と docs/design 05 章(「全員が更新可」[案])が異なっていた。05 に合わせて P1 に変更した。docs/design 側で最終確認が必要。
2. **金額の下限**: 旧骨子は「0 以上」。0 円の項目に意味がないため 1 以上とした(docs/design に記述なし)。
3. **00 共通基盤に楽観的ロックの記述がない**: 05(旅程メモ)は「最後の保存が勝つ」。本モジュールは version 方式を独自に採った。00 の確定後に合わせる。
4. **01 骨子にメンバー一覧取得関数がない**(`isMember` / `isOrganizer` のみ)。退会者表示のために要望した。
5. **04 骨子の `canEdit(g)` の対象範囲が不明**。完了後・中止後の費用メモの扱いが 04 骨子の未決事項(「中止時の費用メモ…の扱い」)のままで、本書の 6.2 は暫定。
6. **README 4.3「状態を変える操作は POST」と 05 骨子の `PUT`** が不一致。本書は PUT/DELETE を採用。
7. **docs/design 07 章は「項目名」に禁止表現を適用**と記すが、本書は `memo` も対象にした(メモ欄に連絡先・決済誘導が書かれ得るため)。
8. **docs/design 05 章の ExpenseNote に日付項目がない**(「メモ日時」のみ)。依頼の「日付」を `spentOn` として追加し、「メモ日時」を `createdAt` と解釈した [推定]。05 章への反映が必要。
9. **他モジュールの現行版との差異**(本書には反映していない。各モジュールと調整する): (a) 00 の `ExpenseNote` 型は `paidBy`・`sharedWith` を使い、`spentOn`・`memo`・`version`・`updatedBy`・`updatedAt` がない。(b) 00 の金額の範囲は 0〜10,000,000 円、本書は 1〜1,000,000 円。(c) 00 のエラー本体は補足を `detail` に入れる形で、本書は `reason`・`current` を最上位に置いている。(d) 00 の `v.object` は未知キーを捨てる。本書と 09 SAF-RULE-38 は拒否する。(e) 00 はパスの ID 形式不正を `not_found`、本書は 400 とする。(f) 00 は Route Handler をリソースごとの `route.ts` とし、`[...path]` を使わない。(g) 04 の `canEditExpenses` は実行確定・実施中・完了のときだけ可で、本書 6.2(募集中から完了まで可)と異なる。(h) 09 は `assertTextAllowed("expense_item")`(項目名のみ)を定義しており、`memo` 用の文脈がない。(i) 00 の seed は費用メモ 2 件(g-011)、本書は 4〜6 件。(j) 05 の現行版は version による楽観的ロックを採っており、4.3・13 章 3 の「05 は最後の保存が勝つ」は骨子時点の記述である。
