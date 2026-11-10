# ブラウザ操作手順(3 分版・音声解説つき)

Claude Code が chrome-devtools MCP で画面を操作し、`speak.ps1` で台詞を読み上げる。シナリオは [scenario.md](scenario.md)、台詞は [narration.md](narration.md)。
ツールの引数には、必ず `pageId`(デモ専用ページ)を付ける。以下 `P` はそのページ番号。`{base}` = `http://localhost:<ポート>/nttw-demo`。

## 1. 事前準備(下準備。`/demo prep`)

| # | 作業 | 方法 |
| --- | --- | --- |
| 1 | サーバー起動 | `app/` で `NEXT_TELEMETRY_DISABLED=1 mise exec -- npm run build`(約 90 秒)→ `NEXT_TELEMETRY_DISABLED=1 mise exec -- npx next start -p 6231`(**バックグラウンド起動**)。3000 番の dev は触らない。`curl {base}` が 200 になるまで待つ |
| 2 | chrome-devtools の読み込み | ToolSearch で `select:mcp__chrome-devtools__new_page,navigate_page,take_snapshot,click,fill_form,press_key,wait_for,take_screenshot,resize_page,evaluate_script,close_page,list_pages` |
| 3 | **デモ専用ページ** | `new_page(url={base}, isolatedContext="demo")`。**共有ブラウザなので、他のページは触らない・閉じない**。戻り値の番号が `P`。`isolatedContext` で Cookie が他のページと分離される(ユーザー切替の Cookie が混ざらない) |
| 4 | 画面サイズ | `resize_page(pageId=P, width=430, height=860)`(スマホ幅) |
| 5 | ウォームアップ | `evaluate_script` で下の「ウォームアップ」を実行(画面は動かさず、HTML を取得するだけ) |
| 6 | **初期化** | 同じスクリプトの最後で `POST /api/demo/reset` → ユーザーを u-001 に戻す(**ウォームアップで汚れたデータを戻す**) |
| 7 | 待機画面 | `navigate_page(url={base}/new-group)` → `wait_for(text=["最少人数"])` |
| 8 | uid の取得 | `take_snapshot(filePath=<スクラッチ>)` し、Grep で次を控える: 名称、行き先、地方(combobox)、開始日、終了日、最少人数、締切日(Date)、「グループを作る」ボタン。**この後、ページを再読み込みしない**(uid が変わるため) |
| 9 | 音声テスト | `powershell -NoProfile -File docs/demo/speak.ps1 -Text "音声のテストです。"`(終了コード 0 なら読み上げ完了) |

ウォームアップのスクリプト(`evaluate_script` の `function`):

```js
async () => {
  const J = {'Content-Type':'application/json'};
  const setU = (u) => fetch('/api/demo/me', {method:'POST', headers:J, body:JSON.stringify({userId:u})});
  const warm = async (u, paths) => { await setU(u); for (const p of paths) await fetch(p); };
  await warm('u-001', ['/nttw-demo/new-group','/nttw-demo/groups','/nttw-demo/groups/g-101','/nttw-demo/groups/g-101/requests']);
  await warm('u-013', ['/nttw-demo/business/insights']);
  await warm('u-009', ['/nttw-demo/admin/stats']);
  await fetch('/api/demo/reset', {method:'POST', headers:J, body:'{}'});
  await setU('u-001');
  const m = await (await fetch('/api/demo/me')).json();
  return [m.user.id, m.clock.today];   // 期待: ["u-001","2026-11-09"]
}
```

注意: 「デモを初期化」は**ユーザー(Cookie)を戻さない**ので、必ず `setU('u-001')` で戻す。初回表示のとき、トップに「ようこそ」ダイアログが出る(`/new-group` では出ない)。出たら閉じる(×ボタンの uid を `click`)。

## 2. 共通ルール

