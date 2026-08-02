// ===================== ファイター状態機械 =====================
// 操作キャラの挙動。対戦格闘モードでは2体を同時に動かすため、
// この中では state.js の player を直接触らず、引数 f のファイターだけを操作する。
// 入力は f.input(人間なら keys、CPUならAIが書き込むオブジェクト)から読む。
import { GRAV, JUMP_V, JUMP_UPPER_V, MOVE_SPD, CLAMP_MARGIN, DOWN_INVULN,
  VS_DASH_TAP_WINDOW, VS_DASH_SPD, VS_DASH_TIME, VS_DASH_END } from './config.js';
import { VIEW_W, GROUND_Y, GAME } from './state.js';
import { sfx } from './sfx.js';
import { bgm } from './bgm.js';

export function startAttack(f, combo){
  f.combo=combo; f.comboIdx=0;
  f.comboTimer=combo[0].wait;
  f.state='attack';
  // 風切り音は各斬りフレーム(atk1/2/3)で鳴らす → updateFighter 側を参照
}

// ジャンプアッパー発動。通常より速く上昇し、上昇中は広い攻撃判定を出す(getAttackBox参照)。
// 頂点(vy>=0)で jumpUpper を解除し通常のジャンプ下りへ移行する。
export function startJumpUpper(f){
  const keys=f.input;
  f.vy=JUMP_UPPER_V;      // 通常ジャンプより速い上昇
  f.onGround=false;
  f.jumpsLeft=0;          // ジャンプアッパー後は2段ジャンプ不可
  f.jumpUpper=true;
  f.state='jump';
  f.airAttack=0;
  f.combo=null; f.comboIdx=0;
  // 横方向の入力があれば反映(斜め上への遊撃)
  if(keys.left&&!keys.right) f.vx=-MOVE_SPD;
  else if(keys.right&&!keys.left) f.vx=MOVE_SPD;
  else f.vx=0;
  f.swingId++;            // 1回のアッパー=1スイング(各敵に1ヒット)
  sfx.jumpUpper();
}

// ダッシュ開始。専用ポーズは持たず、歩きの絵を速く回して見せる(render.js側)。
export function startDash(f, dir){
  f.state='dash'; f.dashDir=dir; f.dashTimer=VS_DASH_TIME;
  f.vx=dir*VS_DASH_SPD;
  f.tapDir=0; f.tapTimer=0;
  sfx.dash();
}

// ダッシュ入力の検出。地上で自由に動ける時だけ受け付ける。
// ・キーボード/スティック: 同じ方向キーを2回押す
// ・スマホの専用ダッシュボタン(keys.dash): 単独なら向いている方へ、
//   方向を入れていればその方向へ(後ろを入れながらでバックダッシュ)
function checkDashTap(p, keys, edgeLeft, edgeRight, edgeDash){
  if(p.tapTimer>0) p.tapTimer--;
  const free = p.onGround && (p.state==='idle'||p.state==='walk');
  if(edgeDash){
    if(!free) return false;
    let dir = p.facing;
    if(keys.left && !keys.right) dir=-1;
    else if(keys.right && !keys.left) dir=1;
    startDash(p, dir); return true;
  }
  if(edgeLeft){
    if(free && p.tapDir===-1 && p.tapTimer>0){ startDash(p,-1); return true; }
    p.tapDir=-1; p.tapTimer=VS_DASH_TAP_WINDOW;
  } else if(edgeRight){
    if(free && p.tapDir===1 && p.tapTimer>0){ startDash(p,1); return true; }
    p.tapDir=1; p.tapTimer=VS_DASH_TAP_WINDOW;
  }
  return false;
}

