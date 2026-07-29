// ===================== エントリポイント =====================
// 各モジュールを配線し、アセット読み込み・入力・ローダーUIを起動する。
// index.html から <script type="module" src="src/main.js"> で読み込まれる。
import { loadEnemySprites, loadBackground, loadLogo } from './assets.js';
import { setupInput } from './input.js';
import { setupTouch } from './touch.js';
import { setupLoader } from './loader.js';

loadEnemySprites();   // 敵スプライトを起動時に読み込む
loadBackground();     // 背景画像を読み込む
loadLogo();           // タイトルロゴ(ready画面。無ければ非表示)
setupInput();         // キー入力を配線
setupTouch();         // タッチ操作(スマホのみ自動表示)を配線
setupLoader();        // ローダーUI(ドロップ/お試しボタン)を配線
