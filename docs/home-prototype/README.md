# Home 魚群試作の実装・検証記録

2026-09-07。対象: `workspace/05922c6c-0221-4802-8e56-19a09e581142`。

Homeに通常の縦スクロール、HTMLの名前・短い仮本文・プロフィールアンカーを実装した。既存の魚メッシュとGPUのBoidsを使い、最初から名前の形に配置した魚がスクロールで解放される。

**ビルドと状態遷移テストは成功。実ブラウザの起動が環境制約で失敗したため、魚文字の判読性・動き・端末性能・画面画像は未確認。視覚検証を含む受入完了とはしていない。** コンセプト合意は既存のものを使用し、人間の成果確認・PR公開・マージは実行していない。

## 前回レビューへの修正（2026-09-07）

- **P2・形成中の縮小:** `Scene.resize()` は文字目標を作り直さず、初回の文字配置を滞在中保持する。`homeLayout.js` が画面に収まる一様倍率と縦オフセットを計算し、`FishMesh` の表示へ同時適用する。PC開始の1行は縮小後も1行、スマホ開始の2行は回転後も2行で、文字順を保つ。GPUの現在位置・速度・目標textureは書き換えず、再集合を待たない。本文の側方目標幅は表示倍率を逆算して更新する。
- **再現検証:** `tests/home-layout.test.js` は1440×900、390×844、844×390、320×740の各開始サイズから各サイズへの16通りについて、文字領域の即時収容・縦位置・側方目標の座標系・元サイズへの倍率復帰を検証。未実装時の失敗を [resize-red.txt](evidence/resize-red.txt) に記録し、実装後は6テストすべて成功。
- **ブラウザ検査の補強:** `tests/home-browser.mjs` に解放前の縮小・両方向回転を追加。実GPUの位置textureを読み、メッシュ変換とカメラ投影後の魚が画角内にあることを検査する。ルート往復で生存Scene数が0→1となることも検査。Scene取得はテスト中のViteレスポンスだけへの計装で、本番コードにグローバル参照を追加していない。
- **P1・視覚資料不足は未解消:** 今回もVite起動は`listen EPERM 127.0.0.1:5173`、Chromeはページ作成前に終了。更新したブラウザ検査も実行開始前に停止した。PC/スマホのスクリーンショット・動画は0件であり、判読性・動きの自然さを確認したとは扱わない。R1・R2・R7・R8の視覚検証を含む完了判定は保留。

今回の [修正差分](evidence/revision.diff)、[判断記録](resize-decision.md)、[ブラウザ起動結果](evidence/browser-results.json)、[サーバー起動結果](evidence/server-attempt.txt) を参照。依存追加、AR・ForLLM・共通GLSL・ルーター・共通CSSの変更なし。

今回のAIレビューは実装担当によるセルフレビュー（`review-frontend` + `review-security`）。下記の前回独立レビューとは区別する。

| 指摘・確認 | 対応・残課題 |
| --- | --- |
| resize時に位置だけ縮めると魚サイズ・側方目標と座標系がずれる | メッシュ全体を一様変換し、側方目標幅を逆倍率で渡す。16通りの数学的な範囲検査は成功。 |
| resizeで即時描画するためObserver経由の例外もHTML代替へ接続が必要 | ResizeObserverコールバックをcatchし、既存の停止・破棄処理に接続。実ブラウザでの障害注入は未実行。 |
| resizeで再初期化・イベント重複を招かないか | 新しいScene・RAF・observer・GPU textureを作らないことを差分で確認。実メモリー計測は未確認。 |
| 小画面でPC開始の1行が十分読めるか | 領域内に収まる計算は成功。魚文字の判読性は画像・実機未確認。 |
| ブラウザテストが解放後のresizeだけになっていないか | 解放前の実GPU投影検査と各サイズの画像保存を追加。環境制約で実行できていない。 |
| セキュリティ・対象外ページ | 新規入力・外部送信・依存なし。AR/ForLLMは別Scene/mesh/simulationを使い、ファイル差分なし。 |

**残る必須作業:** 起動可能な環境でブラウザ検証を実行し、PC/スマホのformation・loosening・body・解放前resize画像を添付して人間に提示する。人間による成果確認は未実施。AIレビューはその代替ではない。

## 差分と判断