export function updateFighter(f){
  const p=f, keys=f.input;
  // 無敵の残りフレームを減らす(9999=致命傷中の永続無敵は減らさない)。
  // 以前は updateEnemies の末尾で減らしていたが、対戦モードでは敵がいないため
  // 「自分の時間は自分で進める」形にここへ移した。減算がフレーム内で1手番早く
  // なるので、実効の無敵時間が1フレームだけ伸びる(60→61f。体感差はない)。
  if(p.invuln>0 && p.invuln<9999) p.invuln--;

  const pressLeft=keys.left, pressRight=keys.right;
  const pressUp=keys.up, pressDown=keys.down;
  const edgeLight=keys.light&&!p.lastLight;
  const edgeHeavy=keys.heavy&&!p.lastHeavy;
  const edgeUp=keys.up&&!p.lastUp;
  const edgeLeft=keys.left&&!p.lastLeft, edgeRight=keys.right&&!p.lastRight;
  const edgeDash=keys.dash&&!p.lastDash;
  p.lastLight=keys.light; p.lastHeavy=keys.heavy; p.lastUp=keys.up;
  p.lastLeft=keys.left; p.lastRight=keys.right; p.lastDash=keys.dash;
  // ダッシュ。対戦モードのみ。発動したらこのフレームは抜ける
  if(p.canDash && checkDashTap(p, keys, edgeLeft, edgeRight, edgeDash)) return;

  // ===== 被弾中の状態(操作不能・無敵) =====
  // hurt: 地上ダメージ。knockback: 空中で吹っ飛び。down: 着地後ダウン。
  if(p.state==='hurt'){
    p.vx*=0.85; p.x+=p.vx; clampX(p);
    p.hurtTimer--;
    if(p.hurtTimer<=0){ p.state='idle'; }
    return;
  }
  if(p.state==='knockback'){
    // 吹っ飛び中: 物理継続。ジャンプ入力で復帰(2段ジャンプ扱い)。ただし致命傷中(dying)は復帰不可。
    if(edgeUp && !p.dying){
      p.vy=JUMP_V*0.92; p.jumpsLeft=0; p.state='jump'; p.airAttack=0; sfx.jump2();
      // 復帰後は通常空中制御へ(このフレームは抜ける)
    } else {
      p.vy+=GRAV; p.x+=p.vx; p.y+=p.vy; p.vx*=0.98;
      clampX(p);
      if(p.y>=GROUND_Y){
        p.y=GROUND_Y; p.vy=0; p.vx=0;
        // 着地 → ダウン
        p.state='down'; p.hurtTimer= p.dying ? 999 : 40;
        // 起き上がり直後の被弾を防ぐため、ダウン中〜起き上がり直後まで無敵を確保
        if(!p.dying) p.invuln = Math.max(p.invuln, DOWN_INVULN);
        // 致命傷ならゲームオーバー(対戦モードでは勝敗の演出を vs.js 側で行うため、
        // 負けた側がCPUのときは defeatSfx=false にしてゲームオーバー音を鳴らさない)
        if(p.dying){ GAME.over=true; bgm.stop(); if(p.defeatSfx) sfx.gameover(); }
      }
      return;
    }
  }
  if(p.state==='down'){
    p.vx=0; p.hurtTimer--;
    if(p.hurtTimer<=0 && !GAME.over){
      p.onGround=true;
      // 対戦モードは「ダウン → しゃがみ → 待機」と一拍置いて起き上がる。
      // getupFrames=0 のアクションモードは従来どおり待機へ直行。
      if(p.getupFrames>0){ p.state='getup'; p.hurtTimer=p.getupFrames; }
      else p.state='idle';
    }
    return;
  }
  // 起き上がり(しゃがみポーズ)。ダウン明けの猶予で、まだ入力は効かない。
  if(p.state==='getup'){
    p.vx=0; p.hurtTimer--;
    if(p.hurtTimer<=0) p.state='idle';
    return;
  }
  // ダッシュ中。VS_DASH_TIME フレーム加速し、そのあと滑って止まる(後隙)。
  // 途中で攻撃・ジャンプはできない＝踏み込みにはリスクがある。
  if(p.state==='dash'){
    p.dashTimer--;
    if(p.dashTimer>0) p.vx=p.dashDir*VS_DASH_SPD;
    else p.vx*=0.6;
    p.x+=p.vx; clampX(p);
    if(p.dashTimer<=-VS_DASH_END){ p.state='idle'; p.vx=0; }
    return;
  }
  // ガード硬直。しゃがみポーズのまま少し押し戻される。
  if(p.state==='guard'){
    p.vx*=0.85; p.x+=p.vx; clampX(p);
    p.guardTimer--;
    if(p.guardTimer<=0){ p.state='idle'; p.vx=0; }
    return;
  }
  // ガードクラッシュ。吹っ飛ばずその場で長く硬直する＝相手の追撃が確定する。
  if(p.state==='crush'){
    p.vx*=0.85; p.x+=p.vx; clampX(p);
    p.crushTimer--;
    if(p.crushTimer<=0){ p.state='idle'; p.vx=0; }
    return;
  }
  // 相殺(ブロッキング)の硬直。攻撃ポーズのまま少し押し戻される。
  // 空中で相殺した場合は落下を続け、着地したら接地状態に戻す。
  if(p.state==='clash'){
    p.vx*=0.88; p.x+=p.vx; clampX(p);
    if(!p.onGround){
      p.vy+=GRAV; p.y+=p.vy;
      if(p.y>=GROUND_Y){ p.y=GROUND_Y; p.vy=0; p.onGround=true; p.jumpsLeft=1; }
    }
    p.clashTimer--;
    if(p.clashTimer<=0){
      if(p.onGround){ p.state='idle'; p.vx=0; }
      else p.state='jump';   // まだ空中なら通常の空中制御へ戻す
    }
    return;
  }

  // ===== ジャンプアッパー(ジャンプ+弱の同時押し) =====
  // ジャンプ入力の瞬間に弱攻撃を押していれば発動。通常より速く上昇し広い判定を出す。
  // ・地上から発動 → 2段ジャンプ不可(jumpsLeft=0)
  // ・1段目ジャンプ中に発動 → それが2段目扱い(以降ジャンプ不可)
  // ・弱攻撃の出始め(atk_start)なら中断してアッパーへ差し替え(同時押しの取りこぼし対策)
  if(edgeUp && keys.light){
    const groundOK = p.onGround &&
      (p.state!=='attack' || (p.combo===p.lightCombo && p.comboIdx===0));
    const doubleOK = !p.onGround && p.jumpsLeft>0 && !p.jumpUpper;
    if(groundOK || doubleOK){ startJumpUpper(p); return; }
  }

  // 攻撃中は攻撃処理を優先（地上のみ）
  if(p.state==='attack'){
    p.vx=0;
    const step=p.combo[p.comboIdx];
    // 各コマの入り(残りフレーム==wait)で一度だけ前進
    if(p.comboTimer===step.wait){
      p.x += step.adv*p.boxScale*p.facing;
    }
    p.comboTimer--;
    if(p.comboTimer<=0){
      p.comboIdx++;
      if(p.comboIdx>=p.combo.length){
        p.combo=null; p.state='idle';
      } else {
        p.comboTimer=p.combo[p.comboIdx].wait;
        // 斬りコマに入る瞬間に攻撃IDを更新＆風切り音を鳴らす。
        // 当たり判定が有効になるのと同一フレームで更新することで、
        // サブステップのズレによる多段ヒット(弱攻撃の2ヒット等)を防ぐ。
        const np=p.combo[p.comboIdx].pose;
        if(np==='atk1'||np==='atk2'||np==='atk3'){
          p.swingId++; sfx.swing(p.combo===p.heavyCombo, np==='atk3');
        }
      }
    }
    clampX(p);
    return;
  }

  // 攻撃開始（地上のみ）
  if(p.onGround && edgeLight){ startAttack(p, p.lightCombo); return; }
  if(p.onGround && edgeHeavy){ startAttack(p, p.heavyCombo); return; }

  // 向き更新
  if(pressLeft&&!pressRight) p.facing=-1;
  else if(pressRight&&!pressLeft) p.facing=1;

  // ジャンプ(地上=1段目, 空中=2段目)
  if(edgeUp && !pressDown){
    if(p.onGround){
      p.vy=JUMP_V; p.onGround=false; p.jumpsLeft=1; p.state='jump'; sfx.jump();
      if(pressLeft&&!pressRight) p.vx=-MOVE_SPD;
      else if(pressRight&&!pressLeft) p.vx=MOVE_SPD;
      else p.vx=0;
    } else if(p.jumpsLeft>0){
      p.vy=JUMP_V*0.92; p.jumpsLeft--; p.airAttack=0; sfx.jump2();  // 2段ジャンプ
      // 空中で向き入力があれば横速度を上書き
      if(pressLeft&&!pressRight) p.vx=-MOVE_SPD;
      else if(pressRight&&!pressLeft) p.vx=MOVE_SPD;
    }
  }

  if(p.onGround){
    if(pressDown){
      p.state='crouch'; p.vx=0;
    } else if(pressLeft^pressRight){
      p.vx=(pressRight?MOVE_SPD:-MOVE_SPD);
      if(p.state!=='walk'){ p.state='walk'; p.walkPhase='in'; p.walkTimer=0; p.walkFrame=0; }
    } else {
      p.vx=0;
      if(p.state==='walk'){ p.walkPhase='out'; }
      else if(p.state!=='attack'){ p.state='idle'; }
    }
  } else {
    // 空中: 横移動の慣性を軽く操作可能に
    if(pressLeft&&!pressRight) p.vx=Math.max(p.vx-0.4,-MOVE_SPD);
    else if(pressRight&&!pressLeft) p.vx=Math.min(p.vx+0.4,MOVE_SPD);
    // 空中攻撃: 弱/強どちらでも1発。既に出てなければ発動(アッパー中は専用判定なので出さない)
    if((edgeLight||edgeHeavy) && p.airAttack<=0 && !p.jumpUpper){ p.airAttack=16; p.swingId++; sfx.swing(edgeHeavy); }
  }
  if(p.airAttack>0) p.airAttack--;

  // 物理
  p.vy+=GRAV;
  // ジャンプアッパーは頂点(下降開始)で解除 → 通常のジャンプ下りへ
  if(p.jumpUpper && p.vy>=0) p.jumpUpper=false;
  p.x+=p.vx; p.y+=p.vy;
  if(p.y>=GROUND_Y){
    p.y=GROUND_Y; p.vy=0;
    if(!p.onGround){ p.onGround=true; p.state='idle'; p.airAttack=0; p.jumpsLeft=1; p.jumpUpper=false; }
  }
  clampX(p);

  // 歩き in/loop/out の遷移
  // ループは walk1 → walk_start → walk2 → walk_start の4コマ循環
  if(p.state==='walk'){
    p.walkTimer++;
    const STEP=7; // フレーム表示間隔
    if(p.walkPhase==='in'){
      // 歩き始めを一瞬見せてからループへ
      if(p.walkTimer>=STEP){ p.walkPhase='loop'; p.walkTimer=0; p.walkFrame=0; }
    } else if(p.walkPhase==='loop'){
      if(p.walkTimer>=STEP){ p.walkTimer=0; p.walkFrame=(p.walkFrame+1)%4; }
    } else if(p.walkPhase==='out'){
      if(p.walkTimer>=STEP){ p.state='idle'; p.walkPhase='none'; }
    }
  }
  p.animT++;
}

