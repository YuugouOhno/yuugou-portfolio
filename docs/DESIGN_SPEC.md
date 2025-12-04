# GPGPU Boids Simulation - 設計仕様書 (v2.1 Future-Proof)

## 1. プロジェクト概要

本プロジェクトは、Three.jsとGPGPU技術を用いて、数千〜数万匹の魚の群れ（Boids）をブラウザ上でリアルタイムにシミュレーション・描画することを目的とする。

### コアコンセプト: 計算（脳）と描画（体）の分離

パフォーマンスを最大化するため、CPUでの計算は最小限に留め、群れの挙動計算とメッシュの座標変換を全てGPU上で行うアーキテクチャを採用する。

### 拡張性の重視 (Future-Proofing)

初期段階から以下の機能を想定した設計を行う：

- **インタラクション**: マウス（捕食者/餌）への回避・追跡行動。
- **モーフィング**: 群れ全体で特定の形状（文字やロゴ、球体など）を形成する制御。
- **ダイナミック演出**: 速度や密度、時間経過に応じた滑らかな色彩変化。
- **【v2.1強化】汎用ステート管理**: HP、チームID、状態異常など、将来的なゲームロジック追加に耐えるデータ構造。

---

## 2. 技術スタックと要件

- **Core Library**: Three.js (r150以上推奨)
- **GPGPU Utility**: GPUComputationRenderer (Three.js examples)
- **Build Tool**: Vite (高速なHMRによるシェーダー開発効率化のため)
- **Language**: JavaScript (ES6+) / GLSL (Shader Language)
- **Target Device**: PCおよびハイエンドモバイル端末（WebGL 2.0対応必須）

---

## 3. システムアーキテクチャ

システムはデータが循環するフィードバックループ構造を持つ。拡張機能のために、外部入力（マウス座標等）とターゲット形状データを追加する。

### A. Simulation Loop (The Brain / GPGPU)

**Input:**
- 前フレームの `texturePosition`, `textureVelocity`, `textureExtra`
- `textureTarget`: 形状形成モード時の目標座標（オプション）。
- Uniforms: マウス座標、モード切替フラグ、経過時間、重み係数。

**Process (Velocity & Extra Shader):**
- Boids基本3ルール（分離・整列・結合）の計算。
- 外部要因（マウス斥力/引力）の加算。
- 形状維持力の加算。
- ステータス更新: HPの減少、状態異常の遷移など（`textureExtra`の更新）。

**Output:** 更新された `texturePosition`, `textureVelocity`, `textureExtra`。

### B. Rendering Loop (The Body / InstancedMesh)

**Input:** GPGPU計算結果の全テクスチャ + Static Attributes。

**Process (Vertex Shader & Fragment Shader):**
- 座標更新と回転（LookAt）。
- 色彩計算: 速度、`textureExtra`（HPやチーム）、Attribute（固有色）を組み合わせた動的な色決定。

**Output:** スクリーンへの描画。

---

## 4. ディレクトリ構成

将来的な機能追加に耐えうるよう、シェーダーファイルを機能単位で細分化する構成案。

```
src/
├── index.js             # エントリーポイント
├── glsl/
│   ├── boids/
│   │   ├── velocity.frag   # 物理演算・移動ロジック
│   │   ├── position.frag   # 位置更新
│   │   └── extra.frag      # [New] ステータス管理（HP, State）
│   ├── chunks/             # 再利用可能なGLSL関数群
│   │   ├── simplexNoise.glsl
│   │   └── rotation.glsl
│   └── fish/
│       ├── fish.vert       # 形状変形・配置
│       └── fish.frag       # 色彩・ライティング
└── webgl/
    ├── Scene.js
    ├── GPGPUSimulation.js  # 計算ロジック
    └── FishMesh.js         # 描画ロジック
```

---

## 5. データ構造とクラス設計

### データ定義 (Texture Specification)

ここが拡張性の要です。 動的なデータ（Texture）と静的なデータ（Attribute）を明確に分けます。

#### 1. Dynamic Data (GPGPU Textures)

毎フレーム変化する値。

| Texture Name | R (x) | G (y) | B (z) | A (w) |
|---|---|---|---|---|
| `texturePosition` | 位置 X | 位置 Y | 位置 Z | アニメーション位相 |
| `textureVelocity` | 速度 X | 速度 Y | 速度 Z | 速度の減衰率 (Drag) |
| `textureExtra` [New] | チームID / 種類 | HP / 寿命 | 状態フラグ | 汎用カウンタ |
| `textureTarget` | 目標 X | 目標 Y | 目標 Z | 形状引力ウェイト |

> **`textureExtra`**: これを用意しておくことで、「被弾した」「無敵モード」「特定の魚だけ大きくする」などの仕様変更に、シェーダーの変更のみで対応できます。