| ファイル | 変更と理由 |
| --- | --- |
| `src/pages/Home.js`, `Home.css` | 通常HTMLを先行描画。Homeのみoverflowを解除。WebGLは2回のRAF後に遅延importし、失敗・reduced-motion時はHTMLを維持。通常リンク、停止操作、本文の不透明な読み取り面を設置。 |
| `src/webgl/Scene.js` | カメラ回転、CSS3D、捕食者、操作パネルをHomeから除去。実際のhero矩形から進捗取得。Home滞在単位のrelease latch、ResizeObserver、visibility停止、破棄処理を実装。 |
| `src/webgl/homeMotion.js` | 解放開始12%、完了70%を定数化。単調なsmoothstepと時間平滑化。完了後は進捗0に戻っても拘束復活なし。 |
| `src/webgl/nameTargets.js`, `homeLayout.js` | ローカルArial/sans-serifをcanvasで計測・ラスタライズ。1,024匹の初期位置と拘束目標。初回幅700px未満では `Yuugou` → `Ohno` の順の2行。滞在中の折り返しは維持し、resizeは全体の表示倍率で追従。Webフォント待ちなし。 |
| `src/webgl/GPGPUSimulation.js`, `home-position.frag`, `home-velocity.frag` | 現在位置は速度積分のみ。拘束と分離・整列・凝集の力を混ぜる。速度6、加速度6 world units/s系を上限とし最低速度の強制・球体への座標クランプを除去。各魚64近傍を分散サンプリング。 |
| `src/webgl/FishMesh.js`, `home-fish.vert` | 既存のインスタンス魚形状と尾の動きを使用。テクスチャ中心参照、低速・上方向の姿勢の安定化、明るい既存色系。ARが使用する旧シェーダーは保持。 |
| `tests/home-motion.test.js`, `tests/home-browser.mjs` | 解放状態の再現テストと、ブラウザ上の操作・フォールバック・画像保存の検証手順。 |

全差分はホストが公開するPRのFiles changedで確認できる。ローカルでは `git diff` と追加ファイルを併せて参照する。AR・ForLLM・共通の旧GLSL・ルーター・共通styleはファイル差分なし。HomeからAppを外す際に、ForLLMにも効いていた既存`App.css`のimportは明示的に維持した。

判断記録: カメラ周回方式を継続する案と、通常HTML＋装飾canvas案を比較し、後者を採用。入力方法ごとの差をなくし、魚の初期化成功に情報閲覧を依存させないため。新しいアニメーション依存は追加しない。GPUは従来の4,096匹・全探索から1,024匹・64近傍に縮小し、本文では側方の遊泳領域へ誘導、80%を奥へ移す。単なる透明度変更には依存しない。本文が現れる瞬間にも読めるよう、不透明な本文背景を併用する。実機で名前・密度・解放速度を確認後に、粒数・魚サイズ・解放区間を再調整する。

## 実行済み検証

| 検証 | 結果・証拠 |
| --- | --- |
| テスト先行 | 実装前の `node --test tests/home-motion.test.js` が未実装モジュールで失敗することを確認。その後実装。 |
| `npm test` | 6件成功。[実行結果](evidence/unit-tests.txt)。拘束の往復、解放後の逆スクロール、深い復元、急な時間差、文字順、境界・overscroll、16通りの表示サイズ変更を検証。 |
| `node --test --experimental-test-coverage tests/*.test.js` | `homeMotion.js` と `homeLayout.js` のline/branch/function 100%。[結果](evidence/unit-coverage.txt)。これは純粋関数だけの範囲であり、GLSL・DOM・GPUのカバレッジではない。 |
| `npm run build` | 成功。[出力](evidence/build.txt)。既存のAR関連の静的/動的import混在と大きいchunkの警告あり。 |
| `node --check tests/home-browser.mjs` | 構文確認成功。ブラウザ内部のassertionは未実行。 |
| `git diff --check` | 成功。 |
| AR / ForLLM / 共通GLSL | 対象ファイル差分なし。ブラウザのAR開始画面・カメラ実動作は未確認。 |

環境: macOS Darwin、Node v22.21.1、Vite 7.2.6、three r152。`npm ci --offline` はキャッシュ不足（ENOTCACHED）、通常の `npm ci` はレジストリDNS解決不可（ENOTFOUND）で失敗。既存の同一リポジトリの `node_modules` をworktreeへコピーして検証した。lockfile上の非optional 151パッケージを照合し、バージョン不一致・欠損は0件。依存定義・lockfileの変更なし。再現環境では通常の `npm ci` を使用する。

## ブラウザ検証の条件と結果

| 条件 | 今回の結果 |
| --- | --- |
| ローカルVite、127.0.0.1:5173 | listen EPERM。サーバー起動不可。 |
| インストール済みGoogle Chrome、Playwright、headless、PC 1440×900 | ページ作成前に終了（`Target page, context or browser has been closed`）。画像なし。 |
| Chromeスマホエミュレーション、390×844、DPR3、touch | 実行予定条件をスクリプトに保存。ブラウザ起動不可のため未実行。実機結果ではない。 |
| 解放前390×844、844×390、320×740、1440×900へのresizeと回転 | 実GPU座標の投影検査と画像保存を追加。スクリプト未実行。 |
| 物理PCの通常Chrome/Safari/Firefox | 未確認。 |
| iPhone Safari / Android Chrome実機、回転、アドレスバー伸縮 | 未確認。 |

[ブラウザ実行結果](evidence/browser-results.json) に起動失敗を保存した。**スクリーンショット・動画は取得できていない。設計イメージを実ブラウザの証拠として代用していない。** 権限変更・sandboxの迂回は実施していない。

ブラウザ起動とローカル待受が可能な環境で:

