// ===================== 描画 =====================
import { FOOT_SINK, ENEMY_TYPES, ENEMY_DRAW_SCALE, DEATH_DUR, POP_DUR } from './config.js';
import { stage, sctx, GROUND_Y, GAME, player, world, runtime, gfx } from './state.js';
import { getAttackBox } from './player.js';

// 大型敵の色替え用: 元絵の明暗(黒い輪郭・陰影・ハイライト)を保ったまま、
// 色相・彩度だけを指定色に差し替えたcanvasを生成・キャッシュする('color'合成)。
const _tintCache=new WeakMap();   // spr -> Map(color -> canvas)
function getTinted(spr, color){
  let m=_tintCache.get(spr); if(!m){ m=new Map(); _tintCache.set(spr,m); }
  let c=m.get(color); if(c) return c;
  c=document.createElement('canvas'); c.width=spr.w; c.height=spr.h;
  const cx=c.getContext('2d');
  cx.drawImage(spr.canvas,0,0);             // 元絵(明暗を保持)
  cx.globalCompositeOperation='color';       // 色相/彩度=指定色, 明度=元絵 → 黒線は黒のまま
  cx.fillStyle=color; cx.fillRect(0,0,c.width,c.height);
  cx.globalCompositeOperation='destination-in';  // 元絵の形(アルファ)に切り抜き
  cx.drawImage(spr.canvas,0,0);
  m.set(color,c); return c;
}

