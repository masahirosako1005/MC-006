# ブラウザ操作手順(3 分版・音声解説つき)

Claude Code が chrome-devtools MCP の `evaluate_script` で、**ブラウザのページ内ランナー([runner.js](runner.js))**を呼び、ランナーが画面操作と台詞(VOICEVOX をページから直接再生)を進める。シナリオは [scenario.md](scenario.md)、台詞は [narration.md](narration.md)(ランナーに同じ台詞を埋め込んである)。
サービス名は **Kopa**(台詞では「こぱあ」)。観光だけでなく、地方都市と人、そして人と人をつなぐことをテーマにしたサービスのデモ(N0 で説明)。**台詞駆動**: 画面操作 → 間 → 台詞(再生が終わるまで待つ)→ 次の操作、を、ランナーが 1 回の呼び出しの中で直列に進める(第4章)。従来の操作ごとの MCP 呼び出し + `speak.ps1` の方式は、付録 A(フォールバック手順)に残してある。
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
| 8 | **ランナーの注入** | `docs/demo/runner.js` を Read し、**全文を** `evaluate_script(pageId=P, format="script", function=<全文>)` に渡す(`sourcePath` は、ワークスペースの外(worktree)だと拒否される。リポジトリ直下から実行する場合は `sourcePath` でもよい)。戻り値は、すでに先読み済みの台詞数(初回は 0)。フォームの uid は**不要**(ランナーが label で入力欄を探す) |
| 9 | **台詞の先読み** | `evaluate_script(function="async () => await window.__demo.prefetch({mute:false})")`。VOICEVOX で全 20 台詞を合成して `__demo.audio` に保持する(約 50 秒。**本番に入れない**)。期待: `{"ctx":"running","ok":20,"fail":[],"total":79.4}`。`ctx` が `running` でない、または `fail` があれば、付録 A(フォールバック)へ。`mute` のときは `{mute:true}`(合成せず、台詞の長さ ÷ 6 秒だけ待つ)。**この後、ページを再読み込みしない**(再読み込みでランナーと音声が消える。消えたら 8〜9 をやり直す) |
| 10 | 合図待ち | 「準備完了です」と伝える。待機中のユーザー(Cookie)は何でもよい(ランナーが部 1 の先頭で u-001 にする) |

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
- **画面が変わったら、少し待ってから台詞**: 台詞は同期再生(フォアグラウンド)。台詞の前に 0.8〜1 秒の間(`Start-Sleep`)を入れ、台詞の最中は画面を動かさない。

`waitText` の雛形(ページ読み込み後の待ち):

```js
async () => { for (let i=0;i<60 && !document.body.innerText.includes('目印');i++) await new Promise(r=>setTimeout(r,250)); return true }
```

## 3. 音声

### 3.1 ランナーの音声(通常)

| 項目 | 内容 |
| --- | --- |
| 方式 | ページから `http://127.0.0.1:50021`(VOICEVOX)へ `fetch`(`audio_query` → `synthesis`、ずんだもん style id 3、`speedScale` 1.3)。CORS は通る(HTTP 200 を確認)。合成結果は `AudioContext.decodeAudioData` で `AudioBuffer` にして `window.__demo.audio[id]` に保持(先読み)。本番は `AudioBufferSourceNode` を `start()` し、`onended` まで待つ(合成待ちゼロ)。 |
| 自動再生 | `evaluate_script` 経由の実行では `AudioContext` が `running`(`navigator.userActivation.hasBeenActive = true`、再生は各部の呼び出しの先頭で `resume()` を再確認)。止まる場合は、ページ内を 1 回 `click` してから `prefetch` をやり直す。 |
| 台詞の同期 | `say()` は `onended`(+ 保険のタイマー = 長さ + 1.5 秒)を待ってから戻る。台詞の前後の間 0.12 秒、操作の後の間 0.6 秒。台詞の最中は `await` で次の操作に進まない。 |
| ログ | `window.__demo.log` に `{t(ms), kind: S/O/P, id, ev: start/end, dur, res, ok, err}`。`run(N)` の戻り値にも入る。`ok` は操作後の画面の確認(入力値、表示テキスト、要素が画面内にあるか)。 |
| クレジット | `prefetch` が左上に「音声: VOICEVOX:ずんだもん」を小さく表示。`__demo.finish()` で消す。 |
| mute | 台詞の長さ(文字数)÷ 6 秒だけ待つ(音は出ない)。 |
| 台詞を変えるとき | 台詞を変えたら、`narration.md` と `runner.js` の `LINES` を**両方**直す。 |

### 3.2 `speak.ps1`(フォールバック。付録 A)

