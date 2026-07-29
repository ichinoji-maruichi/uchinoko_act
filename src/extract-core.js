// ===================== 共有スプライト抽出コア（純粋関数） =====================
// クロマキー → 最大連結成分 → bbox切り出し →(despill)→(縁の膨張) を1セル分行う。
// ゲーム(プレイヤー/敵)とスプライトスタジオで共有する。状態(state)には依存しない。

// クロマキー色の自動検出: 四隅+上下中央の6点平均(プレイヤー/スタジオ用)
export function detectKeyColor(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const w=canvas.width,h=canvas.height;
  const pts=[[0,0],[w-1,0],[0,h-1],[w-1,h-1],[(w/2)|0,0],[(w/2)|0,h-1]];
  let sr=0,sg=0,sb=0;
  for(const [x,y] of pts){ const d=ctx.getImageData(x,y,1,1).data; sr+=d[0];sg+=d[1];sb+=d[2]; }
  return {r:Math.round(sr/pts.length),g:Math.round(sg/pts.length),b:Math.round(sb/pts.length)};
}
// 左上1ピクセルをキー色にする(敵表用)
export function cornerKeyColor(canvas){
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const d=ctx.getImageData(0,0,1,1).data; return {r:d[0],g:d[1],b:d[2]};
}

function keyness(K,r,g,b){
  const mx=Math.max(K.r,K.g,K.b);
  if(K.g===mx) return g-Math.max(r,b);
  if(K.b===mx) return b-Math.max(r,g);
  return r-Math.max(g,b);
}
// キー色からの距離→アルファ(0..255)。プレビュー等でも使うため公開。
export function keyAlpha(K,r,g,b,tol){
  const k=keyness(K,r,g,b); const hi=tol,lo=-10;
  const a=(hi-k)/(hi-lo);
  return a<=0?0:a>=1?255:Math.round(a*255);
}
// 緑かぶり除去。プレビュー等でも使うため公開。
export function despillPixel(K,r,g,b){
  const mx=Math.max(K.r,K.g,K.b);
  if(K.g===mx && g>Math.max(r,b)) return [r,Math.max(r,b),b];
  if(K.b===mx && b>Math.max(r,g)) return [r,g,Math.max(r,g)];
  if(K.r===mx && r>Math.max(g,b)) return [Math.max(g,b),g,b];
  return [r,g,b];
}

