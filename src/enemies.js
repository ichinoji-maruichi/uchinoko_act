// ===================== 敵・戦闘 =====================
import { ENEMY_TYPES, STOMP_BOUNCE, STOMP_REVIVE_DOUBLEJUMP, DEATH_DUR, GIANT_SPAWN_EVERY } from './config.js';
import { VIEW_W, GROUND_Y, GAME, player, world, runtime, addPop } from './state.js';
import { getAttackBox } from './player.js';
import { sfx } from './sfx.js';

// 敵を倒す共通処理(スコア加算+ポップ表示)。死ぬ箇所は必ずここを通す。
// cause: 'attack'(斬り) / 'stomp'(踏み潰し) で撃破音を変える。
export function killEnemy(e, cause='attack'){
  e.dead=true; e.deadT=0;
  GAME.score+=e.score;
  addPop(e.x, e.y-e.r*2, '+'+e.score);
  sfx.kill(cause);
  // 一定数倒すごとに大型敵を1体予約(次のフレームで確定スポーン)
  runtime.killCount++;
  if(runtime.killCount % GIANT_SPAWN_EVERY === 0) runtime.giantsPending++;
}

// 湧き間隔: 時間とともに短縮。序盤120f(2秒)→下限35f
function spawnInterval(){
  return Math.max(35, 120 - GAME.time/300);
}
// 時間経過で敵構成を変える。序盤は雑魚中心、後半ほど強敵が混ざる。
function pickType(){
  const sec=GAME.time/60;
  // 各タイプの重み(出現しやすさ)。secに応じて強敵の重みが増加。
  // 大型敵はここには入れない(30体撃破ごとに別途確定スポーンする)
  const w={
    walker: 10,
    rusher: Math.min(8, sec/6),      // 6秒ごとに+1、最大8
    brute:  Math.min(6, sec/10),     // 10秒ごとに+1、最大6
    flyer:  Math.min(6, (sec-15)/10) // 15秒後から出始める
  };
  let total=0; for(const k in w){ if(w[k]>0) total+=w[k]; }
  let r=Math.random()*total;
  for(const k in w){ if(w[k]<=0)continue; r-=w[k]; if(r<=0)return k; }
  return 'walker';
}
export function spawnEnemy(type){
  if(!type) type=pickType();
  const T=ENEMY_TYPES[type];
  const fromLeft=Math.random()<0.5;
  const speed=T.speedMin+Math.random()*(T.speedMax-T.speedMin);
  world.enemies.push({
    type,
    x: fromLeft ? -30 : VIEW_W+30,
    y: T.fly ? GROUND_Y-105 : GROUND_Y,   // 飛ぶ敵: 地上攻撃は届かない高さ。立ち判定は頭まで届くので接触はする
    dir: fromLeft ? 1 : -1,
    speed, hp:T.hp, maxHp:T.hp,
    dead:false, deadT:0, hitFlash:0,
    lastSwing:-1,
    r:T.r, hue:T.hue, fly:T.fly, score:T.score, atkImmune:T.atkImmune,
    spr:T.spr, tint:T.tint,   // 大型敵: 流用スプライトと色替え(通常敵は undefined)
    bobSeed:Math.random()*100
  });
}
// 大型敵(でかきのこ/でかたぬき)のどちらかを確定スポーン
function spawnGiant(){
  spawnEnemy(Math.random()<0.5 ? 'giant_mushroom' : 'giant_tanuki');
}

