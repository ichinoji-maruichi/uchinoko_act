// ===================== ランディング（ヒーロー演出＋準備セクション） =====================
import { POSES, COLS, ROWS, EX } from './config.js';
import * as core from './extract-core.js';
import { GEN_PROMPT, TEMPLATE_A_SRC, TEMPLATE_B_SRC } from './studio/config.js';
import { TEMPLATE_SRC } from './studio/config.js';

const $ = id => document.getElementById(id);

// 素材（後で差し替え）。無ければフォールバック。
const HERO_SPRITE_SRC = 'assets/hero-sprite.png';   // 見本キャラのスプライト表
const HERO_ILLUST_SRC = 'assets/hero-illust.png';   // 見本キャラの元イラスト
const LOGO_SRC        = 'assets/logo.png';          // タイトルロゴ

// ---------- テンプレDL / プロンプトコピー（スタジオと同じ内容を再利用） ----------
function saveBlob(blob,name){
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);
}
async function dlTemplate(src,name){
  try{ const r=await fetch(src); if(!r.ok) throw new Error('見つかりません'); saveBlob(await r.blob(),name);
    $('landStatus').textContent=name+' を保存しました。'; }
  catch(e){ $('landStatus').textContent='保存に失敗: '+e.message; }
}
function setupPrepare(){
  $('copyPromptLand').addEventListener('click',()=>{
    navigator.clipboard.writeText(GEN_PROMPT).then(()=>{
      $('landStatus').textContent='プロンプトをコピーしました。生成チャットに貼り付けて、キャラ絵とテンプレート画像を添付してください。';
    }).catch(()=>{
      $('landStatus').innerHTML='自動コピーできませんでした。下の文をコピーしてください。';
      const ta=document.createElement('textarea'); ta.value=GEN_PROMPT;
      ta.style.cssText='width:100%;height:150px;margin-top:8px'; $('landStatus').appendChild(ta); ta.select();
    });
  });
  $('dlTplA').addEventListener('click',()=>dlTemplate(TEMPLATE_A_SRC,'sprite-template-a.png'));
  $('dlTplB').addEventListener('click',()=>dlTemplate(TEMPLATE_B_SRC,'sprite-template-b.png'));
}

// ---------- ヒーローの動くスプライト ----------
function extractSheet(img){
  const c=document.createElement('canvas'); c.width=img.naturalWidth; c.height=img.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true}); ctx.drawImage(img,0,0);
  const key=core.detectKeyColor(c);
  const opts={cols:COLS,rows:ROWS,tol:EX.tol,minsz:EX.minsz,inset:EX.inset,despill:true,dilate:2};
  const fr={};
  for(let i=0;i<COLS*ROWS;i++){ const p=POSES[i]; if(!p)continue;
    const r=core.extractCell(ctx,c.width,c.height,key,i%COLS,(i/COLS|0),opts); if(r)fr[p]=r; }
  return fr;
}
// 見せ場クリップ(歩く→攻撃→ジャンプ→やられ)
const DEMO=['idle','idle','walk_start','walk1','walk_start','walk2','walk_start','walk1','walk2','walk_start',
  'atk_start','atk1','atk2','atk3','idle','crouch','jump_up','jump_down','idle','idle','damage','knockback','down','idle'];

function startHero(fr){
  const cv=$('heroSprite'); if(!cv) return;
  const ctx=cv.getContext('2d');
  const seq=DEMO.filter(p=>fr[p]); if(!seq.length) return;
  const groundY=cv.height-14, topMargin=22;   // 頭上に明確な余白を確保
  const lift={ jump_up:20, jump_down:10 };     // ジャンプは少し浮かせて見せる
  // 全ポーズ(持ち上げ量込み)がキャンバスに収まる共通スケール＋足元アンカー。
  // 相対サイズを保ちつつ、背の高いポーズやジャンプで頭が切れないようにする。
  let maxExt=0, maxW=0;
  for(const p of seq){ const f=fr[p]; maxExt=Math.max(maxExt, f.h+(lift[p]||0)); maxW=Math.max(maxW, f.w); }
  const z=Math.min((groundY-topMargin)/maxExt, (cv.width*0.86)/maxW);
  let i=0,last=0; const fps=8;
  function loop(t){
    requestAnimationFrame(loop);
    if(t-last<1000/fps) return; last=t;
    const pose=seq[i%seq.length]; i++;
    const f=fr[pose];
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.imageSmoothingEnabled=false;
    const dw=f.w*z, dh=f.h*z, yOff=(lift[pose]||0)*z;
    ctx.drawImage(f.canvas,0,0,f.w,f.h, (cv.width-dw)/2, groundY-dh-yOff, dw,dh);
    ctx.strokeStyle='rgba(0,0,0,.12)'; ctx.beginPath();
    ctx.moveTo(0,groundY+0.5); ctx.lineTo(cv.width,groundY+0.5); ctx.stroke();
  }
  requestAnimationFrame(loop);
}
function loadHero(){
  const tryLoad=(src,onok,onfail)=>{ const im=new Image(); im.onload=()=>onok(im); im.onerror=onfail; im.src=src; };
  // after: スプライト（見本 → 無ければマネキン）
  tryLoad(HERO_SPRITE_SRC, im=>startHero(extractSheet(im)),
    ()=> tryLoad(TEMPLATE_SRC, im=>startHero(extractSheet(im)), ()=>{}));
  // before: イラスト（見本 → 無ければプレースホルダのまま）
  tryLoad(HERO_ILLUST_SRC, im=>{ const box=$('heroIllust'); box.innerHTML=''; box.appendChild(im); im.style.maxHeight='210px'; }, ()=>{});
  // ロゴ（あれば差し替え）
  tryLoad(LOGO_SRC, im=>{ const box=$('heroLogo'); box.innerHTML=''; im.className='hero-logo'; box.appendChild(im); }, ()=>{});
}

setupPrepare();
loadHero();
