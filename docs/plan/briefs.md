# サブエージェントへのブリーフ

窓口は、次の雛形の `<...>` に `tasks.md` のタスクのブロックを差し込んで、サブエージェントを起動する(`isolation: "worktree"`、バックグラウンド)。

## 1. 雛形

```
あなたはタスク <P-x-y> <タスク名> の実装担当。ブランチは agent/<名前>(worktree 分離済み)。

## 目的
<tasks.md の「内容」>

## 対象(このファイル以外は変更しない)
<tasks.md の「対象」>

## 前提
- 前提タスク: <tasks.md の「前提」>(マージ済み)
- 設計の参照: <tasks.md の「内容」の設計参照>。名前・パス・署名・値は契約書 docs/feature/_unified-contracts.md が正。
- 画面モック: <tasks.md の「画面」。無ければ省略>

## 完了条件
<tasks.md の「完了条件」>
ゲート: G-T = `npm test -- <対象>`、G-B = `npx tsc --noEmit` と `npm run lint` と `npm run build`(app/ で実行)。

## 守ること
docs/plan/briefs.md の「2. 共通の注意」に従う。

## 報告(500 字以内)
1. 変更したファイル
2. 実行したコマンドと結果(失敗した試験は出力の要点を添える)
3. FollowUp(形式: `- [ ] 内容 / <P-x-y> / 重大度(高・中・低)`)
4. 未確認事項
```

## 2. 共通の注意

### 環境
- 作業は `app/` で行う。最初に `npm ci` を実行する(worktree では `node_modules` が共有されない)。
- Next.js 16 は従来と異なる。ページ・Route Handler・Cookie を書く前に `app/node_modules/next/dist/docs/` の該当ガイドを読む。
- 実行時に外部 API・DB・クラウドを使わない。新しい npm 依存は追加しない(Vitest は P-0-1 が追加済み)。

### 範囲
- 「対象」に書かれたファイルだけを変更する。`route.ts`、`features/bootstrap.ts`、他モジュールのファイル、`group-seed.json`(P-0-3 以外)は変更しない。変更が必要なら FollowUp に書く。
- P-0-2 が置いたスタブ(`throw new Error("not implemented")`)を本体に置き換える。公開する名前と署名は変えない。
- 見送りの範囲(契約書 第 16 章、各設計の「見送り」の印)は作らない。主ルートの正常系を先に動かす。
- 同じ波の他タスクが作る関数は、試験では `vi.mock` で代替する。00 の関数は本体を使う。

### 設計との関係
- 設計書が正。設計書に無い仕様を足さない。契約書と各設計書が食い違う場合は契約書に合わせ、食い違いを FollowUp に書く。
- 判断に迷う点は、最も単純な案で進め、報告の「未確認事項」に書く(主ルートが止まる判断だけを窓口に問う)。

### 試験
- Vitest。前提データは `resetForTest()` と `fixtures.ts`(`GROUP_BY_STATUS` ほか)。試験の中で作るデータは `insertGroup`・`insertMember`・`insertBlock` と 900 番台の ID。
- 正常系と代表的な拒否 1 件程度。境界値・異常系の網羅はしない。
- 失敗した試験を隠さない。主ルートに関係しない失敗は `it.skip` にして FollowUp に書いてよい。

### 情報管理・git
- `.env*`、`Password.txt.txt` を読まない。`sample-data/` は P-0-4 だけが扱い、行の内容を出力・報告しない。
- コミット・push はしない(窓口がオーナーの承認後に行う)。`git add .`・`-A` は使わない。
- 不具合・エッジケース・見た目の修正は直さず FollowUp に書く。主ルートが止まる不具合だけを直す。
