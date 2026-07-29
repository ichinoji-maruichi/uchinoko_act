// ===================== アニメ再生プレビュー =====================
import { CLIPS, CENTROID_ANCHOR } from './config.js';
import { $, studio } from './state.js';

let stage=null, sctx=null;
let clipList=[], playIdx=0, lastT=0, playing=false;

// クリップ選択ボタンを敷き詰める。必要なポーズが1つも無いクリップは無効化。
export function buildClips(){
  const box=$('clips'); if(!box) return; box.innerHTML='';
  Object.keys(CLIPS).forEach(name=>{
    const ok=CLIPS[name].seq.some(p=>studio.frames[p]);
    const b=document.createElement('button');
    b.textContent=name; b.disabled=!ok;
    if(name===studio.curClip) b.classList.add('on');
    b.addEventListener('click',()=>selectClip(name));
    box.appendChild(b);
  });
}

export function selectClip(name){
  studio.curClip=name;
  const seq=(CLIPS[name]?.seq || ['idle']).filter(p=>studio.frames[p]);
  clipList = seq.length ? seq : ['idle'].filter(p=>studio.frames[p]);
  playIdx=0; lastT=0; playing=true;
  [...document.querySelectorAll('#clips button')].forEach(b=>
    b.classList.toggle('on', b.textContent===name));
}

function draw(pose){
  sctx.clearRect(0,0,stage.width,stage.height);
  const f=studio.frames[pose]; if(!f) return;
  const z=+$('zoom').value, dir=+$('dir').value;
  const gx=stage.width/2;
  const groundY=stage.height-24;
  sctx.save();
  sctx.imageSmoothingEnabled=false;
  let drawX, drawY;
  if(CENTROID_ANCHOR.has(pose)){
    drawX=gx - (f.cx*z)*dir;
    drawY=(stage.height*0.42) - f.cy*z;
  } else {
    drawX=gx - (f.w/2)*z;
    drawY=groundY - f.footY*z;
  }
  sctx.translate(gx,0); sctx.scale(dir,1); sctx.translate(-gx,0);
  const dx = dir===1 ? drawX : (stage.width-drawX-f.w*z);
  sctx.drawImage(f.canvas,0,0,f.w,f.h, dx,drawY, f.w*z,f.h*z);
  sctx.restore();
  sctx.strokeStyle='rgba(255,255,255,.15)';
  sctx.beginPath(); sctx.moveTo(0,groundY+0.5); sctx.lineTo(stage.width,groundY+0.5); sctx.stroke();
}

function loop(t){
  requestAnimationFrame(loop);
  if(!playing || !clipList.length || !sctx) return;
  const fps=+$('fps').value, interval=1000/fps;
  if(t-lastT<interval) return;
  lastT=t;
  const clip=CLIPS[studio.curClip] || {loop:true};
  draw(clipList[playIdx]);
  playIdx++;
  if(playIdx>=clipList.length){
    if(clip.loop) playIdx=0;
    else if(clip.tail) playIdx=clipList.length-1;   // 最終フレームで静止
    else playIdx=0;
  }
}

// アニメ関連UIの配線＋ループ開始
export function setupAnim(){
  stage=$('stage'); sctx=stage.getContext('2d');
  $('fps').addEventListener('input',()=>$('fpsV').textContent=$('fps').value);
  $('zoom').addEventListener('input',()=>$('zoomV').textContent=$('zoom').value+'×');
  requestAnimationFrame(loop);
}
