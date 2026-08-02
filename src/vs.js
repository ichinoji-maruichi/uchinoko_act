// ===================== 対戦格闘モード =====================
// 2体のファイターを同時に動かすモード。1人用モードとの違いは
// 「敵・アイテムの代わりに、もう1体のファイターが相手」という点だけで、
// ファイターの挙動そのものは player.js の updateFighter を共用する。
import {
  VS_MAX_HP, VS_TARGET_H, VS_START_GAP, VS_BOX_SCALE,
  VS_BODY_HW_R, VS_BODY_TOP_R, VS_BODY_CROUCH_R,
  VS_COMBO_LIMIT, VS_HITSTUN, VS_HIT_KB, VS_LAUNCH_VX, VS_LAUNCH_VY,
  VS_AIR_KB, VS_AIR_LIFT, VS_CORNER_PUSH, VS_CORNER_ZONE,
  VS_CLASH_KB, VS_CLASH_FREEZE, VS_GETUP, VS_PUSH_DIST, CLAMP_MARGIN,
  VS_LIGHT_COMBO, VS_HEAVY_COMBO,
  VS_GUARD_CHIP, VS_GUARD_STUN, VS_GUARD_KB, VS_CRUSH_DMG, VS_CRUSH_STUN,
  VS_UPPER_DMG, VS_ITEM_HEAL, VS_ITEM_FAKE_DMG, nextVsItemTimer,
  VS_INTRO_STEPS, VS_INTRO_FRAMES,
  ITEM_FALL_SPEED, ITEM_FAKE_RATE, ITEM_ATK_UP_SCALE,
} from './config.js';
import { VIEW_W, GROUND_Y, GAME, vs, world, runtime, keys,
  createFighter, resetFighter, addPop, updatePops } from './state.js';
import { updateFighter, getAttackBox, clampX } from './player.js';
import { updateAi, createAiState } from './vsai.js';
import { sfx } from './sfx.js';
import { bgm } from './bgm.js';

// 投入済みのポーズ表からファイターを1体作る。
// 身長の正規化(SCALE)はキャラごとに行うので、元絵の大きさが違っても並べて違和感がない。
// 一方 boxScale(判定の大きさ)は両者共通にして、元画像の解像度で不利にならないようにする。
function makeVsFighter(FR, input){
  const f = createFighter({ maxHp: VS_MAX_HP, input });
  f.FR = FR;
  f.SCALE = VS_TARGET_H / FR.idle.h;
  f.boxScale = VS_BOX_SCALE;
  f.getupFrames = VS_GETUP;
  f.lightCombo = VS_LIGHT_COMBO;   // 対戦用バランスのコンボ表に差し替える
  f.heavyCombo = VS_HEAVY_COMBO;
  f.canDash = true;                // ダッシュ(方向キー2回押し)は対戦モードのみ
  f.upperDmg = VS_UPPER_DMG;
  return f;
}

// 2人を開始位置へ。中央から左右に等距離、向かい合わせに置く。
function placeFighters(){
  const cx = VIEW_W/2, half = VS_START_GAP/2;
  resetFighter(vs.f1, cx - half); vs.f1.facing =  1;
  resetFighter(vs.f2, cx + half); vs.f2.facing = -1;
}

// キャラ選択後に呼ぶ。選んだ方を人間、残りをCPUとしてファイターを生成する。
export function startVsMatch(){
  vs.f1 = makeVsFighter(vs.sheets[vs.playerIdx],   keys);   // 人間: 既存のキー入力をそのまま使う
  vs.f2 = makeVsFighter(vs.sheets[1-vs.playerIdx], {});     // CPU: AIが書き込む専用の入力オブジェクト
  vs.f2.defeatSfx = false;   // CPUが倒れた時はゲームオーバー音ではなく勝利音を鳴らす
  vs.f2.ai = createAiState();
  resetVsMatch();
}

// 同じ組み合わせで再戦(リトライ)。ファイターは作り直さず位置と体力だけ戻す。
export function resetVsMatch(){
  placeFighters();
  if(vs.f2) vs.f2.ai = createAiState();
  vs.winner = null;
  vs.resultShown = false;
  GAME.over = false;
  GAME.time = 0;
  world.items = [];
  world.pops = [];
  runtime.itemTimer = nextVsItemTimer();
}

// ===================== 判定 =====================

// くらい判定(体)。2人とも同じ身長で描かれるので、身長に対する比で定義する。
// しゃがみ中は低くなる。
export function getBodyBox(f){
  const h = VS_TARGET_H;
  const top = f.y - h*(f.state==='crouch' ? VS_BODY_CROUCH_R : VS_BODY_TOP_R);
  return { x:f.x, top, bottom:f.y, hw:h*VS_BODY_HW_R };
}

