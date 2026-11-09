# Raund nttw-demo ローカルミラー

`https://app.raund.net/nttw-demo` の構造を、Next.js（App Router）でローカルに再現した環境です。
追加機能を作るためのベースで、**外部ネットワークへの実行時依存はありません**（フォント・地図タイル・API すべてローカル）。

## 起動

```bash
npm install
npm run dev          # http://localhost:3000  → /nttw-demo へリダイレクト
# または
npm run build && npm start
```

- `npm run seed` : `../sample-data/*.csv` から `src/data/seed.json` を再生成します。
- Windows の Application Control が `@next/swc` のネイティブ DLL をブロックする環境では、警告が出ますが WASM にフォールバックして動きます。

## 再現しているもの

| 本番 | ローカル |
|---|---|
| `/[campaign]` 配下の画面 | `src/app/[campaign]/**`（ホーム・スポット・特典・マイページ・お知らせ・押印・リセット・お問い合わせ ほか） |
| `GET/POST api.raund.net/api/v2/...` | `src/app/api/v2/[...path]/route.ts`（インメモリ。再起動で初期状態に戻る） |
| メニュー（ホーム／ホームスポット／GET特典履歴） | `AppShell` のボトムナビ |
| 配色トークン `--main-color` 等 | `globals.css` |
| MapLibre の地図 | SVG ではなく CSS のイラストマップ（`.map`） |

### 未実装（画面だけ用意）
`/rule` `/service` `/qrerror` `/restore` `/products/tickets` は説明文のみ。本番の本文は未取得です。
ログイン、LINE、Giftee/PayPay、OCR、マイナビ連携、多言語、QR/GPS 押印、決済は未実装です。

## 注意（正確性）

- 本番の HTML/CSS と調査ドキュメント（`../docs/overview.md`）から構造を読み取って**自作**しています。本番の JS バンドル・画像・ロゴはコピーしていません。
- **API のレスポンス形式は本番と同一ではありません**（本番の形式は未確認）。パスだけ揃えています。
- スポットの説明・地図座標・合言葉・特典の必要スタンプ数（3/5/7）は、CSV に無いため仮置きです（`scripts/build-seed.mjs`）。
- デモ押印の合言葉: `SPOT01`〜`SPOT07`（大文字小文字は区別しません）。
- ユーザーは `sample-data` のテストユーザー 1 名固定です（ログインなし）。

## 追加機能の作り方

- 画面: `src/app/[campaign]/<route>/page.tsx` を追加し、タイトルを `AppShell.tsx` の `TITLES` に足します。
- API: `route.ts` の `switch` にケースを追加し、状態は `src/lib/server-store.ts` に置きます。
- 型・取得: `src/lib/api.ts` の `useApi` / `post` を使います。
