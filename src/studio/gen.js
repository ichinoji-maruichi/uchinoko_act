// ===================== 生成補助（ルートB: 手動） =====================
// プロンプトをコピーして、外部の画像生成チャット(Gemini/ChatGPT等)で作る。
// テンプレートは A(通常版) / B(拡張版) / C(頭身アップ版) の3種類をダウンロードできる。
import { GEN_PROMPT, TEMPLATE_A_SRC, TEMPLATE_B_SRC, TEMPLATE_C_SRC } from './config.js';
import { $, saveBlob } from './state.js';

async function downloadTemplate(src, name){
  try{
    const res=await fetch(src);
    if(!res.ok) throw new Error('画像が見つかりません（'+src+'）');
    saveBlob(await res.blob(), name);
    $('webStatus').textContent=name+' を保存しました。';
  }catch(e){
    $('webStatus').textContent='保存に失敗: '+e.message;
  }
}

function copyPrompt(){
  navigator.clipboard.writeText(GEN_PROMPT).then(()=>{
    $('webStatus').textContent='プロンプトをコピーしました。生成チャットに貼り付けて、キャラ絵とテンプレート画像を添付してください。';
  }).catch(()=>{
    $('webStatus').innerHTML='自動コピーできませんでした。下の文を選択してコピーしてください。';
    const ta=document.createElement('textarea');
    ta.value=GEN_PROMPT; ta.style.width='100%'; ta.style.height='160px'; ta.style.marginTop='8px';
    ta.className='bevel-in'; $('webStatus').appendChild(ta); ta.focus(); ta.select();
  });
}

export function setupGen(){
  $('copyPromptBtn').addEventListener('click', copyPrompt);
  $('dlTemplateA').addEventListener('click', ()=>downloadTemplate(TEMPLATE_A_SRC,'sprite-template-a.png'));
  $('dlTemplateB').addEventListener('click', ()=>downloadTemplate(TEMPLATE_B_SRC,'sprite-template-b.png'));
  $('dlTemplateC').addEventListener('click', ()=>downloadTemplate(TEMPLATE_C_SRC,'sprite-template-c.png'));
}
