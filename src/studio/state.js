// ===================== スタジオの実行時状態 =====================
export const $ = id => document.getElementById(id);
export function show(id, on=true){ const el=$(id); if(el) el.style.display = on ? '' : 'none'; }

export const studio = {
  srcImg: null,
  srcCanvas: null,          // 読み込んだスプライト表
  srcCtx: null,
  KEY: { r:0, g:255, b:34 }, // クロマキー色(読み込み時に四隅から更新)
  frames: {},               // pose -> {canvas,w,h,footY,cx,cy}
  opts: { tol:120, minsz:200, inset:3 },  // 抜き調整(スライダー)
  curClip: null,            // 再生中クリップ名
};

// Blob保存の共通ヘルパ
export function saveBlob(blob, name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
