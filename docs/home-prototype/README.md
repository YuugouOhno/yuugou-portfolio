# Home 魚群試作の実装・検証

2026-09-08 JST。ブランチ `workspace/05922c6c-0221-4802-8e56-19a09e581142`。

通常のHTMLを先に表示し、実際の魚メッシュとGPU Boidsで `YuugouOhno` を形作る。縦スクロールで文字拘束を解き、一度解放した群れはHome滞在中に再集合しない。本文は短いプロフィール試作で、魚が左右の余白を泳ぐ。

現在は候補3のマネージャー実ブラウザ結果を待っている。 15:18 JSTの共有後、指定の20分を超えて約28分確認したが、候補3の画像・結果は未受領。[引渡し記録](evidence/manager-handoff-candidate-3.json) / [待機記録](evidence/manager-wait-candidate-3.json) / [現在の状態](evidence/browser-results.json)。既存P1は最終候補の視覚資料・独立視覚レビューが未完了のため継続中。候補1はスマホ本文の視認性検査で失敗。候補2は全検査を通ったが、独立AI視覚レビューで到達直後の見え方に追加調整を求められた。人間の成果確認は未実施。

## 差分と判断

[今回の修正差分](evidence/margin-departure.diff) / [試作全体の差分（f2d8b46基準）](evidence/prototype.diff) / [判断記録](margin-departure-decision.md)

| 対象 | 最終候補での変更 |
| --- | --- |
| `home-velocity.frag` | 文字位置から近い側の余白へ誘導。側方目標は現在の奥行きで投影し、本文の外縁まで奥への移動を遅らせる。横方向の力を独立して計算し、遠い奥行き目標に横移動が負ける問題を修正。速度・加速度の上限6とBoidsを維持。 |
| `home-fish.vert`, `FishMesh.js` | 魚サイズを文字位置からの実移動距離で連続補間。横へ泳ぐ間も文字用の小さな描画が残る問題を修正。初期文字位置や位置積分は維持。 |
| `GPGPUSimulation.js` | 深いスクロール位置での初期配置も文字目標の左右へ揃え、起動後の不要な本文横断を防止。 |

本文のレイアウト・背景・原稿・リンク、検査の可視ピクセル閾値は変更していない。依存追加もない。[影響範囲の照合](evidence/unrelated-source-verification.json)で、AR・ForLLM・ルーター・共有シェーダー・lockfile・共通CSSは `f2d8b46` から差分なし。実機ARの検証を意味しない。

## レビュー差し戻しと対応

| 指摘 | 対応・証拠 |
| --- | --- |
| P1: 同一候補の実測画像と結果が未受領。スマホ本文の魚が見えない。 | 指定の `ready.json` / `result-N.json` 手順を使用。候補1の[返却結果](evidence/candidate-1/manager-result.json)を受領し、[実描画3.11 CSS pxでの失敗](evidence/candidate-1/browser-results.json)と[本文画像](evidence/candidate-1/mobile-emulated-body.png)を保存。 |
| 候補2: 検査成功だけでは視認性が弱い。 | [結果](evidence/candidate-2/browser-results.json)では26.67 CSS px。[本文画像](evidence/candidate-2/mobile-emulated-body.png)を別AIが実際に開き、6〜7匹の点に留まり取得時刻や乱数による揺れにも弱そうだと指摘。候補3で側方移動と奥へ進むタイミングを修正。 |
| 深い初期位置で左右割り当てが新しい誘導と不一致。 | 候補3で初期配置も `targets[offset]` の符号を使用。独立AIのコード再レビューで対応を確認。 |

[今回の独立AIコード・視覚レビュー](independent-visual-review.md) / [以前のコードレビュー](ai-review.md) / [候補1のコード再レビュー（履歴）](independent-review-final.md)。過去の未受領期間は[待機履歴](verification-pending-history.md)に分離した。過去画像・動画や検証結果を最終候補の証拠として扱わない。

## ローカル検証

[実行記録](evidence/local-verification-final.json)。macOS、Node v22.21.1、既存node_modulesのVite 7.2.6 / three 0.152.0で実行。

