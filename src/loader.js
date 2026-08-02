// ===================== 読み込み（プレイヤー画像） =====================
// 緑背景の5×3スプライト表をドラッグ&ドロップ/クリックで読み込む。
import { TARGET_H, ASSETS } from './config.js';
import { player, runtime, resetGame, stage, sctx, VIEW_W, VIEW_H } from './state.js';
import { extractPlayerSheet } from './extract.js';
import { startLoop } from './loop.js';
import { syncHud } from './hud.js';
import { bgm } from './bgm.js';

// 処理中オーバーレイ(index.htmlの#loading)の表示切替。
export function showLoading(text){
  const el=document.getElementById('loading'); if(!el) return;
  const t=document.getElementById('loadingText'); if(t && text) t.textContent=text;
  el.classList.add('show'); el.setAttribute('aria-hidden','false');
}
export function hideLoading(){
  const el=document.getElementById('loading'); if(!el) return;
  el.classList.remove('show'); el.setAttribute('aria-hidden','true');
}

// キャンバスのバックストア解像度を「実表示サイズ×dpr」に合わせ、
// 論理座標(VIEW_W×VIEW_H)→物理ピクセルへ拡大する基準トランスフォームを張る。
// これで従来の「800×450 → CSS表示サイズ(例:900px)」というブラウザ側の二段目の拡縮
// (ドット絵の線が間引かれて細く見える主因の一つ)をなくす。論理サイズは不変なので
// キャラの見た目の大きさや当たり判定・物理は一切変わらない。
export function fitStage(){
  const wrap=document.getElementById('stageWrap');
  if(!wrap || wrap.style.display==='none') return;   // 非表示中は正しく測れない
  const cssW=stage.clientWidth;
  if(!cssW) return;
  const dpr=Math.min(3, Math.max(1, window.devicePixelRatio||1));   // 高dprでも上限3で暴走防止
  const cssH=cssW*VIEW_H/VIEW_W;                       // 論理比を厳守してアスペクトのドリフトを防ぐ
  stage.width =Math.round(cssW*dpr);
  stage.height=Math.round(cssH*dpr);
  // stage.width/height への代入でコンテキスト状態はリセットされるため基準変換を張り直す
  sctx.setTransform(stage.width/VIEW_W, 0, 0, stage.height/VIEW_H, 0, 0);
  sctx.imageSmoothingEnabled=false;
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
  // 抽出(extractPlayerSheet)は同期処理でUIをブロックするため、先にローディングを1回描画させてから実行する。
  // (rAFはタブ非表示時に止まるので、確実に走る setTimeout で1フレームぶん遅延させる)
  setTimeout(()=>{
    let FR;
    try{
      FR=extractPlayerSheet(img);
    }catch(e){
      hideLoading(); alert('読み込み中にエラー: '+e.message); return;
    }
    const got=Object.keys(FR).length;
    if(!FR.idle){
      hideLoading();
      alert('スプライトを抽出できませんでした（'+got+'ポーズ検出）。緑背景の5×3表か確認してください。');
      return;
    }
    // 抽出したポーズ表と、idle基準の共通スケール係数をファイターへ渡す
    // (キャラごとに身長が違うため、倍率もキャラごとに持つ。相対サイズは保たれる)
    player.FR = FR;
    player.SCALE = TARGET_H / FR.idle.h;
    player.boxScale = player.SCALE;   // アクションモードは従来どおり描画倍率＝判定倍率
    runtime.MODE='action';            // showStage内のHUD更新より先にモードを確定させる
    showStage();
    hideLoading();
    enterReady();
  }, 32);
}

// ランディング一式(ヘッダ/本文/フッタ)の表示切替。ゲーム中は隠す。
export function setLandingVisible(on){
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
  runtime.MODE='action';
  runtime.PHASE='ready';
  resetGame();
  startLoop();
}

// ゲーム画面(canvas)を表示状態にする。対戦モードのキャラ選択からも使う。
export function showStage(){
  setLandingVisible(false);
  document.getElementById('vsSelect').style.display='none';
  document.getElementById('stageWrap').style.display='block';
  fitStage();   // 表示直後の実サイズでバックストア解像度を確定
  window.scrollTo(0,0);
  syncHud();    // モードに応じてHUDボタンの出し分けを更新
}

// ローダー画面に戻る（別スプライトを読み込ませてリトライ）
export function backToLoader(){
  bgm.stop();
  runtime.MODE='action';
  runtime.PHASE='ready';
  runtime.paused=false;
  document.getElementById('stageWrap').style.display='none';
  document.getElementById('vsSelect').style.display='none';
  setLandingVisible(true);
}

// ローダーUI(ドロップ・ファイル選択・お試しボタン)を配線する
export function setupLoader(){
  // 画面回転・リサイズ・ブラウザズーム(dpr変化)でバックストア解像度を追従させる
  window.addEventListener('resize', fitStage);
  window.addEventListener('orientationchange', fitStage);
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
