# 再開の記録(2026-11-09 17:15 中断)

オーナーの指示で、中間成果物の状態のまま中断した。2026-11-10 に再開する。再開時は、本書 → `docs/plan/tasks.md` → `docs/plan/followups.md` の順に読む。

## 1. 現在の状態

- 進捗: 本線 60 タスクのうち 43 タスクが完了(約 72%)。P-3-3 は WIP でマージ済み。`tasks.md` の `[*]` が完了。
  - Wave 0(8)、Wave 1(9)、Wave 2(25)は、すべて完了。
  - Wave 3 は P-3-1(作成・編集フォーム)のみ完了。P-3-16(通し試験)は、マージ済みだが、skip 2 件・todo 1 件のため、`[ ]` のまま。
  - P-3-3(一覧画面)は、WIP としてコミットし、統合ブランチにマージ済み(`tasks.md` は `[ ]` のまま)。G-B は通過。ただし、一覧に実データが出るかは未確認で、`GET /api/groups` が `internal` を返した(マージ前の古い状態での結果。再開時に最初に再確認する。F-028)。
  - Wave 4(結合と手順書)は、未着手。
- 統合ブランチは **`worktree-feature-auth`**(worktree: `C:\Users\Jisui_share006\work\.claude\worktrees\feature-auth`)。**`main` には取り込んでいない**(`main` は afe494c のまま)。このセッションは worktree 分離のため、`main` のチェックアウトに対する git 操作ができなかった。
  - 再開時、`main` に取り込む場合は、`main` をチェックアウトしているディレクトリで `git merge worktree-feature-auth` を行う(オーナーの操作、または `main` 側のセッション)。
  - タスクブランチ(`agent/w*`、`worktree-agent-*`)は、すべて `worktree-feature-auth` にマージ済み。ただし P-3-3 を除く。
- 実装は API 中心。API の主ルートは実装済み。**グループ系の画面はほぼ未実装**(`/groups`、`/notifications` などは 404。`/new-group` と `/groups/[id]/edit` は P-3-1 で追加)。

## 2. 再開の手順(この順で)

1. **環境の確認**
   - `C:\Users\Jisui_share006\work\.claude\worktrees\feature-auth` で `mise trust` → `mise install`。app/ で `mise exec -- npm ci`(node_modules が壊れていれば再インストール)。
   - 並行する `npm ci` は競合する(ENOTEMPTY)。起動は 1 つずつ、または 3〜4 並列までに抑える。
   - worktree の同時作成も競合する。サブエージェントの起動は、1 つずつか、少数ずつにする。
2. **統合後の全体確認(F-004、最優先)**
   - app/ で `npm test`、`npx tsc --noEmit`、`npm run lint`、`npm run build`。各タスクは他モジュールを `vi.mock` で代替して試験したため、実物同士の結合は未確認。ここで出た不整合を先に直す(主ルートが止まるものだけ)。
3. **通し試験の有効化(F-001〜F-003)**
   - `app/src/test/scenario/main-route.test.ts` の skip と todo を外す。実装済みの 04 handlers・view・replan、11 の getOfficialBadges、05〜08 の API がマージ済み。
   - 中止 → 再企画 → 再申請、通知 API 経由の確認、旅程・チャット・費用・スタンプ・振り返りの通し、`/api/stats`・`/api/insights`。
   - `replan` の `recordCreated` の二重呼び出し(F-002)、`evaluateAll` が seed を変えないこと(F-003)を確認。
4. **P-3-3(一覧画面)の完成**
   - マージ済みの WIP を、実データで確認する。`GET /api/groups` の `internal`(F-028)の原因を調べ、`/nttw-demo/groups` に一覧が出ることを確認して、`tasks.md` にチェックを付ける。