#### 2. Static Data (Instanced Attributes)

初期化時に決定し、変化しない値。JS側で `InstancedBufferAttribute` としてメッシュに持たせます。

- `attribute vec3 aColor`: その魚の本来の色（ベースカラー）。
- `attribute float aSize`: その魚の基準サイズ。
- `attribute float aSeed`: ランダムシード（個体差ノイズ用）。

---

### クラス詳細と拡張メソッド

#### A. GPGPUSimulation.js (計算マネージャ)

**Variable管理:** `textureExtra` を追加し、自己参照（前フレームの値を読み込む設定）を行う。

**Uniforms管理:**
- `uInteractionType`: 0=無効, 1=逃げる, 2=集まる, 3=攻撃する...
- `uDelta`: 可変フレームレート対応のための経過時間。

#### B. FishMesh.js (描画マネージャ)

**Material拡張:**
- `uColorMode`: 0=BaseColor, 1=VelocityBased, 2=TeamColor, 3=Mix
- 頂点シェーダー内で、`textureExtra.g` (HP) が0になったら scale を0にして非表示にする（死亡処理）などのロジックを入れられるようにする。

---

## 6. 魚の制御ロジック (Behavior Blending)

`velocity.frag` では、様々な「欲求（Force）」をブレンドして最終的な加速度を決定します。

### 振る舞いの優先順位 (Priority Accumulation)

```glsl
vec3 acc = vec3(0.0);

// 1. 環境要因 (Environment)
acc += avoidWalls(pos) * uWallWeight; // 壁回避

// 2. インタラクション (Interaction)
// textureExtra.z (状態フラグ) を見て挙動を変えることも可能
if (state != DEAD) {
    acc += interactMouse(pos, uMouse) * uMouseWeight;
}

// 3. 群れ制御 (Flocking)
// 形状形成モード(ShapeMode)時は、Boidsの力を弱める調整を入れる
float flockInfluence = mix(1.0, 0.2, uShapeModeStrength);
acc += separate(pos, vel) * uSeparationWeight * flockInfluence;
acc += align(pos, vel) * uAlignmentWeight * flockInfluence;
acc += cohere(pos, vel) * uCohesionWeight * flockInfluence;

// 4. 形状形成 (Formation)
acc += seekTarget(pos, targetPos) * uShapeWeight * textureTarget.w;

// 5. 最終適用
vel += acc * delta;
```

---

## 7. 色彩表現の拡張

ジェネラティブな色彩表現のロジック。

### シェーダーでの色彩ロジック (fish.frag)

```glsl
// ベースカラー（Attribute）
vec3 baseColor = vColor;

// 速度による変化（赤熱化）
float speed = length(vel);
vec3 speedColor = mix(baseColor, vec3(1.0, 0.2, 0.2), smoothstep(0.0, 5.0, speed));

// 状態による変化（textureExtra.r = チームID）
vec3 teamColor = (extra.r < 0.5) ? vec3(0.0, 0.5, 1.0) : vec3(1.0, 0.0, 0.0);

// モードによるブレンド
vec3 finalColor = mix(speedColor, teamColor, uShowTeamColor);

// HPによる点滅（textureExtra.g = HP）
if (extra.g < 0.3) {
    finalColor *= (0.5 + 0.5 * sin(uTime * 10.0)); // 瀕死で点滅
}
```

---

## 8. 開発ロードマップ (Updated)

### Step 1: ベース構築 (The Robust Foundation)

- GPUComputationRenderer セットアップ。
- `textureExtra` を含む3枚の計算テクスチャを初期化。
- 静的データ（Attribute）をInstancedMeshに流し込む処理の実装。

### Step 2: Boids実装

- 基本3ルールの実装。
- `texturePosition.w` (Phase) を使った頂点アニメーションの実装。

### Step 3: インタラクションと拡張ロジック

- マウスインタラクションの実装。
- ステータスロジック: `extra.frag` を作成し、時間経過でHPが減る、特定エリアで回復するなどのテスト実装を行う。

### Step 4: ビジュアル・ポリッシュ

- カラーシステムの構築。
- ポストプロセス（Bloom等）を入れて発光表現を強化。

---

## 9. 考慮すべき重要事項

### 拡張性の担保（まとめ）

- **新しいパラメータが必要になったら**: まず `textureExtra` の空きチャンネルを使う。それでも足りなければ `textureExtra2` を足すだけで良い。
- **新しい挙動が必要になったら**: `velocity.frag` に新しい関数 `newBehavior()` を作り、`acc +=` するだけ。
- **魚ごとの個性を出したくなったら**: `textureVelocity.w` (Mass) や Attribute を参照して、力の掛かり具合（`acc *= 1.0 / mass`）を変える。