export function updateEnemies(){
  if(GAME.over)return;
  GAME.time++;
  // 湧き(練習モードでは湧かない)
  runtime.spawnTimer--;
  if(!runtime.PRACTICE && runtime.spawnTimer<=0){ spawnEnemy(); runtime.spawnTimer=spawnInterval(); }
  // 30体撃破ごとに予約された大型敵を確定スポーン
  if(!runtime.PRACTICE && runtime.giantsPending>0){ spawnGiant(); runtime.giantsPending--; }

  // プレイヤーの攻撃判定矩形(攻撃中のみ)
  const atkBox=getAttackBox();

  for(const e of world.enemies){
    if(e.dead){ e.deadT++; continue; }
    if(e.hitFlash>0) e.hitFlash--;
    // まっすぐ歩く(飛ぶ敵はその高さのまま)
    e.x += e.dir*e.speed;

    const ecx=e.x, ecy=e.y-e.r;   // 敵の判定中心

    // 1) 攻撃ヒット(atkImmuneな敵=rusherには効かない)
    if(!e.atkImmune && atkBox && e.lastSwing!==runtime.swingId &&
       Math.abs(e.x-atkBox.cx)<atkBox.hw+e.r &&
       Math.abs(ecy-atkBox.cy)<atkBox.hh+e.r){
      e.lastSwing=runtime.swingId;
      e.hp-=(atkBox.dmg||1); e.hitFlash=6;
      e.x += atkBox.dir*6;
      if(e.hp<=0){ killEnemy(e); } else { sfx.hit(atkBox.dmg||1); }
      continue;
    }

    // 2) 踏みつけ判定: プレイヤーが落下中(vy>0)で、敵の上側から接触
    const pfeet=player.y;                 // プレイヤー足元
    const dxS=Math.abs(e.x-player.x);
    if(!player.onGround && player.vy>0 &&
       dxS < e.r+16 &&
       pfeet > ecy-e.r-8 && pfeet < ecy+e.r*0.6){
      // 踏んだ! 敵ごとの効果
      const T=ENEMY_TYPES[e.type];
      player.vy=STOMP_BOUNCE*(T.stompBounceScale||1);   // 大型敵ほど強く跳ね返す
      // 2段ジャンプ復活。ただし大型敵(stompRefund:false)は戻さない→無限バウンド不可
      if(STOMP_REVIVE_DOUBLEJUMP && T.stompRefund!==false) player.jumpsLeft=1;
      // 大型敵(stompImmune): 踏めるがダメージは入らない。跳ね返すだけ「ポン」→攻撃で倒す。
      // ダメージが無いので点滅(hitFlash)もさせない。
      if(T.stompImmune){ sfx.stomp(); }
      else {
        e.hitFlash=6;
        // 倒したら「ぐしゃっ」、HPが残る敵(brute)は1ダメージで跳ねるだけ「ポン」
        if(e.maxHp>1){ e.hp--; if(e.hp<=0){ killEnemy(e,'stomp'); } else { sfx.stomp(); } }
        else { killEnemy(e,'stomp'); }
      }
      continue;
    }

    // 3) 接触ダメージ(踏みつけ以外の接触)
    // 無敵中・被弾モーション中は食らわない
    const inHurt = (player.state==='hurt'||player.state==='knockback'||player.state==='down');
    if(player.invuln<=0 && !inHurt){
      // プレイヤーの体の縦範囲を広めに取る(頭上の飛敵にも当たる)
      // 立ちは頭まで(飛敵に当たる)、しゃがみは低く(避けられる)
      const headUp = (player.state==='crouch') ? 45 : 140;
      const pTop=player.y-headUp, pBottom=player.y;   // 頭〜足元
      const eTop=ecy-e.r, eBottom=ecy+e.r;
      const overlapX = dxS < e.r+16;
      const overlapY = eBottom>pTop && eTop<pBottom;
      if(overlapX && overlapY){
        GAME.hp--; sfx.hurt();
        player.jumpUpper=false;
        const kbDir = (player.x<e.x?-1:1);
        if(player.onGround){
          // 地上 → ダメージモーション(操作不能・無敵)
          player.state='hurt'; player.hurtTimer=28; player.invuln=60;
          player.vx=kbDir*3;
        } else {
          // 空中 → 吹っ飛び
          player.state='knockback'; player.invuln=75;
          player.vx=kbDir*5; player.vy=-8;
        }
        if(GAME.hp<=0){
          GAME.hp=0;
          // 致命傷: 吹っ飛ばしてダウン→終了。復帰不可(dying)。
          player.dying=true;
          player.state='knockback'; player.invuln=9999;
          player.vx=kbDir*6; player.vy=-11; player.onGround=false;
        }
      }
    }
  }
  // 掃除
  world.enemies=world.enemies.filter(e=>{
    if(e.dead) return e.deadT<DEATH_DUR;
    return e.x>-60 && e.x<VIEW_W+60;
  });
  if(player.invuln>0 && player.invuln<9999) player.invuln--;
}
