# Home 魚群試作の実装・検証記録

2026-09-08 JST。対象ブランチ: `workspace/05922c6c-0221-4802-8e56-19a09e581142`。

**最新の再検証（2026-09-08 13:24 JST）:** 前回P1への対応として、同じworktreeでVite・Playwrightを再実行した。Viteは `listen EPERM`、Chromeはページ作成前の終了となり、P1は未解消。今回のアプリコード変更はない。[再検証とAIセルフレビュー](verification-retry.md)に、今回の結果と次に必要な検証を記録した。以下のP2修正説明は既存コミットの履歴であり、今回追加した修正ではない。

Homeは通常のHTMLを先に表示し、既存の魚メッシュとGPU Boidsで最初から `YuugouOhno` を形作る。通常スクロールで解放し、本文では側方・奥へ泳ぐ。今回の修正は、前回レビューP2の解放後リサイズによるクリッピングへの対応。

**ビルドと7件の単体テストは成功。P2は実装・数学的投影検証まで対応。P1の実ブラウザ検証・画像資料不足は未解消。R1・R2・R7・R8の視覚検証を含む受入完了とはしない。** 本セッションでもローカルサーバーは `listen EPERM`、Chromeはページ作成前に終了した。PC・スマホとも画像・動画は0件。人間の成果確認は未実施。push・PR公開・デプロイ・マージ・保護設定変更は実施していない。PR公開はホストが担当する。

## 今回の修正と証拠

[今回のコード・テスト差分](evidence/depth-resize.diff) / [判断記録](depth-resize-decision.md) / [投影比較](evidence/projection-comparison.json)

| ファイル | 変更と理由 |
| --- | --- |
| `src/webgl/homeLayout.js`, `Scene.js` | シミュレーション幅をHome初回の値で固定。文字用の倍率とは別に、遊泳用の横倍率を現在幅/初回幅で算出。resizeでGPU位置・速度・目標を書き換えない。 |
| `src/webgl/FishMesh.js`, `src/glsl/fish/home-fish.vert` | `mesh.scale.setScalar()`を廃止。文字のz=0では従来どおり名前全体をフィット。z=-35以下では横幅のみ追従し、縦位置と奥行きを固定する。間は実際の深さによるsmoothstepで接続。スクロール値による描画位置の瞬間切替はない。個々の魚の形は一様倍率を使って保つ。 |
| `src/webgl/GPGPUSimulation.js`, `src/glsl/boids/home-velocity.frag` | 深い初期位置と遊泳目標を同じ側方領域へ統一。近い魚z=-35は初回幅×0.6、遠い魚z=-160は初回幅×1.15、左右へ配置。初期y範囲を±36へ収める。カメラfar=600は変更不要。 |
| `tests/home-layout.test.js` | 1440×900、390×844、844×390、320×740の各開始サイズ→各サイズの16通りについて、文字領域と解放済み近/遠・左右・上下のxyz投影を検証。 |
| `tests/home-browser.mjs` | 既存の形成・操作・復元・フォールバック・ルート往復検査に、深い初期位置から16通りのresize検査を追加。GPU座標と描画uniformから投影しxyz範囲を検査。Scene・simulation・targetsの同一性とGPU位置不変を検査し画像保存する。今回も起動前に停止しており、これらのassertionは未実行。 |

投影のNDC範囲は各軸-1〜1。従来の390×844→844×390では倍率3.4807により遠い魚のzが1.000029となりfarで消える。逆方向では旧側方目標のxが1.84358となり画角外へ出る。修正後の側方目標は両方向とも近い魚x=0.88889、遠い魚x=0.88462、zはいずれも1未満。[数値の比較](evidence/projection-comparison.json)はThree.jsによる数学的検証であり、ブラウザ描画や画像の代替ではない。

## 実行した検証