5. **Wave 3 の画面(主ルートを優先)**
   - 優先順: P-3-2(詳細シェル・メンバー・招待)、P-3-4(参加前詳細・招待コード)、P-3-5(申請パネル・承認画面)、P-3-6(状態表示・辞退・中止・再企画。`GroupStatusBadge` ほか)、P-3-12(通知・ベル)。
   - その次: P-3-7〜3-11(旅程・チャット・費用・ラリー・安全)、P-3-13(着地・公式バッジ)、P-3-14(自治体集計)、P-3-15(需要見込み)。
   - 各タスクのブリーフは `docs/plan/briefs.md` の雛形と、本日の起動に使った内容(`tasks.md` の「対象」「内容」「画面」)を使う。
   - P-3-1 の FollowUp: `TextRejectNotice` のスタブ(P-3-11 の担当)と GroupForm の自前表示が二重になる。P-3-11 のとき統合する。
6. **Wave 4**: P-4-1(画面の通し確認と主ルート停止の修正)、P-4-2(起動・デモ手順書 `docs/plan/demo.md`。`NEXT_TELEMETRY_DISABLED=1` を含める)。
7. **PO の動作確認**: API は curl とブラウザで確認できる。画面は 5 の主ルートが入ってから。

## 3. 起動のしかた(ローカル確認)

- `next dev` は、セキュリティ機能(SentinelOne か WDAC)が `@next/swc-win32-x64-msvc` をブロックし、WASM 版 SWC にフォールバックするため、不安定(`CodeFrameColorMode` のエラー)。確認は **`npm run build` のあと `npx next start -p <ポート>`** が確実(build は約 90 秒、他の build と重なると遅い)。
- ユーザー切替: Cookie `demoUser=u-001`(`u-NNN` 形式)。DemoBar も同じ Cookie を設定する。既定は u-001。
- `POST` には `Content-Type: application/json` が必要(付けないと 415)。
- 本日、中断時点で動いていたサーバー:
  - ポート 3000: `next dev`(PID 788 と 17876、feature-auth の app/)。
  - ポート 3200: `next start`(PID 13124、マージ前の古い build)。`taskkill /PID 13124 /T /F` で停止できる。

## 4. 環境・ツール

- 開発環境は mise(`mise.toml`、Node 24.21.0)。AGENTS.md §1 に運用ルールを追記済み。
- AGENTS.md §3 に、タスクブランチの `main` 取り込みを承認不要とするルールを追記済み。ただし、このセッションからは `main` のチェックアウトを操作できなかった。
- Chrome DevTools MCP を local スコープで追加済み(`C:\Users\Jisui_share006\.claude.json`)。このセッションには反映されていない。Claude Code の再起動、または `/mcp` の再接続で使えるようになる(初回に使用許可の承認が必要)。提出物には含めない。ライセンス一覧への扱いは F-023。
- 運用の決定: 承認が必要な操作は都度確認する。軽微な仕様決定は推奨値で進める(メモリに記録済み)。

## 5. 片付けが必要なもの

- `C:\Users\Jisui_share006\work\.claude\worktrees\agent-*` に、多数の worktree が残っている(約 50)。マージ済みのため、再開後に削除してよい。
  - ロック済みで未使用の worktree が 6 つある(`agent-a0d3a4a40df6d5c6f`、`agent-a3fdfb6ab684c95d2`、`agent-a63c5cc40f75836a3`、`agent-a97194922f130cddf`、`agent-adb14e5dabd8953d0`、`agent-adb7b367a1f5fa2dd`)。Wave 3 の同時起動に失敗したときの残骸。
  - 一部の worktree の `app/node_modules` は、他の worktree への junction。元の worktree を先に削除すると壊れる。
  - 1 つの worktree に `app/node_modules_bad`(Windows の長いパスで通常削除できない)が残っている。
- 削除は、マージ済みであることを確認してから、オーナーの承認後に行う。

## 6. 主な未決・注意

- F-016: `UserRole` の 4 ロール化と 13 の優先度(A)は、オーナー確認が必要。
- 12 の MUN 系の `messages.ts`(指標名・区分表示名)が不足(F-008)。
- 要望テーマ辞書の不一致(F-009)。CSV を見ずに調整できなかった。
- seed.json の個人情報の扱い(R-20 / 13 INS-Q-01)は、提出前に確認が必要。
- 提出先・期限・形式は rule.md に明記がなく、未確認。