| 項目 | 内容 |
| --- | --- |
| 呼び出し | `powershell -NoProfile -File docs/demo/speak.ps1 -Id N1`(台詞は narration.md の `[N1]`)。`-Text "..."` で任意の文も可 |
| 声 | 既定は **VOICEVOX ずんだもん ノーマル(style id 3)**(エンジン `127.0.0.1:50021` が応答するとき)。`-Speaker "春日部つむぎ"` や `-Speaker 8` で変更、`-ListSpeakers` で一覧。応答しなければ Haruka(SAPI)にフォールバック。`-Engine auto|voicevox|sapi`(既定 auto)。`-Speed`(既定 1.3)、`-Pitch`、`-Intonation`、`-VvUrl`。`-Voice`/`-Rate` は SAPI 用。**クレジット**: 画面の隅かスライド末尾に「音声: VOICEVOX:ずんだもん」を表示する |
| 速さ | `-Rate 1`(既定)。-10〜10 |
| 音なし | `-Mute`(台詞を画面に出すだけ。すぐ終わる)。`/demo mute` は全台詞に `-Mute` を付ける |
| 完了 | **読み上げが終わるまで戻らない**。終了コード 0 = 完了、3 = 前の発話が終わらずスキップ、2 = 台詞なし |
| 重なり防止 | 名前付き Mutex。前の発話が終わるまで次は待つ(最大 `-TimeoutSec` 秒、既定 40) |
| 実行方法 | **同期(フォアグラウンド)**。PowerShell ツールで通常に呼ぶ(`run_in_background` は使わない)。台詞が終わるまで戻らないので、戻ってから次の操作を出す。操作と同じ応答に並べない |

続けて読む台詞(間に操作が無いもの)は、**1 回の呼び出しに `;` でつないで**まとめる: `speak.ps1 -Id N3a; speak.ps1 -Id N3b`。1 呼び出しごとに約 0.4〜1 秒の合成待ちが先頭に入る。

## 4. 3 分版の手順(ランナー方式。部ごとに 1 回呼ぶだけ)

プレゼンターの「開始」で、**3 回**呼ぶ(各回は前の戻りを待つ。間に別の応答を挟まない):

```
evaluate_script(pageId=P, function="async () => { const r = await window.__demo.run(1); return r.totalMs }")
evaluate_script(pageId=P, function="async () => { const r = await window.__demo.run(2); return r.totalMs }")
evaluate_script(pageId=P, function="async () => { const r = await window.__demo.run(3); return r }")   // 最後に log 全体を返す
```

各 `run(N)` は、ページ内で「操作 → 間(0.6 秒)→ 台詞(`ended` まで待つ)→ 次の操作」を直列に進める。台詞の最中は、`await` で次の操作に進まない(画面は動かない)。操作が失敗しても例外で止めず、`log` に `err` を残して台詞を続ける。時計は部 1 の開始(`run(1)`)で 0 になり、部 2・3 も同じ時計(部の間の MCP 往復も総時間に入る)。

**遷移方式**: 部をまたぐ・画面を替える遷移は、すべて `window.next.router.push('/nttw-demo/...')`(Next.js のクライアントナビゲーション)。JS コンテキスト(ランナー、先読みの音声)が保たれる。**注意**: 検証中に 1 回、`router.push('/nttw-demo/new-group')`(自治体の画面から)の直後に、ページが完全に再読み込みされ、ランナーが消えたことがあった(原因は未特定。通常の部 1〜3 の遷移では起きていない)。再読み込みが起きたら、第1章 #8〜#9 の注入と先読みをやり直す。

### 4.1 手順(ランナーの中身。`runner.js` の part1〜3)

| 部 | 順 | 種別 | 内容 | 期待される画面(ログの `ok` で確認) |
| --- | --- | --- | --- | --- |
| 1 | 1 | S | N0, N1a | 空の「グループを作る」フォーム |
| 1 | 2 | O | 名称・行き先・開始日・終了日を入力(native setter + `input`/`change`) | 入力済み |
| 1 | 3 | S | N1b | |
| 1 | 4 | O | 最少人数・締切日を入力、地方 combobox をクリック → 「鈴風高原」の option をクリック | 地方=鈴風高原、地図の中部が光る |
| 1 | 5 | S | N1c, N2a | |
| 1 | 6 | O | 「グループを作る」→ `/groups/g-201` の「募集中」を待つ | 募集中のグループ詳細 |
| 1 | 7 | S | N2b | |
| 1 | 8 | O | u-002・u-003 の申請を API で仕込む → u-001 に戻し、申請画面へ(`router.push`)→ 「承認する」2 つを待つ | 申請 2 件 |
| 1 | 9 | S | N3a, N3b | |
| 1 | 10 | O | 「承認する」を文言で探して 1 件ずつクリック(1 件ごとに 0.9 秒) | 承認済み |
| 1 | 11 | S | N3c | |
| 1 | 12 | O | グループ詳細へ(`router.push`)→ 「最少人数到達」を待つ | 最少人数到達、3 人 / 最少 3 人 |
| 1 | 13 | S | N4a, N4b | |
| 2 | 1 | O | u-013 に切替 → インサイトへ → 棒グラフを中央にスクロール | 棒グラフ |
| 2 | 2 | S | N5a, N5b | |
| 2 | 3 | O | ピーク週(22 番目の `rect`)をクリック → 円グラフの見出しへ | 12月28日の週、円グラフ |
| 2 | 4 | S | N6a | |
| 2 | 5 | O | 「提案」見出しへスクロール | 提案カード |
| 2 | 6 | S | N6b | |
| 3 | 1 | O | u-009 に切替 → 集計へ → 「主な指標」へ | 主な指標 |
| 3 | 2 | S | N7a, N7b | |
| 3 | 3 | O | 「地方別」へスクロール | 地方別の表(少数) |
| 3 | 4 | S | N8a | |
| 3 | 5 | O | 「流入元」へスクロール | 流入元の棒 |
| 3 | 6 | S | N8b, N9 | 結びで終了 |

