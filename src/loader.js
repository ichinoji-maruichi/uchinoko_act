// ===================== 読み込み（プレイヤー画像） =====================
// 緑背景の5×3スプライト表をドラッグ&ドロップ/クリックで読み込む。
import { TARGET_H, ASSETS } from './config.js';
import { gfx, runtime, resetGame } from './state.js';
import { detectKeyColor, extractAll } from './extract.js';
import { startLoop } from './loop.js';
import { bgm } from './bgm.js';

// 処理中オーバーレイ(index.htmlの#loading)の表示切替。
function showLoading(text){
  const el=document.getElementById('loading'); if(!el) return;
  const t=document.getElementById('loadingText'); if(t && text) t.textContent=text;
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
}
function hideLoading(){
  const el=document.getElementById('loading'); if(!el) return;
  el.classList.remove('show'); el.setAttribute('aria-hidden','true');
}

function loadFile(file){
  showLoading('画像を読み込み中…');
  const img=new Image();
  img.onload=()=>bootFromImage(img);
  img.onerror=()=>{ hideLoading(); alert('画像を読み込めませんでした。'); };
  img.src=URL.createObjectURL(file);
}

function bootFromImage(img){
  showLoading('スプライトを抽出中…');
  // 抽出(extractAll)は同期処理でUIをブロックするため、先にローディングを1回描画させてから実行する。
  // (rAFはタブ非表示時に止まるので、確実に走る setTimeout で1フレームぶん遅延させる)
  setTimeout(()=>{
    try{
      gfx.srcCanvas=document.createElement('canvas');
      gfx.srcCanvas.width=img.naturalWidth; gfx.srcCanvas.height=img.naturalHeight;
      gfx.srcCtx=gfx.srcCanvas.getContext('2d',{willReadFrequently:true});
      gfx.srcCtx.drawImage(img,0,0);
      detectKeyColor(); extractAll();
    }catch(e){
      hideLoading(); alert('読み込み中にエラー: '+e.message); return;
    }
    const got=Object.keys(gfx.FR).length;
    if(!gfx.FR.idle){
      hideLoading();
      alert('スプライトを抽出できませんでした（'+got+'ポーズ検出）。緑背景の5×3表か確認してください。');
      return;
    }
    // idle基準で全ポーズ共通のスケール係数を算出（相対サイズは保たれる）
    runtime.SCALE = TARGET_H / gfx.FR.idle.h;
    setLandingVisible(false);
    document.getElementById('stageWrap').style.display='block';
    window.scrollTo(0,0);
    hideLoading();
    enterReady();
  }, 32);
}

// ランディング一式(ヘッダ/本文/フッタ)の表示切替。ゲーム中は隠す。
function setLandingVisible(on){
  const disp = on ? '' : 'none';
  ['landing','siteHeader','siteFooter'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.style.display=disp;
  });
  // ゲーム中は背景（放射グラデ＋斜めライン）を消して無地に
  document.body.classList.toggle('game-active', !on);
  document.documentElement.classList.toggle('game-active', !on);
}

// スプライト読込後: ゲーム画面は表示するが、Enterで開始する待機状態へ
function enterReady(){
  runtime.PHASE='ready';
  resetGame();
  startLoop();
}

// ローダー画面に戻る（別スプライトを読み込ませてリトライ）
export function backToLoader(){
  bgm.stop();
  runtime.PHASE='ready';
  runtime.paused=false;
  document.getElementById('stageWrap').style.display='none';
  setLandingVisible(true);
}

// ローダーUI(ドロップ・ファイル選択・お試しボタン)を配線する
export function setupLoader(){
  const drop=document.getElementById('drop');
  const fileInput=document.getElementById('file');
  drop.addEventListener('click',()=>fileInput.click());
  ['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hot');}));
  ['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hot');}));
  drop.addEventListener('drop',ev=>{const f=ev.dataTransfer.files[0];if(f)loadFile(f);});
  fileInput.addEventListener('change',ev=>{const f=ev.target.files[0];if(f)loadFile(f);});
  document.getElementById('useDefault').addEventListener('click',()=>{
    showLoading('サンプルを読み込み中…');
    const img=new Image();
    img.onload=()=>bootFromImage(img);
    img.onerror=()=>{ hideLoading(); alert('サンプル画像を読み込めませんでした。'); };
    img.src=ASSETS.playerDefault;
  });
}
