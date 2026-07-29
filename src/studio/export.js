// ===================== 書き出し（PNGコンタクトシート / アニメJSON） =====================
import { POSES, COLS, ROWS } from '../config.js';
import { CLIPS, CENTROID_ANCHOR } from './config.js';
import { $, studio, saveBlob } from './state.js';

// 14ポーズを1枚のコンタクトシートPNG(5×3配置・足元揃え)として書き出し
function exportSheet(){
  const frames=studio.frames;
  const keys=Object.keys(frames);
  if(!keys.length) return;
  const maxW=Math.max(...keys.map(k=>frames[k].w));
  const maxH=Math.max(...keys.map(k=>frames[k].h));
  const pad=8, fw=maxW+pad, fh=maxH+pad;
  const cc=document.createElement('canvas');
  cc.width=fw*COLS; cc.height=fh*ROWS;
  const cx=cc.getContext('2d'); cx.imageSmoothingEnabled=false;
  POSES.forEach((pose,idx)=>{
    if(!pose||!frames[pose])return;
    const f=frames[pose], col=idx%COLS, row=(idx/COLS)|0;
    const px=col*fw+((fw-f.w)>>1);
    const py=row*fh+(fh-f.h-4);   // 足元下端そろえ
    cx.drawImage(f.canvas,px,py);
  });
  cc.toBlob(b=>saveBlob(b,'sprites_extracted.png'));
}

// ポーズのメタ情報＋クリップ定義をJSONで書き出し
function exportJson(){
  const meta={cols:COLS,rows:ROWS,poses:{},clips:CLIPS};
  Object.keys(studio.frames).forEach(k=>{
    const f=studio.frames[k];
    meta.poses[k]={ w:f.w, h:f.h, footY:f.footY, cx:Math.round(f.cx), cy:Math.round(f.cy),
      anchor:CENTROID_ANCHOR.has(k)?'centroid':'foot' };
  });
  saveBlob(new Blob([JSON.stringify(meta,null,2)],{type:'application/json'}), 'sprite_meta.json');
}

export function setupExport(){
  $('dlZip').addEventListener('click', exportSheet);
  $('dlJson').addEventListener('click', exportJson);
}
