# GPGPU Boids Simulation - 設計仕様書

## 1. プロジェクト概要

本プロジェクトは、Three.jsとGPGPU技術を用いて、数千〜数万匹の魚の群れ（Boids）をブラウザ上でリアルタイムにシミュレーション・描画することを目的とする。

### コアコンセプト: 計算（脳）と描画（体）の分離

パフォーマンスを最大化するため、CPUでの計算は最小限に留め、群れの挙動計算とメッシュの座標変換を全てGPU上で行うアーキテクチャを採用する。

### 実装する機能

- **Boidsシミュレーション**: 分離・整列・結合の3ルールによる群れ行動
- **複数グループ**: 種類ごとに独立した群れを形成（異なる種類同士は干渉しない）
- **インタラクション**: マウス（捕食者/餌）への回避行動
- **ダイナミック演出**: 速度に応じた滑らかな色彩変化

---

## 2. 技術スタックと要件

- **Core Library**: Three.js (r150以上推奨)
- **GPGPU Utility**: GPUComputationRenderer (Three.js examples)
- **Build Tool**: Vite
- **Language**: JavaScript (ES6+) / GLSL
- **Target Device**: PCおよびハイエンドモバイル端末（WebGL 2.0対応必須）

---

## 3. システムアーキテクチャ

システムはデータが循環するフィードバックループ構造を持つ。

### A. Simulation Loop (GPGPU)

**Input:**
- 前フレームの `texturePosition`, `textureVelocity`
- Uniforms: マウス座標、経過時間、重み係数

**Process (Velocity Shader):**
- Boids基本3ルール（分離・整列・結合）の計算
  - **同じグループIDの魚同士でのみ適用**
- 壁回避力の加算
- マウスインタラクション（斥力/引力）の加算

**Output:** 更新された `texturePosition`, `textureVelocity`

### B. Rendering Loop (InstancedMesh)

**Input:** GPGPU計算結果のテクスチャ + Static Attributes

**Process (Vertex Shader & Fragment Shader):**
- 座標更新と回転（LookAt）
- 尾ひれアニメーション
- 速度・グループに応じた色彩計算

**Output:** スクリーンへの描画

---

## 4. ディレクトリ構成

```
src/
├── main.js              # エントリーポイント
├── glsl/
│   ├── boids/
│   │   ├── velocity.frag   # 物理演算・移動ロジック
│   │   └── position.frag   # 位置更新
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

## 5. データ構造

### Dynamic Data (GPGPU Textures)

毎フレーム変化する値。

| Texture Name | R (x) | G (y) | B (z) | A (w) |
|---|---|---|---|---|
| `texturePosition` | 位置 X | 位置 Y | 位置 Z | アニメーション位相 |
| `textureVelocity` | 速度 X | 速度 Y | 速度 Z | グループID |

> **グループID**: 同じグループIDを持つ魚同士でのみBoidsルールが適用される。異なるグループの魚は互いを無視する。

### Static Data (Instanced Attributes)

初期化時に決定し、変化しない値。

- `attribute vec2 aReference`: GPGPUテクスチャ参照用UV
- `attribute vec3 aColor`: ベースカラー
- `attribute float aSize`: 基準サイズ
- `attribute float aSeed`: ランダムシード（個体差用）

---

## 6. 魚の制御ロジック (Behavior Blending)

`velocity.frag` では、様々な「力（Force）」をブレンドして最終的な加速度を決定する。

```glsl
float myGroup = vel.w;

vec3 acc = vec3(0.0);

// 1. 壁回避
acc += avoidWalls(pos) * uWallWeight;

// 2. マウスインタラクション
acc += interactMouse(pos, uMouse) * uMouseWeight;

// 3. Boids 3ルール（同じグループのみ）
for each neighbor {
    float otherGroup = otherVel.w;
    if (myGroup == otherGroup) {
        // 分離・整列・結合の計算
    }
}

// 4. 適用
vel.xyz += acc * delta;
// vel.w (グループID) は変更しない
```

---

## 7. 色彩表現

### シェーダーでの色彩ロジック (fish.frag)

```glsl
// ベースカラー（Attribute、グループごとに異なる色を設定可能）
vec3 baseColor = vColor;

// 速度による変化
float speed = length(vVelocity);
vec3 finalColor = mix(baseColor, vec3(1.0, 0.4, 0.2), smoothstep(0.0, 10.0, speed));

// ライティング
float diffuse = max(dot(normalize(vNormal), lightDir), 0.0);
finalColor *= (ambient + diffuse);
```

---

## 8. 開発ロードマップ

### Step 1: ベース構築 ✅

- GPUComputationRenderer セットアップ
- 2枚の計算テクスチャ（position, velocity）を初期化
- 静的データ（Attribute）をInstancedMeshに流し込む処理

### Step 2: Boids実装 ✅

- 基本3ルール（分離・整列・結合）の実装
- 壁回避の実装
- `texturePosition.w` を使った尾ひれアニメーション

### Step 3: グループ機能

- `textureVelocity.w` にグループIDを格納
- velocity.frag でグループIDによるフィルタリング
- グループごとのベースカラー設定

### Step 4: インタラクション

- マウス座標の取得とUniform送信
- マウスへの回避ロジック実装

### Step 5: ビジュアル・ポリッシュ

- 速度ベースの色彩変化
- ポストプロセス（Bloom等）の検討