// 攻撃ボックスが相手の体に重なっているか
function overlaps(box, target){
  const b = getBodyBox(target);
  if(Math.abs(b.x - box.cx) >= box.hw + b.hw) return false;
  // 攻撃は矩形(cy±hh)、体は top..bottom の縦範囲
  return (box.cy + box.hh) > b.top && (box.cy - box.hh) < b.bottom;
}

// 相手の攻撃を受けて自由に動けない状態(のけぞり・吹っ飛び・ダウン・起き上がり・
// ガード硬直・ガードクラッシュ)。この間は多段ヒット防止とコンボ数を保持する。
function isHitState(f){
  return f.state==='hurt' || f.state==='knockback' || f.state==='down' ||
         f.state==='getup' || f.state==='guard' || f.state==='crush';
}

// 攻撃を中断して相殺の硬直へ。攻撃ポーズのまま押し戻される。
// 空中で成立した場合はそのまま落下する(落下処理は updateFighter の clash 分岐)。
function toClash(f, dir, pose){
  f.clashPose = pose;
  f.state = 'clash';
  f.clashTimer = VS_CLASH_FREEZE;
  f.combo = null; f.comboIdx = 0;
  f.airAttack = 0; f.jumpUpper = false;
  f.comboCount = 0;
  f.vx = dir*VS_CLASH_KB;
}

// 相殺(ブロッキング)。互いにダメージなしで少し離れる。
function clash(a, b, aPose, bPose){
  const dir = a.x < b.x ? -1 : 1;   // a を押し戻す向き
  toClash(a,  dir, aPose);
  toClash(b, -dir, bPose);
  sfx.clash();
}

// ヒット確定。ダメージ・のけぞり・ノックバックを適用する。
// 連続ヒットが上限に達するか、フィニッシュ(強3発目)なら大きく吹っ飛ばす。
// ガード成立の条件: 攻撃を受けた瞬間に地上でしゃがんでいること。
// (しゃがみ状態そのものがガード。ジャンプ中や硬直中はガードできない)
function isGuarding(f){
  return f.onGround && (f.state==='crouch' || f.state==='guard');
}

// ガードされた時の処理。削りダメージだけ与えて硬直させる。
// ただし強3段目(atk3)はガードを崩す＝ガードクラッシュ。
function applyGuard(attacker, victim, box, kbDir){
  victim.lastHitSwing = attacker.swingId;
  if(box.pose==='atk3'){
    // ガードクラッシュ: 吹っ飛ばさずその場で長く硬直させる＝追撃が確定する
    victim.hp -= VS_CRUSH_DMG;
    victim.state='crush'; victim.crushTimer=VS_CRUSH_STUN;
    victim.vx=kbDir*VS_GUARD_KB;
    victim.comboCount=0;
    sfx.crush();
  } else {
    victim.hp -= VS_GUARD_CHIP;
    victim.state='guard'; victim.guardTimer=VS_GUARD_STUN;
    victim.vx=kbDir*VS_GUARD_KB;
    sfx.guard();
  }
  if(victim.hp<=0) koFighter(victim, kbDir);
  else cornerPush(attacker, victim, kbDir);
}

// 力尽きた時の共通処理(大きく吹っ飛ばしてダウン→復帰不可)
function koFighter(victim, kbDir){
  victim.hp = 0; victim.dying = true;
  victim.state='knockback'; victim.invuln=9999;
  victim.vx=kbDir*VS_LAUNCH_VX; victim.vy=VS_LAUNCH_VY-1; victim.onGround=false;
  vs.winner = (victim===vs.f1) ? 'p2' : 'p1';
  sfx.ko();
}

