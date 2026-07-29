// ===================== タッチ操作(スマホ) =====================
// 画面下部に十字ボタン(←→↑↓)と攻撃2ボタン(弱/強)を出す。
// やっていることは state.js の keys を true/false するだけで、
// ゲームロジック(player.js など)には一切触れない。キーボードと自然に共存する。
import { keys, runtime, GAME } from './state.js';
import { startGame } from './input.js';

// タッチ端末判定: 指などの粗いポインタを持つ端末のみ対象(PCは従来どおりキーボード)。
function isTouchDevice(){
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window);
}

// keys のキー名 / 表示ラベル / 追加クラス
const BTNS = [
  { k:'up',    label:'↑', cls:'tp-up'    },
  { k:'left',  label:'←', cls:'tp-left'  },
  { k:'right', label:'→', cls:'tp-right' },
  { k:'down',  label:'↓', cls:'tp-down'  },
  { k:'light', label:'弱', cls:'tp-light' },
  { k:'heavy', label:'強', cls:'tp-heavy' },
];

export function setupTouch(){
  if(!isTouchDevice()) return;
  document.body.classList.add('has-touch');

  // --- DOM 構築 ---
  const pad = document.createElement('div');
  pad.id = 'touchpad';

  const dpad    = document.createElement('div'); dpad.className = 'tp-dpad';
  const actions = document.createElement('div'); actions.className = 'tp-actions';

  // pointerId -> 押下中ボタン要素。マルチタッチ(移動しながら攻撃)を成立させ、
  // 指を離した/画面外に出たときに確実にキーを戻すために持つ。
  const active = new Map();

  function makeBtn({ k, label, cls }){
    const b = document.createElement('button');
    b.className = 'tp-btn ' + cls;
    b.type = 'button';
    b.textContent = label;
    b.dataset.k = k;
    b.addEventListener('pointerdown', e=>{
      e.preventDefault();
      keys[k] = true;
      b.classList.add('is-on');
      active.set(e.pointerId, b);
    });
    // pointerup/cancel は下の window リスナで一括処理(スタック防止)
    return b;
  }

  for(const def of BTNS){
    const b = makeBtn(def);
    (def.k==='light' || def.k==='heavy' ? actions : dpad).appendChild(b);
  }
  pad.appendChild(dpad);
  pad.appendChild(actions);
  document.getElementById('stageWrap').appendChild(pad);

  // 指を離す/キャンセルされたら、そのポインタが押していたボタンのキーを戻す。
  function release(e){
    const b = active.get(e.pointerId);
    if(!b) return;
    keys[b.dataset.k] = false;
    b.classList.remove('is-on');
    active.delete(e.pointerId);
  }
  addEventListener('pointerup', release);
  addEventListener('pointercancel', release);

  // START待ち / ゲームオーバー中は、画面タップで開始・リトライ(Enter相当)。
  const stage = document.getElementById('stage');
  stage.addEventListener('pointerdown', e=>{
    if(runtime.paused) return;
    if(GAME.over || (runtime.PHASE==='ready' && !GAME.over)){
      startGame();
    }
  });
}
