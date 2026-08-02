// ===================== 対戦モードのCPU =====================
// CPUは人間とまったく同じ入力しか使わない。updateFighter が読む入力オブジェクト
// (f.input)に毎フレーム書き込むだけで、専用の特権や内部状態は持たせない。
// これにより「CPUだけができる動き」が生まれず、強さの調整もパラメータだけで済む。
import { VS_AI, VS_AI_RANGE, CLAMP_MARGIN } from './config.js';
import { VIEW_W, world } from './state.js';
import { getAttackBox } from './player.js';

const KEYS = ['left','right','up','down','light','heavy'];

export function createAiState(){
  return { action:'wait', timer:0, recoverTried:false, prevOState:'idle' };
}

function clearInput(inp){ for(const k of KEYS) inp[k]=false; }

// 決めた行動を実際のキー入力に落とす。dir は相手のいる向き(1=右)。
function applyAction(ai, inp, dir){
  const fwd = dir>0 ? 'right' : 'left';
  const back = dir>0 ? 'left' : 'right';
  switch(ai.action){
    case 'approach': inp[fwd]=true; break;
    case 'back':     inp[back]=true; break;
    case 'jump':     inp.up=true; inp[fwd]=true; break;
    case 'light':    inp.light=true; break;
    case 'heavy':    inp.heavy=true; break;
    case 'guard':    inp.down=true; break;   // しゃがみ=ガード
    case 'wait':     break;
    // アイテムを取りに行く/避ける時は、相手ではなく落下地点を基準に動く
    case 'goLeft':   inp.left=true;  break;
    case 'goRight':  inp.right=true; break;
    // ダッシュは人間と同じ「方向キー2回押し」で出す。CPUだけの近道は作らない。
    // timer 4=押す / 3=離す / 2=押す(ここで成立) / 1=そのまま
    case 'dashF':    if(ai.timer!==3) inp[fwd]=true;  break;
    case 'dashB':    if(ai.timer!==3) inp[back]=true; break;
  }
}

function setAction(ai, action, frames){ ai.action=action; ai.timer=frames; }

// 落下中で、まだ誰も壊していないアイテムのうち一番下にあるもの
function nearestItem(){
  let best=null;
  for(const it of world.items){
    if(it.taken) continue;
    if(!best || it.y > best.y) best = it;
  }
  return best;
}

