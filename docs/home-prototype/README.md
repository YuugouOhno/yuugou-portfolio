# Home 魚群試作の実装・検証記録

2026-09-08 JST。対象ブランチ: `workspace/05922c6c-0221-4802-8e56-19a09e581142`。

Homeは通常のHTMLを先に表示し、魚の実メッシュとGPU Boidsで `YuugouOhno` を形作る。通常の縦スクロールで文字拘束を解き、一度解放した群れはそのHome滞在中は再集合しない。本文は魚が左右の余白と奥へ泳ぐ短いプロフィール試作。

今回の差し戻しでは、マネージャーの実ブラウザ画像で判明したスマホ本文の魚の視認性を修正した。候補1は共有後20分超、約30秒間隔で結果を確認したが `result-1.json` は未着。今回候補のブラウザ検証と視覚的受入は未完了で、R1・R2・R7・R8を完了扱いにしない。人間の成果確認は未実施。PR公開はホストが担当し、実装担当はpush・公開・マージ・デプロイ・保護設定変更を行っていない。

## 変更とレビュー資料

[今回の差分](evidence/mobile-visibility.diff) / [試作全体の差分（f2d8b46基準）](evidence/prototype.diff) / [判断記録](mobile-visibility-decision.md) / [独立AIレビュー](ai-review.md)

P1差し戻し後の[独立AI再レビュー](independent-review-final.md)も実施済み。コード上の追加修正必須指摘はないが、候補1の視覚レビューは未実施であり、既存P1は未解決。

| 対象 | 変更と理由 |
| --- | --- |
| `homeLayout.js`, `FishMesh.js`, `home-fish.vert` | 文字形成用の倍率から本文の魚サイズを独立。横向きの最小の魚は近方で約3 CSS px、遠方で約1.6px。初回の画面幅やリサイズで本文の魚が過小にならない。サイズは実際の深度に応じて連続補間する。 |
| `home-velocity.frag` | 遠方目標へ直線的に向かう間、スマホ本文の保護面に隠れ続ける問題を軽減するため、実位置の左右比で奥への誘導を調整。既存Boids、速度・加速度上限、位置積分を保持する。 |
| `home-fish.vert` | Homeの魚の色を1.35倍に調整し、薄かったスマホの文字を補助。ARが参照する共有fragmentは変更しない。 |
| `tests/home-layout.test.js` | 初回画面と変更後画面の16通りで、近方・遠方の魚の投影サイズを検証。既存の文字範囲・xyz投影テストも維持。 |
| `tests/home-browser.mjs` | GPU座標に加えて、実際に描画された三角形をcanvasから取得。本文・ヘッダー・フッターで隠れる領域を除いた可視ピクセルを検査。本文到達時と30秒後の画像・検査を追加。 |

本文背景、原稿、リンク、AR・ForLLM・ルーター・依存定義・lockfileには今回の変更なし。試作全体でもAR・ForLLMの機能と掲載内容は変更していない。

## ローカル検証

| 検証 | 結果 |
| --- | --- |
| `npm test` | 差し戻し後の再実行でも8件成功。[今回結果](evidence/unit-tests-final.txt)。文字順、拘束往復、解放ラッチ、深い初期位置、進捗境界、時間差、リサイズ投影と本文魚サイズ。 |
| テスト先行 | 新しい魚サイズ検査を先に追加し、未実装時の失敗を確認。[Red結果](evidence/body-size-red.txt)。 |
| `node --test --experimental-test-coverage tests/*.test.js` | `homeLayout.js`・`homeMotion.js` のline/branch/function 100%。[結果](evidence/unit-coverage.txt)。GLSL・DOM・GPUはこの割合に含まない。 |
| `npm run build` | 差し戻し後の再実行でも成功。[今回出力](evidence/build-final.txt)。既存ARの静的/動的import混在と大きなchunkの警告あり。 |
| `node --check tests/home-browser.mjs` | 成功。 |
| `git diff --check` | 成功。ログ出力の行末空白のみ整形。 |

ローカル環境: macOS、Node v22.21.1、Vite 7.2.6、three 0.152.0。既存node_modules使用。ブラウザはユーザー指定のマネージャー環境で補完し、実装担当によるsandbox権限変更・サーバー起動制約の迂回は行わない。

差し戻し後の[検証実行記録](evidence/local-verification-final.json)を保存。候補1のアプリ・テスト・設定・静的ファイル66件は作業ツリーとバイト単位で一致した：[候補照合](evidence/candidate-1-source-verification.json)。AR・ForLLM・ルーター・共有シェーダー・lockfile・共通CSSは基準 `f2d8b46` から差分がない：[影響範囲の照合](evidence/unrelated-source-verification.json)。この比較は実機ARの検証を意味しない。

## 今回の再開確認（14:37〜14:57 JST）

2026-09-08、候補1の `ready.json` を14:37 JSTに更新し、30秒の待機を挟みながら20分超確認したが、`result-1.json` は未受領だった。[今回の待機記録](evidence/manager-wait-resumed.json)。候補ディレクトリへの依存導入は確認できたが、候補の画像・ブラウザ結果は取得していない。**既存P1は未解決であり、人間の成果確認を求められる状態には達していない。**