台詞と画面の対応は付録 A.2 の表のまま(各台詞は、説明する画面の状態になってから始まる)。

### 4.2 時間の内訳(実測。音声 VOICEVOX、Speed 1.3、先読み済み)

| 項目 | 秒 |
| --- | --- |
| 台詞の合計(20 本。先読みした音声の長さ) | 79.4 |
| 台詞の間(各 0.12 秒)+ 台詞の前の間 | 約 6 |
| 操作 + 操作後の間(0.6 秒 × 11) | 約 12(操作そのもの約 8 + 間約 6.6、承認のクリック 1.8 秒を含む) |
| 部 1 → 2 → 3 の MCP 往復(2 回) | 約 6(2.9 秒 + 3.4 秒) |
| **総時間(開始から最後の台詞の終了まで、実測)** | **105.0(1 分 45 秒)** |

台詞の削減(案 B)は不要だった(目標 175 秒以内に対して約 70 秒の余裕)。`narration.md` は変更していない。余った時間は、操作後の間(`op` の `sl(600)`)を伸ばす、または台詞を足すことに使える(ただし、台詞を変えたら `runner.js` の `LINES` も直す)。

## 付録 A. フォールバック手順(操作ごとの MCP 呼び出し + `speak.ps1`。台詞駆動・上から順に実行)

**ランナーが使えない場合**(prefetch が失敗、`ctx` が running にならない、`voice=sapi`)だけ使う。総時間は約 265 秒(180 秒を超える)。

**原則: 画面操作 → 画面が安定するまで待つ(間) → 台詞を同期(ブロック)で再生 → 次の操作。** 台詞は `run_in_background` で起動しない。台詞が説明する画面の変化は、その台詞を言い始める前に済ませる。台詞の再生中は画面を動かさない。

- **操作(O)** と **台詞(S)** を、番号順に 1 つずつ、前の呼び出しが返ってから次を呼ぶ(同じ応答に並べて出さない。並べると並行実行になり、同期が崩れる)。
- **S の呼び出し**: PowerShell ツールで 1 回。`Start-Sleep -Milliseconds 800; powershell -NoProfile -File docs/demo/speak.ps1 -Id N1b`(待ち 0.8 秒 → 台詞。台詞が続くときは `-Id` を `;` でつなぐ)。`-Speed` の既定は **1.3**。終了コード 0 を確認。
- **待ち(間)**: 画面遷移のあとは `waitText` 相当の待ち(O の `evaluate_script` に含めてある)+ S 側の `Start-Sleep` 0.8〜1.0 秒。O のスクリプトの末尾にも 0.3〜1 秒の間が入っている。
- 以下、`P` = デモ専用ページ、uid は下準備の `take_snapshot` で取る(フォーム 6 項目: 名称、行き先、開始日、終了日、最少人数、締切日)。

### A.1 手順表

