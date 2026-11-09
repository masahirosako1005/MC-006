# 09 環境構築・起動手順

## 目的
第三者が支給PC上で、外部接続なしにアプリを起動できる手順を示す。

## 含める内容
- 前提(OS、Node.js)
- 依存関係の導入、seed データの生成、起動・停止、ビルド
- 動作確認の方法(ブラウザ、レスポンシブ表示)
- モック部分の明示

## 現時点で分かっていること
- 作業は `app/` で行う: `npm install` / `npm run dev` / `npm run build` / `npm run lint`。 [事実、AGENTS.md 1]
- seed は `app/scripts/build-seed.mjs` が `sample-data/*.csv` から `app/src/data/seed.json` を作る。実行コマンドは未確認。 [事実/要確認]
  - `app/package.json` に `"seed": "node scripts/build-seed.mjs"` がある。実行コマンドは `npm run seed` と推定する。 [事実(定義)/推定(手順)]
- 追加機能のダミーデータ `app/src/data/group-seed.json` は手書きのファイルで、生成の手順は無い。起動時に読み込み、デモ操作の初期化(`/api/demo/reset`)で読み込み時の状態に戻る。 [案、詳細設計 00]
- 試験: Vitest を開発時の依存として追加し、`app/` で `npm test` を実行する(`vitest.config.ts` は 00 が用意する)。 [決定(Vitest、判断 11)/案(スクリプト名、契約書 11.3)]
- 動作は localhost。確認は支給PCのブラウザで、スマホ表示は開発者ツールを使う。 [事実、rule.md 2・3]
- 保存先は `C:\AI-Sprint\workspace\MC-0xx\` 配下。 [事実、rule.md 4]

## 未決
- Node.js のバージョン、ポート番号、seed 生成コマンドの記載。 [要確認] Vitest が対応する Node.js のバージョンも合わせて確認する。
- 本番ビルド(`next start`)での起動を標準とするか。