// f=CPU, o=相手(人間), level='easy'|'normal'|'hard'
export function updateAi(f, o, level){
  const P = VS_AI[level] || VS_AI.normal;
  const ai = f.ai;
  if(!ai) return;        // CPUが操作していないファイターの入力には触れない
  const inp = f.input;
  clearInput(inp);

  // 吹っ飛び中: 受け身(ジャンプ)を狙うかどうかを1回だけ抽選する。
  // 下降に転じてから判断するので、人間と同じく「落ちながら復帰」になる。
  if(f.state==='knockback'){
    if(!f.dying && !ai.recoverTried && f.vy>0){
      ai.recoverTried = true;
      if(Math.random() < P.recover) inp.up = true;
    }
    return;
  }
  ai.recoverTried = false;

  // 操作を受け付けない状態。復帰した瞬間に判断し直せるようタイマーを空にしておく。
  if(f.state==='hurt' || f.state==='down' || f.state==='getup' || f.state==='clash' ||
     f.state==='guard' || f.state==='crush'){
    ai.timer = 0;
    return;
  }
  // 攻撃・ダッシュ中は入力しても無視されるので、そのまま出し切る
  if(f.state==='attack' || f.state==='dash'){ ai.timer = 0; return; }

  const dist = Math.abs(o.x - f.x);
  const dir  = o.x > f.x ? 1 : -1;
  const oDown = (o.state==='down' || o.state==='getup');   // 相手がダウン中は攻撃を当てられない
  const inRange = dist < VS_AI_RANGE;

  // --- 割り込み: 相手の隙を狩る ---
  // 相手が「攻撃モーション中なのに判定が消えている」＝後隙。強3段目を空振りした後が代表例。
  // ガードクラッシュ中・のけぞり中も同じく確定所なので、迷わず殴りに行く。
  // (これが無いと、後隙の長い強攻撃を空振りされても取り返せず一方的に損をする)
  const oRecovering = o.state==='attack' && o.comboIdx>0 && !getAttackBox(o);
  const oPunishable = oRecovering || o.state==='crush' || o.state==='hurt';
  if(oPunishable && inRange && !oDown){
    setAction(ai, Math.random() < P.heavy ? 'heavy' : 'light', 3);
    applyAction(ai, inp, dir);
    return;
  }

  // --- アイテムへの反応 ---
  // 本物は割りに行き(放置すると相手に回復される)、偽物は触れないよう離れる。
  // 相手の攻撃への対応より優先度は低いので、確定所や被弾リスクが無い時だけ動く。
  const it = nearestItem();
  if(it && ai.timer<=0 && o.state!=='attack'){
    const dx = it.x - f.x;
    if(!it.fake){
      // 落ちてくる前から位置を合わせておき、届く高さになったら振る
      if(Math.abs(dx) > 50)      setAction(ai, dx>0 ? 'goRight' : 'goLeft', 6);
      else if(it.y > 150)        setAction(ai, 'light', 3);
      else                       setAction(ai, 'wait', 4);
      applyAction(ai, inp, dir); return;
    }
    if(Math.abs(dx) < 70){       // 偽物が真上に来たら離れる
      setAction(ai, dx>0 ? 'goLeft' : 'goRight', 8);
      applyAction(ai, inp, dir); return;
    }
  }

  // --- 割り込み: 相手が攻撃を始めた瞬間に合わせて振る ---
  // 攻撃の出始め(atk_start)は数フレームあるので、同時に振れば
  // 早い弱攻撃が先に当たるか、同時に当たって相殺になる。
  // ここだけは行動中(ai.timer>0)でも割り込む＝これが「反応の良さ」の正体。
  const oAttackStart = (o.state==='attack' && ai.prevOState!=='attack');
  ai.prevOState = o.state;
  if(oAttackStart && inRange && !oDown){
    const r = Math.random();
    if(r < P.clash){
      // 攻撃を合わせて相殺を狙う(risk: 読み負けると food になる)
      setAction(ai, 'light', 3);
      applyAction(ai, inp, dir); return;
    }
    if(r < P.clash + P.guard){
      // ガードで受ける。削りは食らうが安全。強3段目が来ると崩される
      setAction(ai, 'guard', 22);
      applyAction(ai, inp, dir); return;
    }
  }

  // 行動の継続中はそのまま入力を出し続ける
  if(ai.timer > 0){
    ai.timer--;
    applyAction(ai, inp, dir);
    return;
  }

  // --- ここから次の行動を決める（判断の間隔 = P.react が反応の速さ）---
  if(oDown){
    // 起き上がりを待つ（間合いだけ詰めておく）
    setAction(ai, inRange ? 'wait' : 'approach', P.react);
  } else if(!inRange){
    // ダッシュには後隙があるので、踏み込んだ先で殴られない状況でだけ使う。
    // (相手が攻撃中でなく、かつ十分に離れている時)
    const dashSafe = dist > VS_AI_RANGE*2 && o.state!=='attack';
    const r=Math.random();
    if(r < P.jump)                       setAction(ai, 'jump', 10);
    else if(dashSafe && r < P.jump+P.dash) setAction(ai, 'dashF', 4);
    else                                 setAction(ai, 'approach', P.react);
  } else {
    const q = Math.random();
    if(q < P.aggro)              setAction(ai, Math.random() < P.heavy ? 'heavy' : 'light', 3);
    // 下がる時は、相手が攻撃中でなければバックダッシュで大きく間合いを切る
    else if(q < P.aggro+P.retreat){
      if(o.state!=='attack' && Math.random() < P.dash) setAction(ai, 'dashB', 4);
      else setAction(ai, 'back', P.react);
    }
    else                          setAction(ai, 'wait', P.react);
  }

  // 画面端まで下がると詰むので、端が近ければ下がらず前に出る
  const edge = CLAMP_MARGIN + 70;
  if((ai.action==='back'||ai.action==='dashB') && (f.x < edge || f.x > VIEW_W-edge)) ai.action='approach';

  applyAction(ai, inp, dir);
}
