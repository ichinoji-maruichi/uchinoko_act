// ===================== アセット読み込み =====================
// 敵スプライトと背景を assets/ 配下のPNGから読み込む。
// ※ getImageData を使うためローカルサーバー経由(http)で開く必要がある。

import { ASSETS } from './config.js';
import { gfx } from './state.js';
import { extractEnemySheet } from './extract.js';

// 敵スプライト(enemies.png)を抽出して gfx.ESPR に格納。
// 抽出失敗時は空のまま → 描画側が色付きの丸でフォールバックする。
export function loadEnemySprites(){
  const img=new Image();
  img.onload=()=>{ gfx.ESPR=extractEnemySheet(img); };
  img.src=ASSETS.enemies;
}

// 背景画像(森)を読み込む。失敗時は render() 側でグラデ背景にフォールバック。
export function loadBackground(){
  const im=new Image();
  im.onload =()=>{ gfx.bgImg=im; gfx.bgReady=true; };
  im.onerror=()=>{ gfx.bgReady=false; };
  im.src=ASSETS.background;
}

// タイトルロゴを読み込む。無ければ ready画面はテキストのみ(フォールバック)。
export function loadLogo(){
  const im=new Image();
  im.onload =()=>{ gfx.logo=im; gfx.logoReady=true; };
  im.onerror=()=>{ gfx.logoReady=false; };
  im.src=ASSETS.logo;
}
