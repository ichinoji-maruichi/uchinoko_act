// ===================== 描画 =====================
import { FOOT_SINK, ENEMY_TYPES, ENEMY_DRAW_SCALE, DEATH_DUR, POP_DUR,
  VS_INTRO_STEPS, VS_INTRO_FRAMES } from './config.js';
import { sctx, GROUND_Y, GAME, player, world, runtime, gfx, vs, VIEW_W, VIEW_H } from './state.js';
import { getAttackBox } from './player.js';
import { getBodyBox } from './vs.js';

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

// ファイターの現在の状態から表示すべきポーズ名を決める
function currentPose(p){
  switch(p.state){
    case 'attack': return p.combo[p.comboIdx].pose;
    case 'crouch': return 'crouch';
    case 'hurt': return 'damage';
    case 'knockback': return 'knockback';
    case 'down': return 'down';
    case 'getup': return 'crouch';       // ダウン→しゃがみ→待機 の途中(対戦モード)
    case 'clash': return p.clashPose;    // 相殺: 弾かれた瞬間の攻撃ポーズのまま止める
    case 'guard': return 'crouch';       // ガード=しゃがみ。硬直中も同じ絵
    case 'crush': return 'damage';       // ガードクラッシュ
    // ダッシュは専用ポーズを持たず、歩きの絵を速く切り替えて疾走感を出す
    case 'dash':  return (p.dashTimer % 8 < 4) ? 'walk1' : 'walk2';
    case 'jump':
      if(p.jumpUpper && p.vy<0) return 'jump_upper';   // ジャンプアッパー上昇中
      if(p.airAttack>0) return 'atk1';   // 空中攻撃
      return p.vy<0 ? 'jump_up' : 'jump_down';
    case 'walk':
      if(p.walkPhase==='in'||p.walkPhase==='out') return 'walk_start';
      // ループ: walk1 → walk_start → walk2 → walk_start
      return ['walk1','walk_start','walk2','walk_start'][p.walkFrame];
    default: return 'idle';
  }
}
// ファイター p を pose の絵で描く。スプライト表(FR)と倍率(SCALE)はキャラごと。
function drawFighter(p, pose){
  const f=p.FR[pose]||p.FR.idle; if(!f)return;
  const z=p.SCALE, dir=p.facing;
  // 全ポーズ足元アンカー: bbox下端をp.y(接地点)に合わせる。
  // 離陸・着地時は p.y==GROUND_Y なので足が地面線に乗り、空中では自然に浮く。
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

// ファイターの足元の影。キャラの絵の横幅に合わせた楕円。
export function drawFighterShadow(p){
  const f=p.FR[currentPose(p)]||p.FR.idle; if(!f)return;
  const sw=f.w*p.SCALE*0.6;
  sctx.fillStyle='rgba(0,0,0,.3)';
  sctx.beginPath();
  sctx.ellipse(p.x, GROUND_Y+4, sw/2, 6, 0,0,Math.PI*2);
  sctx.fill();
}

// ファイター本体。無敵中は点滅させる。
export function drawFighterSprite(p){
  if(p.invuln>0 && (Math.floor(p.invuln/4)%2===0)) return;
  drawFighter(p, currentPose(p));
}

// 背景:画像があれば描画、なければ従来のグラデ+単色地面
function drawBackground(){
  if(gfx.bgReady && gfx.bgImg){
    sctx.imageSmoothingEnabled=false;   // ドット絵をくっきり
    sctx.drawImage(gfx.bgImg,0,0,VIEW_W,VIEW_H);
  } else {
    const g=sctx.createLinearGradient(0,0,0,VIEW_H);
    g.addColorStop(0,'#1a2438'); g.addColorStop(1,'#0f1420');
    sctx.fillStyle=g; sctx.fillRect(0,0,VIEW_W,VIEW_H);
    // 地面
    sctx.fillStyle='#26304a';
    sctx.fillRect(0,GROUND_Y,VIEW_W,VIEW_H-GROUND_Y);
    sctx.strokeStyle='rgba(255,255,255,.12)';
    sctx.beginPath();sctx.moveTo(0,GROUND_Y+0.5);sctx.lineTo(VIEW_W,GROUND_Y+0.5);sctx.stroke();
  }
}

// アクションモード(1人用)の場面
function drawActionScene(){
  drawFighterShadow(player);
  // 敵(プレイヤーより奥/手前は気にせず、敵→プレイヤーの順)
  for(const e of world.enemies) drawEnemy(e);
  // 回復アイテム
  for(const it of world.items) drawItem(it);
  // プレイヤー(無敵中は点滅)
  drawFighterSprite(player);
  // スコアポップ("+N")
  drawPops();
  drawHUD();
}

// 対戦格闘モードの場面
function drawVsScene(){
  if(!vs.f1 || !vs.f2) return;
  drawFighterShadow(vs.f1); drawFighterShadow(vs.f2);
  for(const it of world.items) drawItem(it);
  // 攻撃中の方を手前に描く(打撃の当たり位置が見えるように)
  const front = vs.f2.state==='attack' && vs.f1.state!=='attack' ? vs.f2 : vs.f1;
  const back  = front===vs.f1 ? vs.f2 : vs.f1;
  drawFighterSprite(back); drawFighterSprite(front);
  drawPops();
  drawVsHud();
}

export function render(){
  drawBackground();
  if(runtime.MODE==='vs') drawVsScene();
  else drawActionScene();
  // 当たり判定の可視化
  if(runtime.DEBUG) drawDebug();
  // タッチ端末では一時停止/ゲームオーバーのメニューをDOM(touch.js)で出すので、
  // キー操作前提のcanvasメニューは描かない(READY画面は共通で描く)。
  const touchUI = document.body.classList.contains('has-touch');
  // START待ち
  if(runtime.PHASE==='ready' && !GAME.over) drawReady();
  // 試合開始の演出
  if(runtime.PHASE==='intro') drawVsIntro();
  // 一時停止メニュー
  // 操作方法パネルはDOMで手前に出るので、キャンバス側のメニューは描かない
  if(runtime.paused && !runtime.helpOpen && !GAME.over && !touchUI) drawPauseMenu();
  // ゲームオーバー
  if(GAME.over && !touchUI) (runtime.MODE==='vs' ? drawVsResult() : drawGameOver());
}

function drawReady(){
  sctx.fillStyle='rgba(0,0,0,.55)';
  sctx.fillRect(0,0,VIEW_W,VIEW_H);
  sctx.textAlign='center';
  let textY=VIEW_H/2;
  // タイトルロゴ(あれば上に配置)。ドット絵が荒れないよう拡大は整数倍＋スムージング無し。
  if(gfx.logoReady && gfx.logo){
    const lw0=gfx.logo.naturalWidth, lh0=gfx.logo.naturalHeight;
    let z=Math.min((VIEW_W-60)/lw0, 250/lh0);
    z = z>=1 ? Math.floor(z) : z;   // 拡大は等倍(整数倍)、縮小のみ小数許容
    const lw=lw0*z, lh=lh0*z;
    sctx.imageSmoothingEnabled=false;
    sctx.drawImage(gfx.logo, (VIEW_W-lw)/2, 30, lw, lh);
    textY = 30 + lh + 52;
  }
  const blink = (Math.floor(Date.now()/500)%2===0);
  sctx.fillStyle = blink ? '#fff' : '#9fb4d8';
  sctx.font='bold 30px sans-serif';
  sctx.fillText('PRESS ENTER TO START', VIEW_W/2, textY);
  sctx.fillStyle='#cfd8e8'; sctx.font='14px sans-serif';
  sctx.fillText('Enter（またはスペース）でゲーム開始', VIEW_W/2, textY+30);
  sctx.textAlign='left'; sctx.textBaseline='alphabetic';
}

const CPU_LABEL = { easy:'よわい', normal:'ふつう', hard:'つよい' };

// メニューの選択肢を縦に並べて描く共通処理
function drawMenuList(lines, startY, gap=30){
  sctx.textAlign='center';
  lines.forEach((l,i)=>{
    sctx.font = (l.small ? '15px' : '19px') + ' sans-serif';
    sctx.fillStyle = l.color || '#fff';
    sctx.fillText(l.text, VIEW_W/2, startY + i*gap);
  });
  sctx.textAlign='left';
}

// 一時停止メニュー
function drawPauseMenu(){
  const isVs = runtime.MODE==='vs';
  sctx.fillStyle='rgba(0,0,0,.62)';
  sctx.fillRect(0,0,VIEW_W,VIEW_H);
  sctx.textAlign='center';
  sctx.fillStyle='#fff'; sctx.font='bold 34px sans-serif';
  sctx.fillText('一時停止', VIEW_W/2, VIEW_H/2-70);
  sctx.textAlign='left';
  const lines = [{ text:'つづける（Esc）', color:'#cfd8e8' }];
  if(isVs){
    lines.push({ text:'もう一度たたかう（R）' });
    lines.push({ text:'CPUの強さ：'+CPU_LABEL[vs.cpuLevel]+'（D で切り替え）', color:'#ffe14d' });
    lines.push({ text:'キャラを選び直す（C）', color:'#9fb4d8' });
  } else {
    lines.push({ text:'リトライする（R）' });
  }
  lines.push({ text:'終了する（Q）… 最初の画面へ', color:'#9fb4d8' });
  drawMenuList(lines, VIEW_H/2-24);
}

// ファイター1体ぶんの判定表示(足元・体の縦範囲・攻撃ボックス)
function drawFighterDebug(p){
  sctx.fillStyle='#ff0';
  sctx.beginPath(); sctx.arc(p.x, p.y, 3, 0,Math.PI*2); sctx.fill(); // 足元
  const headUp=(p.state==='crouch')?45:140;
  sctx.strokeStyle='rgba(255,255,0,.9)';
  sctx.strokeRect(p.x-18, p.y-headUp, 36, headUp);  // 接触判定の縦範囲(しゃがみで低くなる)
  const b=getAttackBox(p);
  if(b){
    sctx.strokeStyle='rgba(255,60,60,1)';
    sctx.fillStyle='rgba(255,60,60,.18)';
    sctx.fillRect(b.cx-b.hw, b.cy-b.hh, b.hw*2, b.hh*2);
    sctx.strokeRect(b.cx-b.hw, b.cy-b.hh, b.hw*2, b.hh*2);
  }
}
function drawDebug(){
  sctx.save();
  sctx.lineWidth=1.5;
  if(runtime.MODE==='vs'){
    for(const f of [vs.f1, vs.f2]){
      if(!f) continue;
      drawFighterDebug(f);
      // くらい判定(実際にヒット判定に使う体の矩形)
      const b=getBodyBox(f);
      sctx.strokeStyle='rgba(80,255,120,1)';
      sctx.strokeRect(b.x-b.hw, b.top, b.hw*2, b.bottom-b.top);
    }
    sctx.font='11px monospace'; sctx.fillStyle='#fff'; sctx.textAlign='left';
    sctx.fillText('[D] 判定表示  赤=攻撃 緑=くらい  combo:'+vs.f1.comboCount+'/'+vs.f2.comboCount, 8, VIEW_H-10);
    sctx.restore(); return;
  }
  drawFighterDebug(player);
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
  sctx.fillText('[D] 判定表示  赤=攻撃 緑=地上敵 青=飛敵 黄=接触/足元', 8, VIEW_H-10);
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
  const heartsW=player.maxHp*26;
  hudPlate(8, 8, heartsW+8, 26);
  for(let i=0;i<player.maxHp;i++){
    // 枠(y=8..34, 中央21)の中央に配置。size=18で潰れず均整の取れたハート。
    drawHeart(24+i*26, 21, 18, i<player.hp ? '#e5484d' : '#4a3033');
  }
  // スコア(下地パネル付き)
  sctx.font='bold 18px monospace';
  const scoreText='SCORE '+GAME.score;
  const scoreW=sctx.measureText(scoreText).width;
  hudPlate(VIEW_W-8-scoreW-16, 8, scoreW+16, 26);
  sctx.textAlign='right'; sctx.textBaseline='alphabetic';
  sctx.fillStyle='#fff';
  sctx.fillText(scoreText, VIEW_W-16, 28);
  sctx.textAlign='left';
  if(runtime.PRACTICE){
    sctx.font='bold 13px monospace';
    const pText='練習モード（P解除／1-6で敵出現）';
    const pW=sctx.measureText(pText).width;
    hudPlate(VIEW_W/2-pW/2-8, 8, pW+16, 22);
    sctx.fillStyle='#7fd'; sctx.textAlign='center';
    sctx.fillText(pText, VIEW_W/2, 24);
    sctx.textAlign='left';
  }
}
// 対戦モードの体力バー。outer 側(画面端)を固定し、減ると中央へ向かって縮む。
function drawVsBar(x, y, w, h, ratio, fromRight, label){
  hudPlate(x-4, y-4, w+8, h+8);
  sctx.fillStyle='rgba(255,255,255,.12)';
  sctx.fillRect(x, y, w, h);
  const fw=Math.max(0, Math.min(1, ratio))*w;
  // 残量で色を変える(緑→黄→赤)。ピンチが一目で分かるように。
  sctx.fillStyle = ratio>0.5 ? '#3fbf5a' : (ratio>0.25 ? '#ffd166' : '#e5484d');
  sctx.fillRect(fromRight ? x+w-fw : x, y, fw, h);
  sctx.strokeStyle='rgba(255,255,255,.7)'; sctx.lineWidth=1.5;
  sctx.strokeRect(x+0.5, y+0.5, w-1, h-1);
  sctx.font='bold 13px monospace'; sctx.fillStyle='#fff';
  sctx.textAlign = fromRight ? 'right' : 'left';
  sctx.fillText(label, fromRight ? x+w : x, y+h+16);
  sctx.textAlign='left';
}
function drawVsHud(){
  const w=Math.min(300, VIEW_W/2-30), h=18, y=16;
  drawVsBar(16, y, w, h, vs.f1.hp/vs.f1.maxHp, false, '1P');
  drawVsBar(VIEW_W-16-w, y, w, h, vs.f2.hp/vs.f2.maxHp, true, 'CPU');
}

// 試合開始の演出。コマの頭で大きく出てから、少し縮んで薄くなる。
function drawVsIntro(){
  const i = Math.min(VS_INTRO_STEPS.length-1, Math.floor(runtime.introT / VS_INTRO_FRAMES));
  const text = VS_INTRO_STEPS[i];
  const t = (runtime.introT % VS_INTRO_FRAMES) / VS_INTRO_FRAMES;   // 0→1
  const pop = t<0.25 ? 1.5-(t/0.25)*0.5 : 1;      // 出た瞬間だけ大きく
  const alpha = t>0.75 ? 1-(t-0.75)/0.25 : 1;     // 終わりぎわにフェード
  const last = (i===VS_INTRO_STEPS.length-1);
  sctx.save();
  sctx.globalAlpha = Math.max(0, alpha);
  sctx.translate(VIEW_W/2, VIEW_H/2-30);
  sctx.scale(pop, pop);
  sctx.textAlign='center'; sctx.textBaseline='middle';
  sctx.font = 'bold 68px sans-serif';
  sctx.lineWidth = 8; sctx.strokeStyle = 'rgba(0,0,0,.8)';
  sctx.strokeText(text, 0, 0);
  sctx.fillStyle = last ? '#ff5c8a' : '#ffe14d';
  sctx.fillText(text, 0, 0);
  sctx.restore();
  sctx.textAlign='left'; sctx.textBaseline='alphabetic';
}

// 対戦の決着画面。勝った側を大きく出す。
function drawVsResult(){
  const win = vs.winner==='p1';
  sctx.fillStyle='rgba(0,0,0,.6)';
  sctx.fillRect(0,0,VIEW_W,VIEW_H);
  sctx.textAlign='center';
  sctx.font='bold 52px sans-serif';
  sctx.lineWidth=6; sctx.strokeStyle='rgba(0,0,0,.8)';
  sctx.strokeText('K.O.', VIEW_W/2, VIEW_H/2-56);
  sctx.fillStyle='#ffe14d';
  sctx.fillText('K.O.', VIEW_W/2, VIEW_H/2-56);
  sctx.font='bold 34px sans-serif';
  sctx.fillStyle = win ? '#7fe3a0' : '#ff8a9c';
  sctx.fillText(win ? 'あなたの勝ち！' : 'あなたの負け…', VIEW_W/2, VIEW_H/2-8);
  sctx.textAlign='left';
  drawMenuList([
    { text:'もう一度たたかう（Enter / R）' },
    { text:'CPUの強さ：'+CPU_LABEL[vs.cpuLevel]+'（D で切り替え）', color:'#ffe14d' },
    { text:'キャラを選び直す（C）', color:'#9fb4d8' },
    { text:'終了する（Q）… 最初の画面へ', color:'#9fb4d8' },
  ], VIEW_H/2+30, 28);
}

function drawGameOver(){
  sctx.fillStyle='rgba(0,0,0,.6)';
  sctx.fillRect(0,0,VIEW_W,VIEW_H);
  sctx.fillStyle='#fff'; sctx.textAlign='center';
  sctx.font='bold 40px sans-serif';
  sctx.fillText('GAME OVER', VIEW_W/2, VIEW_H/2-40);
  sctx.font='20px monospace';
  sctx.fillText('SCORE '+GAME.score, VIEW_W/2, VIEW_H/2-4);
  sctx.font='15px sans-serif';
  sctx.fillStyle='#fff';
  sctx.fillText('リトライする … Enter / R', VIEW_W/2, VIEW_H/2+34);
  sctx.fillStyle='#9fb4d8';
  sctx.fillText('終了する（最初の画面へ）… Q', VIEW_W/2, VIEW_H/2+60);
  sctx.textAlign='left';
}
