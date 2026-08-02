// ===================== 入力 =====================
import { KEYMAP } from './config.js';
import { keys, runtime, GAME, world, vs, resetGame } from './state.js';
import { backToCharSelect } from './vsui.js';

// CPUの強さを よわい→ふつう→つよい で巡回させる(メニューのDキー)
const CPU_LEVELS = ['easy','normal','hard'];
function cycleCpuLevel(){
  vs.cpuLevel = CPU_LEVELS[(CPU_LEVELS.indexOf(vs.cpuLevel)+1) % CPU_LEVELS.length];
  sfx.coin();
}
import { backToLoader } from './loader.js';
import { spawnEnemy } from './enemies.js';
import { resetVsMatch, startVsIntro } from './vs.js';
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
// 対戦モードは READY→3→2→1→FIGHT! の演出を挟んでから開始する。
export function startGame(){
  if(runtime.MODE==='vs'){
    startVsIntro();          // 中で resetVsMatch と PHASE='intro' を行う
    bgm.start();
    return;
  }
  runtime.PHASE='playing';
  resetGame();
  sfx.start(); bgm.start();
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
    // ゲームオーバー/決着: Enter/R=リトライ、D=CPUの強さ変更、C=キャラ選び直し、Q=終了
    if(GAME.over){
      if(e.code==='Enter'||e.code==='KeyR'){
        startGame(); e.preventDefault();  // 同じ組み合わせで即リトライ
      } else if(runtime.MODE==='vs' && e.code==='KeyD'){
        cycleCpuLevel(); e.preventDefault();
      } else if(runtime.MODE==='vs' && e.code==='KeyC'){
        backToCharSelect(); e.preventDefault();
      } else if(e.code==='KeyQ'){
        backToLoader(); e.preventDefault();
      }
      return;
    }
    // 一時停止メニュー中: R=リトライ / D=強さ変更 / C=キャラ選び直し / Q=終了 / Esc=つづける
    if(runtime.paused){
      if(e.code==='KeyR'){
        runtime.paused=false;
        if(runtime.MODE==='vs'){ startVsIntro(); }
        else { resetGame(); sfx.start(); }
        e.preventDefault();
      }
      else if(runtime.MODE==='vs' && e.code==='KeyD'){ cycleCpuLevel(); e.preventDefault(); }
      else if(runtime.MODE==='vs' && e.code==='KeyC'){ runtime.paused=false; backToCharSelect(); e.preventDefault(); }
      else if(e.code==='KeyQ'){ backToLoader(); e.preventDefault(); }
      else if(e.code==='Escape'){ runtime.paused=false; e.preventDefault(); }
      return;
    }
    // プレイ中に Esc で一時停止メニューを開く
    if(e.code==='Escape'){ runtime.paused=true; e.preventDefault(); return; }
    const k=KEYMAP[e.code]; if(k){keys[k]=true; e.preventDefault();}
    if(e.code==='KeyD'){ runtime.DEBUG=!runtime.DEBUG; e.preventDefault(); }  // 当たり判定の可視化ON/OFF
    // 練習モードと敵の手動出現はアクションモード専用(対戦モードには敵がいない)
    if(runtime.MODE!=='vs'){
      if(e.code==='KeyP'){ runtime.PRACTICE=!runtime.PRACTICE; if(runtime.PRACTICE){ world.enemies=[]; runtime.giantsPending=0; } e.preventDefault(); }
      // 練習モード中: 数字キーで指定した敵を出現(敵確認用)
      if(runtime.PRACTICE && PRACTICE_SPAWN[e.code]){ spawnEnemy(PRACTICE_SPAWN[e.code]); e.preventDefault(); }
    }
  });
  addEventListener('keyup',e=>{
    const k=KEYMAP[e.code]; if(k){keys[k]=false; e.preventDefault();}
  });
}
