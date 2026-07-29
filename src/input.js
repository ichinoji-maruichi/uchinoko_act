// ===================== 入力 =====================
import { KEYMAP } from './config.js';
import { keys, runtime, GAME, world, resetGame } from './state.js';
import { backToLoader } from './loader.js';
import { spawnEnemy } from './enemies.js';
import { sfx } from './sfx.js';
import { bgm } from './bgm.js';
import { toggleMute } from './audio.js';

// 練習モード中に数字キーで出せる敵(敵確認用)
// 1:walker 2:rusher 3:brute 4:flyer 5:でかきのこ 6:でかたぬき
const PRACTICE_SPAWN = {
  Digit1:'walker', Digit2:'rusher', Digit3:'brute', Digit4:'flyer',
  Digit5:'giant_mushroom', Digit6:'giant_tanuki'
};

// START/リトライ共通処理。キーボード(Enter/R)とタッチ(画面タップ)から呼ぶ。
export function startGame(){
  runtime.PHASE='playing'; resetGame(); sfx.start(); bgm.start();
}

export function setupInput(){
  addEventListener('keydown',e=>{
    // START待ち: Enter/Space でゲーム開始
    // Mキー: BGM・SFX まとめてミュート切替（AudioContextのアンロックも兼ねる）
    if(e.code==='KeyM'){ toggleMute(); e.preventDefault(); return; }
    if(runtime.PHASE==='ready' && !GAME.over){
      if(e.code==='Enter'||e.code==='Space'){
        startGame(); e.preventDefault();
      }
      return;
    }
    // ゲームオーバー: Enter/R=同じキャラでリトライ、Q=終了(最初の画面へ)
    if(GAME.over){
      if(e.code==='Enter'||e.code==='KeyR'){
        startGame(); e.preventDefault();  // 同じキャラで即リトライ
      } else if(e.code==='KeyQ'){
        backToLoader(); e.preventDefault();
      }
      return;
    }
    // 一時停止メニュー中: R=リトライ / Q=終了(最初の画面へ) / Esc=つづける
    if(runtime.paused){
      if(e.code==='KeyR'){ resetGame(); sfx.start(); runtime.paused=false; e.preventDefault(); }
      else if(e.code==='KeyQ'){ backToLoader(); e.preventDefault(); }
      else if(e.code==='Escape'){ runtime.paused=false; e.preventDefault(); }
      return;
    }
    // プレイ中に Esc で一時停止メニューを開く
    if(e.code==='Escape'){ runtime.paused=true; e.preventDefault(); return; }
    const k=KEYMAP[e.code]; if(k){keys[k]=true; e.preventDefault();}
    if(e.code==='KeyP'){ runtime.PRACTICE=!runtime.PRACTICE; if(runtime.PRACTICE){ world.enemies=[]; runtime.giantsPending=0; } e.preventDefault(); }
    // 練習モード中: 数字キーで指定した敵を出現(敵確認用)
    if(runtime.PRACTICE && PRACTICE_SPAWN[e.code]){ spawnEnemy(PRACTICE_SPAWN[e.code]); e.preventDefault(); }
  });
  addEventListener('keyup',e=>{
    const k=KEYMAP[e.code]; if(k){keys[k]=false; e.preventDefault();}
  });
}
