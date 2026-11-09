# 画面モック(docs/design/mockup)

Next.js(Mantine)で実装する画面を、実装の前に静的な HTML+CSS で示す。本書は、画面モックを作成するときの共通の決まりを定める。

## 1. ファイル構成

```
docs/design/mockup/
  README.md            本書
  index.html           画面モックの一覧(ロール別・機能別)
  components.html      部品カタログ
  _template.html       画面モックの雛形
  _sample-page.html    サンプル画面(土台の確認用。グループ一覧の例)
  assets/base.css      デザイントークンと共通部品のスタイル
  traveler/            旅行者の画面(探索、運営・実施)
  safety/              安全・通知の画面(全ロール共通)
  municipal/           自治体の画面
  business/            観光事業オーナーの画面
  host/                地元の担い手の画面
```

- 確認方法: エクスプローラーで `docs/design/mockup/index.html` をダブルクリックし、ブラウザ(Chrome、Edge など)で開く。サーバーは不要(`file://` で開ける)。
- スマートフォン幅の確認: ブラウザの開発者ツールのデバイス表示で幅 360px を選ぶ。

## 2. 既存サイトから継承したデザイントークン

出どころの略号: [G] `app/src/app/globals.css`、[M] `@mantine/core` 9.7 の既定値(`app/node_modules/@mantine/core/styles.css`)、[P] 既存画面(`app/src/app/[campaign]/**/page.tsx`、`app/src/components/AppShell.tsx`、`Providers.tsx`)での Mantine の使い方、[N] 既存に無いため [G][M] の延長で新設。

### 2.1 色

| トークン | 値 | 出どころ | 用途 |
|---|---|---|---|
| `--main-color` | #2f6ba3 | [G] | ヘッダー背景、主ボタン(既存は `color="var(--main-color)"`)、選択中のナビ・タブ |
| `--sub-color` | #e1eef8 | [G] | 獲得済みスタンプ背景、副ボタン、未読の通知、自分の吹き出し |
| `--on-main-color` | #ffffff | [G] | `--main-color` 上の文字 |
| `--on-sub-color` | #193e62 | [G] | `--sub-color` 上の文字 |
| `--main-color-light` | #63a1dc | [G] `.hero` のグラデーション終端 | ヒーロー、グラフの見込み値 |
| `--success-color` | #2fa36b | [G] `.map` の取得済みピン | 進捗(到達) |
| `--page-bg` | #f5f5f5 | [G] body | ページの背景 |
| `--border-shell` | #e0e0e0 | [G] `.app-shell`、`.app-nav` | シェル・下部ナビの線 |
| `--border` | #dee2e6 | [M] gray-3 | カード(`withBorder`)、表の線 |
| `--border-input` | #ced4da | [M] gray-4 | 入力欄の線 |
| `--text` | #000000 | [M] color-text | 本文 |
| `--text-dimmed` | #495057 | [M] gray-7 | 補足文(`c="dimmed"`)。Mantine の dimmed(gray-6 #868e96)は白地で 3.3:1 のため 1 段濃くした |
| `--text-nav` | #616161 | [G] `.app-nav a` | 下部ナビの文字 |
| `--link` | #1971c2 | [M] blue-8 | リンク。anchor の既定 blue-6 は白地で 3.5:1 のため 2 段濃くした |
| エラー | #e03131 | [M] red-8 | エラー文、危険ボタン |
| Mantine パレット | gray / blue / teal / yellow / green / cyan / red / grape | [M] | 状態色、アラート |