- **ページ遷移のあとは、必ず待つ**: `wait_for` は一致した時点の**スナップショットを全文返す**ので、長いページ(インサイト、集計)では出力が大きい。長いページは、`evaluate_script` で「目印のテキストが出るまで 250ms ごとに確認」(下の `waitText`)を使い、スナップショットを返さない。
- **uid は毎回取り直す**(ページ遷移・再描画のたびに番号が変わる)。ただし、**同じページを再読み込みしない限り**、直前のスナップショットの uid は使える(部 1 のフォーム入力はこれで高速化)。
- **まとめて呼ぶ**: 依存しない呼び出し(`fill_form` と、続く `click` など)は、1 回の応答に並べて出す。1 回ごとに数秒かかるため、呼び出し回数が時間を決める。
- **下部ナビに隠れるボタン**(F-182): `evaluate_script` で `scrollIntoView({block:'center'})` してから `click`。
- **ユーザー切替**: DemoBar のセレクトは、選択肢がスナップショットに出ない。キーボード(`click` → `press_key ArrowDown`/`ArrowUp` → `Enter`)で切り替えられるが、**デモ中は Cookie を直接設定する**方が速い: `fetch('/api/demo/me', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({userId:'u-013'})})` のあと `location.href=...`(1 回の `evaluate_script`)。
- **ラジオ(「地図で見る」など)**: input 自体は `click` が効かない。**ラベル文字**(スナップショットの StaticText の uid)を `click` する。
- **日付欄**: `fill_form` に Date 要素の uid を渡し、`"2026-12-10"` の形で入る(W5 修正済み)。
- **セレクト(地方)**: `click`(開く)→ `press_key ArrowDown` ×N → `press_key Enter`。選択肢はスナップショットに出ない。2 回で「鈴風高原」(日本地図の中部がオレンジに光る)。
- **ボタンの連続クリック**: 一覧が並び替わると uid がずれる(承認ボタンで実際に誤クリックが出た)。複数ボタンは `evaluate_script` の中で「文言で探して、1 つずつ、待ちを入れてクリック」する。
- **ゆっくり見せる**: 画面が変わったら、台詞が終わるまでその画面で待つ(`evaluate_script` の `sleep`)。

`waitText` の雛形(ページ読み込み後の待ち):

```js
async () => { for (let i=0;i<60 && !document.body.innerText.includes('目印');i++) await new Promise(r=>setTimeout(r,250)); return true }
```

## 3. 音声(`speak.ps1`)

| 項目 | 内容 |
| --- | --- |
| 呼び出し | `powershell -NoProfile -File docs/demo/speak.ps1 -Id N1`(台詞は narration.md の `[N1]`)。`-Text "..."` で任意の文も可 |
| 声 | 日本語の声を自動選択。この PC では **Microsoft Haruka Desktop(ja-JP)**。英語の Zira も入っている。`-ListVoices` で一覧、`-Voice Haruka` で指定 |
| 速さ | `-Rate 1`(既定)。-10〜10 |
| 音なし | `-Mute`(台詞を画面に出すだけ。すぐ終わる)。`/demo mute` は全台詞に `-Mute` を付ける |
| 完了 | **読み上げが終わるまで戻らない**。終了コード 0 = 完了、3 = 前の発話が終わらずスキップ、2 = 台詞なし |
| 重なり防止 | 名前付き Mutex。前の発話が終わるまで次は待つ(最大 `-TimeoutSec` 秒、既定 40) |
| 並行実行 | Claude Code の PowerShell/Bash ツールを **`run_in_background: true`** で呼ぶ。すぐ制御が戻るので、その間にブラウザ操作を行う。完了通知は無視してよい(次の台詞は Mutex で順番待ちになる) |

台詞は 1 つずつ別々に起動するより、**続けて読む台詞は 1 回の呼び出しに `;` でつなぐ**: `speak.ps1 -Id N3; speak.ps1 -Id N4`。台詞と画面の対応を保つため、台詞が画面より遅れそうなら、操作側に `sleep` を入れる。

## 4. 3 分版の手順(台詞と操作のタイミング表)

台詞は約 5〜6 字/秒。`S` = speak.ps1 を背景で起動、`→` は同じ応答にまとめて並べる呼び出し。所要は実測の目安(台詞のみ N0 9.8s, N1 12.9, N2 7.5, N3 13.4, N4 11.0, N5 12.2, N6 14.9, N7 10.0, N8 14.3, N9 8.4。計 114.3 秒)。

### 部 1: グループの作成と参加(目安 0:00〜1:05)

