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
- 動作は localhost。確認は支給PCのブラウザで、スマホ表示は開発者ツールを使う。 [事実、rule.md 2・3]
- 保存先は `C:\AI-Sprint\workspace\MC-0xx\` 配下。 [事実、rule.md 4]

## 未決
- Node.js のバージョン、ポート番号、seed 生成コマンドの記載。 [要確認]
- 本番ビルド(`next start`)での起動を標準とするか。
