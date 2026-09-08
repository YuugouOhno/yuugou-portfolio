# 候補1の独立AIレビュー

この文書は候補1の結果受領前の履歴。結果はその後受領し、スマホ本文の実描画検査が失敗した。現在の候補・対応・判定は [README](README.md) を参照。

2026-09-08 JST。実装担当とは別のAIが `review-frontend` と `review-security` を適用し、候補1のコードをレビューした。アプリケーションとテストは編集していない。これはAIによるレビュー記録であり、人間の成果確認・承認ではない。

## 現在の判定

コード上の追加修正必須指摘なし。候補1の `result-1.json` は未受領であり、候補1の独立視覚レビューは未実施。**試作全体の合格とは判定しない。** 既存P1の「検証結果・視覚資料の受領と独立視覚レビュー」は未解決である。

レビュー対象は作業ツリーの `src/pages/Home.js` / `Home.css`、`src/webgl/Scene.js` / `GPGPUSimulation.js` / `FishMesh.js` / `homeMotion.js` / `homeLayout.js` / `nameTargets.js`、`src/glsl/boids/home-velocity.frag` / `home-position.frag`、`src/glsl/fish/home-fish.vert`、`tests/home-motion.test.js` / `home-layout.test.js` / `home-browser.mjs`。影響確認として `src/router/Router.js`、`src/style.css`、`src/components/App.css`、`package.json` と既存レビュー・検証記録も参照した。候補スナップショットは `/private/tmp/yuugou-task1-review/candidate-1`。ソース照合とテスト実行結果は実装担当の記録を参照し、このレビュー担当が実行したとは扱わない。

## コード確認

| 観点 | 評価 |
| --- | --- |
| R1 名前形成 | 初期位置に文字内の標本点を与え、正確な `YuugouOhno`、狭幅で `Yuugou` → `Ohno` の文字順を維持。ローカルフォントを使用し、通常HTMLのh1も提供する。判読性は候補画像の確認が必要。 |
| R2 解放・本文 | 実スクロール進捗を平滑化し、位置の置換ではなく力を補間。速度・加速度上限、最低速度の強制なしを確認。本文の魚サイズを文字倍率から独立させ、横へ泳いでから奥へ進む誘導も連続した式になっている。 |
| R3 解放の保持 | Home滞在内の解放ラッチは上スクロールと動き設定変更を越えて保持する。深い初期位置では解放済みの側方分布から開始する。 |
| R4 通常閲覧 | HTML挿入後にSceneを遅延読込。実スクロールと通常アンカーを使い、canvasは入力を遮らない。本文の不透明背景が文字・リンクの背後を保護する。 |
| R5 代替表示 | reduced-motionではSceneを起動せず、WebGL・float target・シェーダー・context loss等の失敗時は破棄してHTMLを残す。 |
| R6 リソース | 世代番号で遅延importの古い起動を防止。RAF、ResizeObserver、visibility/context listener、geometry/material、GPU texture/target、rendererの破棄を確認。resizeは既存状態とuniformを使う。 |
| R7 検査の妥当性 | release境界・ラッチ・時間差・文字順・投影の単体検査がある。ブラウザ検査は実際のcanvas描画から本文等のmask外の可視ピクセルを数えるため、GPU中心位置だけの検査不足を改善している。 |
| セキュリティ | 今回のHomeコードに外部入力のHTML挿入、新しい機密情報、API、送信処理はない。固定HTMLと外部リンクの `noopener noreferrer` を確認。追加指摘なし。 |

## 視覚確認の実施範囲

以下の**修正前**の画像2点を実際に開いて確認した。候補1の画像ではなく、候補1の成功証拠には使用しない。

- [旧モバイル文字形成](evidence/before-mobile-emulated-formation.png): 魚による `Yuugou` / `Ohno` の二行を読めるが、暗めである。HTMLの名前とナビゲーションは読める。
- [旧モバイル本文](evidence/before-mobile-emulated-body.png): 本文・リンクは読める一方、魚は視認できない。既存のマネージャー指摘に同意する。

候補1で確認すべき点は、PCとスマホエミュレーションの文字形成、連続スクロール中のほどけ方、本文到達時と30秒後の魚の判別性、本文・リンクを妨げない密度と位置である。20 CSS pxの描画閾値は描画存在の補助であり、魚の判別性・名前の読みやすさ・遷移の自然さを保証しない。返却画像と連続記録を確認後、この文書に結果を追記する。

## 未確認事項

候補1のPC/スマホ実ブラウザ検証結果と視覚資料は未受領。物理スマホ、Safari/Firefox、実機AR、長時間の発熱・メモリー、本番の第三者スクリプト込みの性能は未確認。スマホエミュレーションを実機確認として扱わない。人間による成果確認、承認、マージは実施していない。

## 再開後の独立コードレビュー（2026-09-08 14:38 JST）

別AIエージェント `/root/independent_review` が `review-frontend` / `review-security` を適用し、候補1のHome・Scene・GPU・魚シェーダー・release/layout・ブラウザ検査を再確認した。追加の修正必須コード指摘はない。HTML先行表示、文字順、力の連続補間、解放ラッチ、深い位置の初期化、代替表示、破棄と遅延起動競合対策を確認した。

同レビュー担当は、描画面積20 CSS px以上という検査では魚としての判別性を保証できず、候補の画像・連続記録を用いた独立視覚レビューが必要との判断を維持した。14:57 JSTまで結果は未受領で、視覚レビューは実施できていない。既存P1は未解決。このレビューを人間の成果確認・承認とは扱わない。
