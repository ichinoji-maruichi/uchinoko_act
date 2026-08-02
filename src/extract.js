// ===================== スプライト抽出（ゲーム用ラッパ） =====================
// 実処理は共有コア(extract-core.js)。ここではゲーム側のポーズ配置と結線する。
// 対戦格闘モードで2キャラ分を別々に読み込むため、このモジュールは状態を持たず
// 抽出結果を戻り値で返す(呼び出し側がファイターへ格納する)。

import { POSES, ESPR_MAP, COLS, ROWS, EX, LYING_POSES, LYING_ANCHOR_FRAC } from './config.js';
import * as core from './extract-core.js';

// 横たわりポーズの接地アンカー(footY)を「本体の下端」に補正する。
// 各行の前景ピクセル数を数え、最大行幅の LYING_ANCHOR_FRAC 以上ある一番下の行を本体下端とみなす。
// 髪・尻尾など細い突起(=行幅が小さい)はこの下に来ても無視されるので、本体が接地する。
// 揺れ物がないキャラは最下行付近も十分な幅があるため footY≒bh となり従来と変わらない。
function lyingFootY(res){
  const { canvas, w, h } = res;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const rows = new Array(h).fill(0); let maxc = 0;
  for(let y=0; y<h; y++){
    let c=0; const base=y*w*4;
    for(let x=0; x<w; x++) if(d[base+x*4+3] > 128) c++;
    rows[y]=c; if(c>maxc) maxc=c;
  }
  if(maxc===0) return h;
  const th = maxc * LYING_ANCHOR_FRAC;
  for(let y=h-1; y>=0; y--) if(rows[y] >= th) return y+1;
  return h;
}

// プレイヤー表(5×3)を1枚まるごと抽出し、pose -> frame のテーブルを返す(despill+膨張あり)。
// キー色は四隅+中央6点から自動検出する。抽出できなかったポーズはキーごと存在しない。
export function extractPlayerSheet(img){
  const cv=document.createElement('canvas');
  cv.width=img.naturalWidth; cv.height=img.naturalHeight;
  const cx=cv.getContext('2d',{willReadFrequently:true});
  cx.drawImage(img,0,0);
  const key=core.detectKeyColor(cv);
  const W=cv.width, H=cv.height;
  const opts={ cols:COLS, rows:ROWS, tol:EX.tol, minsz:EX.minsz, inset:EX.inset, despill:true, dilate:2 };
  const FR={};
  for(let idx=0; idx<COLS*ROWS; idx++){
    const pose=POSES[idx]; if(!pose) continue;
    const res=core.extractCell(cx, W, H, key, idx%COLS, (idx/COLS)|0, opts);
    if(res){
      // 横たわりポーズは本体下端を接地アンカーにする(髪・尻尾の垂れ下がりで浮くのを防ぐ)
      if(LYING_POSES.includes(pose)) res.footY = lyingFootY(res);
      FR[pose]=res;
    }
  }
  return FR;
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
