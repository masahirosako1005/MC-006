# 起動手順・デモ手順(P-4-2)

注意: 本アプリは**モック**。認証・決済・外部送信は無く、データはメモリ上(seed 由来)。画面上部の DemoBar(モックバッジ)で明示している。

## 1. 環境準備(mise)

リポジトリ直下で:

```
mise trust
mise install
cd app
mise exec -- npm ci
```

Node.js は `mise.toml` で固定(24.21.0)。手動インストール・グローバル変更はしない。

## 2. seed 生成(必要なときだけ)

`app/src/data/*.json` は生成済みでコミットされている。再生成する場合:

```
cd app
mise exec -- npm run seed
```

(`build-seed.mjs` と `build-future-trips.mjs` を実行。`sample-data/*.csv` が元。)

## 3. 起動(build + start を標準とする)

`next dev` は、セキュリティ機能(SentinelOne / WDAC)が `@next/swc-win32-x64-msvc` をブロックし、WASM 版 SWC にフォールバックするため不安定(`CodeFrameColorMode` のエラー)。**`npm run build` のあと `npx next start` で起動する。**

PowerShell:

```
cd app
$env:NEXT_TELEMETRY_DISABLED = "1"
mise exec -- npm run build        # 約 90 秒
mise exec -- npx next start -p 3200
```

Bash:

```
cd app
NEXT_TELEMETRY_DISABLED=1 mise exec -- npm run build
NEXT_TELEMETRY_DISABLED=1 mise exec -- npx next start -p 3200
```

ブラウザで `http://localhost:3200/` を開く。`/` は `/nttw-demo` へリダイレクトされる。キャンペーン ID は **`nttw-demo`**(`app/src/app/[campaign]/layout.tsx`)。以降の URL は `http://localhost:3200/nttw-demo` を `{base}` と書く。

試験: `mise exec -- npm test`(Vitest)。

## 4. DemoBar とユーザー切替

- 画面上部の DemoBar に、現在のユーザー・日付(デモ時計)、ユーザー切替、`+1日 / +3日 / +7日`、`デモを初期化` がある(`app/src/components/groups/common/DemoBar.tsx`)。
- ユーザー切替は Cookie `demoUser=u-NNN` を設定する(DemoBar のセレクトが `POST /api/demo/me` で設定)。既定は `u-001`。
- 主なユーザー:

| 役割 | ID |
| --- | --- |
| 旅行者・幹事(既定) | `u-001`(ほか u-002 など。DemoBar のセレクトで確認) |
| 自治体 | `u-009` |
| 観光事業オーナー | `u-013` |

- API を直接叩くとき、`POST` には `Content-Type: application/json` が必要(無いと 415)。

## 5. デモ時計の進め方

- DemoBar の `+1日 / +3日 / +7日` で、デモ時計を進める(`POST /api/demo/clock` `{"action":"advanceDays","days":N}`)。
- 時計の進行で、グループの状態が自動で変わる: 募集中 → 最少人数到達 → 締切 → 辞退期間 → 実行確定 → 実施中 → 完了(最少人数に届かず締切なら中止)。
- 実行確定・実施・完了に専用ボタンは無い。**時計を進めて遷移させる**。グループのハブ画面の状態表示(LifecyclePanel)で確認する。遷移の目安日は作成時の日程次第なので、+3日 / +7日 を繰り返して状態を見る。
- `デモを初期化`(`POST /api/demo/reset`)で、読み込み時の状態に戻る(時計も初期化)。

## 6. 主ルートのデモ台本

画面の見出しは `{base}` = `http://localhost:3200/nttw-demo`。

1. **旅行者・幹事(u-001)**: グループ作成 `{base}/new-group` → 作成後のグループ詳細 `{base}/groups/{groupId}`。
2. **一覧**: `{base}/groups`(募集中グループ。seed の `g-101` など。詳細は `{base}/groups/g-101`)。
3. **参加申請(別ユーザーに切替)**: DemoBar で別の旅行者に切替 → `{base}/groups/{groupId}` で申請。参加コードで入る場合は `{base}/invite`。
4. **承認(幹事に戻す)**: DemoBar で幹事へ切替 → `{base}/groups/{groupId}/requests` で承認(最少人数に到達 → 状態 `min_reached`)。メンバーは `{base}/groups/{groupId}/members`。
5. **実行確定**: DemoBar の `+7日` などで時計を進める → 締切 → 辞退期間 → 実行確定。`{base}/groups/{groupId}` の状態表示を確認。通知は `{base}/notifications`。
6. **実施(旅程・チャット・費用)**: さらに時計を進めて「実施中」にする。ハブ画面の旅程・チャット・費用タブ、ラリー/スタンプ `{base}/groups/{groupId}`、振り返り `{base}/groups/{groupId}/review`。
7. **完了**: さらに時計を進めて「完了」にする。
8. **自治体(u-009)**: DemoBar で切替 → 集計 `{base}/admin/stats`(完了グループが集計に反映される)。
9. **観光事業オーナー(u-013)**: DemoBar で切替 → 需要見込み `{base}/business/insights`。

その他の画面: 入口 `{base}/entry`、ホーム `{base}`、スポット `{base}/spots`、マイページ `{base}/mypage`(プロフィール `/mypage/profile`、ブロック `/mypage/blocks`、本人確認 `/mypage/verification`)、外部リンク集 `{base}/external-links`、お知らせ `{base}/news`、GET特典履歴 `{base}/pointHistory`。

## 7. 既知の制約(docs/plan/followups.md より要点)

- 画面のブラウザでの目視確認は限定的(多くは API と HTTP 200 の確認まで)。見た目は Mantine の標準部品で、モックの CSS は未再現(F-100、F-140 ほか)。
- 振り返りは実施中(in_progress)のみ全機能。募集中のグループでは `/review` は ErrorNotice のみ(F-141)。
- 費用タブは実施中のみ編集可。モバイルはカードでなく横スクロール(F-130、F-131)。
- 旅程タブ: 並び替え UI・競合ダイアログは未実装(F-110)。チャット: Enter 送信・未読区切り等は未実装(F-120)。通報・ブロックの導線は呼び出し元へ未配線(F-121、F-150)。
- 条件変更時の再同意フロー未実装(F-063)。
- 自治体集計は一部(時系列グラフ・ファネル等)未実装(F-090)。インサイトはグラフ・年代別が未実装(F-100)。`/admin/stats` は自治体ユーザー以外だと 403(F-092)。
- seed の特典付与記録があるメンバーには新規付与されない(F-019)。
- `next dev` は不安定(F-020)。提出先 PC でも同じブロックが起きるか未確認。
- 通し試験 `notify.test.ts` の「confirmed は summaryText を付ける」が失敗(F-042、F-051)。

## 8. 停止方法

ポートを指定して PID を調べ、停止する(PowerShell):

```
$p = (Get-NetTCPConnection -LocalPort 3200 -State Listen).OwningProcess
Stop-Process -Id $p -Force
```

または `netstat -ano | findstr :3200` で PID を確認し、`taskkill /PID <PID> /T /F`。
