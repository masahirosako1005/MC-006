# Raund（nttw-demo）サイト概要

調査対象: https://app.raund.net/nttw-demo
調査日: 2026-11-06

## 調査方法と限界

- 公開されている HTML と、そこから読み込まれる JS チャンク 27 個（約 3.3MB）を静的に解析しました。
  - 各ルートへの GET は 1 秒間隔で行いました。
  - API は `GET /api/v2/menus` を 1 回だけ呼びました（認証なしのため 400）。
- **ログインはしていません。** ログイン後にしか見えない画面と、API のレスポンスの中身は未確認です。
- 以下の情報は JS のコードと文言から読み取ったものです。実際の挙動で未確認のものには「推定」と付けています。
- `robots.txt` と `sitemap.xml` は 200 を返しますが、中身はアプリの HTML でした。実体はありません。
- `https://docs.raund.net` は 404 でした。

## サービスの概要

**Raund** は、スタンプラリー・ポイントラリー型のキャンペーンを運営するためのマルチテナント Web アプリです。

- `https://app.raund.net/{campaign}` の `{campaign}` がキャンペーンの slug です。`nttw-demo` はそのデモ用キャンペーンです。
- 環境変数 `NEXT_PUBLIC_CAMPAIGN_SLUG` と `NEXT_PUBLIC_SERVICE_NAME` で動作を切り替えます。
- UI 文言とバリデーション文言は日本語、簡体字中国語、繁体字中国語の 3 言語です（推定。多言語対応は `多言語対応フラグ` で切り替え）。
- 利用者はスマホブラウザを想定しています。ボトムナビゲーション、右スワイプ操作、カメラ（QR・AR）を使います。

トップ画面のメニューは「ホーム」「ホームスポット」「GET特典履歴」の 3 項目です。

## 技術構成

| 項目 | 内容 |
|---|---|
| フロントエンド | Next.js（Pages Router、SSG。buildId `20260604140151`）、Turbopack、Mantine、Zustand |
| 地図 | MapLibre GL（タイルは `tiles.raund.net`、`protomaps.github.io`）、Google Maps API |
| 配信 | CloudFront + S3 |
| API | `https://api.raund.net/api/v2/...`（一部 `/api/v1/tracking`） |
| 認証 | `https://auth.raund.net/{campaign}/...`（Cookie ベース。トークンのリフレッシュあり） |
| アセット | `assets.raund.net`、プライベート S3 バケット（ap-northeast-1） |
| 計測・広告 | Google Analytics / GTM、Facebook、LINE Tag、Google Ads |
| 外部連携 | LINE ログインと友だち追加、Giftee（ギフト受取）、PayPay ポイント交換、マイナビ進学 |

セキュリティヘッダ（CSP、HSTS、X-Frame-Options: DENY など）は設定済みです。CSP の `connect-src` にあるドメインにしか通信できません。拡張機能で別 API を呼ぶ場合は、この制約に注意してください。

## ページ（ルート）一覧

ルートは `/[campaign]/...` の形です。以下は `/nttw-demo` を基準にした実測結果です。

| パス | HTTP | 内容（コードと文言からの推定を含む） |
|---|---|---|
| `/` | 200 | ホーム。キャンペーン紹介、ポップアップ、スタンプ・ポイントカードの一覧 |
| `/spots` | 200 | スポット一覧。地図とリストの切替、現在地順、エリアや条件での絞り込み、「行きたい」登録 |
| `/spots/detail` | 200 | スポット詳細。獲得可能なスタンプ・ポイント、クーポン、音声ガイド、フォトフレーム、SNS 共有、写真投稿 |
| `/rewards` | 200 | 特典一覧。応募、抽選、交換 |
| `/rewards/detail` | 200 | 特典詳細。応募フォーム、確認、完了の流れ |
| `/mypage` | 200 | マイページ。獲得状況、履歴、アカウント設定 |
| `/news`、`/notice` | 200 | お知らせの一覧と詳細 |
| `/rule`、`/service` | 200 | 利用規約、サービス説明（`/service` は特定商取引法の表記 HTML を表示する可能性あり） |
| `/qr`、`/qrerror` | 200 | QR コードによるスタンプ獲得と、そのエラー画面 |
| `/reset`、`/resetfinish` | 200 | 獲得データのリセットと完了画面 |
| `/restore` | 200 | 復元用 QR によるデータ復元 |
| `/pointHistory` | 200 | ポイント履歴 |
| `/inquiries` | 200 | お問い合わせフォーム |
| `/products/tickets` | 200 | チケット・コース購入 |
| `/mynavi/exchange`、`/mynavi/point-history` | 200 | マイナビ進学ポイントの交換と履歴 |
| `/[campaign]/mynavi` | 未確認 | マイナビ進学の学校検索（オープンキャンパス日程） |
| `/terrain`、`/payment`、`/reservation`、`/overdraw`、`/inquiries/confirm`、`/ocr/form`、`/ocr/receipt` | **404** | JS に名前はありますが、このキャンペーンでは存在しません。別キャンペーンのルートか、内部状態名の可能性があります |