// 1セルを抽出して {canvas,w,h,footY,cx,cy} を返す(抽出できなければ null)。
// opts: {cols,rows,tol,minsz,inset,despill(bool),dilate(回数)}
export function extractCell(srcCtx, srcW, srcH, key, col, row, opts){
  const { cols, rows, tol, minsz, inset, despill, dilate } = opts;
  // AI生成の表は行/列が均等に割れていないことがある。機械割り(幅÷cols・高÷rows)だと
  // コマ境界がキャラ(頭など)に食い込んで欠ける。各コマを少し広げて見て、緑の隙間で
  // 区切られた「最大の連結塊＝そのキャラ全体」を拾えば、ズレていても欠けない。
  // (正常に収まっているコマは最大塊が変わらないので結果は不変)
  const padFrac = opts.padFrac ?? 0.13;
  const cw=srcW/cols, ch=srcH/rows, ins=inset;
  const padY=Math.round(ch*padFrac), padX=Math.round(cw*padFrac*0.5);
  const x0=Math.max(0,     Math.floor(col*cw)+ins-padX);
  const y0=Math.max(0,     Math.floor(row*ch)+ins-padY);
  const x1=Math.min(srcW,  Math.floor((col+1)*cw)-ins+padX);
  const y1=Math.min(srcH,  Math.floor((row+1)*ch)-ins+padY);
  const sw=x1-x0, sh=y1-y0; if(sw<=0||sh<=0) return null;
  const img=srcCtx.getImageData(x0,y0,sw,sh);
  const alpha=new Uint8Array(sw*sh), fg=new Uint8Array(sw*sh);
  for(let p=0,i=0;p<sw*sh;p++,i+=4){
    const a=keyAlpha(key,img.data[i],img.data[i+1],img.data[i+2],tol);
    alpha[p]=a; fg[p]=a>128?1:0;
  }
  // 最大連結成分(4近傍フラッドフィル)
  const lbl=new Int32Array(sw*sh); let best=0,bestSize=0,cur=0; const st=[];
  for(let s=0;s<sw*sh;s++){
    if(fg[s]&&!lbl[s]){
      cur++; let size=0; st.length=0; st.push(s); lbl[s]=cur;
      while(st.length){
        const q=st.pop(); size++; const qx=q%sw,qy=(q/sw)|0;
        if(qx>0){const n=q-1;if(fg[n]&&!lbl[n]){lbl[n]=cur;st.push(n);}}
        if(qx<sw-1){const n=q+1;if(fg[n]&&!lbl[n]){lbl[n]=cur;st.push(n);}}
        if(qy>0){const n=q-sw;if(fg[n]&&!lbl[n]){lbl[n]=cur;st.push(n);}}
        if(qy<sh-1){const n=q+sw;if(fg[n]&&!lbl[n]){lbl[n]=cur;st.push(n);}}
      }
      if(size>bestSize){bestSize=size;best=cur;}
    }
  }
  if(bestSize<minsz) return null;
  let minx=sw,miny=sh,maxx=0,maxy=0,sumx=0,sumy=0,cnt=0;
  for(let p=0;p<sw*sh;p++)if(lbl[p]===best){
    const px=p%sw,py=(p/sw)|0;
    if(px<minx)minx=px;if(px>maxx)maxx=px;if(py<miny)miny=py;if(py>maxy)maxy=py;
    sumx+=px;sumy+=py;cnt++;
  }
  // マスク(必要なら縁を膨張してアンチエイリアスの取りこぼしを拾う)
  const mask=new Uint8Array(sw*sh);
  for(let p=0;p<sw*sh;p++) mask[p]=(lbl[p]===best)?1:0;
  for(let it=0; it<(dilate||0); it++){
    const s2=mask.slice();
    for(let y=0;y<sh;y++)for(let x=0;x<sw;x++){
      const p=y*sw+x; if(s2[p])continue;
      if((x>0&&s2[p-1])||(x<sw-1&&s2[p+1])||(y>0&&s2[p-sw])||(y<sh-1&&s2[p+sw]))mask[p]=1;
    }
  }
  const bw=maxx-minx+1, bh=maxy-miny+1;
  const oc=document.createElement('canvas'); oc.width=bw; oc.height=bh;
  const octx=oc.getContext('2d'); const od=octx.createImageData(bw,bh);
  for(let yy=0;yy<bh;yy++)for(let xx=0;xx<bw;xx++){
    const sp=(miny+yy)*sw+(minx+xx), di=(yy*bw+xx)*4;
    if(mask[sp]&&alpha[sp]>0){
      const si=sp*4;
      let dr=img.data[si],dg=img.data[si+1],db=img.data[si+2];
      if(despill){ const c=despillPixel(key,dr,dg,db); dr=c[0];dg=c[1];db=c[2]; }
      od.data[di]=dr;od.data[di+1]=dg;od.data[di+2]=db;od.data[di+3]=alpha[sp];
    } else od.data[di+3]=0;
  }
  octx.putImageData(od,0,0);
  return { canvas:oc, w:bw, h:bh, footY:bh, cx:(sumx/cnt)-minx, cy:(sumy/cnt)-miny };
}

// 抽出済みフレームの「白版」(色を白にしてアルファは維持)を生成。被弾/消滅の白飛ばし用。
export function makeWhite(frame){
  const { canvas, w, h } = frame;
  const src=canvas.getContext('2d').getImageData(0,0,w,h);
  const wc=document.createElement('canvas'); wc.width=w; wc.height=h;
  const wctx=wc.getContext('2d'); const wd=wctx.createImageData(w,h);
  for(let p=0;p<w*h;p++){ const d=p*4; wd.data[d]=255; wd.data[d+1]=255; wd.data[d+2]=255; wd.data[d+3]=src.data[d+3]; }
  wctx.putImageData(wd,0,0); return wc;
}
