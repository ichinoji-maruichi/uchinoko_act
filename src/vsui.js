// ===================== 対戦モードのUI（2枚投入 → キャラ選択） =====================
// ランディングの「対戦格闘モード」セクションで2キャラ分のスプライト表を読み込み、
// キャラ選択画面(DOM)でどちらを操作するか決めて試合を始める。
// 選択画面をcanvasではなくDOMにしているのは、タッチ操作の実装を二重に持たずに
// スマホでもそのまま押せるようにするため。
import { ASSETS } from './config.js';
import { runtime, vs } from './state.js';
import { extractPlayerSheet } from './extract.js';
import { showLoading, hideLoading, showStage, setLandingVisible } from './loader.js';
import { startVsMatch } from './vs.js';
import { startLoop } from './loop.js';
import { bgm } from './bgm.js';

const $ = id => document.getElementById(id);

// ランディング側とキャラ選択画面側、どちらの状態表示にも同じ文言を出す。
// (差し替えはどちらの画面からでもできるので、見えている方に出れば良い)
function setStatus(msg){
  for(const id of ['vsStatus','vsSelStatus']){
    const el=$(id); if(el) el.textContent=msg;
  }
}

// 抽出済みポーズ表の idle を、指定canvasに収まるよう縮小して描く(投入確認用のプレビュー)。
// flip=true で左右反転。元絵は右向きなので、右側に置くキャラを反転すると向かい合う。
function drawPreview(cv, FR, flip=false){
  const ctx=cv.getContext('2d');
  ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,cv.width,cv.height);
  const f=FR && FR.idle; if(!f) return;
  const pad=8;
  const z=Math.min((cv.width-pad*2)/f.w, (cv.height-pad*2)/f.h);
  const dw=f.w*z, dh=f.h*z;
  ctx.save();
  ctx.imageSmoothingEnabled=false;
  // キャンバス中央で反転する。描画は左右中央寄せなので位置はそのままで良い。
  if(flip){ ctx.translate(cv.width,0); ctx.scale(-1,1); }
  ctx.drawImage(f.canvas, 0,0,f.w,f.h, (cv.width-dw)/2, cv.height-pad-dh, dw,dh);
  ctx.restore();
}

function isSelectOpen(){
  const el=$('vsSelect');
  return !!el && el.style.display==='block';
}

// スロット i の見た目(ランディングの投入枠とキャラ選択画面のカード)をまとめて更新する。
// 選択画面から差し替えた時も、裏にあるランディング側の表示がズレないようにする。
function refreshSlotViews(i){
  const n=i+1;
  drawPreview($('prevVs'+n), vs.sheets[i]);
  // キャラ選択画面は左右に並べて対戦カードに見せるので、右側(キャラ2)だけ反転して向かい合わせる
  drawPreview($('selPrev'+n), vs.sheets[i], i===1);
  const nameEl=$('selName'+n); if(nameEl) nameEl.textContent=vs.names[i];
  const drop=$('dropVs'+n); if(drop) drop.classList.toggle('filled', !!vs.sheets[i]);
}

// スロット i (0/1) に画像を読み込んで抽出し、プレビューを描く。
function loadSlot(i, img, label){
  let FR;
  try{
    FR=extractPlayerSheet(img);
  }catch(e){
    hideLoading(); setStatus('読み込み中にエラー: '+e.message); return;
  }
  if(!FR.idle){
    hideLoading();
    setStatus('キャラ'+(i+1)+': スプライトを抽出できませんでした（'+Object.keys(FR).length+'ポーズ検出）。緑背景の5×3表か確認してください。');
    return;
  }
  vs.sheets[i]=FR;
  vs.names[i]=label;
  refreshSlotViews(i);
  hideLoading();
  const n=vs.sheets.filter(Boolean).length;
  // キャラ選択画面から差し替えた時は「あと何キャラ」ではなく差し替えた旨を出す
  if(isSelectOpen()){
    setStatus('キャラ'+(i+1)+' を「'+label+'」に差し替えました（'+Object.keys(FR).length+'ポーズ）。');
  } else {
    setStatus(n>=2 ? '2キャラそろいました！「キャラを選ぶ」に進んでください。'
                   : 'キャラ'+(i+1)+' を読み込みました（'+Object.keys(FR).length+'ポーズ）。あと'+(2-n)+'キャラ。');
  }
  $('vsGo').disabled = n<2;
}