- Mantine のテーマ(`Providers.tsx`)は `primaryColor: "blue"`(#228be6)。既存画面は主要な操作だけ `color="var(--main-color)"` を指定し、`Progress` や `variant="light"` のボタンは既定の blue のまま使っている。モックでは主色を `--main-color` に揃え、副ボタンは `--sub-color` で表す。実装では、主ボタンに既存と同じ `color="var(--main-color)"` を指定する。

### 2.2 状態色(グループの状態 8 種)

00 §3.2 の `StatusBadge` の色の対応表に合わせる。背景は Mantine の各色の 1 番(`variant="light"` 相当)、文字色は 4.5:1 以上になるよう 9 番より濃い値にした([N])。色に加えて記号とラベルで区別する。

| 状態 | クラス | Mantine color | 記号 | 文字/背景 | コントラスト |
|---|---|---|---|---|---|
| 募集中 | `.status--recruiting` | blue | ● | #134f86 / #d0ebff | 6.8:1 |
| 最少人数到達 | `.status--min-reached` | teal | ▲ | #075b42 / #c3fae8 | 7.0:1 |
| 辞退期間 | `.status--withdrawal` | yellow | ◆ | #6b4300 / #fff3bf | 7.8:1 |
| 実行確定 | `.status--confirmed` | green | ✔ | #1d6a2e / #d3f9d8 | 5.8:1 |
| 実施中 | `.status--in-progress` | cyan | ▶ | #0a5966 / #c5f6fa | 6.8:1 |
| 完了 | `.status--completed` | gray | ■ | #343a40 / #f1f3f5 | 10.3:1 |
| 中止 | `.status--cancelled` | red | ✕ | #a51d1d / #ffe3e3 | 6.2:1 |
| 再企画 | `.status--replanned` | grape | ↻ | #6e2683 / #f3d9fa | 7.1:1 |

### 2.3 文字・余白・角丸・寸法

| 種類 | 値 | 出どころ |
|---|---|---|
| フォント | "Noto Sans JP", "Yu Gothic UI", "Hiragino Sans", Meiryo, sans-serif(端末にあるものを使う。Web フォントは読み込まない) | [G] `--mantine-font-family` |
| 文字サイズ | xs 12 / sm 14 / md 16 / lg 18 / xl 20(px) | [M] |
| ヘッダーの画面名 | 16px、太字、中央 | [G] `.app-header h1` |
| 下部ナビの文字 | 11px | [G] `.app-nav a` |
| 行の高さ | 1.55 | [M] |
| 余白 | xs 10 / sm 12 / md 16 / lg 20 / xl 32(px)。画面の内側は md(既存の `Stack p="md"`)、要素の間は sm(`gap="sm"`) | [M][P] |
| 角丸 | xs 2 / sm 4 / md 8 / lg 16 / xl 32(px)。カード・ボタン・入力は md(既存の `radius="md"`)、地図 12px、バッジは丸 | [M][P][G] |
| 影 | シェル: `0 0 0 1px #e0e0e0`。カードのホバーとダイアログは新設 | [G][N] |
| シェルの幅 | スマートフォン幅 480px 上限(中央寄せ) | [G] `.app-shell` |
| ヘッダー / 下部ナビの高さ | 56px / 64px | [G] |
| ボタン・入力の高さ | 36px | [M] button-height-sm / input-height-sm |
| バッジ | 高さ 20px、11px、太字、丸 | [M] badge md |

### 2.4 レイアウト(既存のシェルの継承と拡張)

- スマートフォン幅(〜767px。360px まで崩れないこと): 既存と同じ。ヘッダー(戻る/画面名/通知ベル)、下部ナビ(固定)、シェル幅 480px 上限。
- デスクトップ幅(768px〜)[N]: 既存は 480px 固定のため新設。シェル幅を 1080px に広げ、ヘッダーにロゴ・ナビ・通知・ユーザーを並べ、下部ナビを隠す。画面名はヘッダーでは視覚的に隠し(見出しとしては残す)、本文の `.page-title-lg` で表示する。`.grid--2/--3/--side` が多列になる。
- デモバー [N]: 画面の最上部に固定(`position: sticky`)。00 §3.1 の DemoBar(モック表示、ユーザー切替、日付、日付を進める、初期化)に、ロール 4 種の切り替えを加えた。日付の操作と初期化は `<details>` に畳む。

## 3. クラスの命名規則

- BEM 風: ブロック `.card`、要素 `.card__title`、修飾 `.card--muted`。単語の区切りはハイフン(`.status--min-reached`)。
- 既存の globals.css のクラス(`.app-shell`、`.app-header`、`.app-main`、`.app-nav`、`.hero`、`.stamp-grid`、`.stamp`、`.map`)は同じ名前・同じ見た目で使う。
- 状態は可能な限り属性で表す: `aria-current="page"`(選択中のナビ・タブ・ページ)、`aria-selected`(タブ)、`aria-pressed`(チップ・セグメント)、`aria-invalid="true"`(入力エラー)、`aria-disabled="true"`(無効のリンク)、`data-on="true"`(獲得済みスタンプ。既存と同じ)。
- 画面固有のスタイルが必要なときは、画面の `<style>` に書き、クラス名に画面 ID の接頭辞を付ける(例: `.trv01-map`)。base.css は直接変更しない。共通化したい部品は窓口に報告する。
- 余白の微調整に限り `style="margin-top:8px"` などのインライン指定を許す。グラフの棒の長さは `style="width:NN%"` で指定する。

## 4. 部品カタログと Mantine の対応

一覧は `components.html` で確認する。

| 部品 | クラス | Mantine コンポーネント | 備考 |
|---|---|---|---|
| デモバー | `.demo-bar` | `Group`、`Select`、`Button`、`Menu` | 00 CMN-UI-01 DemoBar |
| ヘッダー | `.app-header`、`.icon-btn`、`.icon-btn__dot` | `ActionIcon variant="subtle"`、`Indicator` | 既存 AppShell |
| 下部ナビ | `.app-nav` | (既存の自作) | 既存 AppShell |
| グループ内の下部タブ | `.hub-tabs` | `Tabs` または自作 | `.app-nav` と同じ見た目 |
| 画面の外枠 | `.page`、`.stack`、`.group`、`.grid` | `Stack p="md" gap="sm"`、`Group`、`SimpleGrid` | |
| パンくず | `.breadcrumb` | `Breadcrumbs` | |
| 区切り線 | `.divider` | `Divider` | |
| 定義リスト | `.kv` | `SimpleGrid` + `Text` | |
| カード | `.card`、`--sm`、`--link`、`--muted`、`--accent` | `Card withBorder radius="md"`(`padding="sm"`、`component={Link}`) | |
| ボタン | `.btn--primary` | `Button color="var(--main-color)"` | |
| | `.btn--secondary` | `Button variant="light"` | |
| | `.btn--outline` | `Button variant="outline"` | |
| | `.btn--danger` / `--danger-light` | `Button color="red"` / `variant="light" color="red"` | |
| | `.btn--ghost` | `Button variant="subtle"` | |
| | `--sm` / `--lg` / `--block` / `disabled` | `size` / `fullWidth` / `disabled` | |
| バッジ | `.badge--*` | `Badge variant="light"` | `.badge--green` は既存の filled の再現 |
| 状態バッジ | `.status--*` | `Badge variant="light"`(00 `StatusBadge`) | 2.2 |
| モック表示 | `.badge--mock` | `Badge`(00 `MockBadge`) | |
| タブ | `.tabs`、`.tabs__tab` | `Tabs` | 画面間は `?tab=` のリンク |
| セグメント | `.segmented` | `SegmentedControl` | 既存のスポット一覧 |
| 入力 | `.field`、`.input` | `TextInput`(`label`、`description`、`error`、`withAsterisk`) | |
| 日付 | `.input[type=date]` | `DateInput`(@mantine/dates) | |
| セレクト | `.select` | `Select` / `NativeSelect` | |
| テキストエリア | `.textarea` | `Textarea` | |
| チェックボックス・ラジオ | `.check`、`.fieldset` | `Checkbox`、`Radio`、`Checkbox.Group`、`Radio.Group` | |
| スイッチ | `.switch` | `Switch` | 既存のスポット一覧 |
| チップ | `.chip`、`.chip-row` | `Chip`、`Chip.Group` | 定型文、テーマの選択 |
| テーブル | `.table-wrap`、`.table` | `Table.ScrollContainer`、`Table` | |
| ページネーション | `.pagination` | `Pagination` | |
| ダイアログ | `.modal`、`.modal-preview`、`.modal-overlay--target` | `Modal`(size md 440px) | 既存ホームのポップアップ |
| アラート | `.alert--info/--success/--warning/--error` | `Alert variant="light"` | 00 `ErrorNotice` |
| 通知アイテム | `.notice-list`、`.notice-item` | `Card` / `NavLink` の並び | 既存 news の構成 |
| 空状態 | `.empty` | `Stack` + `Text` + `Button` | |
| 読み込み | `.skeleton` | `Skeleton`(00 `LoadingBlock`) | |
| プログレス | `.progress`、`.progress__marker` | `Progress`(最少人数の印は自作) | 既存ホーム |
| 人数の席表示 | `.seats`、`.seat` | 自作 | `.stamp` の延長 |
| スタンプ | `.stamp-grid`、`.stamp` | (既存の自作) | 既存ホーム |
| チャット | `.chat`、`.chat__msg`、`.chat__bubble`、`.chat__composer` | `Paper` + `Text`、`Textarea`、`Button` | |
| 指標タイル | `.stat`、`.stat-grid` | `Paper` + `Text`、`SimpleGrid` | |
| 簡易グラフ | `.bar-chart`、`.col-chart`、`.legend` | `@mantine/charts`(未導入)または自作 | 数値ラベルを併記 |
| メンバー行 | `.list`、`.avatar` | `Avatar`、`Group` | 画像を使わず頭文字 |
| 画面情報 | `.mock-info` | (モック専用。実装しない) | |

## 5. 画面ファイルの置き場所と命名規則

- 置き場所: `docs/design/mockup/<ロール>/<画面名>.html`。ロールのフォルダは `traveler`、`safety`(全ロール共通の安全・通知)、`municipal`、`business`、`host`。
- 画面名: 英小文字とハイフン(kebab-case)。例: `docs/design/mockup/traveler/group-list.html`、`docs/design/mockup/safety/report-dialog.html`、`docs/design/mockup/municipal/stats-dashboard.html`。
- 画面 ID: `TRV-nn`(旅行者)、`SAF-nn`(安全・通知)、`MUN-nn`(自治体)、`BIZ-nn`(観光事業オーナー)、`HST-nn`(地元の担い手)。割り当ては `index.html` の一覧に従う。
- 1 画面 1 ファイル。状態ごとの表示の違い(例: 8 状態)は、1 ファイルの中に節を分けて並べるか、`group-hub--cancelled.html` のように `--<状態>` を付けた別ファイルにする。
- ダイアログは、呼び出し元の画面の上に重ねた形で 1 ファイルにする(`.modal-overlay` を固定表示)。
- 画面を作ったら、`index.html` の自分の行だけを更新する(状態を「作成済み」にし、画面名をファイルへのリンクにする)。

## 6. 相対パスの決まり

- `file://` で開けるよう、すべて相対パスで書く。先頭が `/` のパス、`http(s)://` の参照は使わない。
- サブフォルダの画面からは、`../assets/base.css`、`../index.html`、`../components.html`、他のロールの画面は `../safety/notifications.html` のように書く。
- `_template.html` は `docs/design/mockup/` 直下にあるため、コピーしたら `assets/`、`index.html`、`traveler/` などの先頭に `../` を付ける。
- 実装時の URL(`/[campaign]/groups` など)は、画面情報(`.mock-info`)の「実装パス」に文字で書き、リンクにしない。
- 未作成の画面へのリンクは、作成予定のファイル名で書いてよい(作成されるまでは開けない)。既存サイトの画面(ホーム、スポットなど)へのリンクは `href="#"` とする。

## 7. HTML の書き方の決まり

- `<html lang="ja">`、`<meta charset="utf-8">`、`<meta name="viewport" content="width=device-width, initial-scale=1">` を付ける。`<title>` は「画面名 | 画面モック」。
- 改行コードは CRLF、文字コードは UTF-8、インデントは空白 2 つ。手で書き、整形を揃える。
- JavaScript は使わない。開閉はリンクと CSS の `:target`、`<details>` で表す。押しても何も起きないボタンは `type="button"` とする。
- 外部のフォント・CDN・画像を使わない。アイコンはインラインの SVG(線画。`class="icon"`、`aria-hidden="true"`)。写真の代わりは `.hero` のグラデーションか、頭文字の `.avatar`。
- 見出しの階層: ヘッダーの画面名が `<h1>`(既存 AppShell と同じ)、画面内の節が `<h2>`、その下が `<h3>`。段を飛ばさない。
- ランドマーク: `<header>`、`<main id="main">`、`<nav aria-label="…">`、`<footer>`。先頭に「本文へ移動」のリンクを置く。
- フォーム: すべての入力に `<label for>` を付ける。ラベルを見せない入力は `.visually-hidden` のラベルを付ける。ヘルプとエラーは `aria-describedby` で入力と結ぶ。エラーの入力には `aria-invalid="true"`。必須は `required` と見た目の「*」(`aria-hidden="true"`)。選択肢のまとまりは `<fieldset>` と `<legend>`。
- ダイアログ: `role="dialog"`、`aria-modal="true"`、`aria-labelledby`(題名の id)。閉じるボタンに `aria-label="閉じる"`。
- 状態・結果の表示: 成功と情報は `role="status"`、エラーは `role="alert"`(既存の inquiries・qr 画面と同じ)。
- アイコンだけのボタン・リンクには `aria-label` を付ける(例: 通知ベル「通知(未読 3 件)」)。
- 色だけで情報を伝えない(状態バッジは記号とラベル、未読は背景色と「未読」の文字、グラフの見込みは斜線)。
- 表は `<caption>` か見出しで題名を示し、列見出しに `<th scope="col">` を付ける。
- フォーカスリング(`:focus-visible` の 2px の線)を消さない。

## 8. 各画面が持つ要素

1. デモバー(ロール 4 種の切り替え、デモユーザーの選択、日付、デモ操作)。その画面のロールに `aria-current="true"` を付ける。
2. ヘッダー(戻る、画面名 `<h1>`、通知ベル。デスクトップ幅ではロゴ・ナビ・ユーザー)。
3. 画面情報 `.mock-info`: 画面 ID、画面名、対象ロール、実装パス、参照設計書(ファイルと節。例: `docs/feature/03-join-flow.md §3`)、遷移先(他の画面モックへのリンク)。
4. パンくず(画面モック一覧 → 親画面 → この画面)。
5. 本文(`.page` の中)。主な操作、表示する項目、空状態・エラー状態の見本を含める。
6. フッター(画面モック一覧への導線)。
7. 下部ナビ(旅行者の画面。自治体・観光事業オーナーの画面は、ナビの項目を各ロールの画面に置き換える)。

## 9. ダミーデータの方針

- 架空の名前・地名だけを使う。表示名は名のみのカタカナ(ミサキ、ケンタ、ユイ、ダイスケ、ハルカ、ソウタ、ナナミ、リク、タナカ、ゲン など。docs/feature/00 の seed と同じ)。観光事業オーナーのデモユーザーは「ミナト」を仮に使う(seed 未定義)。
- 地名は seed の架空の地方(水琴地方、鈴風高原、星凪諸島、虹帆町)と、それを使った架空のスポット名だけを使う。実在の地名・店名・団体名は使わない。
- グループ名・日付・人数は docs/feature/00 の CMN-D-03(g-001〜g-013)に合わせると、実装の seed と対応がとれる。基準日は 2026-11-09。
- `sample-data/` の値(人数、年代の分布、アンケートの回答など)を転記しない。集計画面の数値も架空の値とする。
- 個人を特定できる情報(本名、メールアドレス、電話番号、住所、顔写真)を載せない。性別の表示・絞り込みは設けない。
- 文言は「旅の同行者探し」に統一し、恋愛を連想させる語、「相乗り」「マッチング」は使わない。

## 10. 既存サイトで確認できなかった点

- 本番サイト(app.raund.net)の CSS は確認していない。継承元は、ローカル再現環境 `app/` の globals.css と Mantine の既定値、docs/ideas/overview.md の記述(メインカラー・サブカラーの設定項目、ボトムナビゲーション)である。本番の実際の色・フォント・アイコンとは異なる可能性がある。
- 既存サイトにはデスクトップ幅のレイアウト、フッター、パンくず、テーブル、ページネーション、タブ(`Tabs`)、チェックボックス・ラジオ、チャット、グラフが無い。これらは [N] として新設した。
- 影の値(Mantine の shadow-sm)は styles.css から値を取り出せなかったため、近い値で新設した。
- アイコン(既存は @tabler/icons-react)は、オフラインのため同じ形の線画をインライン SVG で簡略に描いた。
- 観光事業オーナーのロールの識別子・デモユーザー・画面のパスは、設計(モジュール 13)が未作成のため仮の値である。