| 検証 | 条件と結果 |
| --- | --- |
| テスト先行 | 新しい解放済み投影テストが修正前に失敗。[Red結果](evidence/depth-resize-red.txt)。 |
| `npm test` | 7件成功。[結果](evidence/unit-tests.txt)。16通りの文字/解放済み配置、文字順、拘束の往復、解放ラッチ、深い初期位置、進捗境界、急な時間差を検証。 |
| `node --test --experimental-test-coverage tests/*.test.js` | `homeLayout.js`・`homeMotion.js`のline/branch/function 100%。[結果](evidence/unit-coverage.txt)。GLSL・DOM・GPUの実行カバレッジは含まない。 |
| `npm run build` | 成功。[出力](evidence/build.txt)。既存のAR関連の静的/動的import混在と大きなchunkの警告あり。 |
| `node --check tests/home-browser.mjs` | 構文確認成功。ブラウザassertionの成功を意味しない。 |
| `git diff --check` | 成功。 |
| AR / ForLLM / 共通ファイル | `src/pages/AR`、`src/pages/ForLLM`、`src/webgl/ar`、router、共通style、依存定義・lockfileに今回の差分なし。ARは別のmesh・simulation・GLSLを参照することを確認。実機ARは未確認。 |

環境: macOS Darwin、Node v22.21.1、Vite 7.2.6、three r152。前回用意されたローカルnode_modulesを利用。依存追加・更新なし。通常の再現環境では `npm ci` を使用する。

## ブラウザ検証と視覚資料

[実行結果JSON](evidence/browser-results.json) / [サーバー起動結果](evidence/server-attempt.txt)

| 条件 | 実施結果 |
| --- | --- |
| Vite、127.0.0.1:5173 | `listen EPERM: operation not permitted`で起動不可。 |
| インストール済みGoogle Chrome、Playwright、headless | `Target page, context or browser has been closed`でページ作成前に終了。ブラウザバージョン取得にも到達していない。 |
| PC 1440×900、DPR1 | スクリプトに条件を定義済み。ページ検査未実行、画像なし。 |
| スマホ390×844、DPR3、touch | Chromeエミュレーション条件を定義済み。未実行。実機検証ではない。 |
| 深い初期位置・解放後の縦横回転、4サイズ×4サイズ | GPU xyz投影・状態不変・画像保存を追加済み。未実行。 |
| 物理PCの通常Chrome/Safari/Firefox | 未確認。 |
| iPhone Safari / Android Chrome実機 | 未確認。回転・アドレスバー伸縮・速度・発熱・メモリーも未確認。 |

権限変更やsandboxの迂回は行っていない。画像・動画の代わりに生成画像を証拠として添付することもしていない。

