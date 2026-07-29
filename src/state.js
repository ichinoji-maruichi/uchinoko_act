// ===================== 実行時状態 =====================
// ゲーム中に変化する状態の単一の置き場所。
// 各モジュールはここから同じオブジェクト参照を import して読み書きする。
// （プリミティブは runtime にまとめ、オブジェクト経由で共有することで
//  モジュール間の再代入問題を避ける）

import { GROUND_OFFSET, nextItemTimer, POP_DUR } from './config.js';

// --- キャンバス ---
export const stage = document.getElementById('stage');
export const sctx  = stage.getContext('2d');
export const GROUND_Y = stage.height - GROUND_OFFSET;   // 接地ライン

// --- ゲーム全体の状態 ---
export const GAME = { hp:3, maxHp:3, score:0, over:false, time:0 };

// --- プレイヤー ---
export const player = {
  x: stage.width/2, y: GROUND_Y, vx:0, vy:0,
  facing:1,            // 1=右, -1=左
  onGround:true,
  state:'idle',        // idle/walk/crouch/jump/attack/hurt/knockback/down
  hurtTimer:0,         // 被弾モーションの残りフレーム
  dying:false,         // 致命傷中(復帰不可)
  // 歩き in/loop/out
  walkPhase:'none',    // none/in/loop/out
  walkTimer:0, walkFrame:0,
  // 攻撃
  combo:null, comboIdx:0, comboTimer:0,
  airAttack:0,         // >0 の間、空中攻撃ポーズを表示(フレーム残数)
  invuln:0,            // 被弾後の無敵フレーム
  jumpsLeft:1,         // 空中で使える追加ジャンプ回数
  // アニメ一般
  animT:0,
};

// --- ワールド内オブジェクト（filter で再代入されるので配列はここで一元管理） ---
export const world = {
  enemies: [],
  items:   [],
  pops:    [],   // スコアポップ "+N"
};

// --- 実行時プリミティブ（モジュール間で共有・書き換えする値） ---
export const runtime = {
  SCALE: 1.0,          // 抽出後に idle 基準で算出
  swingId: 0,          // 攻撃モーションごとに一意。多段ヒット防止に使う
  spawnTimer: 0,
  itemTimer: 0,
  killCount: 0,        // 撃破した敵の総数(大型敵の確定スポーン判定に使う)
  giantsPending: 0,    // スポーン待ちの大型敵の数
  DEBUG: false,        // Dキーで当たり判定の可視化ON/OFF
  PRACTICE: false,     // Pキーで練習モード(敵が湧かない)
  PHASE: 'ready',      // 'ready'(START待ち) / 'playing'
  paused: false,       // 一時停止(終了/リトライメニュー表示中)
  // 入力エッジ検出
  lastLight:false, lastHeavy:false, lastUp:false,
  // ループ
  running:false, acc:0, last:0, errShown:false,
};

// --- キー押下状態 ---
export const keys = {};

// --- スプライト・画像アセット ---
export const gfx = {
  KEY: { r:0, g:255, b:34 },  // クロマキー色(抽出時に自動検出)
  srcCanvas: null, srcCtx: null,
  FR: {},        // pose -> {canvas,w,h,footY,cx,cy}  プレイヤー
  ESPR: {},      // type -> [{canvas,white,w,h}, ...] 敵
  bgImg: null, bgReady: false,
  logo: null, logoReady: false,   // ready画面のタイトルロゴ(任意)
};

// ===================== 状態の生成・操作 =====================

// スコアポップ("+N" が上に浮かんで消える)を追加
export function addPop(x, y, text){ world.pops.push({ x, y, text, t:0 }); }

// スコアポップの更新(上へ浮かんでフェード)
export function updatePops(){
  for(const p of world.pops){ p.t++; p.y-=0.8; }
  world.pops = world.pops.filter(p => p.t < POP_DUR);
}

// 1プレイの初期化
export function resetGame(){
  GAME.hp=GAME.maxHp; GAME.score=0; GAME.over=false; GAME.time=0;
  world.enemies=[]; runtime.spawnTimer=60; runtime.swingId=0;
  runtime.killCount=0; runtime.giantsPending=0; runtime.paused=false;
  world.items=[]; runtime.itemTimer=nextItemTimer();
  world.pops=[];
  player.x=stage.width/2; player.y=GROUND_Y; player.vx=0; player.vy=0;
  player.state='idle'; player.onGround=true; player.combo=null; player.airAttack=0;
  player.invuln=0; player.dying=false; player.hurtTimer=0; player.jumpsLeft=1;
}