| # | 台詞 | 操作(順に) | 待ち・期待される表示 | 秒 |
| --- | --- | --- | --- | --- |
| 1-1 | S: N0 → N1(連続) | `fill_form(pageId=P, elements=[名称="鈴風高原 ゆっくり散策", 行き先="雪雫の音楽堂", 開始日="2026-12-10", 終了日="2026-12-11", 最少人数="3", 締切日="2026-12-01"])` → `click(地方 combobox)` → `press_key ArrowDown` ×2 → `press_key Enter` | 入力済みフォーム、地方=鈴風高原、日本地図の中部がオレンジ(N1 の間) | 約 10(N0+N1 で約 23 秒話す) |
| 1-2 | S: N2 → N3(連続) | `evaluate_script`(「グループを作る」ボタンを `scrollIntoView`)→ `click(グループを作る)` | `/groups/g-201` に遷移、「募集中」、最少人数 3、メンバー 1 人 | 約 5 |
| 1-3 | (N2 の間) | `evaluate_script`: **`sleep` 約 4 秒**(作成直後の画面を見せる)→ 申請の仕込み: u-002、u-003 の順に Cookie 切替 → `POST /api/groups/g-201/join-requests`(`{note, consentMinMembers:true, consentedMinMembers:3}`)→ u-001 に戻す → `location.href=…/requests` | 「参加申請の承認」画面に申請 2 件(「3 人でも参加してよい」の同意つき) | 約 6 |
| 1-4 | (N3 の間) | `evaluate_script`: `承認する` が出るまで待つ → 約 2.5 秒見せる → 文言「承認する」のボタンを 1 つずつ、1.5 秒おきに `click` ×2 → `location.href=グループ詳細` | 「最少人数到達」(緑)、現在 3 人 / 最少 3 人 | 約 10 |
| 1-5 | S: N4 | `take_screenshot`(任意)。N4 が終わるまでこの画面 | | 約 11(台詞) |

### 部 2: 観光事業オーナー u-013(目安 1:05〜1:40)

| # | 台詞 | 操作 | 待ち・期待される表示 | 秒 |
| --- | --- | --- | --- | --- |
| 2-1 | S: N5 → N6(連続) | `evaluate_script`: u-013 に切替 → `location.href={base}/business/insights` | | 2 |
| 2-2 | | `evaluate_script`: 棒グラフ(`[aria-label^="週別の旅行者人数"]`)が出るまで待つ → `scrollIntoView({block:'center'})` | 青い棒(実績 3 週)と斜線の棒(予定)。部 1 のデモグループが 12/07 週の予定(募集中)に加わる | 約 4 |
| 2-3 | (N5 の終わり→N6) | `evaluate_script`: 6 秒待つ → 棒グラフの `rect`(クリック領域は透明な高さ 222 の rect)の **22 番目**(ピーク週 12/28)に `dispatchEvent(new MouseEvent('click',{bubbles:true}))` → 「週別の年代別構成」見出しを `scrollIntoView({block:'start'})` | 週のセレクトが「12月28日〜1月3日」に、年代の円グラフ | 約 8 |
| 2-4 | | `scrollIntoView` で「提案」見出しへ(任意)。N6 が終わるまで待つ | 提案カード | 約 8 |

### 部 3: 自治体 u-009(目安 1:40〜2:15)

| # | 台詞 | 操作 | 待ち・期待される表示 | 秒 |
| --- | --- | --- | --- | --- |
| 3-1 | S: N7 → N8 → N9(連続) | `evaluate_script`: u-009 に切替 → `location.href={base}/admin/stats` | | 2 |
| 3-2 | | `evaluate_script`: 「主な指標」が出るまで待つ。トップの指標を見せる(約 5 秒) | グループ作成数・申請数・承認率・実行確定率 | 約 6 |
| 3-3 | (N8 の間) | `evaluate_script`: 末尾が「地方別」の要素を `scrollIntoView({block:'start'})` | 地方別の表、流入元の棒、「少数」の表示 | 約 6 |
| 3-4 | | N9 が終わるまで待つ → `take_screenshot` | | 約 8 |

終了処理: 台詞の終了コードを確認(0)。続けて「サーバーを止めてよいか」をプレゼンターに確認する(`/demo` の終了時)。

## 5. 合図の出し方

- **3 分版はノンストップ**。プレゼンターの「開始」で、第4章の部 1 〜 部 3 を連続して実行する。
- `step` モード: 部ごと(部 1、部 2、部 3)に止まり、プレゼンターが「次へ」と言ってから次の部を実行する。
- 台詞の途中で止めたいとき: プレゼンターが「止めて」と言ったら、AI は新しい操作を出さず、`speak.ps1` の起動も止める(実行中の発話は終わるまで待つ)。

## 6. 失敗時のリカバリ

