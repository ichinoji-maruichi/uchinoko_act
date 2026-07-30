// ===================== プレイヤー状態機械 =====================
import { GRAV, JUMP_V, JUMP_UPPER_V, MOVE_SPD, CLAMP_MARGIN, LIGHT_COMBO, HEAVY_COMBO, DOWN_INVULN } from './config.js';
import { stage, GROUND_Y, GAME, player, keys, runtime } from './state.js';
import { sfx } from './sfx.js';
import { bgm } from './bgm.js';

export function startAttack(combo){
  player.combo=combo; player.comboIdx=0;
  player.comboTimer=combo[0].wait;
  player.state='attack';
  // 風切り音は各斬りフレーム(atk1/2/3)で鳴らす → updatePlayer 側を参照
}

// ジャンプアッパー発動。通常より速く上昇し、上昇中は広い攻撃判定を出す(getAttackBox参照)。
// 頂点(vy>=0)で jumpUpper を解除し通常のジャンプ下りへ移行する。
export function startJumpUpper(){
  const p=player;
  p.vy=JUMP_UPPER_V;      // 通常ジャンプより速い上昇
  p.onGround=false;
  p.jumpsLeft=0;          // ジャンプアッパー後は2段ジャンプ不可
  p.jumpUpper=true;
  p.state='jump';
  p.airAttack=0;
  p.combo=null; p.comboIdx=0;
  // 横方向の入力があれば反映(斜め上への遊撃)
  if(keys.left&&!keys.right) p.vx=-MOVE_SPD;
  else if(keys.right&&!keys.left) p.vx=MOVE_SPD;
  else p.vx=0;
  runtime.swingId++;      // 1回のアッパー=1スイング(各敵に1ヒット)
  sfx.jumpUpper();
}

export function updatePlayer(){
  const p=player;
  const pressLeft=keys.left, pressRight=keys.right;
  const pressUp=keys.up, pressDown=keys.down;
  const edgeLight=keys.light&&!runtime.lastLight;
  const edgeHeavy=keys.heavy&&!runtime.lastHeavy;
  const edgeUp=keys.up&&!runtime.lastUp;
  runtime.lastLight=keys.light; runtime.lastHeavy=keys.heavy; runtime.lastUp=keys.up;

  // ===== 被弾中の状態(操作不能・無敵) =====
  // hurt: 地上ダメージ。knockback: 空中で吹っ飛び。down: 着地後ダウン。
  if(p.state==='hurt'){
    p.vx*=0.85; p.x+=p.vx; clampX();
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
      clampX();
      if(p.y>=GROUND_Y){
        p.y=GROUND_Y; p.vy=0; p.vx=0;
        // 着地 → ダウン
        p.state='down'; p.hurtTimer= p.dying ? 999 : 40;
        // 起き上がり直後の被弾を防ぐため、ダウン中〜起き上がり直後まで無敵を確保
        if(!p.dying) p.invuln = Math.max(p.invuln, DOWN_INVULN);
        if(p.dying){ GAME.over=true; bgm.stop(); sfx.gameover(); }   // 致命傷ならゲームオーバー
      }
      return;
    }
  }
  if(p.state==='down'){
    p.vx=0; p.hurtTimer--;
    if(p.hurtTimer<=0 && !GAME.over){ p.state='idle'; p.onGround=true; }
    return;
  }

  // ===== ジャンプアッパー(ジャンプ+弱の同時押し) =====
  // ジャンプ入力の瞬間に弱攻撃を押していれば発動。通常より速く上昇し広い判定を出す。
  // ・地上から発動 → 2段ジャンプ不可(jumpsLeft=0)
  // ・1段目ジャンプ中に発動 → それが2段目扱い(以降ジャンプ不可)
  // ・弱攻撃の出始め(atk_start)なら中断してアッパーへ差し替え(同時押しの取りこぼし対策)
  if(edgeUp && keys.light){
    const groundOK = p.onGround &&
      (p.state!=='attack' || (p.combo===LIGHT_COMBO && p.comboIdx===0));
    const doubleOK = !p.onGround && p.jumpsLeft>0 && !p.jumpUpper;
    if(groundOK || doubleOK){ startJumpUpper(); return; }
  }

  // 攻撃中は攻撃処理を優先（地上のみ）
  if(p.state==='attack'){
    p.vx=0;
    const step=p.combo[p.comboIdx];
    // 各コマの入り(残りフレーム==wait)で一度だけ前進
    if(p.comboTimer===step.wait){
      p.x += step.adv*runtime.SCALE*p.facing;
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
          runtime.swingId++; sfx.swing(p.combo===HEAVY_COMBO, np==='atk3');
        }
      }
    }
    clampX();
    return;
  }

  // 攻撃開始（地上のみ）
  if(p.onGround && edgeLight){ startAttack(LIGHT_COMBO); return; }
  if(p.onGround && edgeHeavy){ startAttack(HEAVY_COMBO); return; }

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
    if((edgeLight||edgeHeavy) && p.airAttack<=0 && !p.jumpUpper){ p.airAttack=16; runtime.swingId++; sfx.swing(edgeHeavy); }
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
  clampX();

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

export function clampX(){
  const m=CLAMP_MARGIN;
  if(player.x<m)player.x=m;
  if(player.x>stage.width-m)player.x=stage.width-m;
}

// 攻撃判定ボックス(攻撃中のみ返す)。プレイヤーの前方に出す。
export function getAttackBox(){
  const p=player;
  let active=false, reach=52, hh=34, cyOff=55, dmg=1, reachOff=0.6;
  if(p.state==='attack'){
    // コンボの打撃コマ(atk1/2/3)でのみ判定を出す
    const step=p.combo[p.comboIdx];
    const pose=step.pose;
    if(pose==='atk1'||pose==='atk2'||pose==='atk3') active=true;
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
    dmg=step.dmg||1;
  } else if(p.state==='jump' && p.jumpUpper && p.vy<0){
    // ジャンプアッパー(上昇中): 前も上も広い判定。飛行敵/回復アイテムを遊撃しやすく。
    active=true;
    reach=84; hh=120; cyOff=80; reachOff=0.4;
  } else if(p.state==='jump' && p.airAttack>0){
    active=true;
    cyOff=55; hh=95;   // 空中攻撃は縦に広く。高い飛敵にもジャンプ頂点で届く
  }
  if(!active)return null;
  const cx=p.x + p.facing*(reach*reachOff);
  const cy=(p.y-cyOff);
  return {cx, cy, hw:reach*runtime.SCALE*0.7, hh:hh*runtime.SCALE, dir:p.facing, dmg};
}

// プレイヤー被弾を発生させる(接触・偽アイテム共通)。srcXは加害物のx(ノックバック方向)。
export function hurtPlayer(srcX){
  if(player.invuln>0)return;
  if(player.state==='hurt'||player.state==='knockback'||player.state==='down')return;
  GAME.hp--; sfx.hurt();
  player.jumpUpper=false;
  const kbDir=(player.x<srcX?-1:1);
  if(player.onGround){
    player.state='hurt'; player.hurtTimer=28; player.invuln=60; player.vx=kbDir*3;
  } else {
    player.state='knockback'; player.invuln=75; player.vx=kbDir*5; player.vy=-8;
  }
  if(GAME.hp<=0){
    GAME.hp=0; player.dying=true;
    player.state='knockback'; player.invuln=9999;
    player.vx=kbDir*6; player.vy=-11; player.onGround=false;
  }
}
