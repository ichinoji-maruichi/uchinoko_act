// ===================== 抽出UI（プレビュー＋14ポーズ抽出グリッド） =====================
import { POSES, COLS, ROWS } from '../config.js';
import * as core from '../extract-core.js';
import { LABEL_JP, CENTROID_ANCHOR } from './config.js';
import { $, show, studio } from './state.js';
import { buildClips, selectClip } from './anim.js';

// 読み込んだ画像をスタジオのパイプラインに流し込む(ファイル/お試し/生成 共通)
export function loadSheetImage(img){
  studio.srcImg=img;
  const c=document.createElement('canvas');
  c.width=img.naturalWidth; c.height=img.naturalHeight;
  studio.srcCanvas=c; studio.srcCtx=c.getContext('2d',{willReadFrequently:true});
  studio.srcCtx.drawImage(img,0,0);
  detectKeyColor();
  show('tuneGroup'); show('poseGroup'); show('animGroup');
  drawSrcPreview(); extractAll();
}

export function detectKeyColor(){
  studio.KEY = core.detectKeyColor(studio.srcCanvas);
}

// 抜き具合のプレビュー(市松背景に合成＋グリッド線＋キー色スウォッチ)
export function drawSrcPreview(){
  const c=$('srcPrev'); if(!c || !studio.srcCanvas) return;
  const w=studio.srcCanvas.width, h=studio.srcCanvas.height;
  c.width=w; c.height=h;
  const ctx=c.getContext('2d');
  const src=studio.srcCtx.getImageData(0,0,w,h);
  const out=ctx.createImageData(w,h);
  const K=studio.KEY, tol=studio.opts.tol;
  for(let i=0;i<src.data.length;i+=4){
    const r=src.data[i],g=src.data[i+1],b=src.data[i+2];
    const a=core.keyAlpha(K,r,g,b,tol);
    if(a===0){ out.data[i]=43;out.data[i+1]=47;out.data[i+2]=58;out.data[i+3]=255; }
    else {
      const [dr,dg,db]=core.despillPixel(K,r,g,b);
      const bg = ((i>>2)%2)^(((i>>2)/w|0)%2) ? 43 : 51;   // 市松
      const af=a/255;
      out.data[i]=Math.round(dr*af+bg*(1-af));
      out.data[i+1]=Math.round(dg*af+bg*(1-af));
      out.data[i+2]=Math.round(db*af+bg*(1-af));
      out.data[i+3]=255;
    }
  }
  ctx.putImageData(out,0,0);
  const sw=$('keySwatch'), kv=$('keyVal');
  if(sw){ sw.style.background=`rgb(${K.r},${K.g},${K.b})`; kv.textContent=`RGB(${K.r},${K.g},${K.b})`; }
  ctx.strokeStyle='rgba(255,80,80,.7)'; ctx.lineWidth=Math.max(1,w/600);
  for(let cx=1;cx<COLS;cx++){const x=w*cx/COLS;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
  for(let ry=1;ry<ROWS;ry++){const y=h*ry/ROWS;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
}

// 全ポーズを抽出してグリッド表示。frames を更新し、クリップを再構築。
export function extractAll(){
  studio.frames={};
  const grid=$('grid'); grid.innerHTML='';
  const W=studio.srcCanvas.width, H=studio.srcCanvas.height;
  const opts={ cols:COLS, rows:ROWS, tol:studio.opts.tol, minsz:studio.opts.minsz, inset:studio.opts.inset, despill:true, dilate:2 };
  for(let idx=0;idx<COLS*ROWS;idx++){
    const pose=POSES[idx];
    const col=idx%COLS, row=(idx/COLS)|0;
    const cell=document.createElement('div'); cell.className='cell';
    if(pose===null){ cell.classList.add('empty'); grid.appendChild(cell); continue; }
    const res=core.extractCell(studio.srcCtx, W, H, studio.KEY, col, row, opts);
    const tag=document.createElement('div'); tag.className='tag'; tag.textContent=LABEL_JP[pose]||pose;
    cell.appendChild(tag);
    if(res){
      studio.frames[pose]=res;
      const cv=document.createElement('canvas'); cv.width=res.w; cv.height=res.h;
      cv.getContext('2d').drawImage(res.canvas,0,0);
      cell.appendChild(cv);
      const an=document.createElement('div'); an.className='anchor';
      an.textContent=CENTROID_ANCHOR.has(pose)?'重心':'足元';
      cell.appendChild(an);
    } else {
      cell.classList.add('empty');
      const m=document.createElement('div'); m.style.color='#f88'; m.style.fontSize='10px';
      m.textContent='×'; cell.appendChild(m);
    }
    grid.appendChild(cell);
  }
  buildClips();
  selectClip(studio.curClip || "歩く");
}