| # | 種別 | 内容(呼び出し) | 間・待ち | 期待される画面 |
| --- | --- | --- | --- | --- |
| 1 | S | `N0` → `N1a`(続けて 1 回で) | 先頭 0.8 秒 | 空の「グループを作る」フォーム(`/new-group`) |
| 2 | O | `fill_form(P, [名称="鈴風高原 ゆっくり散策", 行き先="雪雫の音楽堂", 開始日="2026-12-10", 終了日="2026-12-11"])` | 返ったら 3 へ | 名称・行き先・日程が入った |
| 3 | S | `N1b` | 先頭 0.8 | 同上(入力済みの前半) |
| 4 | O | `fill_form(P, [最少人数="3", 締切日="2026-12-01"])` | | 最少人数 3、締切が入った |
| 5 | O | 【REGION】`evaluate_script`(地方を「鈴風高原」に) | スクリプト内 0.4 秒 | 地方=鈴風高原、**日本地図の中部が光る** |
| 6 | S | `N1c` → `N2a`(続けて) | 先頭 0.8 | 入力済みフォーム。地図が光っている(氏名・連絡先の欄が無いのが見える) |
| 7 | O | 【CREATE】`evaluate_script`(「グループを作る」→ 遷移 → 「募集中」を待つ) | スクリプト内 0.3 | `/groups/g-201`、「募集中」、最少人数 3 |
| 8 | S | `N2b` | 先頭 0.8 | 募集中のグループ詳細 |
| 9 | O | 【SEED】`evaluate_script`(u-002・u-003 の申請を仕込む → 申請画面へ → 「承認する」2 つを待つ) | スクリプト内 0.3 | 「参加申請の承認」。申請 2 件(「3 人でも参加してよい」の同意つき) |
| 10 | S | `N3a` → `N3b`(続けて) | 先頭 0.8 | 申請 2 件が見えている |
| 11 | O | 【APPROVE】`evaluate_script`(「承認する」を 1 件ずつ、1 秒おきに) | スクリプト内 1 秒 ×2 | 2 件とも承認済み |
| 12 | S | `N3c` | 先頭 0.5 | 承認済みの申請画面 |
| 13 | O | 【DETAIL】`evaluate_script`(グループ詳細へ → 「最少人数到達」を待つ) | スクリプト内 0.3 | 「最少人数到達」(緑)、現在 3 人 / 最少 3 人 |
| 14 | S | `N4a` → `N4b`(続けて) | 先頭 0.8 | 最少人数到達の詳細 |
| 15 | O | 【OWNER】`evaluate_script`(u-013 に切替 → インサイトへ → 棒グラフを待つ → 中央へスクロール) | スクリプト内 0.3 | 棒グラフ(青=実績、斜線=予定。部 1 のグループが 12/07 週に加わる) |
| 16 | S | `N5a` → `N5b`(続けて) | 先頭 0.8 | 棒グラフ |
| 17 | O | 【WEEK】`evaluate_script`(ピーク週の棒をクリック → 円グラフの見出しへスクロール) | スクリプト内 0.5 | 週が「12月28日〜1月3日」、年代別の円グラフ |
| 18 | S | `N6a` | 先頭 0.8 | 円グラフ |
| 19 | O | 【PROPOSAL】`evaluate_script`(「提案」見出しへスクロール) | スクリプト内 0.3 | 提案カード |
| 20 | S | `N6b` | 先頭 0.8 | 提案カード |
| 21 | O | 【ADMIN】`evaluate_script`(u-009 に切替 → 集計へ → 「主な指標」へスクロール) | スクリプト内 0.3 | 主な指標(作成・申請・実行確定・中止率) |
| 22 | S | `N7a` → `N7b`(続けて) | 先頭 0.8 | 主な指標 |
| 23 | O | 【REGIONTABLE】`evaluate_script`(「地方別」へスクロール) | スクリプト内 0.3 | 地方別の表と「少数」 |
| 24 | S | `N8a` | 先頭 0.8 | 地方別、少数の表示 |
| 25 | O | 【INFLOW】`evaluate_script`(「流入元」へスクロール) | スクリプト内 0.3 | 流入元の棒 |
| 26 | S | `N8b` → `N9`(続けて) | 先頭 0.8 | 流入元。結びの台詞で終了 |

終了処理: 台詞の終了コード(0)を確認。次の「サーバーを止めてよいか」はプレゼンターに確認する(`/demo` の終了時)。

### A.2 台詞と画面の対応表(その台詞を言う時点の画面状態)

| 台詞 ID | 台詞が説明すること | 言い始める時点で済んでいる画面の状態 | 直前の操作 |
| --- | --- | --- | --- |
| N0, N1a | 導入、グループを作る | 空のフォーム | (待機画面) |
| N1b | 名前と行き先、日程を入れて | 名称・行き先・日程が入力済み | #2 |
| N1c, N2a | 地方を選ぶと中部が光る。氏名・連絡先の欄が無い | 最少人数・締切も入力済み、地方=鈴風高原、地図の中部が光っている | #4, #5 |
| N2b | 募集中のグループができた | 募集中のグループ詳細 | #7 |
| N3a, N3b | 別の旅行者が 2 人申請、最少人数でもよい同意つき | 申請 2 件(同意つき)の承認画面 | #9 |
| N3c | 幹事は承認を押すだけ | 2 件とも承認済み | #11 |
| N4a, N4b | 最少人数に達した | 「最少人数到達」の詳細 | #13 |
| N5a, N5b | オーナーの画面。青=実績、斜線=予定 | 棒グラフ | #15 |
| N6a | 週を選ぶと円グラフ | 週選択済み、年代別の円グラフ | #17 |
| N6b | 提案が出る | 提案カード | #19 |
| N7a, N7b | 自治体の画面。作成数・申請数・実行確定率 | 主な指標 | #21 |
| N8a | 5 件未満は少数 | 地方別の表(少数) | #23 |
| N8b, N9 | 担当地方だけの集計、流入元、結び | 流入元の棒 | #25 |

### A.3 操作スクリプト(`evaluate_script` の `function`。そのまま貼って使える)

【REGION】地方=鈴風高原(Mantine のセレクト。キーボード操作 3 回より速い):

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const c=[...document.querySelectorAll('input[role=combobox]')].find(e=>e.required); c.click(); c.focus(); await sl(400); [...document.querySelectorAll('[role=option]')].find(o=>o.textContent.includes('鈴風高原')).click(); await sl(400); return c.value }
```

【CREATE】作成 → 募集中:

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='グループを作る'); b.scrollIntoView({block:'center'}); await sl(500); b.click(); for(let i=0;i<60&&!/\/groups\/g-\d+/.test(location.pathname);i++) await sl(250); for(let i=0;i<60&&!document.body.innerText.includes('募集中');i++) await sl(250); await sl(300); return location.pathname }
```