| 症状 | 対処 |
| --- | --- |
| 要素が見つからない・uid が古い | `take_snapshot` で取り直して 1 回だけ再試行。直らなければ、その操作を飛ばして台詞を続ける |
| 「グループを作る」が失敗(入力エラー) | 日付がデモ時計(2026-11-09)より後か、締切 < 開始 ≦ 終了か確認。`fill_form` を再実行 |
| グループ番号が g-201 でない | 初期化していない。部 1-3 の `g-201` は、URL から読む(`location.pathname.match(/groups\/(g-\d+)/)`)ので、そのまま動く |
| 状態がずれた | `/demo reset`(= ウォームアップ後半の `reset` と `setU('u-001')`)→ `/new-group` へ戻る |
| サーバーが落ちた | 別ポート(例 6232)で `npx next start` を再起動(build 済みなら数秒)。URL のポートを入れ替える |
| 音が出ない | `-Mute` で台詞を画面に出し、プレゼンターが読む。`speak.ps1 -ListVoices` で声を確認 |
| 共有ブラウザの別ページが邪魔 | `list_pages` で、自分のページ(`isolatedContext=demo`)を `select_page` し直す。他のページは閉じない |

## 7. 付録: 省略した場合の追加章(余力がある場合)

3 分には入れない。検証で動作を確認したもの。台詞は `speak.ps1 -Text "..."` で、その場で作る。

| 章 | 操作 | 注意 |
| --- | --- | --- |
| トップ | `navigate_page({base})`、初回は「ようこそ」ダイアログを閉じる | |
| 一覧 | `{base}/groups`。「地図で見る」は**ラベル文字**を `click`。地図の `拡大` ボタン(aria-label「拡大」)を **1 回ずつ**押す(倍率表示 1.5 倍) | DemoBar が二重表示される(F-200) |
| 絞り込み | 「絞り込み」ボタンで右ドロワー(地方・日程・空き・タグ・年代) | 「適用」は閉じるだけ(F-201) |
| スポット地図 | `{base}/spots` → 「地図」のラベル文字を `click` → 拡大/縮小 | |
| デモ時計 | `POST /api/demo/clock {"action":"advanceDays","days":N}`(DemoBar の +1/+3/+7日 と同じ。ページを再読み込み)。締切 12/01・開始 12/10 のとき、11/09 から +7,+7,+3,+7 で 12/10(実施中) | 定型文チップ(「集合時間を相談したい」など)は押すとすぐ送信される |

## 検証メモ

実施: 2026-11-10、worktree で `mise trust` → `mise install` → `npm ci` → `npm run build` → `npx next start -p 6231`、chrome-devtools(共有ブラウザの `isolatedContext=demo` の新規ページ、430×860)。

- **通った**: 下準備(ウォームアップ → 初期化 → `/new-group` 待機)、部 1(フォーム入力 → 作成 → 申請 2 件 → 承認 2 件 → 最少人数到達)、部 2(棒グラフ、週の切替、円グラフ)、部 3(集計、地方別、少数)、音声(Haruka)、`-Mute`、`-ListVoices`。
- **通し実測**: 音声あり、第4章の手順で通して **約 102 秒**(開始から最後の台詞の終了まで。台詞は当時の短い版)。台詞を現行版に伸ばしたため、台詞のみの実測は 114.3 秒(各台詞の秒は第4章)。操作は台詞と並行なので、現行版の通しは約 115〜125 秒の見込み(180 秒以内)。聴感(実際に音が出たか)は、PowerShell が例外なく完了(終了コード 0)したことで確認した。耳での確認はできていない。
- **直した点(手順に反映)**:
  1. ラジオ(「地図で見る」)は input への `click` がタイムアウトする → ラベル文字を `click`。
  2. 地方セレクトの選択肢はスナップショットに出ない → キーボード(ArrowDown、Enter)。
  3. 承認ボタンを uid で連続クリックすると、1 件目の承認で一覧が並び替わり、2 件目の uid が別の要素(ホーム)を押した → `evaluate_script` で文言検索 + 待ち。
  4. `wait_for` はスナップショットを全文返す(インサイトで約 500 行)→ 長いページは `evaluate_script` の待ちに替えた。
  5. 作成直後の画面が一瞬で次へ進むと台詞(N2)と合わない → 部 1-3 に `sleep` を入れた。
  6. 「デモを初期化」はユーザー Cookie を戻さない → ウォームアップの最後に u-001 を設定。
  7. 部 2 の円グラフの週切替は、棒の透明な `rect`(22 番目 = 12/28 週)に click イベントを送る(週のセレクトのキーボード操作より速い)。グラフの構成が変わると番号がずれる。
- **既知の制約**: ブラウザ操作の各呼び出しは数秒かかる。呼び出し回数を増やすと 180 秒に近づく。DemoBar の +N日 ボタンはページを再読み込みする(F-173)。`wait_for` の出力が長いページがある。聴感の確認はできない。
