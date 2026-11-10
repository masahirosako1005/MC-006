---
name: demo
description: プレゼン用の 3 分デモを、chrome-devtools で AI がブラウザ操作し、音声(日本語 TTS)で解説しながら実行する。/demo [start | prep | mute | reset | step | chapter N] [voice=sapi|voicevox]
disable-model-invocation: true
argument-hint: "[start | prep | mute | reset | step | chapter N] [voice=sapi|voicevox]"
---

# /demo(3 分デモの実行)

オーナーが `/demo` と入力したときだけ使う。**プレゼンターは話さず、AI が操作と音声解説を行う。**

## 最初にやること

1. `docs/demo/operation.md`、`docs/demo/scenario.md`、`docs/demo/narration.md` を Read する(手順・台詞・待ちの詳細はここにある。ここには書き写さない)。
2. 引数を判定する(下表)。

| 引数 | 動作 |
| --- | --- |
| なし / `start` | 下準備 → 音声テスト → プレゼンターの「開始」を待つ → 3 分デモをノンストップで実行 |
| `prep` | 下準備のみ(サーバー、ブラウザ、ウォームアップ、初期化、音声テスト、待機画面) |
| `mute` | 音声なし。全ての `speak.ps1` に `-Mute` を付ける(`start` と併用可: `/demo start mute`) |
| `reset` | データとユーザーの初期化のみ(operation.md 第1章のウォームアップ後半) |
| `step` | 部 1・部 2・部 3 を 1 つずつ実行し、部ごとにプレゼンターの「次へ」を待つ |
| `chapter N` | 第4章の部 N だけを実行(N = 1, 2, 3) |
| `voice=sapi` / `voice=voicevox` | 音声エンジンを強制する。全ての `speak.ps1` に `-Engine sapi`(または `voicevox`)を付ける(例 `/demo start voice=sapi`)。省略時は auto(VOICEVOX が応答すれば VOICEVOX、無ければ SAPI)。声は `-Speaker`(既定 ずんだもん)。画面の隅かスライド末尾に「音声: VOICEVOX:ずんだもん」を表示する |

## 下準備(`start` / `prep`)

- デモ用ポート(既定 6231)に接続できるか確認する(`curl`)。未起動なら、operation.md 第1章に従い `app/` で `NEXT_TELEMETRY_DISABLED=1 mise exec -- npm run build` → `npx next start -p 6231` を**バックグラウンド起動**し、PID を控える。build 済みなら起動のみ。
- ToolSearch で chrome-devtools の各ツールを読み込む。**共有ブラウザなので、デモ専用の新しいページ**(`new_page`、`isolatedContext="demo"`)を開き、`pageId` を固定する。他のページは触らない。
- `resize_page`(430×860)、ウォームアップ、**初期化**、`/new-group` で待機、uid の取得、音声テスト(`speak.ps1 -Text "音声のテストです。"`。終了コード 0 を確認)。
- 準備ができたら「準備完了です。『開始』と言ってください」と短く伝えて待つ。

## 実行ルール

- 3 分版は**ノンストップ**(`step` を除く)。プレゼンターの「開始」を受けたら、operation.md 第4章の表を上から実行する。
- 台詞は `speak.ps1` を `run_in_background` で起動し、その間にブラウザ操作を行う(並行)。台詞の重なりは Mutex が防ぐ。
- 操作は operation.md の共通ルールに従う(uid は取り直す、`wait_for` か `evaluate_script` で待つ、まとめて呼ぶ、ゆっくり)。
- 失敗したら operation.md 第6章に従い、**デモを止めない**(1 回だけ再試行 → だめなら飛ばして台詞を続ける。代替はスクリーンショット)。
- 「止めて」と言われたら、新しい操作と台詞の起動をやめる。
- 終了後、台詞の終了コードを確認し、所要時間を報告する。**起動したサーバーを PID 指定で停止してよいか確認**してから止める(全 node の一括終了は禁止)。

## 禁止事項

- 本番・外部サイトを操作しない(`localhost` のデモのみ)。
- コードとデータファイルを変更しない。データの操作は、デモ内の画面操作と、デモ用 API(`/api/demo/*`、申請の仕込み)に限る。
- 個人情報(`.env*`、`Password.txt.txt`、`sample-data/` の CSV)を読まない・読み上げない・出力しない。デモ用のユーザー ID(u-001、u-002、u-003、u-009、u-013)のみ使う。
- 見送りの機能(未実装)を見せない・話さない。
