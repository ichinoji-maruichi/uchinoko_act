// ===================== スプライト抽出（ゲーム用ラッパ） =====================
// 実処理は共有コア(extract-core.js)。ここではゲームの state(gfx) と結線する。

import { POSES, ESPR_MAP, COLS, ROWS, EX } from './config.js';
import { gfx } from './state.js';
import * as core from './extract-core.js';

// プレイヤー表: 四隅+中央6点でキー色を検出し gfx.KEY に格納
export function detectKeyColor(){
  gfx.KEY = core.detectKeyColor(gfx.srcCanvas);
}

// gfx.srcCanvas を全ポーズ抽出して gfx.FR に格納(despill+膨張あり)
export function extractAll(){
  gfx.FR={};
  const W=gfx.srcCanvas.width, H=gfx.srcCanvas.height;
  const opts={ cols:COLS, rows:ROWS, tol:EX.tol, minsz:EX.minsz, inset:EX.inset, despill:true, dilate:2 };
  for(let idx=0; idx<COLS*ROWS; idx++){
    const pose=POSES[idx]; if(pose===null) continue;
    const res=core.extractCell(gfx.srcCtx, W, H, gfx.KEY, idx%COLS, (idx/COLS)|0, opts);
    if(res) gfx.FR[pose]=res;
  }
}

// 敵表(img)を抽出して { type:[{canvas,white,w,h},...], ... } を返す。
// 左上をキー色に、despill/膨張なし、各スプライトに白版を付ける。
export function extractEnemySheet(img){
  const cv=document.createElement('canvas');
  cv.width=img.naturalWidth; cv.height=img.naturalHeight;
  const cx=cv.getContext('2d',{willReadFrequently:true});
  cx.drawImage(img,0,0);
  const key=core.cornerKeyColor(cv);
  const W=cv.width, H=cv.height;
  const opts={ cols:COLS, rows:ROWS, tol:EX.tol, minsz:EX.minsz, inset:EX.inset, despill:false, dilate:0 };
  const groups={};
  for(let idx=0; idx<COLS*ROWS; idx++){
    const name=ESPR_MAP[idx]; if(!name) continue;
    const res=core.extractCell(cx, W, H, key, idx%COLS, (idx/COLS)|0, opts);
    if(!res) continue;
    if(!groups[name]) groups[name]=[];
    groups[name].push({ canvas:res.canvas, white:core.makeWhite(res), w:res.w, h:res.h });
  }
  return groups;
}
