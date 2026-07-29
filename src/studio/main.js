// ===================== スプライトスタジオ エントリポイント =====================
import { TEMPLATE_SRC } from './config.js';
import { $, show, studio } from './state.js';
import { loadSheetImage, drawSrcPreview, extractAll } from './extract-ui.js';
import { setupAnim } from './anim.js';
import { setupExport } from './export.js';
import { setupGen } from './gen.js';

// ---- モード選択 ----
$('modeGen').addEventListener('click',()=>{
  $('modeGen').classList.add('on'); $('modeExisting').classList.remove('on');
  show('charGroup'); show('loadGroup');
});
$('modeExisting').addEventListener('click',()=>{
  $('modeExisting').classList.add('on'); $('modeGen').classList.remove('on');
  show('charGroup',false); show('loadGroup');
});

// ---- STEP1: スプライト表の読み込み(ファイル/お試し) ----
function loadFile(file){
  const img=new Image();
  img.onload=()=>{ loadSheetImage(img); $('tuneGroup').scrollIntoView({behavior:'smooth'}); };
  img.src=URL.createObjectURL(file);
}
const drop=$('drop'), fileInput=$('file');
drop.addEventListener('click',()=>fileInput.click());
['dragover','dragenter'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.add('hot');}));
['dragleave','drop'].forEach(e=>drop.addEventListener(e,ev=>{ev.preventDefault();drop.classList.remove('hot');}));
drop.addEventListener('drop',ev=>{const f=ev.dataTransfer.files[0];if(f)loadFile(f);});
fileInput.addEventListener('change',ev=>{const f=ev.target.files[0];if(f)loadFile(f);});
$('useDefault').addEventListener('click',()=>{
  const img=new Image();
  img.onload=()=>{ loadSheetImage(img); $('tuneGroup').scrollIntoView({behavior:'smooth'}); };
  img.src=TEMPLATE_SRC;
});

// ---- STEP2: 抜き調整スライダー ----
function bindSlider(id,vid){
  const el=$(id), out=$(vid);
  const upd=()=>{ studio.opts[id]=+el.value; out.textContent=el.value; };
  el.addEventListener('input',()=>{ upd(); if(studio.srcCanvas){ drawSrcPreview(); extractAll(); } });
  upd();
}
bindSlider('tol','tolV'); bindSlider('minsz','minszV'); bindSlider('inset','insetV');

// ---- 各機能の配線 ----
setupGen();      // 生成(ルートA/B)
setupExport();   // 書き出し
setupAnim();     // アニメプレビュー(ループ開始)