function loadSlotFromFile(i, file){
  showLoading('画像を読み込み中…');
  const img=new Image();
  img.onload =()=>setTimeout(()=>loadSlot(i, img, file.name.replace(/\.[^.]+$/,'')), 32);
  img.onerror=()=>{ hideLoading(); setStatus('画像を読み込めませんでした。'); };
  img.src=URL.createObjectURL(file);
}

function loadSlotSample(i){
  showLoading('サンプルを読み込み中…');
  const img=new Image();
  img.onload =()=>setTimeout(()=>loadSlot(i, img, 'サンプル'), 32);
  img.onerror=()=>{ hideLoading(); setStatus('サンプル画像を読み込めませんでした。'); };
  img.src=ASSETS.playerDefault;
}

// 試合中/決着後に、キャラ選択画面へ戻る（読み込んだ2キャラはそのまま使う）
export function backToCharSelect(){
  bgm.stop();
  runtime.MODE='action';   // 選択し直すまでは対戦の描画・更新を止める
  runtime.PHASE='ready';
  runtime.paused=false;
  document.getElementById('stageWrap').style.display='none';
  openSelect();
}

// キャラ選択画面へ
function openSelect(){
  if(vs.sheets.filter(Boolean).length<2) return;
  setLandingVisible(false);
  $('vsSelect').style.display='block';
  refreshSlotViews(0); refreshSlotViews(1);
  setStatus('');
  window.scrollTo(0,0);
}

// 選択画面 → 試合開始待ち(READY)へ
function chooseAndStart(idx){
  vs.playerIdx=idx;
  const lv=document.querySelector('input[name="cpuLevel"]:checked');
  vs.cpuLevel = lv ? lv.value : 'normal';
  runtime.MODE='vs';
  runtime.PHASE='ready';
  runtime.PRACTICE=false;
  showStage();
  startVsMatch();
  startLoop();
}

export function setupVsUi(){
  for(let i=0;i<2;i++){
    const n=i+1;
    const drop=$('dropVs'+n), file=$('fileVs'+n);
    if(!drop) continue;
    drop.addEventListener('click',()=>file.click());
    ['dragover','dragenter'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('hot');}));
    ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('hot');}));
    drop.addEventListener('drop',e=>{ const f=e.dataTransfer.files[0]; if(f) loadSlotFromFile(i,f); });
    file.addEventListener('change',e=>{ const f=e.target.files[0]; if(f) loadSlotFromFile(i,f); });
    $('sampleVs'+n).addEventListener('click',()=>loadSlotSample(i));
  }
  $('vsGo').addEventListener('click', openSelect);
  $('selVs1').addEventListener('click', ()=>chooseAndStart(0));
  $('selVs2').addEventListener('click', ()=>chooseAndStart(1));

  // キャラ選択画面でも画像を差し替えられるようにする。
  // ボタンからのファイル選択と、カードへのドラッグ&ドロップの両方を受ける。
  for(let i=0;i<2;i++){
    const n=i+1;
    const card=$('selCard'+n), swap=$('selSwap'+n), file=$('selFile'+n);
    if(!card) continue;
    swap.addEventListener('click', ()=>file.click());
    file.addEventListener('change', e=>{ const f=e.target.files[0]; if(f) loadSlotFromFile(i,f); e.target.value=''; });
    ['dragover','dragenter'].forEach(ev=>card.addEventListener(ev,e=>{e.preventDefault();card.classList.add('hot');}));
    ['dragleave','drop'].forEach(ev=>card.addEventListener(ev,e=>{e.preventDefault();card.classList.remove('hot');}));
    card.addEventListener('drop', e=>{ const f=e.dataTransfer.files[0]; if(f) loadSlotFromFile(i,f); });
  }
  $('vsBack').addEventListener('click', ()=>{
    $('vsSelect').style.display='none';
    setLandingVisible(true);
    $('versus').scrollIntoView();
  });
}