```sh
npm ci
npm test
npm run build
npm run dev -- --host 127.0.0.1
# 別ターミナル。既に利用可能なPlaywrightのモジュールパスを指定する。
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs node tests/home-browser.mjs
```

Playwrightを別途利用できる環境が必要。アプリの依存には追加していない。任意で `HOME_TEST_URL` / `BROWSER_CHANNEL` を指定可能。GPU検査の計装は `/src/webgl/Scene.js` のVite開発レスポンスを使うため、このスクリプトの接続先には開発サーバーを指定する（build preview用ではない）。スクリプトは既存の第三者スクリプト通信を遮断してHomeを検証するため、第三者スクリプトを含む本番相当状態は別確認となる。

正常に実行すると`evidence/`にPC/スマホ各formation・loosening・body・returned-released・paused-resized・deep-reloadのPNG、各フォールバックPNG、JSON結果を保存する。スクロール・wheel・CDP touch・PageDown・アンカー・戻る・再訪・canvas数・横はみ出しを検証する。reduced-motion・WebGL無効・float render target無効・シェーダー例外・context lossも検証する。画像と速度感の判定、FPS、メモリーの長時間測定は自動assertionの対象外。

人間に確認してもらう事項:

1. HTML名とは別に、魚だけで `YuugouOhno` が読み取れるか。スマホ2行の文字順、大文字O、小文字uの識別を確認。
2. 通常のwheel/touchで徐々にほどけ、急なアンカー移動でも魚が飛ばないか。解放後、先頭へ戻っても群れのままか。
3. 本文到達直後と30秒後の密度・奥行き・リンク可読性。本文とヘッダーのクリック/Tab操作。
4. 解放前の大幅な幅変更・縦横回転で、魚文字が直ちに全体表示されるか。PC開始の1行をスマホ幅まで縮めた場合も名前として読めるか。停止中は大きいHTML名へ切り替わる。
5. Home→ForLLM→戻る、Home→AR→戻るを繰り返し、1枚のcanvas・1つの更新ループであることをDevToolsで確認。GPUメモリーが累積しないことを確認。
6. 物理スマホの速度・発熱・スクロール感、reduced-motionを滞在中に切り替えた場合、深い位置のブラウザ戻る/リロードを確認。

## 前回実装のAIレビュー（修正前の記録）

`review_home`エージェントが`review-frontend`と`review-security`を使用し、独立した静的レビューとテスト実行を実施。

| 指摘 | 対応・再確認 |
| --- | --- |
| P2: 停止中の大幅resizeで魚文字が欠けたままになる | 停止中はcanvasを隠し、大きいHTML名に戻す。独立再レビューでコード上の解消を確認。 |
| P2: 初回computeのシェーダー例外がHomeのinit catchを通らない | init内でゼロ時間computeを実行しコンパイルを捕捉。animate中にもcatchを追加し、停止・破棄・HTML維持へ接続。独立再レビューでコード上の解消を確認。 |
| 補強: WebGL2でもfloat描画先を利用できない場合がある | `EXT_color_buffer_float`を初期化条件に追加。該当状態の注入検証をブラウザスクリプトに追加。実ブラウザは未確認。 |
| GPUComputationRenderer r152の破棄 | 所有実装を読み、両方のping-pong RT・初期textureのdisposeに加えてvariable materialを明示dispose。レビューでも確認。 |
| セキュリティ | 新規入力/外部送信/秘密情報なし。外部リンクのnoopener noreferrerを確認。追加指摘なし。 |

残る課題: ブラウザ検証と画像取得、魚文字の初期判読性・解放の視覚品質・通常resize後の判読性・実機性能・長時間のGPU破棄確認。既存AR由来の大きな初期bundle警告は今回の試作では変更していない。

## 受入条件の対応

| ID | 実装・検証範囲 | 未確認事項 |
| --- | --- | --- |
| R1 | 正確な文字列、初期目標位置、2行対応、通常HTML名 | PC/スマホでの魚文字の判読性。画像待ち。 |
| R2 | 実スクロール、力の混合、速度/加速度上限、継続Boids、本文側方/奥行き | 自然なほどけ方、本文の密度感。 |
| R3 | visit latch、深い初期位置、単体テスト | 実ブラウザの復元タイミング。 |
| R4 | HTML先行、通常スクロール、非干渉canvas、不透明本文、通常リンク | wheel/touch/keyboardと幅ごとの実ブラウザ結果。 |
| R5 | reduced-motion、非対応WebGL/float/初期化失敗のHTML代替 | 注入ブラウザ検証。 |
| R6 | 世代管理、RAF/observer/listener/GPU破棄、AR/ForLLMの差分なし | 大幅resizeの視覚品質、GPU実測、AR実機回帰。 |
| R7 | build成功、6単体テスト成功、検証条件と環境失敗を記録 | PC/スマホ実ブラウザ検証は未完了。 |
| R8 | 前回独立AIレビュー・今回セルフレビュー・対応・修正差分・残課題を記録 | 必須の画面画像/動画は未取得。人間の成果確認は未実施。 |
