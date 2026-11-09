# 00 共通基盤

## 1. 概要と責務 / 対応する柱
- 全モジュールが使うデータストア、seed、ダミーユーザー、現在ユーザー解決、検証、エラー型、日時(clock)、API 共通処理を提供する。柱の直接対応なし(全体)。 [案]

## 2. 既存機能との関係
- 拡張(並置): 既存 `src/lib/server-store.ts`(インメモリ+seed.json から初期化)と同じ方式で `groups-store.ts` を新設。既存の `/api/v2` モックと `server-store.ts` は変更しない。 [案]
- 流用: `src/lib/api.ts` の `api` / `post` / `useApi`、`seed.json`(キャンペーン、スポット、特典)。

## 3. 画面・UI
| 画面 | 04 章の項目 | パス案 |
|---|---|---|
| デモユーザー切替(モック表示つき) | UI 方針「モックを画面上で明示」 | `AppShell` 内の小メニュー |
| リセット(デモ初期化) | - | `POST /api/groups/_reset` |

## 4. データ(05 章)
| エンティティ | 項目 | 保存先 |
|---|---|---|
| DemoUser(ダミーユーザー) | id、表示名、年代帯、地方、公開設定の初期値(05 のプロフィール) | `group-seed.json` |
| Store | groups、members、joinRequests、plans、messages、expenses、groupStamps、reports、blocks、notifications | globalThis インメモリ [案] |
- ID は `g-001` 形式等の短い英数字 [案]。招待コードは別途(01)。
- [未決] 永続化(JSON/SQLite)の要否、利用者識別の範囲(05 章の未決)。

## 5. インターフェース(案)
| 名称 | 入力 | 出力 | 呼び出し元 |
|---|---|---|---|
| `store()` / `resetStore()` | - | Store | 全 service |
| `currentUser(req)` | Request(Cookie) | DemoUser | 全 Route Handler |
| `validate(schema, input)` | 値 | 成功値 or `AppError(invalid_input, fields)` | Route Handler |
| `AppError(code, message, status)` / `toResponse(e)` | - | `{error, message, fields?}` | Route Handler |
| `clock.now()` / `clock.set(iso)` | - | Date | 04(締切)、通知、チャット |
| `newId(prefix)` | - | 文字列 | 各 service |

## 6. 状態遷移
- なし。

## 7. 入力検証・セキュリティ
- 検証ライブラリは追加しない(依存最小)。自前の小さな検証関数で足りるか、zod を採るか [未決](採る場合は OSS ライセンス確認、08 章)。
- 文字列は長さ上限と制御文字の除去、ID は許可文字のみ、Cookie `demoUser` は seed 内の ID に存在するものだけ受理。
- `clock.set` と `_reset` は開発/デモ用。`NODE_ENV=production` では無効にするか、画面上で「デモ用」と明示 [案]。
- XSS: 出力は React の既定エスケープ、HTML 挿入禁止。SQLi: SQL 不使用(SQLite を採る場合はプレースホルダ)。パス: ユーザー入力をファイルパスに使わない。

## 8. エラー処理
| コード | 条件 | 表示 |
|---|---|---|
| invalid_input | 検証失敗 | 項目ごとのメッセージ |
| forbidden / not_found | 権限なし / 非表示グループ(存在を隠す) | 一覧へ戻る導線 |
| conflict / unavailable_state | 状態不整合(定員、確定済み、中止済み) | 原因と次の行動(再企画など) |
| internal | 想定外 | 再読み込み、デモリセット案内(06 章の未決) |

## 9. 試験観点(10 章)
- 検証・エラー型の単体、リセットで seed 状態に戻る、現在ユーザー切替で視点が変わる、clock 差し替え。

## 10. 依存するモジュール
- なし(最下層)。

## 11. 未決事項
- DB/永続化の有無(03・05 章)、利用者識別(05 章)、検証ライブラリ採否、i18n(02 章)。

## 12. 実装メモ(デモ範囲)
- group-seed.json(ダミーユーザー6〜8人、公開グループ6〜10件、うち公式枠 1〜2、募集中/確定/中止/再企画の各状態を 1 件以上)とインメモリストア、Cookie 切替、リセットのみ実装する。