【SEED】申請の仕込み(u-002、u-003)→ u-001 に戻す → 申請画面(`window.next.router.push` は SPA 遷移なので、スクリプトが途切れず、続けて待てる。パスには basePath `/nttw-demo` が要る):

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const J={'Content-Type':'application/json'}; const g=location.pathname.match(/groups\/(g-\d+)/)[1]; const setU=(u)=>fetch('/api/demo/me',{method:'POST',headers:J,body:JSON.stringify({userId:u})}); for (const u of ['u-002','u-003']) { await setU(u); await fetch('/api/groups/'+g+'/join-requests',{method:'POST',headers:J,body:JSON.stringify({note:'よろしくお願いします',consentMinMembers:true,consentedMinMembers:3})}); } await setU('u-001'); window.next.router.push('/nttw-demo/groups/'+g+'/requests'); for(let i=0;i<80&&[...document.querySelectorAll('button')].filter(b=>b.textContent.trim()==='承認する').length<2;i++) await sl(250); await sl(300); return location.pathname }
```

【APPROVE】承認 2 件(1 件ずつ、文言で探す):

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const find=()=>[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='承認する'); let n=0; for(let k=0;k<2;k++){ const b=find(); if(!b) break; b.scrollIntoView({block:'center'}); await sl(400); b.click(); n++; await sl(1000);} await sl(200); return n }
```

【DETAIL】グループ詳細 → 最少人数到達:

```js
async () => { const g=location.pathname.match(/groups\/(g-\d+)/)[1]; window.next.router.push('/nttw-demo/groups/'+g); for(let i=0;i<80&&!document.body.innerText.includes('最少人数到達');i++) await new Promise(r=>setTimeout(r,250)); await new Promise(r=>setTimeout(r,300)); return document.body.innerText.includes('最少人数到達') }
```