ローカル待受とブラウザ起動が許可された環境で実行する:

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
# 別ターミナル。アプリ依存にはPlaywrightを追加していない。
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
```

任意で`HOME_TEST_URL`と`BROWSER_CHANNEL`を指定可能。Scene取得はViteの `/src/webgl/Scene.js` レスポンスにだけ計装するため、build previewではなく開発サーバーを指定する。本番コードへグローバルScene参照を追加していない。既存の第三者スクリプト通信を遮断する検証なので、本番相当の第三者スクリプト込みの確認は別途必要。

実行可能な環境では`evidence/`にPC/スマホのformation・loosening・body・returned-released・paused-resized・deep-reload、形成前resize、解放済みresize、各フォールバックのPNGが保存される。ホイール・CDP touch・PageDown・アンカー・逆スクロール・深いreload・ルート往復・canvas/Scene数・横はみ出し・reduced-motion・WebGL/float不可・shader例外・context lossを検査する。GPU投影は中心位置の検査で、実際の魚メッシュの判読性や速度感は画像・動画の確認を要する。

## 今回のAIレビュー

実装担当によるセルフレビュー。`review-frontend` + `review-security`を使用し、差分・呼出元・テスト・破棄処理を確認した。独立した別AIレビューや人間レビューとしては扱わない。

| 指摘・確認 | 対応と残課題 |
| --- | --- |
| 前回P2: 奥行きの拡縮と固定far、側方目標が不整合 | 奥行きを固定、遊泳横倍率を文字倍率から分離。16通りの数学的投影検証成功。GPUブラウザ検証は未実行。 |
| 追加発見: 深い初期位置の近い魚にも遠い魚と同じx範囲を与えており、既に画角外の魚がある | 初期化とsteeringの近/遠領域を一致。yも±36へ制限。 |
| 文字倍率と遊泳倍率をrelease値で切替えるとアンカー移動で投影上の魚が飛ぶ | GPU位置が実際に奥へ移動するにつれてsmoothstepで接続。実際の速度感は未確認。 |
| resizeでGPU状態・イベント・リソースが再生成されないか | 更新はcamera・rendererサイズ・既存uniformのみ。RAF/ResizeObserver/listener/textureを新設せず、既存のdispose処理を保持。実GPUの長時間メモリー計測は未確認。 |
| ブラウザ検査が変更後のvertex変換を反映していない | uniformによる深さ依存変換を投影検査に追加。xyzと解放済み状態も検査。 |
| 前回P1: PC/スマホ画像・動画がない | 起動を再試行したが環境制約で未解消。視覚的受入は保留。 |
| セキュリティ | 新規入力・外部送信・依存なし。HTMLリンクと非干渉canvasを維持。追加のセキュリティ指摘なし。 |

前回の独立AIレビューでは、停止中のresize時のHTML代替、初回compute例外の捕捉、float render targetの対応確認、GPUComputationRendererのvariable material破棄を確認している。これらの既存対策は今回も維持した。以前の差分は[前回修正](evidence/revision.diff)、判断は[前回判断](resize-decision.md)を参照。そこにある「一様倍率でのresize」は今回の方式で置き換えた。

## 受入条件と未確認事項

| ID | 実装・証拠 | 残る確認 |
| --- | --- | --- |
| R1 | `nameTargets.js`が初期位置を文字内に生成。`nameLines`はスマホでYuugou→Ohnoの順。HTML h1にも正確な名前。文字列とresize範囲テスト成功。 | PC/スマホで魚だけの名前の判読性。画像なし。 |
| R2 | `Scene.js`の実hero位置、`homeMotion.js`の平滑化、既存Boidsの力・速度積分と上限、継続計算、本文側方/奥への誘導。 | 自然さ・速度感・本文密度・新しい投影接続のGPU実描画。 |
| R3 | Home滞在のrelease latch、深い初期位置では解放済み初期化。単体テスト成功。 | ブラウザの復元タイミング・戻る操作。 |
| R4 | `Home.js`でHTML先行表示、通常リンクとスクロール。`Home.css`のpointer-events:noneと不透明本文。 | wheel/touch/keyboard・リンク操作・実幅のはみ出し・初期化中の応答。 |
| R5 | reduced-motionでは演出省略。WebGL/float/初期化失敗時に停止・破棄しHTML維持。 | 注入ブラウザ検査。 |
| R6 | 今回xyz投影修正、固定シミュレーション座標、既存dispose維持。AR/ForLLM差分なし。 | 実GPUのresize・ルート往復・長時間リソース計測、実機AR。 |
| R7 | build成功、7単体テスト成功、ブラウザ条件と失敗結果を記録。 | 必須のPC/スマホ実ブラウザ検証は未完了。 |
| R8 | AIセルフレビュー・指摘対応・残課題・差分・判断を本資料に記録。 | 必須の視覚資料は未取得。人間の成果確認は未実施。 |

人間への確認事項は、魚だけでの綴り・文字順の判読、通常操作とアンカー移動でのほどけ方、逆スクロール後の群れ維持、本文到達直後と30秒後の見え方、形成中/解放後の回転、各ページ往復と停止/再開、実機の性能・発熱。まず実行可能な環境で上記ブラウザ検証を完了して画像を添付する必要がある。コンセプトへの同意を成果確認と扱わず、人間の判断は代行しない。
