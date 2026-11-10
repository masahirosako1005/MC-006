# 地図データの出典・ライセンス

- 採用: 国土地理院「地球地図日本」(Global Map Japan 2016)の行政界(polbnda_jpn)を、npm パッケージ `jpn-atlas` 1.0.2(TopoJSON, 作者 Dan Henri, BSD-3-Clause)経由で取得。
- URL: https://www.npmjs.com/package/jpn-atlas (https://unpkg.com/jpn-atlas@1.0.2/japan/japan.json)、元データ https://www.gsi.go.jp/kankyochiri/gm_jpn.html
- ライセンス: 元データは「国土地理院コンテンツ利用規約」(公共データ利用規約 第1.0版 PDL1.0、CC BY 4.0 互換)。出典明記と加工の旨の表示で、商用利用・改変・再配布が可能。jpn-atlas 自体は BSD-3-Clause(著作権表示 "Copyright (c) 2018, Dan Henri")。
  - 出典表記例: 「出典:国土地理院ウェブサイト」/加工時「「地球地図日本」(国土地理院)をもとに作成」
- 取得日: 2026-11-10
- 加工内容: TopoJSON から都道府県ポリゴンのみを抽出(投影済み座標 850x680 系のまま)、微小ポリゴンの除去、Douglas-Peucker による簡略化、小笠原諸島の除外、沖縄県を左下の枠内位置へ平行移動、都道府県コード(data-pref)・地方区分の付与、SVG path 化。TS データ `app/src/components/japan-map-data.ts`(約 96KB)に埋め込み。スクリプト・script・外部参照は含まない(数値の path のみ)。
- 画面表示: 地図の下に「地図: 国土地理院「地球地図日本」(公共データ利用規約 第1.0版・CC BY 4.0 互換)をもとに加工」を表示。
- 不採用: geolonia/japanese-prefectures(GFDL。コピーレフトで扱いが重い、小笠原省略)、FreeSVG の都道府県図(出典・精度が不明確)。
- 未確認: 測量法上の承認要否(デモ用途。F-211)。
