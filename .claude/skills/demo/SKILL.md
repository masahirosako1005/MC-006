---
name: demo
description: プレゼン用の 3 分デモを、chrome-devtools でブラウザ内のランナーを呼び、音声(VOICEVOX)で解説しながら実行する。/demo [start | prep | mute | reset | step | chapter N] [voice=sapi|voicevox]
disable-model-invocation: true
argument-hint: "[start | prep | mute | reset | step | chapter N] [voice=sapi|voicevox]"
---

# /demo(3 分デモの実行)

オーナーが `/demo` と入力したときだけ使う。**プレゼンターは話さず、AI が操作と音声解説を行う。**

## 最初にやること

1. `docs/demo/operation.md`、`docs/demo/scenario.md`、`docs/demo/narration.md` を Read する(手順・台詞・待ちの詳細はここにある。ここには書き写さない)。ランナーは `docs/demo/runner.js`。
2. 引数を判定する(下表)。

| 引数 | 動作 |
| --- | --- |
| なし / `start` | 下準備 → プレゼンターの「開始」を待つ → ランナーを部ごとに呼んで、3 分デモをノンストップで実行 |
| `prep` | 下準備のみ(サーバー、ブラウザ、ウォームアップ、初期化、待機画面、ランナー注入、台詞の先読み) |
| `mute` | 音声なし。先読みを `{mute:true}` で呼ぶ(台詞の長さ ÷ 6 秒だけ待つ)。`start` と併用可: `/demo start mute` |
| `reset` | データとユーザーの初期化のみ(operation.md 第1章のウォームアップ後半)→ `/new-group` へ戻る |
| `step` | 部 1・部 2・部 3 の `run(N)` を 1 つずつ実行し、部ごとにプレゼンターの「次へ」を待つ |
| `chapter N` | `run(N)` だけを実行(N = 1, 2, 3) |
| `voice=sapi` | ブラウザ再生を使わず、**付録 A のフォールバック手順**(操作ごとの呼び出し + `speak.ps1 -Engine sapi`)で実行する。`voice=voicevox` は通常のランナー方式(既定) |

## 下準備(`start` / `prep`)

- デモ用ポート(既定 6231)に接続できるか確認する(`curl`)。未起動なら、operation.md 第1章に従い `app/` で `NEXT_TELEMETRY_DISABLED=1 mise exec -- npm run build` → `npx next start -p 6231` を**バックグラウンド起動**し、PID を控える。build 済みなら起動のみ。
- ToolSearch で chrome-devtools の各ツールを読み込む。**共有ブラウザなので、デモ専用の新しいページ**(`new_page`、`isolatedContext="demo"`)を開き、`pageId` を固定する。他のページは触らない。
- `resize_page`(430×860)、ウォームアップ、**初期化**、`/new-group` で待機。
- **ランナーの注入と先読み**(operation.md 第1章 #8〜#9): `evaluate_script(format="script", sourcePath=<docs/demo/runner.js の絶対パス>)` → `evaluate_script(function="async () => await window.__demo.prefetch({mute:false})")`。戻り値で `ctx:"running"`、`fail:[]`、`total`(全台詞の秒数)を確認する。**再読み込みしない**(ランナーと先読みが消える。消えたら注入と先読みをやり直す)。
- 準備ができたら「準備完了です。『開始』と言ってください」と短く伝えて待つ。

## 実行ルール(ランナー方式)

- プレゼンターの「開始」を受けたら、`evaluate_script(function="async () => await window.__demo.run(1)")` → 戻ったらすぐ `run(2)` → `run(3)`(部ごとに 1 回、計 3 回)。各呼び出しは、その部の「操作 → 間 → 台詞(再生が終わるまで待つ)→ 次の操作」を、ページ内で直列に進める。**台詞の最中は画面を動かさない**(ランナーが await で保証)。MCP の往復は部の間だけ。
- 3 回の呼び出しの間に、余計な応答(説明の文章、確認)を挟まない。`step` のときだけ、部ごとにプレゼンターの「次へ」を待つ。
- `chapter 2` / `chapter 3` は、部の先頭でユーザー切替を行うので、単独でも動く(部 1 を通していないと、部 1 のグループは予定に載らないだけ)。
- `reset`: ウォームアップ後半(`/api/demo/reset` と `setU('u-001')`)→ `router.push('/nttw-demo/new-group')`(ランナーは残る)。
- 音声が出ない・`prefetch` が失敗する・`ctx` が `running` にならない場合は、`voice=sapi` と同じく付録 A のフォールバック手順に切り替える。
- 完了後、`run` の戻り値の `log` から総時間(開始〜最後の台詞の終了)を報告する。目標は 180 秒以内。超過は隠さず報告する。最後に `evaluate_script("() => window.__demo.finish()")` でクレジット表示を消す。
- サービス名は **Kopa**(台詞では「こぱあ」)。テーマは「地方都市と人、そして人と人をつなぐ」(N0 で説明)。クレジット「音声: VOICEVOX:ずんだもん」はランナーが画面の隅に出す。
- 失敗しても**デモを止めない**(ランナーは操作の失敗を `log` の `err` に残して次へ進む)。`err` があれば報告する。
- 「止めて」と言われたら、次の部の `run` を呼ばない(実行中の部は、ページ内で終わるまで進む)。
- 終了後、**起動したサーバーを PID 指定で停止してよいか確認**してから止める(全 node の一括終了は禁止)。

## 禁止事項

- 本番・外部サイトを操作しない(`localhost` のデモのみ)。
- コードとデータファイルを変更しない。データの操作は、デモ内の画面操作と、デモ用 API(`/api/demo/*`、申請の仕込み)に限る。
- 個人情報(`.env*`、`Password.txt.txt`、`sample-data/` の CSV)を読まない・読み上げない・出力しない。デモ用のユーザー ID(u-001、u-002、u-003、u-009、u-013)のみ使う。
- 見送りの機能(未実装)を見せない・話さない。