function applyHit(attacker, victim, box){
  const kbDirG = (victim.x < attacker.x ? -1 : 1);
  // ガードされていたら削り/クラッシュ処理へ回す(コンボ数は増やさない)
  if(isGuarding(victim)){ applyGuard(attacker, victim, box, kbDirG); return; }
  victim.lastHitSwing = attacker.swingId;
  victim.hp -= box.dmg;
  victim.jumpUpper = false;
  victim.combo = null; victim.airAttack = 0;
  victim.comboCount++;
  const kbDir = (victim.x < attacker.x ? -1 : 1);
  const finisher = (box.pose==='atk3') || victim.comboCount>=VS_COMBO_LIMIT;

  if(victim.hp<=0){ koFighter(victim, kbDir); return; }
  // フィニッシュはダメージこそ1だが、打撃音は重い方を鳴らして手応えを残す
  sfx.hit(finisher ? 2 : box.dmg);
  if(finisher){
    // 上限到達 or フィニッシュ → 大きく吹っ飛ばしてダウンさせ、コンボを打ち切る
    victim.state='knockback';
    victim.vx=kbDir*VS_LAUNCH_VX; victim.vy=VS_LAUNCH_VY;
    victim.onGround=false;
    victim.comboCount=0;
  } else if(!victim.onGround){
    // 空中ヒット: 浮かせ直す。ここで comboCount をリセットしないのが重要で、
    // リセットすると上限に到達せず空中で延々と拾い直せてしまう(＝ハメ)。
    victim.state='knockback';
    victim.vx=kbDir*VS_AIR_KB; victim.vy=VS_AIR_LIFT;
    victim.onGround=false;
  } else {
    // 地上の通常ヒット: その場でのけぞる。無敵は付けないので強コンボは繋がるが、
    // のけぞり時間は技ごと(box.stun)なので弱連打はループしない。
    victim.state='hurt';
    victim.hurtTimer = box.stun || VS_HITSTUN;
    victim.vx = kbDir*VS_HIT_KB;
  }
  cornerPush(attacker, victim, kbDir);
}

// 画面端では相手を押し込めないので、代わりに殴った側が下がる。
// これがないと端に追い詰めた側が距離を保ったまま一方的に殴り続けられる。
function cornerPush(attacker, victim, kbDir){
  const m = CLAMP_MARGIN + VS_CORNER_ZONE;
  const pinned = (kbDir<0 && victim.x<=m) || (kbDir>0 && victim.x>=VIEW_W-m);
  if(!pinned) return;
  attacker.x -= kbDir*VS_CORNER_PUSH;
  clampX(attacker);
}

// 1フレーム分の攻防を解決する。
// 両者の攻撃判定を「適用前に」まとめて評価することで、同フレームの相打ちを公平に扱う。
// 相殺の条件は「攻撃を受ける瞬間、受け手も攻撃判定を出していること」。
function resolveHits(a, b){
  const ba = getAttackBox(a), bb = getAttackBox(b);
  // 同じ振り(swingId)では1回しか当たらない
  const aHits = !!ba && b.lastHitSwing!==a.swingId && b.invuln<=0 && overlaps(ba, b);
  const bHits = !!bb && a.lastHitSwing!==b.swingId && a.invuln<=0 && overlaps(bb, a);
  if(!aHits && !bHits) return;
  if(ba && bb){
    // 双方が攻撃判定を出している状態で当たった → 相殺
    a.lastHitSwing=b.swingId; b.lastHitSwing=a.swingId;
    clash(a, b, ba.pose, bb.pose);
    return;
  }
  if(aHits) applyHit(a, b, ba);
  else      applyHit(b, a, bb);
}

// 押し合い。近づきすぎたら互いに押し戻す(すり抜け防止)。
// 空中は通り抜けられるようにして、めくり(すれ違い)を成立させる。
function separate(a, b){
  if(!a.onGround || !b.onGround) return;
  const d = b.x - a.x;
  const dist = Math.abs(d);
  if(dist >= VS_PUSH_DIST) return;
  const push = (VS_PUSH_DIST - dist)/2;
  const s = d>=0 ? 1 : -1;
  a.x -= push*s; b.x += push*s;
  clampX(a); clampX(b);
}

// 地上で自由に動ける間は常に相手の方を向く。
// (背後を取られて訳が分からなくなるのを防ぐ。後ろ入力=後退になる)
function faceOpponent(f, o){
  if(!f.onGround) return;
  // ダッシュ中に振り向くと進行方向と絵が食い違うので、終わるまで固定する
  if(f.state==='attack' || f.state==='clash' || f.state==='dash' || isHitState(f)) return;
  f.facing = (o.x >= f.x) ? 1 : -1;
}

// アイテムが攻撃判定に当たっているか(アクションモードと同じ判定式)。
// 落下中のアイテムを高い位置でも壊せるよう、上方向だけ判定を広げる。
function itemHitByBox(it, box){
  if(Math.abs(it.x-box.cx) >= box.hw+it.r) return false;
  const dy = it.y - box.cy;
  return dy<0 ? (-dy < box.hh*ITEM_ATK_UP_SCALE + it.r) : (dy < box.hh + it.r);
}