| コマンド | 結果 |
| --- | --- |
| `npm test` | 8件成功。[ログ](evidence/unit-tests-final.txt)。文字順、拘束往復、解放ラッチ、深い位置、進捗境界、時間差、リサイズ投影、本文魚サイズ。 |
| `npm run build` | 成功。[ログ](evidence/build-final.txt)。既存ARの静的/動的import混在と大きなchunkの警告あり。 |
| `node --check tests/home-browser.mjs` | 成功。 |
| `git diff --check` | 成功。生成した差分資料の空白行を整形して再実行。 |

ブラウザ検査の閾値20 CSS pxは描画の存在確認の補助であり、魚の判別性や遷移の自然さは画像・連続記録を併用して判断する。アプリ・テスト等66ファイルは[候補3とのSHA-256照合](evidence/candidate-3-source-verification.json)で一致。結果受領後は文書と証拠のみを更新する。

## ブラウザ検証の再現条件

実装担当のsandboxで既知のVite/Chrome起動失敗を繰り返さず、ユーザー指定のマネージャー独立環境で補完する。権限の変更・迂回は行わない。マネージャー実行を実装担当自身のブラウザ実行とは記載しない。

```sh
npm ci --ignore-scripts
npm test
npm run build
npm run dev -- --host 127.0.0.1 --port 5180 --strictPort
# 別ターミナル。Playwrightはアプリ依存へ追加しない。
HOME_TEST_URL=http://127.0.0.1:5180 PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
```

`BROWSER_CHANNEL` は任意指定可能。検査はViteのSceneレスポンスだけを計装するため、build previewではなく開発サーバーを使う。本番コードにグローバルScene参照は追加していない。既存の第三者リモートスクリプトは検査中に遮断する。

## 残る確認と人間レビュー

物理iPhone/Android、Safari/Firefox、実機AR、モバイルアドレスバー伸縮、長時間の発熱・メモリー、本番の第三者スクリプト込みの性能は未確認。Chromeのスマホエミュレーションを実機検証とは扱わない。

コンセプトの同意と成果物の確認は別。人間には最終候補の画像・連続記録で、名前の読みやすさ、ほどけ方、本文での魚の控えめな見え方を確認してもらう。PR公開はホストが担当する。実装担当はpush・公開・マージ・デプロイ・保護設定変更、人間の成果確認の代行を行っていない。

## 受入条件の対応

| ID | 実装と検証資料 |
| --- | --- |
| R1 | `nameTargets.js` の初期文字位置、`homeMotion.js` の `YuugouOhno` / `Yuugou` → `Ohno`、`Home.js` の通常HTML見出し。名前順とリサイズの単体検証。最終PC/スマホ画像で判読性を確認する。 |
| R2 | `Scene.js` が実スクロール位置を読み、`home-velocity.frag` / `home-position.frag` が力の補間・速度上限・位置積分を継続。最終候補の本文画像・30秒後画像・連続スクロール記録で確認する。 |
| R3 | `advanceRelease` の滞在内ラッチと深い初期位置。単体検証。ブラウザ検査は逆スクロール、deep reload、ページ内アンカーで状態を確認。 |
| R4 | HTML先行、通常スクロール・アンカー、入力を遮らないcanvas、不透明な本文背景。ブラウザ検査はwheel/touch/PageDown、リンク、横幅を確認。 |
| R5 | reduced-motionでは演出省略。WebGL・float target・shader・context loss時もHTMLを維持。各失敗を注入するブラウザ検査。 |
| R6 | HomeがSceneを所有し、世代番号で古い起動を破棄。RAF・Observer・listener・GPU・rendererを破棄。ブラウザ検査はリサイズ時のGPU位置維持、ForLLM往復3回、AR往復、Scene数を確認。AR/ForLLMソース差分なし。 |
| R7 | build成功、8単体検証成功。実ブラウザのコマンド・環境・結果・画像を記録し、スマホエミュレーションと物理端末を区別する。 |
| R8 | 別AIのコード・視覚レビュー、指摘と対応、全体/今回の差分、同一候補の画像・動画を提示する。人間の成果確認とマージは実施しない。 |