【OWNER】オーナー(u-013)→ インサイト:

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); await fetch('/api/demo/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'u-013'})}); window.next.router.push('/nttw-demo/business/insights'); const q='[aria-label^="週別の旅行者人数"]'; for(let i=0;i<80&&!document.querySelector(q);i++) await sl(250); document.querySelector(q).scrollIntoView({block:'center'}); await sl(300); return location.pathname }
```

【WEEK】ピーク週(12/28、22 番目の透明な rect)→ 円グラフ:

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const rs=[...document.querySelectorAll('[aria-label^="週別の旅行者人数"] rect')]; rs[21].dispatchEvent(new MouseEvent('click',{bubbles:true})); await sl(500); [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].find(e=>e.textContent.includes('週別の年代別構成')).scrollIntoView({block:'start'}); await sl(300); return document.body.innerText.includes('12月28日') }
```

【PROPOSAL】提案:

```js
async () => { [...document.querySelectorAll('h1,h2,h3,h4,[role=heading]')].find(e=>e.textContent.trim().startsWith('提案')).scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,300)); return true }
```

【ADMIN】自治体(u-009)→ 集計 → 主な指標:

```js
async () => { const sl=(ms)=>new Promise(r=>setTimeout(r,ms)); const f=(t)=>[...document.querySelectorAll('p,div,span')].find(e=>e.children.length===0&&e.textContent.trim().startsWith(t)); await fetch('/api/demo/me',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({userId:'u-009'})}); window.next.router.push('/nttw-demo/admin/stats'); for(let i=0;i<80&&!f('主な指標');i++) await sl(250); f('主な指標').scrollIntoView({block:'start'}); await sl(300); return location.pathname }
```

【REGIONTABLE】(地方別)/【INFLOW】(流入元)。文言だけ替えて同じ形:

```js
async () => { const f=(t)=>[...document.querySelectorAll('p,div,span')].find(e=>e.children.length===0&&e.textContent.trim()===t); f('地方別').scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,300)); return true }
```

```js
async () => { const f=(t)=>[...document.querySelectorAll('p,div,span')].find(e=>e.children.length===0&&e.textContent.trim()===t); f('流入元').scrollIntoView({block:'start'}); await new Promise(r=>setTimeout(r,300)); return true }
```

## 5. 合図の出し方・運用

- **3 分版はノンストップ**。プレゼンターの「開始」で、`run(1)` → `run(2)` → `run(3)` を続けて呼ぶ(第4章)。
- `step` モード: 部ごとに止まり、プレゼンターが「次へ」と言ってから次の `run(N)` を呼ぶ。`chapter N` は `run(N)` だけ(部 2・3 の先頭はユーザー切替を含むので、単独でも動く。部 1 を通していないと、部 1 のグループは予定に載らないだけ)。
- `mute`: 先読みを `{mute:true}` で呼ぶ。`reset`: `/api/demo/reset` と `setU('u-001')` のあと、画面を `/new-group` に戻す(`router.push` は、まれにページが再読み込みされランナーが消える。消えたら第1章 #8〜#9)。
- 台詞の途中で止めたいとき: 実行中の部は、ページ内で最後まで進む(途中では止められない)。「止めて」と言われたら、次の部の `run` を呼ばない。
- **台詞を直したとき**: `narration.md` と `runner.js` の `LINES` の**両方**を直す。台詞を足すときは、その台詞が説明する画面の変化を、直前の操作(`runner.js` の part)に入れる。
- **ユーザー(Cookie)**: 部 1 の先頭で u-001 に切り替える。「デモを初期化」はユーザーを戻さないので、`reset` のときは自分で戻す。

## 6. 失敗時のリカバリ

| 症状 | 対処 |
| --- | --- |
| 要素が見つからない・uid が古い | `take_snapshot` で取り直して 1 回だけ再試行。直らなければ、その操作を飛ばして台詞を続ける |
| 「グループを作る」が失敗(入力エラー) | 日付がデモ時計(2026-11-09)より後か、締切 < 開始 ≦ 終了か確認。`fill_form` を再実行 |
| グループ番号が g-201 でない | 初期化していない。部 1-3 の `g-201` は、URL から読む(`location.pathname.match(/groups\/(g-\d+)/)`)ので、そのまま動く |
| 状態がずれた | `/demo reset`(= ウォームアップ後半の `reset` と `setU('u-001')`)→ `/new-group` へ戻る |
| サーバーが落ちた | 別ポート(例 6232)で `npx next start` を再起動(build 済みなら数秒)。URL のポートを入れ替える |
| 音が出ない | `prefetch` の戻り(`ctx`、`fail`)を確認。VOICEVOX が応答しなければ、付録 A(`speak.ps1 -Engine sapi`)か、`mute`(台詞を画面に出さずに待つだけなので、プレゼンターが読む)。`speak.ps1 -ListVoices` で声を確認 |
| `window.__demo` が無い(`undefined`) | ページが再読み込みされた。第1章 #8〜#9(注入と先読み)をやり直す。部の途中なら、`run(N)` の N を選んで続ける |
| ランナーの `log` に `err` / `ok:false` | 操作が失敗した(台詞は続く)。終了後、報告する。`reset` して再実行 |
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

### ランナー方式(ページ内ナレーション)の検証(2026-11-10、agent/w5-demo-fast)

実施: worktree で `mise trust` → `mise install` → `npm ci` → `npm run build` → `npx next start -p 6512`、chrome-devtools(共有ブラウザの `isolatedContext=demo3` の新規ページ、430×860)。VOICEVOX(`127.0.0.1:50021`)で、全台詞を実際に再生。prep(注入 + 先読み)→「開始」→ `run(1)`、`run(2)`、`run(3)` を 1 回ずつ(計 3 回)呼んだ。

**結果: 開始から最後の台詞(N9)の終了まで 105.0 秒(1 分 45 秒)**。180 秒以内。台詞の削減は不要。

| 項目 | 結果 |
| --- | --- |
| 先読み | 20 台詞 すべて成功(`fail:[]`)、合計 79.4 秒、約 47 秒(prep で実施。本番に入らない) |
| `AudioContext` | 全台詞の終了時に `running`。`ended` が全 20 台詞で発火(ログの `S end` の `dur` = バッファの長さ。保険のタイマーでの終了は無い=実時間が `dur` とほぼ一致) |
| `CORS` | ページ(`localhost:6512`)から `127.0.0.1:50021` へ通る |
| `router.push` | 部 1(申請画面、詳細)、部 2(インサイト)、部 3(集計)の遷移とも、JS コンテキストが保たれた(部をまたいでも `__demo` が残る) |
| 操作の確認 | 全 11 操作で `ok=true`(エラー 0) |

**タイムライン**(最終の通し実行。秒は開始からの経過。S の「開始」〜「終了」の間に O は 1 つも入っていない)

| 部 | 種別 | 内容 | 開始 | 終了 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | S | N0 | 0.6 | 13.2 | 12.1 秒 |
| 1 | S | N1a | 13.4 | 15.7 | |
| 1 | O | 入力(名称・行き先・日程) | 15.9 | 16.5 | ok |
| 1 | S | N1b | 17.1 | 20.6 | 入力済みの後 |
| 1 | O | 入力(人数・締切・地方) | 20.7 | 21.9 | ok、地方=鈴風高原 |
| 1 | S | N1c | 22.5 | 25.0 | 地図が光ってから |
| 1 | S | N2a | 25.1 | 28.9 | |
| 1 | O | 作成 → 募集中 | 29.0 | 29.7 | `/groups/g-201` |
| 1 | S | N2b | 30.3 | 32.8 | 募集中の後 |
| 1 | O | 申請の仕込み → 承認画面 | 32.9 | 33.5 | 承認ボタン 2 つ |
| 1 | S | N3a, N3b | 34.1 | 40.3 | 申請 2 件が見えてから |
| 1 | O | 承認 ×2 | 40.5 | 43.0 | 全件承認 |
| 1 | S | N3c | 43.6 | 45.6 | 承認の後 |
| 1 | O | 詳細 → 最少人数到達 | 45.7 | 46.3 | 「最少人数に達しました」 |
| 1 | S | N4a, N4b | 46.9 | 54.1 | |
| 2 | O | オーナー → 棒グラフ | 57.2 | 57.9 | 棒グラフが画面内 |
| 2 | S | N5a, N5b | 58.5 | 65.8 | |
| 2 | O | 週の切替 → 円グラフ | 66.0 | 66.8 | 12月28日、円グラフが画面内 |
| 2 | S | N6a | 67.4 | 70.6 | |
| 2 | O | 提案へスクロール | 70.7 | 70.7 | 提案が画面内 |
| 2 | S | N6b | 71.3 | 75.6 | |
| 3 | O | 自治体 → 主な指標 | 79.1 | 79.7 | 主な指標が画面内 |
| 3 | S | N7a, N7b | 80.3 | 87.7 | |
| 3 | O | 地方別へスクロール | 87.8 | 87.8 | |
| 3 | S | N8a | 88.4 | 93.3 | |
| 3 | O | 流入元へスクロール | 93.4 | 93.4 | |
| 3 | S | N8b, N9 | 94.0 | 104.9 | 結び。終了 105.0 |

- (a) 台詞の最中に操作が走っていない: すべての O の開始〜終了は、直前の S の終了(+0.12 秒)の後、次の S の開始(O 終了 + 0.6 秒)の前。ランナーが `await` で直列に進めるため、構造上も重ならない。
- (b) 各台詞は、説明する画面状態になってから始まる: 各 O に画面の確認(`ok`)を持たせ、`ok=true` を確認してから次の台詞を始めた(入力値、「募集中」、承認ボタン 2 つ、承認ボタンが 0 件、「最少人数に達しました」、棒グラフ・円グラフ・提案・主な指標・地方別・流入元が画面内)。
- (c) 総時間 105.0 秒 ≦ 180 秒。部の間の MCP 往復は、2.9 秒と 3.4 秒。
- 聴感(実際に音が聞こえたか、読みが自然か)は確認できない。`AudioContext` の `running`、`ended` の発火、再生時間(`duration`)のみで再生を確認した。
- 検証中に起きたこと: (1) 最初の通しで、ユーザー Cookie が u-009 のまま(前のテストの残り)で部 1 を始めたため、グループの幹事が u-009 になり承認画面が出ず、約 40 秒のタイムアウトが出た。→ ランナーが部 1 の先頭で `setU('u-001')` するように修正した。(2) `sourcePath` はワークスペース外で拒否されたので、注入は全文を `function` に渡す方式にした。(3) `router.push('/nttw-demo/new-group')` の直後に、ページが 1 回再読み込みされた(上記)。

### 台詞駆動(直列)方式の検証(2026-11-10、agent/w5-demo-sync。旧方式。付録 A)

実施: worktree で `mise trust` → `mise install` → `npm ci` → `npm run build` → `npx next start -p 6304`、chrome-devtools(共有ブラウザの `isolatedContext=demo2` の新規ページ、430×860)。VOICEVOX ずんだもん(`-Speed 1.3`)で実際に再生。4.1 の #1〜#26 を上から 1 行ずつ実行し、台詞の開始・終了(PowerShell の `Get-Date`)と、操作の完了時刻(`evaluate_script` が返した時刻)を記録した。

**タイムライン**(2026-11-10 の時刻。台詞の「開始」は 0.8 秒の待ちと音声合成の待ち(約 0.4〜1 秒)を含む。操作の時刻は、スクリプトが返した完了時刻。`fill_form` は時刻を返さないので、「次の台詞の呼び出し前に返った」ことだけが確認できる)

| # | 種別 | 内容 | 開始 | 終了 | 備考 |
| --- | --- | --- | --- | --- | --- |
| 1 | S | N0, N1a | 13:28:09.0 | 13:28:25.3 | N0 は旧文面(今回の N0 は別測定: 18.2 秒) |
| 2 | O | 入力(名称〜日程) | | 〜13:28:32.0 | 台詞の外 |
| 3 | S | N1b | 13:28:33.3 | 13:28:40.1 | |
| 4〜5 | O | 入力(人数・締切)、地方選択 | | 13:28:46 | 台詞の外 |
| 6 | S | N1c, N2a | 13:28:54.1 | 13:29:09.0 | 地図が光ってから |
| 7 | O | 作成 → 募集中 | | 13:29:12 | |
| 8 | S | N2b | 13:29:18.5 | 13:29:23.7 | |
| 9 | O | 申請の仕込み → 申請画面 | | 13:29:27 | |
| 10 | S | N3a, N3b | 13:29:32.1 | 13:29:43.3 | 申請 2 件が見えてから |
| 11 | O | 承認 ×2 | | 13:29:49 | |
| 12 | S | N3c | 13:29:53.8 | 13:29:57.8 | 承認の後 |
| 13 | O | 詳細 → 最少人数到達 | | 13:30:01 | |
| 14 | S | N4a, N4b | 13:30:06.3 | 13:30:19.7 | |
| 15 | O | オーナー → 棒グラフ | | 13:30:22 | |
| 16 | S | N5a, N5b | 13:30:27.8 | 13:30:40.4 | |
| 17 | O | 週の切替 → 円グラフ | | 13:30:44 | |
| 18 | S | N6a | 13:30:49.3 | 13:30:54.9 | 円グラフが出てから |
| 19 | O | 提案へスクロール | | 13:30:58 | |
| 20 | S | N6b | 13:31:03.4 | 13:31:10.3 | |
| 21 | O | 自治体 → 主な指標 | | 13:31:14 | |
| 22 | S | N7a, N7b | 13:31:19.6 | 13:31:32.4 | |
| 23 | O | 地方別へスクロール | | 13:31:50 | 台詞の外(前の台詞 13:31:32 の後) |
| 24 | S | N8a | 13:31:55.6 | 13:32:03.4 | |
| 25 | O | 流入元へスクロール | | 13:32:05 | |
| 26 | S | N8b, N9 | 13:32:41.0 | 13:32:58.8 | N9 は新文面 |

- **台詞の最中に画面操作が走っていない**: 全ての O の完了時刻は、直前の台詞の終了より後で、次の台詞の開始より前(上表)。O と S は 1 呼び出しずつ直列に実行したので、重ならない(台詞は PowerShell をフォアグラウンドで実行し、終了まで次の呼び出しが出ない)。
- **台詞は、その画面になってから始まる**: 4.2 の対応表のとおり、各台詞の直前の O が、台詞の説明する状態(入力済み、地図が光る、募集中、申請 2 件、承認済み、最少人数到達、棒グラフ、円グラフ、提案、主な指標、地方別、流入元)を完了してから、台詞を始めた。
- 台詞の最大の遅れ(合成待ち)は、台詞の「開始」に含まれる 0.4〜1 秒程度で、台詞は画面が止まってから始まるので、ずれにならない。
- 旧手順(台詞を背景で起動して並行)で出ていた「操作が台詞より先に進む」問題は、直列化で解消した。途中、`fill_form` を台詞と同じ応答に並べると並行実行になることが分かり、「同じ応答に並べない」を第4章に明記した。

**通し総時間(実測)**: 開始(13:28:07.7)から最後の台詞の終了(13:32:58.8)まで、生の経過は 291 秒。ただし、#23 と #26 の間(13:32:05 → 13:32:41)に、台詞の変更(オーナーからの追加指示)に対応する間が入り、約 30 秒余計にかかった。これを通常の間(約 7 秒)に直し、N0 を新文面(18.2 秒。旧文面は 11.8 秒)に差し替えると、**約 265 秒(約 4 分 25 秒)**。**180 秒を超えている**。内訳: 台詞(Speed 1.3、合成待ち込み)約 141 秒 + 操作の呼び出しと間(13 回 × 約 8〜10 秒)約 125 秒。

**超過の原因と短縮案**(`-Speed` を上げすぎない前提):

1. **操作の呼び出し 1 回あたり約 6〜8 秒**(AI の呼び出しの往復)が、13 回で約 100 秒。台詞の速さではなく、ここが支配的。台詞のたびに画面を動かす方式の本質的なコスト。
2. **台詞も約 141 秒と長い**(N0 を 2〜3 文に伸ばしたぶん +6 秒)。
3. 案 A(推奨・要実装): **台詞の再生を、ブラウザのページ内で行う**。`evaluate_script` 1 回の中で「操作 → 間 → VOICEVOX で合成して再生(`await` で終わるまで待つ)→ 次の操作」を直列に進める。確認済み: ページ(`http://localhost:<port>`)から `http://127.0.0.1:50021` への `fetch` は CORS で通り(HTTP 200)、`AudioContext` は `running`(操作後の活性化あり)。AI の往復が部ごとに 1 回(3〜4 回)になり、通しは台詞 約 130 秒 + 間 約 15 秒 ≒ 約 150 秒の見込み(未実装・未検証。FollowUp 候補)。
4. 案 B: 台詞を削る(例: N4b の後半、N8b、N5b の前半)。−10〜15 秒。それでも 4 分前後。
5. 案 C: 操作の呼び出しを減らす(#2 と #4 のフォーム入力を 1 回にする、#17 と #19 を統合、#23 と #25 を統合)。−20 秒。それでも約 4 分。
6. `-Speed` は 1.3 まで(既定を 1.2 → 1.3 に上げた)。1.4 以上は聞き取りにくくなるおそれがあり、上げていない。

**調整した点**: `speak.ps1` の `-Speed` 既定を 1.2 → 1.3。操作の呼び出しを約 18 → 13 回に統合(地方選択を 1 回のスクリプトに、遷移と待ちを `window.next.router.push` で 1 回のスクリプトに)。画面操作の前後に間(0.3〜1 秒)と、台詞の前の 0.8 秒の待ち。フォーム入力は 2 回に分割(名称〜日程 → 台詞 → 人数・締切・地方 → 台詞)。

**未確認**: 聴感(実際に音が出たか、台詞と画面が耳で合っているか、「こぱあ」の読み・アクセントが自然か)は確認できない(PowerShell の終了コード 0 と、VOICEVOX の `audio_query` でアクセント句が「コパア」1 つになることのみ確認)。`window.next.router.push` は Next.js の内部 API で、将来の版で変わる可能性がある。案 A は未検証。デモデータは `/api/demo/reset` で初期化済み。サーバー(PID 9084、port 6304)は停止済み。

### 旧手順(並行方式)の検証(参考)

実施: 2026-11-10、`next start -p 6231`、共有ブラウザの `isolatedContext=demo`。通った: 下準備、部 1〜3、音声(Haruka)、`-Mute`、`-ListVoices`。直した点: ラジオはラベル文字を `click`、地方セレクトは選択肢をスクリプトで、承認ボタンの連続クリックは文言検索 + 待ち、`wait_for` は長いページで出力が大きいので `evaluate_script` の待ちに、「デモを初期化」はユーザー Cookie を戻さない、週の切替は棒の透明な `rect`(22 番目 = 12/28 週)に click イベント。既知の制約: DemoBar の +N日 ボタンはページを再読み込みする(F-173)。
