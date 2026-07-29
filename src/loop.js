// ===================== ゲームループ =====================
// requestAnimationFrame ベースの固定タイムステップ(60fps基準)。
import { STEP_MS } from './config.js';
import { GAME, runtime } from './state.js';
import { updatePlayer } from './player.js';
import { updateEnemies } from './enemies.js';
import { updateItems } from './items.js';
import { updatePops } from './state.js';
import { render } from './render.js';

export function startLoop(){
  if(runtime.running)return; runtime.running=true;
  runtime.last=0; runtime.acc=0;
  requestAnimationFrame(loop);
}

function loop(t){
  requestAnimationFrame(loop);
  if(!runtime.running)return;
  try{
    if(!runtime.last){ runtime.last=t; render(); return; }
    let dt=t-runtime.last; runtime.last=t;
    if(!isFinite(dt)||dt<0) dt=STEP_MS;
    if(dt>100) dt=100;
    runtime.acc+=dt;
    // START待ち・一時停止中はゲームを進めず、描画だけ更新
    if(runtime.PHASE==='ready' && !GAME.over){ runtime.acc=0; render(); return; }
    if(runtime.paused && !GAME.over){ runtime.acc=0; render(); return; }
    let guard=0;
    while(runtime.acc>=STEP_MS && guard<5){
      if(!GAME.over) updatePlayer();
      updateEnemies();
      updateItems();
      updatePops();
      runtime.acc-=STEP_MS; guard++;
    }
    render();
  }catch(e){
    if(!runtime.errShown){ runtime.errShown=true; console.error('ループ内エラー:',e); }
  }
}