export function clampX(f){
  const m=CLAMP_MARGIN;
  if(f.x<m)f.x=m;
  if(f.x>VIEW_W-m)f.x=VIEW_W-m;
}

// 攻撃判定ボックス(攻撃中のみ返す)。ファイターの前方に出す。
export function getAttackBox(f){
  const p=f;
  let active=false, reach=52, hh=34, cyOff=55, dmg=1, reachOff=0.6;
  let atkPose='air';   // どの技の判定か(対戦モードでフィニッシュ判定に使う)
  let stun;            // 対戦モードののけぞりフレーム(未指定なら VS_HITSTUN)
  if(p.state==='attack'){
    // コンボの打撃コマ(atk1/2/3)でのみ判定を出す
    const step=p.combo[p.comboIdx];
    const pose=step.pose;
    // recover が指定されたコマは、最後の recover フレームだけ判定を消す＝後隙。
    // (wait を伸ばすだけだと判定持続が延びて逆に強くなるので、判定と硬直を分ける)
    if(pose==='atk1'||pose==='atk2'||pose==='atk3'){
      if(p.comboTimer > (step.recover||0)){ active=true; atkPose=pose; }
    }
    if(pose==='atk1'||pose==='atk2'){
      reach=78;         // 弱・強1・強2は前方向へ広げる(見た目に合わせて拡張)
    }
    if(pose==='atk3'){
      // フィニッシュ:左ハイキック。脚を前方やや上へ伸ばすので前寄り＆頭上まで。
      // タイミングが合えば飛敵(flyer)も倒せる。
      reach=69;         // 前方向のリーチ(脚)。広すぎたので約7割に抑えた
      hh=112;           // 縦に大きく(蹴り上げで頭上まで)
      cyOff=82;         // 判定中心は頭〜蹴り足の高さ
      reachOff=0.62;    // キックらしく前方に寄せる(足元は接触判定側でカバー)
    }
    dmg=step.dmg||1; stun=step.stun;
  } else if(p.state==='jump' && p.jumpUpper && p.vy<0){
    // ジャンプアッパー(上昇中): 前も上も広い判定。飛行敵/回復アイテムを遊撃しやすく。
    // 外すと空中で無防備になるぶん、対戦ではダメージを高くしてある(f.upperDmg)。
    active=true; atkPose='upper';
    reach=84; hh=120; cyOff=80; reachOff=0.4; dmg=p.upperDmg;
  } else if(p.state==='jump' && p.airAttack>0){
    active=true;
    cyOff=55; hh=95;   // 空中攻撃は縦に広く。高い飛敵にもジャンプ頂点で届く
  }
  if(!active)return null;
  const cx=p.x + p.facing*(reach*reachOff);
  const cy=(p.y-cyOff);
  return {cx, cy, hw:reach*p.boxScale*0.7, hh:hh*p.boxScale, dir:p.facing, dmg, pose:atkPose, stun};
}

// ファイターの被弾を発生させる(敵との接触・偽アイテム共通)。srcXは加害物のx(ノックバック方向)。
export function hurtFighter(f, srcX, dmg=1){
  if(f.invuln>0)return;
  if(f.state==='hurt'||f.state==='knockback'||f.state==='down')return;
  f.hp-=dmg; sfx.hurt();
  f.jumpUpper=false;
  const kbDir=(f.x<srcX?-1:1);
  if(f.onGround){
    f.state='hurt'; f.hurtTimer=28; f.invuln=60; f.vx=kbDir*3;
  } else {
    f.state='knockback'; f.invuln=75; f.vx=kbDir*5; f.vy=-8;
  }
  if(f.hp<=0){
    f.hp=0; f.dying=true;
    f.state='knockback'; f.invuln=9999;
    f.vx=kbDir*6; f.vy=-11; f.onGround=false;
  }
}
