// ===================== アイテム =====================
// 回復アイテムが空から落下。本物(ハート/heal)と偽物(ドクロ/fake)がある。
import { ITEM_FALL_SPEED, ITEM_FAKE_RATE, ITEM_ATK_UP_SCALE, nextItemTimer } from './config.js';
import { VIEW_W, GROUND_Y, GAME, player, world, runtime } from './state.js';
import { getAttackBox, hurtFighter } from './player.js';
import { sfx } from './sfx.js';

export function updateItems(){
  if(GAME.over)return;
  if(!runtime.PRACTICE){
    runtime.itemTimer--;
    if(runtime.itemTimer<=0){
      const fake=Math.random()<ITEM_FAKE_RATE;   // 偽物確率
      world.items.push({ x:80+Math.random()*(VIEW_W-160), y:-20, r:16, taken:false, popT:0, fake });
      runtime.itemTimer=nextItemTimer();
    }
  }
  const atkBox=getAttackBox(player);
  for(const it of world.items){
    if(it.taken){ it.popT++; continue; }
    it.y += ITEM_FALL_SPEED;
    // 攻撃を当てた（落下アイテムを高い位置でも壊せるよう、上方向のみ判定を拡張）
    let hit=false;
    if(atkBox && Math.abs(it.x-atkBox.cx)<atkBox.hw+it.r){
      const dy=it.y-atkBox.cy;                       // 負=アイテムが判定中心より上
      const up=atkBox.hh*ITEM_ATK_UP_SCALE, down=atkBox.hh;
      hit = dy<0 ? (-dy < up+it.r) : (dy < down+it.r);
    }
    if(hit){
      it.taken=true; it.popT=0;
      if(it.fake){ GAME.score++; sfx.coin(); }          // 偽物: 倒してスコア
      else if(player.hp<player.maxHp){ player.hp++; sfx.heal(); } // 本物: 回復
      else { GAME.score++; sfx.coin(); }                 // 本物満タン: スコア
      continue;
    }
    // 偽物への接触 → 被弾
    if(it.fake && player.invuln<=0){
      const inHurt=(player.state==='hurt'||player.state==='knockback'||player.state==='down');
      if(!inHurt){
        const dx=Math.abs(it.x-player.x);
        const dy=Math.abs(it.y-(player.y-70));
        if(dx<it.r+16 && dy<70){ hurtFighter(player, it.x); it.taken=true; it.popT=8; }
      }
    }
    // 地面に落ちたら消滅
    if(!it.taken && it.y>=GROUND_Y){ it.taken=true; it.popT=12; it.missed=true; }
  }
  world.items=world.items.filter(it=> it.taken ? it.popT<14 : it.y<GROUND_Y+20 );
}
