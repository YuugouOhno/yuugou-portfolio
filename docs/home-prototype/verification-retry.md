# P1 ブラウザ検証の再試行

2026-09-08 JST。対象は同じworktreeの既存Home試作。アプリコード・依存・AR・ForLLM・ルーター・保護設定は変更していない。今回は検証記録の更新のみ。コンセプトへの同意を成果承認として扱わず、人間の確認・PR公開・マージは実行していない。

## 結果

**P1は未解消。PC・スマホの画像もブラウザassertionの実行結果も0件で、受入完了ではない。**

| コマンド | 今回の結果 | 証拠 |
| --- | --- | --- |
| `npm test` | 7件成功 | [テスト出力](evidence/unit-tests.txt) |
| `npm run build` | 成功。既存のAR関連import混在・chunkサイズ警告あり | [ビルド出力](evidence/build.txt) |
| `node --check tests/home-browser.mjs` | 成功。ブラウザ実行の成功ではない | [コマンド別終了コードと対象commit](evidence/verification-retry.json) |
| `npm run dev -- --host 127.0.0.1` | `listen EPERM: operation not permitted 127.0.0.1:5173` | [サーバー出力](evidence/server-attempt.txt) |
| `PLAYWRIGHT_MODULE=/Users/yuugou/.npm/_npx/420ff84f11983ee5/node_modules/playwright/index.mjs node tests/home-browser.mjs` | exit 1。Chromeがページ作成前に終了 | [今回のブラウザ結果](evidence/browser-results.json) |

環境はmacOS、Node v22.21.1、インストール済みGoogle Chromeを使うPlaywright headless。Chromeのバージョン取得に未到達。予定条件はPC 1440×900/DPR1、スマホ390×844/DPR3/touchエミュレーション。これらを実施済みとはしない。実機PC・iPhone・Androidでの確認も未実施。利用可能なツールに別のブラウザ実行手段はなく、このセッションでは権限昇格も許可されていない。権限変更・迂回・公開による代替は行っていない。

## 今回のAIセルフレビュー

実装担当AIが `review-frontend` と `review-security` の観点で既存ソースと検証手順を読んだ。独立AIレビューや人間レビューではない。

| ID | ソース・テストで確認したこと | 受入上の残課題 |
| --- | --- | --- |
| R1 | `nameTargets.js`がローカルフォントの文字内に初期位置を生成。`homeMotion.js`の名前はYuugouOhno、狭幅はYuugou→Ohno。名前順・投影の単体テスト成功。 | 実描画の綴り・判読性は未確認。画像なし。 |
| R2 | `Scene.js`がheroの実位置を読み、力の拘束を平滑化。Home用GLSLは位置を速度積分し、加速度と速度を制限。本文へ進んでも計算継続、側方と奥への誘導あり。 | 遷移の自然さ・魚の見え方・長時間の密度は未確認。 |
| R3 | `advanceRelease`のラッチと深い初期位置を単体テスト。Home単位でvisitを保持。 | ブラウザ履歴・スクロール復元のタイミングは未確認。 |
| R4 | `Home.js`はHTMLを先に挿入、演出は遅延import。通常アンカーと操作を妨げないcanvas、本文に不透明な面あり。 | 実際の応答時間・wheel/touch/keyboard・リンク・横はみ出しは未確認。 |
| R5 | reduced-motionで演出省略。WebGL2/float非対応、初期化失敗、context lossはHTMLへ戻す。 | ブラウザによる障害注入は未実行。 |
| R6 | resizeは既存uniform・cameraを更新。disposeはRAF・Observer・listener・GPU resourcesを破棄。ARは専用実装を参照し、AR/ForLLMに今回の変更なし。 | 実GPUでの往復・回転・リソース計測、実機ARは未確認。 |
| R7 | build・7単体テスト成功。予定ブラウザ条件と失敗を記録。 | 必須のPC/スマホ実ブラウザ検証は未完了。 |
| R8 | 今回のAIセルフレビュー、P1未対応理由、以前の実装差分はREADMEから参照できる。 | 必須の視覚資料なし。人間の成果確認は未実施。 |

新規の外部送信・入力経路・依存追加はない。今回のレビューでは、実行できないブラウザ検査を成功とすることが最大の誤報リスク。ソース確認や数学的投影を視覚検証の代替にはしない。

## 判断と再開条件

選択肢は「既存コードを保持して実行環境の制約と未完了を記録する」「視覚確認なしで描画や検証コードを追加変更する」。前者を選択した。前回の指摘は視覚資料不足であり、今回も実行前に止まったため、描画変更を裏付ける新しい観察がない。

ローカル待受とChrome起動が許可された環境で、READMEの手順に従い `tests/home-browser.mjs` を完走する必要がある。PC/スマホのformation・loosening・body画像を目視し、綴り・文字順・本文の可読性を記録する。遷移は連続再生でも確認し、本文到達直後と30秒後の見え方、逆スクロール、回転、再訪も確認する。実機検証とエミュレーションは別に記録する。

残るリスクは、まだ一度もブラウザで通っていないassertion自体の不具合、GPU描画やスクロール復元の不具合、スマホでの性能・発熱。実行環境が変わった時点でP1を再検証し、資料を揃えてから人間へ成果確認を渡す。
