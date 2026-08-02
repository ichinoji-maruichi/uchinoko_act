// ===================== ゲーム画面のHUDボタン（PC向け） =====================
// キャンバス下のキー一覧を「操作方法 / 練習 / ミュート / メニュー」の4ボタンに集約し、
// 細かい操作は「操作方法」パネルで見せる。モードによって中身と表示を出し分ける。
// スマホは touch.js が独自のボタン(#tp-sys)を出すので、こちらは has-touch のとき隠す。
import { runtime, world } from './state.js';
import { toggleMute, isMuted } from './audio.js';

const $ = id => document.getElementById(id);

// 操作方法の中身。共通の操作＋モード固有の操作を並べる。
function helpLines(){
  const common = [
    ['←　→', '移動'],
    ['↑（スペース）', 'ジャンプ／空中でもう一度押すと2段ジャンプ'],
    ['↓', runtime.MODE==='vs' ? 'ガード（対戦では防御になります）' : 'しゃがみ'],
    ['Z', '弱攻撃'],
    ['X', '強攻撃（3段。3段目は大きく吹っ飛ばす）'],
    ['↑ + Z', 'ジャンプアッパー（高く跳びながら攻撃）'],
  ];
  const vs = [
    ['←← ／ →→', 'ダッシュ（同じ方向キーを2回押す）'],
    ['攻撃を合わせる', '相殺。ダメージなしで弾き返す'],
    ['↓ を押しっぱなし', 'ガード。削りダメージは受ける／強3段目で崩される'],
  ];
  const act = [
    ['P', '練習モード（敵が湧かない）'],
    ['1〜6', '練習モード中に敵を出す'],
  ];
  return common.concat(runtime.MODE==='vs' ? vs : act);
}

function renderHelp(){
  const body = $('helpBody'); if(!body) return;
  $('helpTitle').textContent = runtime.MODE==='vs' ? '操作方法（対戦格闘モード）' : '操作方法';
  body.innerHTML = helpLines()
    .map(([k,v]) => '<div class="help-row"><span class="help-key">'+k+'</span><span>'+v+'</span></div>')
    .join('');
}

function openHelp(){
  renderHelp();
  runtime.helpOpen = true;     // 開いている間はゲームを止める(loop.js が見る)
  $('helpModal').classList.add('show');
  $('helpModal').setAttribute('aria-hidden','false');
}
export function closeHelp(){
  runtime.helpOpen = false;
  const el = $('helpModal'); if(!el) return;
  el.classList.remove('show');
  el.setAttribute('aria-hidden','true');
}

function syncMuteLabel(){ $('hintMute').classList.toggle('is-off', isMuted()); }

// モードに応じてボタンの出し分けを更新する。ゲーム画面を出すたびに呼ぶ。
export function syncHud(){
  // 対戦モードでだけ出したい要素(スマホのガード/ダッシュボタン等)の切り替え
  document.body.classList.toggle('mode-vs', runtime.MODE==='vs');
  const prac = $('hintPrac'); if(!prac) return;
  // 練習モードは1人用専用(対戦には敵がいない)
  prac.style.display = runtime.MODE==='vs' ? 'none' : '';
  prac.classList.toggle('is-on', runtime.PRACTICE);
  syncMuteLabel();
  closeHelp();
}

export function setupHud(){
  $('hintHelp').addEventListener('click', ()=>{
    if(runtime.helpOpen) closeHelp(); else openHelp();
  });
  $('helpClose').addEventListener('click', closeHelp);
  // パネルの外側をクリックしても閉じる
  $('helpModal').addEventListener('click', e=>{ if(e.target===$('helpModal')) closeHelp(); });

  $('hintPrac').addEventListener('click', e=>{
    if(runtime.MODE==='vs') return;
    runtime.PRACTICE = !runtime.PRACTICE;
    if(runtime.PRACTICE){ world.enemies.length=0; runtime.giantsPending=0; }
    e.currentTarget.classList.toggle('is-on', runtime.PRACTICE);
  });

  $('hintMute').addEventListener('click', ()=>{ toggleMute(); syncMuteLabel(); });

  $('hintMenu').addEventListener('click', ()=>{
    if(runtime.PHASE!=='playing') return;   // 開始前・演出中・決着後は別画面
    closeHelp();
    runtime.paused = !runtime.paused;
  });
}