// 対戦モードのアイテム。降ってくる仕様はアクションモードと同じで、
// 「壊した側が回復する / 触れた側がダメージを受ける」という取り合いになる。
function updateVsItems(){
  const fs = [vs.f1, vs.f2];
  runtime.itemTimer--;
  if(runtime.itemTimer<=0){
    world.items.push({ x:80+Math.random()*(VIEW_W-160), y:-20, r:16, taken:false, popT:0,
                       fake: Math.random()<ITEM_FAKE_RATE });
    runtime.itemTimer = nextVsItemTimer();
  }
  const boxes = fs.map(getAttackBox);
  for(const it of world.items){
    if(it.taken){ it.popT++; continue; }
    it.y += ITEM_FALL_SPEED;
    // 1) 攻撃で壊す。先に当てた方が効果を得る
    for(let i=0;i<fs.length;i++){
      if(!boxes[i] || !itemHitByBox(it, boxes[i])) continue;
      it.taken=true; it.popT=0;
      if(it.fake){ sfx.coin(); }        // 偽物: 壊しても得は無いが、危険物を消せる
      else {
        const f=fs[i];
        const before=f.hp;
        f.hp = Math.min(f.maxHp, f.hp + VS_ITEM_HEAL);
        addPop(f.x, f.y-120, '+'+(f.hp-before).toFixed(0));
        sfx.heal();
      }
      break;
    }
    if(it.taken) continue;
    // 2) 偽物に触れた側が被弾(本物は触れても何も起きない＝攻撃で壊すしかない)
    if(it.fake) for(const f of fs){
      if(f.invuln>0 || isHitState(f) || f.state==='clash') continue;
      const b=getBodyBox(f);
      if(Math.abs(it.x-b.x) < it.r+b.hw && it.y > b.top-it.r && it.y < b.bottom+it.r){
        const kbDir = (f.x < it.x ? -1 : 1);
        f.hp -= VS_ITEM_FAKE_DMG;
        f.state='hurt'; f.hurtTimer=VS_HITSTUN; f.vx=kbDir*VS_HIT_KB;
        f.jumpUpper=false; f.combo=null; f.airAttack=0;
        sfx.hurt();
        if(f.hp<=0) koFighter(f, kbDir);
        it.taken=true; it.popT=8;
        break;
      }
    }
    // 3) 地面に落ちたら消える
    if(!it.taken && it.y>=GROUND_Y){ it.taken=true; it.popT=12; it.missed=true; }
  }
  world.items = world.items.filter(it => it.taken ? it.popT<14 : it.y<GROUND_Y+20);
}

// 試合開始の演出へ入る。カウントが終わると updateVsIntro が PHASE を playing にする。
export function startVsIntro(){
  resetVsMatch();
  runtime.PHASE = 'intro';
  runtime.introT = 0;
  vs.introStep = -1;
}

// 開始演出を1フレーム進める。ファイターは動かさないので、そのまま構えた状態で待つ。
export function updateVsIntro(){
  const step = Math.floor(runtime.introT / VS_INTRO_FRAMES);
  if(step !== vs.introStep){
    vs.introStep = step;
    // READY と数字は短い音、FIGHT! は開始音
    if(step === VS_INTRO_STEPS.length-1) sfx.start();
    else if(step >= 0 && step < VS_INTRO_STEPS.length) sfx.count();
  }
  runtime.introT++;
  if(runtime.introT >= VS_INTRO_FRAMES * VS_INTRO_STEPS.length){
    runtime.PHASE = 'playing';
  }
}

export function updateVs(){
  GAME.time++;
  const f1=vs.f1, f2=vs.f2;
  updateAi(f2, f1, vs.cpuLevel);   // CPUの入力を作ってから動かす
  updateFighter(f1);
  updateFighter(f2);
  resolveHits(f1, f2);
  updateVsItems();
  updatePops();
  separate(f1, f2);
  faceOpponent(f1, f2);
  faceOpponent(f2, f1);
  // 自由に動ける状態に戻ったらコンボ数をリセット。
  // ※ lastHitSwing はここでリセットしてはいけない。swingId は攻撃ごとに必ず増えるので
  //   「同じ swingId では当たらない」だけで多段ヒットは防げる。ここで戻すと、
  //   のけぞり/ガード硬直が攻撃の判定持続より短い時に同じ振りが再ヒットしてしまう。
  for(const f of [f1, f2]){
    if(!isHitState(f) && f.state!=='clash') f.comboCount=0;
  }
  // 決着: 倒れた側が着地してダウンしたら結果画面へ(GAME.over は updateFighter が立てる)
  if(GAME.over && !vs.resultShown){
    vs.resultShown = true;
    bgm.stop();
    if(vs.winner==='p1') sfx.win();
  }
}
