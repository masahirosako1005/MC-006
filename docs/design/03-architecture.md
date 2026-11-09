# 03 システム構成・技術・ディレクトリ

## 目的
システム構成、使用技術と選定理由、ディレクトリ構成、既存システムとの関係を定める。

## 含める内容
- システム構成図(localhost 完結の構成)
- 使用技術と選定理由
- ディレクトリ構成
- 既存システム(Raund)との関係
- アプリ内の取り決め(API 相当)

## 現時点で分かっていること

### 構成・技術
- アプリは `app/` に置く。Next.js / TypeScript。 [事実、AGENTS.md 1]
- データは `sample-data/*.csv` から `app/scripts/build-seed.mjs` で `app/src/data/seed.json` を生成する。 [事実、AGENTS.md 1]
- 外部API・外部DB・クラウドに実行時依存しない。ローカルミドルウェア(SQLite等)は許可されているが、採否は未決。 [決定(依存禁止)/未決(DB有無)]
  - 詳細設計の方針: 追加機能の状態はサーバーのメモリ(globalThis)に持ち、再起動で `group-seed.json` の内容に戻す。SQLite は採らない。JSON ファイルへの書き出し(永続化)は見送る。 [案、契約書 11.1・16.2、詳細設計 00]
- 既存サイトは Next.js(Pages Router)、Mantine、Zustand 等。 [事実、scratch.md 1.1] 今回の `app/` との揃え方は未確認。
- デモの `app/` は Next.js 16.4.5(App Router)、React 19.3.0、Mantine 9、Zustand、dayjs。`dev`/`build` は `--webpack` を付けて実行する。 [事実、app/package.json]
- 試験の基盤は Vitest(開発時の依存として新規に追加する唯一のライブラリ)。各モジュールは `node --test` を使わない。 [決定、判断 11。契約書 11.1・11.3]
- 地図を使う場合は、国土地理院タイル等の出典表記つき無償のもの。外部接続なしの動作との整合は運営確認またはローカルデータ代替。 [事実、rule.md 8]

### 既存システムとの関係
- 既存のバックエンド・API は見えていない。 [事実]
- 候補: (a) 既存APIに機能を足す、(b) 別サービスとして作って連携する。 [案、scratch.md 4]
- 既存は利用者がキャンペーンごとに別アカウントの可能性。 [推定] 横断機能の前提になる。
- 新機能はキャンペーン単位のフラグで有効化する作りが既存の方式に合う。 [推定]
- デモの `app/` の中では、既存のモック API(`/api/v2`)と既存のストア(`server-store.ts`)を変更せず、追加機能は別の名前空間(`/api/groups` ほか)と別のストア(`groups-store.ts`)で作る。 [案、詳細設計 README]

### ルーティング方式(アプリ内の API)
- Route Handler をリソースごとの `route.ts` で作る。キャッチオール(`[...path]`)とハンドラの登録表は作らない。 [案、契約書 2.1]
- 各モジュールは `features/<モジュール>/handlers.ts` に、共通基盤(00)の `route()` で包んだハンドラを置き、`app/api/.../route.ts` は再エクスポートだけを書く。 [案、契約書 2.1]
- 複数モジュールを組み合わせる処理(グループの作成 `POST /api/groups`、グループ詳細 `GET /api/groups/[groupId]`)は、合成層 `features/groups/compose/handlers.ts`(所有 01)に置く。合成層は他のモジュールから import されない。 [案、契約書 2.1・5.1・5.5]
- フォルダの規則: `_` で始まるフォルダを作らない(R-1。Next.js ではルーティングの対象外になる)。新設するフォルダでは、同じ階層に静的セグメントと動的セグメントを並べない(R-2)。動的セグメント名はグループが `[groupId]`。 [事実(R-1 の根拠は Next.js 16.4.5 のガイド)/案(規則)、契約書 2.1]
- HTTP メソッドは、取得 GET、作成 POST、全置換 PUT、部分更新 PATCH、削除 DELETE、状態遷移の操作は POST の動詞サブパス(`approve`、`withdraw`、`cancel` など)。変更系は `Content-Type: application/json` を必須とする。 [案、契約書 2.3]
- API の一覧は契約書 2.2。デモ用の操作(ユーザー切替、日付の操作、初期化)は `/api/demo/*`。 [案、契約書 2.2]

### ディレクトリ構成
- 現状のリポジトリ: `app/`、`docs/`、`rule/`、`sample-data/`。
- 追加機能の構成(新規のみ。既存ファイルは `next.config.ts` へのヘッダー追加を除いて変更しない)。 [案、詳細設計 00・README]

```
app/
  vitest.config.ts                 試験の設定
  next.config.ts                   (既存)セキュリティヘッダーを追加(07 章)
  src/
    data/group-seed.json           追加機能のダミーデータ(手書き。実在個人の情報なし)
    lib/                           共通基盤(00): ストア、ID、検証、エラー、時計、route()、イベント、クライアント
    features/
      bootstrap.ts                 各モジュールのフック・イベント購読の登録
      groups/                      01 グループ中核(types.ts、core/)
        compose/                   合成層(作成・詳細。所有 01)
        discovery/                 02 グループ探索
        join/                      03 参加申請・承認
        lifecycle/                 04 実行条件・状態遷移
        plan/                      05 旅程・集合場所メモ
        chat/                      06 グループチャット
        expense/                   07 費用の分担メモ
        rally/                     08 グループ・スタンプラリー
      safety/                      09 安全
      notify/                      10 通知
      entry/                       11 入口B
      official/                    11 公式枠・地元の同行枠
      stats/                       12 自治体向け集計
    app/
      api/                         Route Handler(再エクスポートのみ)
      [campaign]/                  画面(groups、new-group、invite、notifications、entry、external-links、admin、mypage)
    components/groups/common/      共通の画面部品
    test/                          試験の共通部品(setup、fixtures)
```

- 観光事業オーナー向け機能(詳細設計 13)のフォルダは、13 の設計書で定める。 [未決]

## 未決
- **既存システムとの関係**(上記 a/b、または今回は独立デモとして扱うか)。 [未決、オーナー判断]
- DB の有無(seed.json のメモリ/ローカル保存のみか、SQLite 等を使うか)。 詳細設計はメモリのみの案(上記)。
- 使用技術の選定理由の記述(競技では既存に合わせるのが理由になるか、実際の package.json で確認が必要)。 [要確認] バージョンは 08 章に記載した。
- API 設計の扱い(アプリ内ルートとして章立てするか)。 詳細設計では契約書 2.2 を API の一覧とした。
- Next.js 16 の仕様の確認(静的・動的セグメントの解決順、Route Handler とキャッシュの挙動など)。設計の判断ではなく、実装の着手時に `app/node_modules/next/dist/docs/` で確認する。 [要確認、契約書 14.2]