`npm test` は8件成功、`npm run build` 成功、ブラウザ検査スクリプトの構文確認と `git diff --check` も成功：[今回の実行記録](evidence/local-verification-resumed.json)。候補1と作業ツリーのアプリ・テスト等66ファイルが一致することを再確認した：[ソース照合](evidence/candidate-1-source-verification.json)。別AIによるコード再レビューでも追加の修正必須指摘はなかったが、候補の独立視覚レビューは未実施。

今回の差分は検証記録・レビュー文書のみ。アプリやテストを変更して検証候補との対応を失うことは避けた。マネージャーから結果を受領し、画像・連続記録を取り込み、独立視覚レビューで確認する工程が残る。新たな権限要求、権限迂回、公開・マージ・デプロイ、人間の成果確認の代行は行っていない。

## ブラウザ検証

候補1を `/private/tmp/yuugou-task1-review/candidate-1` にソースのSHA-256 manifestとともに書き出し、`ready.json` でマネージャーへ共有済み。指定の20分待機後も結果は未着。[引渡し記録](evidence/manager-handoff.json) / [現在のブラウザ状態](evidence/browser-results.json)。アプリ・テスト等51ファイルは候補とSHA-256で一致した：[照合結果](evidence/source-verification.json)。候補ソースは固定しており、返却結果の受領・確認・画像の取り込み・独立視覚レビューが残る。

P1差し戻し後、14:10 JSTに `ready.json` の再検証依頼を更新。同じ候補1を維持して14:12〜14:32 JSTの20分間、30秒間隔で40回確認したが `result-1.json` は未着だった：[今回の待機記録](evidence/manager-wait-final.json)。候補の再検証結果・画像・動画を受領したとは報告できず、R1・R2の視覚確認とR7・R8の必須成果は未完了。新しいブラウザ成功記録や候補画像は追加していない。今回の変更は再検証ログ・ソース照合・レビュー文書のみで、アプリ・テストのソースは候補1から変更していない。

過去のマネージャー検査はChrome 152.0.7977.82で23結果・41画像を取得したが、スマホ本文では魚が判別できなかった。[修正前の文字](evidence/before-mobile-emulated-formation.png) / [修正前の本文](evidence/before-mobile-emulated-body.png)。これらは今回候補の成功証拠として扱わない。

過去のsandbox起動失敗と修正履歴は[履歴](verification-history.md)・[再試行](verification-retry.md)に保持。過去の「画像0件」は当時の実装担当sandboxでの結果である。

再現手順:

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
# 別ターミナル。Playwrightはアプリ依存へ追加しない。
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
```

任意で `HOME_TEST_URL` と `BROWSER_CHANNEL` を指定可能。検査はViteのSceneレスポンスだけを計装するため、build previewではなく開発サーバーを使う。本番コードにグローバルScene参照は追加していない。第三者リモートスクリプトを遮断する条件。

## 人間の成果確認と未確認事項

画像・連続記録で、魚だけでも名前と文字順を読めるか、スクロール時のほどけ方、逆スクロール後の群れ維持、本文の魚の密度とリンクの読みやすさを確認する。コンセプトへの同意と成果物の確認は別であり、人間の承認はAIが代行しない。

物理iPhone/Android、Safari/Firefox、実機AR、アドレスバー伸縮、長時間の発熱・メモリー、本番の第三者スクリプトを含む性能は未確認。Chromeのスマホエミュレーションを実機検証とは記載しない。

## 受入条件の対応

| ID | 実装・検証 | 状態と残る確認 |
| --- | --- | --- |
| R1 | `nameTargets.js`、`homeMotion.js`、`Home.js`。初期文字配置・Yuugou→Ohno・HTML見出し、文字順/リサイズ単体検証。 | 今回候補のPC/スマホの魚文字画像が未取得。判読性の受入は保留。 |
| R2 | `Scene.js`、`home-velocity.frag`、`home-position.frag`、`home-fish.vert`。実スクロール、連続的な力と深度補間、本文のサイズと側方誘導を修正。 | 新しい実描画・30秒後検査は未実行。遷移の自然さ・本文の見え方は保留。 |
| R3 | `advanceRelease`の滞在内ラッチと深い位置の初期化。単体検証成功。 | ブラウザの逆スクロール・復元検査は候補結果待ち。 |
| R4 | HTML先行、通常アンカー、非干渉canvas、不透明本文。 | wheel/touch/PageDown/横幅検査は候補結果待ち。 |
| R5 | reduced-motionで演出省略。WebGL/float/shader/context-lossでHTML維持。 | 各注入ブラウザ検査は候補結果待ち。 |
| R6 | Home所有のScene、世代管理、RAF/Observer/listener/GPU/renderer破棄。AR/ForLLM差分なし。 | リサイズの単体投影検査成功。実ブラウザのルート往復/所有権検査は候補結果待ち。 |
| R7 | build成功、8単体テスト成功、条件・実行結果・未確認点を記録。 | 必須の今回候補のPC/スマホ実ブラウザ検証は未完了。 |
| R8 | 独立AIコードレビュー、指摘対応、差分、判断記録、修正前画像を添付。 | 今回候補の視覚資料・独立視覚レビューは未完了。人間の成果確認・マージは実施していない。 |
