// ===================== タッチ操作(スマホ) =====================
// 左側にフローティングの仮想スティック(バーチャルパッド)、右側に攻撃2ボタン(弱/強)。
// スティックは触れた場所に出現し、指の方向に応じて state.js の keys(左右上下)を
// true/false するだけ。ゲームロジック(player.js など)には一切触れない。
//   ・左右 = 移動  ・下 = しゃがみ  ・上 = ジャンプ(上+弱でジャンプアッパー)
// キーボードと自然に共存する。
import { keys, runtime, GAME, world } from './state.js';
import { startGame } from './input.js';
import { backToLoader } from './loader.js';

// タッチ端末判定: 指などの粗いポインタを持つ端末のみ対象(PCは従来どおりキーボード)。
function isTouchDevice(){
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
      || ('ontouchstart' in window);
}

// START待ち / ゲームオーバー中のタップは「開始/リトライ(Enter相当)」。
function isMenuTap(){
  return GAME.over || (runtime.PHASE==='ready' && !GAME.over);
}

export function setupTouch(){
  if(!isTouchDevice()) return;
  document.body.classList.add('has-touch');

  // --- DOM 構築 ---
  const pad = document.createElement('div');
  pad.id = 'touchpad';

  // 左: 仮想スティック領域(広い当たり判定)。触れた点に base が出て knob が指を追う。
  const stick = document.createElement('div'); stick.className = 'tp-stick';
  const base  = document.createElement('div'); base.className  = 'tp-stick-base';
  const knob  = document.createElement('div'); knob.className  = 'tp-stick-knob';
  base.appendChild(knob); stick.appendChild(base);

  // 右: 攻撃ボタン(弱/強)
  const actions = document.createElement('div'); actions.className = 'tp-actions';

  pad.appendChild(stick);
  pad.appendChild(actions);
  document.getElementById('stageWrap').appendChild(pad);

  // ===== 仮想スティック =====
  const MAXR = 46;   // knob が動ける最大半径(px)
  const DEAD = 12;   // これ以上倒すと方向ON(遊び)
  let stickId = null, baseX = 0, baseY = 0;
  // ジャンプは「スティック上」と「専用ジャンプボタン」の両方から入る。
  // 互いに keys.up を奪い合わないよう、それぞれの状態を OR して keys.up に反映する。
  let stickUp = false;
  const jumpPointers = new Set();   // ジャンプボタンを押している pointerId 群
  function applyUp(){ keys.up = stickUp || jumpPointers.size>0; }

  function clearDir(){ keys.left=keys.right=keys.down=false; stickUp=false; applyUp(); }

  // 触れていない間は左の定位置(CSSのhome)に薄く表示 → 操作できると分かるように。
  // 触れたらその位置へ移動し、離したら定位置へ戻る。
  function homeStick(){
    base.style.left = ''; base.style.top = '';   // インラインを消してCSSのhomeへ戻す
    knob.style.transform = 'translate(-50%,-50%)';
    stick.classList.remove('is-dragging');
  }
  stick.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(isMenuTap()){ startGame(); return; }   // 開始画面ではタップで開始
    if(stickId!==null) return;                 // 既に別の指が使用中
    stickId = e.pointerId;
    baseX = e.clientX; baseY = e.clientY;
    const r = stick.getBoundingClientRect();
    base.style.left = (e.clientX - r.left) + 'px';   // 触れた場所へ移動
    base.style.top  = (e.clientY - r.top)  + 'px';
    stick.classList.add('is-dragging');
    knob.style.transform = 'translate(-50%,-50%)';
    try{ stick.setPointerCapture(e.pointerId); }catch(_){/* 一部端末で未対応 */}
  });
  stick.addEventListener('pointermove', e=>{
    if(e.pointerId!==stickId) return;
    e.preventDefault();
    let dx = e.clientX - baseX, dy = e.clientY - baseY;
    const dist = Math.hypot(dx, dy);
    if(dist > MAXR){ dx = dx/dist*MAXR; dy = dy/dist*MAXR; }
    knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    // 左右＝移動 / 下＝しゃがみ / 上＝ジャンプ(専用ジャンプボタンと併用)
    keys.left  = dx < -DEAD;
    keys.right = dx >  DEAD;
    keys.down  = dy >  DEAD;
    stickUp    = dy < -DEAD;
    applyUp();
  });
  function endStick(e){
    if(e.pointerId!==stickId) return;
    stickId = null;
    homeStick();       // 定位置に戻す(表示は残す)
    clearDir();
  }
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // ===== 攻撃ボタン(弱/強) =====
  // pointerId -> 押下中ボタン。マルチタッチ(移動しながら攻撃)と確実なキー戻しのため保持。
  const active = new Map();
  function makeActionBtn(k, label, cls){
    const b = document.createElement('button');
    b.className = 'tp-btn ' + cls;
    b.type = 'button';
    b.textContent = label;
    b.dataset.k = k;
    b.addEventListener('pointerdown', e=>{
      e.preventDefault();
      if(isMenuTap()){ startGame(); return; }
      keys[k] = true;
      b.classList.add('is-on');
      active.set(e.pointerId, b);
    });
    return b;
  }
  // ジャンプ = 専用ボタン(スティック上でも可)。タップ2回で2段ジャンプ、ジャンプ+弱でアッパー。
  // keys.up は applyUp() で stickUp と OR するため、独自に押下 pointerId を管理する。
  const jumpBtn = document.createElement('button');
  jumpBtn.type='button'; jumpBtn.className='tp-btn tp-jump'; jumpBtn.textContent='ジャンプ';
  jumpBtn.addEventListener('pointerdown', e=>{
    e.preventDefault();
    if(isMenuTap()){ startGame(); return; }
    jumpPointers.add(e.pointerId); applyUp(); jumpBtn.classList.add('is-on');
  });
  function releaseJump(e){
    if(jumpPointers.delete(e.pointerId)){ applyUp(); if(jumpPointers.size===0) jumpBtn.classList.remove('is-on'); }
  }
  addEventListener('pointerup', releaseJump);
  addEventListener('pointercancel', releaseJump);
  actions.appendChild(jumpBtn);
  actions.appendChild(makeActionBtn('light', '弱', 'tp-light'));
  actions.appendChild(makeActionBtn('heavy', '強', 'tp-heavy'));

  function releaseAction(e){
    const b = active.get(e.pointerId);
    if(!b) return;
    keys[b.dataset.k] = false;
    b.classList.remove('is-on');
    active.delete(e.pointerId);
  }
  addEventListener('pointerup', releaseAction);
  addEventListener('pointercancel', releaseAction);

  // 移動・攻撃の全キーを戻す(メニューを開く時などに巻き戻し防止)
  function clearAllKeys(){
    stickUp=false; jumpPointers.clear();
    keys.left=keys.right=keys.up=keys.down=keys.light=keys.heavy=false;
    homeStick();
  }

  // ===== システムボタン(あそび方 / 練習 / メニュー) 右上に常設 =====
  const sys = document.createElement('div'); sys.id='tp-sys';
  function sysBtn(label, cls, handler){
    const b=document.createElement('button'); b.type='button'; b.className='tp-sysbtn '+cls; b.textContent=label;
    b.addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); handler(b); });
    return b;
  }
  const btnPrac = sysBtn('練習', 'tp-prac', (b)=>{
    runtime.PRACTICE=!runtime.PRACTICE;
    if(runtime.PRACTICE){ world.enemies.length=0; runtime.giantsPending=0; }
    b.classList.toggle('is-on', runtime.PRACTICE);
  });
  const btnMenu = sysBtn('≡ メニュー', 'tp-menu', ()=>{
    if(GAME.over || runtime.PHASE!=='playing') return;   // ready/over は別表示
    runtime.paused=!runtime.paused; clearAllKeys();
  });
  sys.append(sysBtn('？ あそび方','tp-help',()=>{ manualGuide=true; }), btnPrac, btnMenu);
  document.getElementById('stageWrap').appendChild(sys);

  // ===== オーバーレイ(あそび方ガイド / 一時停止・ゲームオーバーのメニュー) =====
  const overlay = document.createElement('div'); overlay.id='tp-overlay';
  const panel = document.createElement('div'); panel.className='tp-panel';
  overlay.appendChild(panel);
  document.getElementById('stageWrap').appendChild(overlay);

  function mbtn(label, cls, on){
    const b=document.createElement('button'); b.type='button'; b.className='tp-mbtn '+(cls||''); b.textContent=label;
    b.addEventListener('pointerdown', e=>{ e.preventDefault(); e.stopPropagation(); on(); });
    return b;
  }
  function buildGuide(isReady){
    panel.innerHTML='';
    const h=document.createElement('div'); h.className='tp-ptitle'; h.textContent='あそび方'; panel.appendChild(h);
    const g=document.createElement('div'); g.className='tp-guide';
    g.innerHTML=[
      '<b>移動</b>：スティックを左右',
      '<b>しゃがみ</b>：スティックを下',
      '<b>ジャンプ</b>：ジャンプボタン（スティックを上でも可）',
      '<b>2段ジャンプ</b>：空中でジャンプをもう一度（ボタンが押しやすい）',
      '<b>ジャンプアッパー</b>：ジャンプ＋弱を同時<br><span class="tp-note">高く飛んで攻撃。飛ぶ敵や回復アイテムに強い（弱を押しながらジャンプが確実）</span>',
      '<b>攻撃</b>：弱 ／ 強',
    ].map(s=>'<div class="tp-gline">'+s+'</div>').join('');
    panel.appendChild(g);
    const row=document.createElement('div'); row.className='tp-mrow';
    row.appendChild(isReady ? mbtn('▶ はじめる','primary',()=>startGame())
                            : mbtn('閉じる','primary',()=>{ manualGuide=false; }));
    panel.appendChild(row);
  }
  function buildMenu(isOver){
    panel.innerHTML='';
    const h=document.createElement('div'); h.className='tp-ptitle'; h.textContent=isOver?'GAME OVER':'一時停止'; panel.appendChild(h);
    if(isOver){ const s=document.createElement('div'); s.className='tp-pscore'; s.textContent='SCORE '+GAME.score; panel.appendChild(s); }
    const row=document.createElement('div'); row.className='tp-mrow';
    if(!isOver) row.appendChild(mbtn('つづける','primary',()=>{ runtime.paused=false; }));
    row.appendChild(mbtn('リトライ', isOver?'primary':'', ()=>startGame()));
    row.appendChild(mbtn('最初の画面へ','', ()=>backToLoader()));
    row.appendChild(mbtn('あそび方','ghost',()=>{ manualGuide=true; }));
    panel.appendChild(row);
  }

  // ゲーム状態に合わせてオーバーレイを出し分ける(毎フレーム監視、変化時のみ再構築)。
  let manualGuide=false, lastKey='';
  function syncOverlay(){
    let key='hidden';
    // ゲーム画面(game-active)の時だけ表示。ランディング(読み込み前)では出さない。
    if(document.body.classList.contains('game-active')){
      if(manualGuide)                    key='guide';   // ？ボタン or メニューの「あそび方」
      else if(GAME.over)                 key='over';
      else if(runtime.paused)            key='paused';
      else if(runtime.PHASE!=='playing') key='ready';   // START待ち → ガイドを見せてから開始
      else                               key='hidden';
    }
    if(key!==lastKey){
      lastKey=key;
      if(key==='hidden'){ overlay.classList.remove('show'); document.body.classList.remove('tp-modal'); }
      else{
        overlay.classList.add('show'); document.body.classList.add('tp-modal'); clearAllKeys();
        if(key==='guide')      buildGuide(false);
        else if(key==='ready') buildGuide(true);
        else                   buildMenu(key==='over');
      }
    }
    requestAnimationFrame(syncOverlay);
  }
  requestAnimationFrame(syncOverlay);

  // パッドの外側(キャンバス)をタップしたときも開始/リトライできるように(オーバーレイ非表示時の保険)。
  const stage = document.getElementById('stage');
  stage.addEventListener('pointerdown', e=>{
    if(runtime.paused || document.body.classList.contains('tp-modal')) return;
    if(isMenuTap()) startGame();
  });
}