注意:

- 未ログインでも多くのルートは 200 を返します（SSG の殻だけ返っています）。データの取得とログイン判定はクライアント側 JS が API で行います。
- 200 が返ることと、未ログインで中身が見えることは別です。

## 主な機能

### 1. ラリー（スタンプ・ポイント）

- シート（カード）に、スタンプまたはポイントが貯まります。1 枚たまると新しいカードが追加されます。
- 獲得方法は複数あります。
  - **QR コード**読み取り
  - **バーコード**読み取り
  - **キーワード**入力
  - **GPS**（現在地が範囲内かの照合。「取得距離範囲外です」エラー）
  - **クイズ**回答（`/stamps/{id}/quizzes`。1 日の回答回数に上限）
  - **レシート OCR**（撮影した画像を OCR にかけ、条件が合えば獲得。失敗時は「補填申請」）
  - **ジオフェンス**（`/geofence-areas`）
- 獲得に制限をかけられます。
  - 1 日 1 回、週 1 回、期間外、営業時間外
  - 他の条件の達成が必要（「すべて満たす」「いずれか N 件」）
  - ログイン必須
  - チケット購入またはコース購入が必須
- 「リセット」で再参加できます。リセット前に特典へ応募する必要があります。キャンペーンごとに無効化できます。

### 2. スポット

- スポットごとに、位置情報、メイン画像、獲得可能なスタンプ・ポイントを持ちます。
- クーポンは、スポット単位で使用済みにします。スタッフに画面を見せ、右スワイプで使用する操作です。
- 他に、音声ガイド、フォトフレーム付き AR カメラ、写真投稿（他の利用者のスポット詳細にも表示）、SNS 共有（タップ数を計測）があります。
- 「行きたい」への登録で絞り込めます。

### 3. 特典

- 特典の受け取り方は 4 種類あります。
  - 獲得（条件を満たすと自動で付与）
  - 応募（応募フォームにお届け先などを入力）
  - 抽選（はずれあり。演出画像を設定可能）
  - 交換（ポイントを消費）
- 受け取り方法として **Giftee ギフト**、**PayPay ポイント**（メールアドレスが必要）、QR 特典（`/qr-rewards/{id}/acquire`）があります。
- 特典の API は次のとおりです。
  - 一覧: `/rewards`、`/user/rewards`
  - 取引: `/user/reward-transactions`（応募フォーム、交換、フォトフレーム）

### 4. アカウントとデータ引き継ぎ

- 会員登録・ログインは、メールアドレス（6 桁の認証コードで確認）、アカウント名とパスワード、LINE ログインから選べます。
- 「あとから登録する」が可能で、未登録のままでも利用できる設計のようです（デバイス UUID で識別。推定）。
- LINE 友だち追加を必須にできます（`force-friend`）。
- **復元機能**: 復元用 QR を保存し、別端末でアップロードして復元します。復元用 QR は 1 回しか使えません。同じユーザーへの復元はできません。
- シークレットモードとプライベートブラウズモードでは動作しません（警告が表示されます）。推奨ブラウザの案内もあります。

### 5. その他

- **アンケート**: 会員登録時、特典獲得時などのタイミングで出せます（`/questionnaires`）。
- **お知らせ・通知**: 未読管理があります（`/notifications/unread`）。
- **ポップアップ**: ホーム画面に表示します（`/popups`）。
- **チケット・コース購入**: Stripe など外部の決済セッション（`/ticket/checkout/sessions`、`/ticket/orders`）です。決済サービスは未特定です。
- **マイナビ進学連携**: 学校名・学問・職種・エリア・日程での検索と、ポイント交換を提供します（`/mynavi/colleges`、`/mynavi/study-fields`、`/mynavi/job-categories` など）。
- **お問い合わせ**: フォームを送信します。

## キャンペーン設定（フラグと設定項目）

JS に API スキーマの説明文が含まれており、キャンペーンごとの設定項目が読み取れます。

