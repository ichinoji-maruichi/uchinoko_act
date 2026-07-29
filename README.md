# アクションゲーム（コア）

緑背景の5×3スプライト表を読み込んで、自分のキャラを操作するブラウザアクションゲーム。
単一HTMLだった `game_26.html` を、メンテ・機能追加・素材更新をしやすいように
ES モジュール構成へ分割したもの。

## 起動方法

```bash
node server.mjs
```

起動後、ブラウザで **http://localhost:5173** を開く。停止は `Ctrl+C`。

> **なぜサーバーが必要?**
> スプライト抽出は canvas の `getImageData()` でピクセルを読む。
> `file://`（ダブルクリック）で外部PNGを読むとブラウザのセキュリティ制約で
> canvas が汚染され `getImageData()` が失敗するため、http 経由で開く必要がある。

## 遊び方

1. 「お試しマネキンで遊ぶ」を押す（または緑背景の5×3表をドラッグ&ドロップ）。
2. `Enter` / `Space` で開始。

| キー | 操作 |
|---|---|
| ← → | 移動 |
| ↑ / Space | ジャンプ（空中でもう一度で2段ジャンプ） |
| ↓ | しゃがみ |
| Z | 弱攻撃 |
| X | 強攻撃（コンボ） |
| D | 当たり判定の表示切替（デバッグ） |
| P | 練習モード（敵・アイテムが湧かない） |
| M | BGM・効果音のミュート切替 |
| 1〜6 | （練習モード中）敵を出現：1 walker / 2 rusher / 3 brute / 4 flyer / 5 でかきのこ / 6 でかたぬき |

ゲームオーバー時: `Enter`/`R`=同じキャラでリトライ、`L`=別スプライト読込。

## ファイル構成

```
index.html          ゲーム本体。src/main.js を type="module" で読み込む
studio.html         スプライトスタジオ（キャラ表の用意→抽出→プレビュー→書き出し）
styles.css          Windows 95 風スタイル（ゲーム/スタジオ共有）
studio.css          スタジオ固有スタイル
server.mjs          依存ゼロの静的サーバー
assets/             ★素材。PNGを差し替えるだけで見た目を更新できる
  player_default.png  お試しマネキン兼テンプレート（5×3 プレイヤー表）
  enemies.png         敵表（5×3）
  background.png      背景（800×450）
src/
  config.js         全定数（物理・敵タイプ・コンボ・タイミング・パス）
  state.js          実行時状態（GAME/player/world/runtime/gfx）+ reset/pops
  extract-core.js   ★共有スプライト抽出コア（純粋関数。ゲーム/スタジオ共通）
  extract.js        抽出コアのゲーム用ラッパ（プレイヤー/敵）
  assets.js         敵表・背景のロード
  loader.js         プレイヤー画像の読込UI
  input.js          キー入力・フェーズ遷移
  player.js         プレイヤー状態機械・攻撃判定・被弾
  enemies.js        敵の湧き・挙動・撃破
  items.js          回復/偽アイテム
  audio.js          オーディオ基盤(AudioContext・マスター音量・ミュート共有)
  sfx.js            効果音(WebAudioで合成。素材ファイル不要)
  bgm.js            BGM(WebAudioで合成するチップチューンのループ)
  render.js         全描画
  loop.js           固定60fpsループ
  main.js           起動エントリ（全体を配線）
  studio/           スプライトスタジオのモジュール
    config.js         ラベル/クリップ/生成プロンプト等
    state.js          スタジオ状態・DOMヘルパ
    extract-ui.js     抜き調整プレビュー＋14ポーズ抽出グリッド
    anim.js           アニメクリップ再生
    export.js         PNGコンタクトシート/JSON書き出し
    gen.js            生成（ルートB:手動 / ルートA:Gemini API）
    main.js           スタジオ起動エントリ
reference/          元の単一HTML版と仕様書（参照用。動作には不要）
```

## スプライトスタジオ（studio.html）

http://localhost:5173/studio.html を開く（ゲーム画面のリンクからも行ける）。

- **キャラを生成する**
  - **ルートB（無料・おすすめ）**: 「プロンプトをコピー」＋「テンプレート保存」→ Gemini/ChatGPT等の画像生成チャットに、プロンプトを貼り、自分のキャラ絵とテンプレ画像を添付して送信 → できた表を STEP1 に読み込む。
  - **ルートA（要課金・補助）**: Gemini APIキーがあれば、キャラ絵1枚からボタンで自動生成（`<details>` 内）。
- **既存データを使う**: 緑背景の5×3表を読み込む／お試しマネキン。
- 読み込み後: 抜き調整 → 14ポーズ抽出 → 動作プレビュー → PNG/JSON書き出し。
- 生成プロンプトの文面は `src/studio/config.js` の `GEN_PROMPT`。

## よくある調整

- **物理・難易度・敵構成**: `src/config.js` を編集。
- **素材の差し替え**: `assets/` のPNGを同じ形式（5×3・緑背景クロマキー）で上書き。
- **敵の種類を増やす**: `config.js` の `ENEMY_TYPES` と `ESPR_MAP`、`enemies.js` の湧きロジック（`pickType` の重み）。
- **大型敵（でかきのこ/でかたぬき）**: `ENEMY_TYPES` の `giant_*`。`spr` で流用スプライト、`tint` で色を指定。
  でかきのこ=walker の絵 / でかたぬき=brute の絵を流用。色替えは `'color'` 合成で色相のみ差し替え（黒い輪郭・陰影は保持）。
- **効果音の音量**: `config.js` の `SFX_VOLUME`（0〜1）。音自体の変更は `src/sfx.js`。
- **BGM**: `config.js` の `BGM_VOLUME` / `BGM_TEMPO`。メロディ・進行は `src/bgm.js`（`LEAD`/`BASS` 配列）。

## 今後のリファクタ候補

- `extract.js` のプレイヤー用/敵用パイプラインは処理が重複気味。共通コア化の余地あり。
- `render.js` が大きめ。背景/敵/アイテム/HUD などにさらに分割してもよい。