// HUDのハートアイコン(SVGパス, viewBox 0 0 24 24)。中心(12,12)。
const HEART_PATH = new Path2D('M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41 .81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
function drawHeart(cx, cy, size, fill){
  const s=size/24;
  sctx.save();
  sctx.translate(cx-12*s, cy-12*s); sctx.scale(s,s);
  sctx.fillStyle=fill; sctx.fill(HEART_PATH);
  sctx.restore();
}

function currentPose(){
  const p=player;
  switch(p.state){
    case 'attack': return p.combo[p.comboIdx].pose;
    case 'crouch': return 'crouch';
    case 'hurt': return 'damage';
    case 'knockback': return 'knockback';
    case 'down': return 'down';
    case 'jump':
      if(p.airAttack>0) return 'atk1';   // 空中攻撃
      return p.vy<0 ? 'jump_up' : 'jump_down';
    case 'walk':
      if(p.walkPhase==='in'||p.walkPhase==='out') return 'walk_start';
      // ループ: walk1 → walk_start → walk2 → walk_start
      return ['walk1','walk_start','walk2','walk_start'][p.walkFrame];
    default: return 'idle';
  }
}
function drawFrame(pose){
  const f=gfx.FR[pose]||gfx.FR.idle; if(!f)return;
  const p=player, z=runtime.SCALE, dir=p.facing;
  // 全ポーズ足元アンカー: bbox下端をplayer.y(接地点)に合わせる。
  // 離陸・着地時は player.y==GROUND_Y なので足が地面線に乗り、空中では自然に浮く。
  const drawX=p.x-(f.w/2)*z;
  const drawY=p.y-f.footY*z+FOOT_SINK;
  sctx.save();
  sctx.imageSmoothingEnabled=false;
  if(dir===-1){
    // プレイヤーのx軸で左右反転。drawXはそのまま使う
    sctx.translate(p.x*2,0); sctx.scale(-1,1);
  }
  sctx.drawImage(f.canvas,0,0,f.w,f.h, drawX,drawY, f.w*z,f.h*z);
  sctx.restore();
}

export function render(){
  // 背景:画像があれば描画、なければ従来のグラデ+単色地面
  if(gfx.bgReady && gfx.bgImg){
    sctx.imageSmoothingEnabled=false;   // ドット絵をくっきり
    sctx.drawImage(gfx.bgImg,0,0,stage.width,stage.height);
  } else {
    const g=sctx.createLinearGradient(0,0,0,stage.height);
    g.addColorStop(0,'#1a2438'); g.addColorStop(1,'#0f1420');
    sctx.fillStyle=g; sctx.fillRect(0,0,stage.width,stage.height);
    // 地面
    sctx.fillStyle='#26304a';
    sctx.fillRect(0,GROUND_Y,stage.width,stage.height-GROUND_Y);
    sctx.strokeStyle='rgba(255,255,255,.12)';
    sctx.beginPath();sctx.moveTo(0,GROUND_Y+0.5);sctx.lineTo(stage.width,GROUND_Y+0.5);sctx.stroke();
  }
  // 影
  const f=gfx.FR[currentPose()]||gfx.FR.idle;
  if(f){
    const sw=f.w*runtime.SCALE*0.6;
    sctx.fillStyle='rgba(0,0,0,.3)';
    sctx.beginPath();
    sctx.ellipse(player.x, GROUND_Y+4, sw/2, 6, 0,0,Math.PI*2);
    sctx.fill();
  }
  // 敵(プレイヤーより奥/手前は気にせず、敵→プレイヤーの順)
  for(const e of world.enemies) drawEnemy(e);
  // 回復アイテム
  for(const it of world.items) drawItem(it);
  // プレイヤー(無敵中は点滅)
  if(!(player.invuln>0 && (Math.floor(player.invuln/4)%2===0))){
    drawFrame(currentPose());
  }
  // スコアポップ("+N")
  drawPops();
  // HUD
  drawHUD();
  // 当たり判定の可視化
  if(runtime.DEBUG) drawDebug();
  // START待ち
  if(runtime.PHASE==='ready' && !GAME.over) drawReady();
  // 一時停止メニュー
  if(runtime.paused && !GAME.over) drawPauseMenu();
  // ゲームオーバー
  if(GAME.over) drawGameOver();
}

function drawReady(){
  sctx.fillStyle='rgba(0,0,0,.55)';
  sctx.fillRect(0,0,stage.width,stage.height);
  sctx.textAlign='center';
  let textY=stage.height/2;
  // タイトルロゴ(あれば上に配置)。ドット絵が荒れないよう拡大は整数倍＋スムージング無し。
  if(gfx.logoReady && gfx.logo){
    const lw0=gfx.logo.naturalWidth, lh0=gfx.logo.naturalHeight;
    let z=Math.min((stage.width-60)/lw0, 250/lh0);
    z = z>=1 ? Math.floor(z) : z;   // 拡大は等倍(整数倍)、縮小のみ小数許容
    const lw=lw0*z, lh=lh0*z;
    sctx.imageSmoothingEnabled=false;
    sctx.drawImage(gfx.logo, (stage.width-lw)/2, 30, lw, lh);
    textY = 30 + lh + 52;
  }
  const blink = (Math.floor(Date.now()/500)%2===0);
  sctx.fillStyle = blink ? '#fff' : '#9fb4d8';
  sctx.font='bold 30px sans-serif';
  sctx.fillText('PRESS ENTER TO START', stage.width/2, textY);
  sctx.fillStyle='#cfd8e8'; sctx.font='14px sans-serif';
  sctx.fillText('Enter（またはスペース）でゲーム開始', stage.width/2, textY+30);
  sctx.textAlign='left'; sctx.textBaseline='alphabetic';
}

// 一時停止メニュー（終了する/リトライする）
function drawPauseMenu(){
  sctx.fillStyle='rgba(0,0,0,.62)';
  sctx.fillRect(0,0,stage.width,stage.height);
  sctx.textAlign='center';
  sctx.fillStyle='#fff'; sctx.font='bold 34px sans-serif';
  sctx.fillText('一時停止', stage.width/2, stage.height/2-46);
  sctx.font='20px sans-serif'; sctx.fillStyle='#fff';
  sctx.fillText('リトライする（R）', stage.width/2, stage.height/2+6);
  sctx.fillStyle='#9fb4d8';
  sctx.fillText('終了する（Q）… 最初の画面へ', stage.width/2, stage.height/2+38);
  sctx.fillStyle='#cfd8e8'; sctx.font='15px sans-serif';
  sctx.fillText('つづける（Esc）', stage.width/2, stage.height/2+70);
  sctx.textAlign='left';
}

function drawDebug(){
  sctx.save();
  sctx.lineWidth=1.5;
  // プレイヤー基準点(足元)と接触判定の中心
  sctx.fillStyle='#ff0';
  sctx.beginPath(); sctx.arc(player.x, player.y, 3, 0,Math.PI*2); sctx.fill(); // 足元
  const pcx=player.x, pcy=player.y-40;   // 接触判定のプレイヤー側中心
  const headUp=(player.state==='crouch')?45:140;
  sctx.strokeStyle='rgba(255,255,0,.9)';
  sctx.strokeRect(pcx-18, player.y-headUp, 36, headUp);  // 接触判定の縦範囲(しゃがみで低くなる)
  // 攻撃判定ボックス
  const b=getAttackBox();
  if(b){
    sctx.strokeStyle='rgba(255,60,60,1)';
    sctx.fillStyle='rgba(255,60,60,.18)';
    sctx.fillRect(b.cx-b.hw, b.cy-b.hh, b.hw*2, b.hh*2);
    sctx.strokeRect(b.cx-b.hw, b.cy-b.hh, b.hw*2, b.hh*2);
  }
  // 敵の判定円(実際の判定に使う中心 e.x, e.y-e.r と半径 e.r)
  for(const e of world.enemies){
    if(e.dead)continue;
    const ecx=e.x, ecy=e.y-e.r;
    sctx.strokeStyle= e.fly ? 'rgba(120,180,255,1)' : 'rgba(80,255,120,1)';
    sctx.beginPath(); sctx.arc(ecx, ecy, e.r, 0,Math.PI*2); sctx.stroke();
    sctx.fillStyle=sctx.strokeStyle;
    sctx.beginPath(); sctx.arc(ecx, ecy, 2, 0,Math.PI*2); sctx.fill();
  }
  // 凡例
  sctx.font='11px monospace'; sctx.fillStyle='#fff'; sctx.textAlign='left';
  sctx.fillText('[D] 判定表示  赤=攻撃 緑=地上敵 青=飛敵 黄=接触/足元', 8, stage.height-10);
  sctx.restore();
}

function drawEnemy(e){
  const frames=gfx.ESPR[e.spr||e.type];   // 大型敵は流用スプライト(e.spr)を使う
  const x=e.x, y=e.y;
  // 影
  sctx.save();
  sctx.fillStyle='rgba(0,0,0,'+(e.fly?.15:.3)+')';
  sctx.beginPath(); sctx.ellipse(x,GROUND_Y+4,e.r*(e.fly?0.6:0.8),5,0,0,Math.PI*2); sctx.fill();
  sctx.restore();

  if(frames && frames.length){
    // 2フレーム歩行アニメ
    const fi=Math.floor((GAME.time+e.bobSeed*7)/9)%frames.length;
    const spr=frames[fi];
    // 判定円(半径e.r)基準でスケール。見た目は共通倍率×敵ごとのdrawScale(当たり判定は変えない)。
    const dscale=(ENEMY_TYPES[e.type]&&ENEMY_TYPES[e.type].drawScale)||1;
    const targetH=e.r*2.2*ENEMY_DRAW_SCALE*dscale;
    const z=targetH/spr.h;
    const dw=spr.w*z, dh=spr.h*z;
    sctx.save();
    let deadWhite=0;
    if(e.dead){ const t=e.deadT/DEATH_DUR; sctx.globalAlpha=Math.max(0,1-t);
      const gs=1+t*0.2;   // 拡大は控えめ(最大1.2倍)
      sctx.translate(x,y-e.r); sctx.scale(gs,gs); sctx.translate(-x,-(y-e.r));
      deadWhite=Math.min(1,0.4+t*0.7);   // 消えるほど白く飛ばす
    }
    sctx.imageSmoothingEnabled=false;
    // 進行方向(dir=1で右)。元絵は右向きなので dir=-1(左進行)で反転。
    const drawX=x-dw/2, drawY=(e.fly? y-e.r-dh/2 : y-dh);
    if(e.dir===-1){ sctx.translate(x*2,0); sctx.scale(-1,1); }  // 元絵右向き→左進行で反転
    // 大型敵(tint)は色替え版を、通常敵は元絵を描く
    const baseCanvas = (e.tint && !e.dead) ? getTinted(spr, e.tint) : spr.canvas;
    sctx.drawImage(baseCanvas,0,0,spr.w,spr.h, drawX,drawY,dw,dh);
    // 被弾フラッシュ / 死亡時の白飛ばし: 白版スプライトを重ねる(形状に沿うので透過部は白くならない)
    const whiteA = e.dead ? deadWhite : (e.hitFlash>0 ? 0.6 : 0);
    if(whiteA>0 && spr.white){
      sctx.globalAlpha=(sctx.globalAlpha)*whiteA;
      sctx.drawImage(spr.white,0,0,spr.w,spr.h, drawX,drawY,dw,dh);
    }
    sctx.restore();
  } else {
    // スプライト未ロード時のフォールバック(丸)
    sctx.save();
    sctx.fillStyle= e.hitFlash>0 ? '#fff' : `hsl(${e.hue},60%,55%)`;
    sctx.beginPath(); sctx.arc(x,y-e.r,e.r,0,Math.PI*2); sctx.fill();
    sctx.restore();
  }
  // 硬い敵はHPピップ表示
  if(e.maxHp>1 && !e.dead){
    for(let i=0;i<e.maxHp;i++){
      sctx.fillStyle = i<e.hp ? '#ffd166' : 'rgba(255,255,255,.25)';
      sctx.fillRect(x-e.maxHp*4+i*8, y-e.r*2.2-6, 6, 4);
    }
  }
}

function drawItem(it){
  const sprName = it.fake ? 'fake' : 'heal';
  const spr = gfx.ESPR[sprName] && gfx.ESPR[sprName][0];
  sctx.save();
  if(it.taken){
    const t=it.popT/14;
    sctx.globalAlpha=1-t;
    if(!it.missed){ sctx.translate(it.x,it.y); sctx.scale(1+t*1.2,1+t*1.2); sctx.translate(-it.x,-it.y); }
  } else {
    const pulse=0.85+Math.sin(GAME.time*0.2)*0.15;
    sctx.globalAlpha=pulse;
  }
  if(spr){
    // 光(本物=緑, 偽=紫)
    sctx.fillStyle = it.fake ? 'rgba(200,80,255,.22)' : 'rgba(120,255,170,.25)';
    sctx.beginPath(); sctx.arc(it.x,it.y,it.r+8,0,Math.PI*2); sctx.fill();
    const targetH=it.r*2.6, z=targetH/spr.h, dw=spr.w*z, dh=spr.h*z;
    sctx.imageSmoothingEnabled=false;
    sctx.drawImage(spr.canvas,0,0,spr.w,spr.h, it.x-dw/2,it.y-dh/2,dw,dh);
    sctx.restore(); return;
  }
  if(it.fake){
    // 偽物: 毒々しい紫のドクロ(スプライト未ロード時)
    sctx.fillStyle='rgba(200,80,255,.22)';
    sctx.beginPath(); sctx.arc(it.x,it.y,it.r+6,0,Math.PI*2); sctx.fill();
    const s=it.r;
    sctx.fillStyle='#9b3fd6';
    sctx.beginPath(); sctx.arc(it.x,it.y-s*0.15,s*0.85,Math.PI,0);
    sctx.lineTo(it.x+s*0.55,it.y+s*0.5);
    sctx.lineTo(it.x-s*0.55,it.y+s*0.5);
    sctx.closePath(); sctx.fill();
    sctx.fillRect(it.x-s*0.4,it.y+s*0.4,s*0.8,s*0.35);
    sctx.fillStyle='#1a0a2a';
    sctx.beginPath(); sctx.arc(it.x-s*0.35,it.y-s*0.15,s*0.28,0,Math.PI*2);
    sctx.arc(it.x+s*0.35,it.y-s*0.15,s*0.28,0,Math.PI*2); sctx.fill();
    sctx.restore(); return;
  }
  // 淡い光(本物・スプライト未ロード時)
  sctx.fillStyle='rgba(120,255,170,.25)';
  sctx.beginPath(); sctx.arc(it.x,it.y,it.r+6,0,Math.PI*2); sctx.fill();
  // 緑のハート
  sctx.fillStyle='#43d17a';
  const s=it.r;
  const cx=it.x, cy=it.y-s*0.2;
  sctx.beginPath();
  sctx.moveTo(cx,cy+s*0.35);
  sctx.bezierCurveTo(cx,cy,cx-s,cy-s*0.7,cx-s,cy-s*0.1);
  sctx.bezierCurveTo(cx-s,cy+s*0.55,cx,cy+s*0.8,cx,cy+s*1.1);
  sctx.bezierCurveTo(cx,cy+s*0.8,cx+s,cy+s*0.55,cx+s,cy-s*0.1);
  sctx.bezierCurveTo(cx+s,cy-s*0.7,cx,cy,cx,cy+s*0.35);
  sctx.fill();
  // ハイライト
  sctx.fillStyle='rgba(255,255,255,.5)';
  sctx.beginPath(); sctx.arc(cx-s*0.35,cy-s*0.1,s*0.18,0,Math.PI*2); sctx.fill();
  sctx.restore();
}

// スコアポップの描画("+N" が出現時に少し弾んで、後半でフェード)
function drawPops(){
  for(const p of world.pops){
    const f=p.t/POP_DUR;                 // 0→1
    const alpha = f<0.6 ? 1 : 1-(f-0.6)/0.4;   // 後半40%でフェード
    const pop = p.t<6 ? 1+(6-p.t)/6*0.6 : 1;   // 出現直後だけ拡大→等倍
    sctx.save();
    sctx.globalAlpha=Math.max(0,alpha);
    sctx.translate(p.x, p.y); sctx.scale(pop,pop);
    sctx.font='bold 22px system-ui, sans-serif';
    sctx.textAlign='center'; sctx.textBaseline='middle';
    sctx.lineWidth=4; sctx.strokeStyle='rgba(0,0,0,.75)';
    sctx.strokeText(p.text,0,0);
    sctx.fillStyle='#ffe14d';             // 黄色でスコアらしく
    sctx.fillText(p.text,0,0);
    sctx.restore();
  }
}

// 下地: 黒い半透明の角丸四角＋白い境界線
function hudPlate(x,y,w,h){
  const r=6;
  sctx.save();
  sctx.beginPath();
  sctx.moveTo(x+r,y);
  sctx.arcTo(x+w,y,x+w,y+h,r);
  sctx.arcTo(x+w,y+h,x,y+h,r);
  sctx.arcTo(x,y+h,x,y,r);
  sctx.arcTo(x,y,x+w,y,r);
  sctx.closePath();
  sctx.fillStyle='rgba(0,0,0,.55)';
  sctx.fill();
  sctx.lineWidth=1.5; sctx.strokeStyle='rgba(255,255,255,.85)';
  sctx.stroke();
  sctx.restore();
}
function drawHUD(){
  // 体力ハート(下地パネル付き)
  const heartsW=GAME.maxHp*26;
  hudPlate(8, 8, heartsW+8, 26);
  for(let i=0;i<GAME.maxHp;i++){
    // 枠(y=8..34, 中央21)の中央に配置。size=18で潰れず均整の取れたハート。
    drawHeart(24+i*26, 21, 18, i<GAME.hp ? '#e5484d' : '#4a3033');
  }
  // スコア(下地パネル付き)
  sctx.font='bold 18px monospace';
  const scoreText='SCORE '+GAME.score;
  const scoreW=sctx.measureText(scoreText).width;
  hudPlate(stage.width-8-scoreW-16, 8, scoreW+16, 26);
  sctx.textAlign='right'; sctx.textBaseline='alphabetic';
  sctx.fillStyle='#fff';
  sctx.fillText(scoreText, stage.width-16, 28);
  sctx.textAlign='left';
  if(runtime.PRACTICE){
    sctx.font='bold 13px monospace';
    const pText='練習モード（P解除／1-6で敵出現）';
    const pW=sctx.measureText(pText).width;
    hudPlate(stage.width/2-pW/2-8, 8, pW+16, 22);
    sctx.fillStyle='#7fd'; sctx.textAlign='center';
    sctx.fillText(pText, stage.width/2, 24);
    sctx.textAlign='left';
  }
}
function drawGameOver(){
  sctx.fillStyle='rgba(0,0,0,.6)';
  sctx.fillRect(0,0,stage.width,stage.height);
  sctx.fillStyle='#fff'; sctx.textAlign='center';
  sctx.font='bold 40px sans-serif';
  sctx.fillText('GAME OVER', stage.width/2, stage.height/2-40);
  sctx.font='20px monospace';
  sctx.fillText('SCORE '+GAME.score, stage.width/2, stage.height/2-4);
  sctx.font='15px sans-serif';
  sctx.fillStyle='#fff';
  sctx.fillText('リトライする … Enter / R', stage.width/2, stage.height/2+34);
  sctx.fillStyle='#9fb4d8';
  sctx.fillText('終了する（最初の画面へ）… Q', stage.width/2, stage.height/2+60);
  sctx.textAlign='left';
}