- 機能フラグ:
  - EC 機能
  - 復元機能
  - 多言語対応（言語切替 UI）
  - テストモード
  - イベント期間の表示
  - LINE 友だち追加ボタンの表示、LINE 友だち追加の強制
  - QR・バーコード・キーワード押印時の GPS 照合
- 見た目:
  - メインカラー、サブカラー
  - スタンプの形状、未取得時のスタンプ画像
  - キャンペーントップ画像、マップピン画像
  - スタンプカード一覧の表示形式、スポット詳細と特典詳細のメイン画像の表示モード
- 期間:
  - 開始・終了日時、表示開始・表示終了日時、スタンプ押印可能期間
  - 期間前メッセージ HTML、期間後メッセージ HTML
- 地図: マップ中心座標、画像マップ（イラストマップ）、マップキャプション
- 公式 SNS リンク、特定商取引法に基づく表記 HTML

## API 一覧（JS から抽出）

ベース: `https://api.raund.net/api/v2`。以下はパスだけを確認したもので、リクエストとレスポンスの形式は未確認です。

| 区分 | エンドポイント |
|---|---|
| キャンペーン・共通 | `/campaign`、`/menus`、`/popups`、`/master/update/check`、`/sheets`、`/coupons/{id}` |
| スポット | `/spots`、`/spots/{id}?lat&lon`、`/spots/{id}/coupons`、`/spots/{id}/coupons/{couponId}`、`/spots/{id}/audio-guides`、`/spots/{id}/photo-frames`、`/spots/{id}/share-sns`、`/spots/{id}/share-sns/taps` |
| スタンプ | `/stamps/{id}`、`/stamps/{id}/quizzes`、`/stamps/{id}/quizzes/{quizId}/answer` |
| ユーザー | `/user`、`/user/sheets`、`/user/stamps`、`/user/stamps/{id}`、`/user/activities`、`/user/recovery`、`/user/reset` |
| 特典 | `/rewards`、`/rewards/{id}`、`/qr-rewards/{id}`、`/qr-rewards/{id}/acquire`、`/user/rewards`、`/user/rewards/{id}`、`/user/reward-transactions`、`/user/reward-transactions/{id}/application-form`、`/user/reward-transactions/{id}/exchange`、`/user/reward-transactions/{id}/photo-frames` |
| 購入 | `/products`、`/ticket/checkout/sessions`、`/ticket/checkout/sessions/{id}`、`/ticket/orders` |
| OCR | `/ocr/scan/request`、`/ocr/scan/request/{id}` |
| 通知・アンケート | `/notifications`、`/notifications/unread`、`/notifications/{id}`、`/questionnaires`、`/questionnaires/{id}`、`/questionnaires/type/{type}` |
| ジオフェンス | `/geofence-areas`、`/geofence-areas/{id}/events` |
| マイナビ | `/mynavi/areas`、`/mynavi/college-types`、`/mynavi/colleges`、`/mynavi/colleges/search`、`/mynavi/colleges/filter`、`/mynavi/colleges/filter/count`、`/mynavi/colleges/{id}`、`/mynavi/study-fields`、`/mynavi/job-categories` |
| 計測 | `/api/v1/tracking` |

認証 API は `https://auth.raund.net/{campaign}/` 配下です。

- `auth/check`
- `auth/logout`
- `token/refresh`
- `reauth?return_to=`
- `account/password`
- `line/authorize/force-friend`
- メール関連（`email`、`email/check`、`email/verify`、`email/resend`）

## 追加機能を作るときの注意

- フロントは SSG で、データは全てクライアントから API で取ります。追加画面は `pages/[campaign]/...` に足す形になるはずです。
- ソースコードは入手していません（取得したのは公開バンドルのみ）。実装方針を決める前に、リポジトリへのアクセス権があるか確認してください。
- 認証は Cookie ベースで、`auth.raund.net` と `api.raund.net` を使います。別オリジンから呼ぶと CORS と CSP で止まる可能性が高いです。
- `nttw-demo` はデモ用です。本番キャンペーンとは設定が違う（例: 404 になるルートが存在する）可能性があります。

## 未確認事項（次にやること）

1. ログイン後の画面を確認します（テスト用アカウントがあるか依頼元に確認）。
2. 各 API のリクエストとレスポンスの形式を確認します（API 仕様書があるか確認）。
3. `/[campaign]/mynavi` の挙動と、404 だったルートがどのキャンペーンで有効かを確認します。
4. 決済サービスの種類、OCR の提供元、リポジトリの場所を確認します。
5. このデモサイトに対する調査・負荷の許容範囲を、依頼元に確認します。
