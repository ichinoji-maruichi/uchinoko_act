// ===================== 実行時状態 =====================
// ゲーム中に変化する状態の単一の置き場所。
// 各モジュールはここから同じオブジェクト参照を import して読み書きする。
// （プリミティブは runtime にまとめ、オブジェクト経由で共有することで
//  モジュール間の再代入問題を避ける）

import { GROUND_OFFSET, nextItemTimer, POP_DUR, ACTION_MAX_HP, LIGHT_COMBO, HEAVY_COMBO } from './config.js';

// --- キャンバス ---
export const stage = document.getElementById('stage');
export const sctx  = stage.getContext('2d');
// 論理座標系のサイズ。ゲームの物理・配置はすべてこの座標で行う。
// バックストア解像度(stage.width/height)は表示サイズ×dprへ後から広げる(loader.js fitStage)
// ので、初期属性値(index.html: 800×450)をここで固定して論理サイズとして使う。
export const VIEW_W = stage.width;
export const VIEW_H = stage.height;
export const GROUND_Y = VIEW_H - GROUND_OFFSET;   // 接地ライン

// --- ゲーム全体の状態 ---
// 体力はファイター側(player.hp)が持つ。ここはモードをまたぐ進行状態のみ。
export const GAME = { score:0, over:false, time:0 };

// --- キー押下状態 ---
export const keys = {};

// ===================== ファイター =====================
// 操作キャラの生成。対戦格闘モードでは2体を同時に動かすため、
// 1人用モードのプレイヤーも「ファイターの1体目」として扱う。
// 以前 runtime / gfx / GAME に置いていた「1人しかいない前提」の値
// (SCALE・swingId・入力エッジ・ポーズ表・体力)は、すべてここに持たせる。
export function createFighter(opts={}){
  return {
    x: VIEW_W/2, y: GROUND_Y, vx:0, vy:0,
    facing:1,            // 1=右, -1=左
    onGround:true,
    state:'idle',        // idle/walk/crouch/jump/attack/hurt/knockback/down
    hurtTimer:0,         // 被弾モーションの残りフレーム
    dying:false,         // 致命傷中(復帰不可)
    hp:    opts.maxHp || ACTION_MAX_HP,
    maxHp: opts.maxHp || ACTION_MAX_HP,
    // 歩き in/loop/out
    walkPhase:'none',    // none/in/loop/out
    walkTimer:0, walkFrame:0,
    // 攻撃。使うコンボ表はファイターごとに持つ(対戦モードは別バランスの表を入れる)
    lightCombo: LIGHT_COMBO, heavyCombo: HEAVY_COMBO,
    upperDmg:1,          // ジャンプアッパーの威力。対戦モードでは高くする

    combo:null, comboIdx:0, comboTimer:0,
    airAttack:0,         // >0 の間、空中攻撃ポーズを表示(フレーム残数)
    invuln:0,            // 被弾後の無敵フレーム
    jumpsLeft:1,         // 空中で使える追加ジャンプ回数
    jumpUpper:false,     // ジャンプアッパー中(上昇中のみ true)。2段ジャンプ不可・広い判定
    // アニメ一般
    animT:0,
    // --- ファイター固有(1体ごとに独立して持つ必要があるもの) ---
    input: opts.input || {},   // キー押下状態。人間は keys、CPUはAIが書き込む
    lastLight:false, lastHeavy:false, lastUp:false,   // 入力のエッジ検出用
    lastLeft:false, lastRight:false, lastDash:false,  // ダッシュ入力の検出用
    swingId:0,           // 攻撃モーションごとに一意。多段ヒット防止に使う
    FR:{},               // pose -> {canvas,w,h,footY,cx,cy}  抽出済みスプライト
    SCALE:1.0,           // idle の身長を TARGET_H に正規化する倍率(描画用)
    // 判定の大きさの倍率。アクションでは SCALE と同じ。対戦では両者共通の値を入れ、
    // 元画像の解像度でリーチが変わって有利不利が出ないようにする。
    boxScale:1.0,
    // --- 対戦モードの戦闘用(アクションモードでは使わない) ---
    lastHitSwing:-1,     // 相手のどのスイングまで食らったか(1回の振りで多段ヒットしない)
    comboCount:0,        // 連続で受けたヒット数。上限に達すると強制的に吹っ飛ぶ
    clashTimer:0,        // 相殺後の硬直の残りフレーム
    clashPose:'atk1',    // 相殺で止まった瞬間の攻撃ポーズ(そのまま表示する)
    getupFrames:0,       // >0 ならダウン後に「しゃがみ」をこのフレーム数だけ挟んで起き上がる
    canDash:false,       // ダッシュ(方向キー2回押し)を使えるか。対戦モードのみ true
    tapDir:0, tapTimer:0,          // 2回押しの受付(直前に押した向きと残りフレーム)
    dashDir:1, dashTimer:0,        // ダッシュ中の向きと残りフレーム
    guardTimer:0, crushTimer:0,    // ガード硬直 / ガードクラッシュ後の硬直
    defeatSfx:true,      // 力尽きた時にゲームオーバー音を鳴らすか(対戦のCPU側は false)
    ai:null,             // CPUが操作するファイターのみ、思考状態(vsai.js)を持つ
  };
}

// ファイターを開始状態へ戻す。FR/SCALE/input と入力エッジは持ち越す
// (エッジをリセットすると、キーを押しっぱなしでのリトライ時に
//  意図しない攻撃・ジャンプが暴発するため)。
export function resetFighter(f, x=VIEW_W/2){
  f.x=x; f.y=GROUND_Y; f.vx=0; f.vy=0;
  f.state='idle'; f.onGround=true; f.combo=null; f.airAttack=0;
  f.invuln=0; f.dying=false; f.hurtTimer=0; f.jumpsLeft=1;
  f.jumpUpper=false;
  f.hp=f.maxHp; f.swingId=0;
  f.lastHitSwing=-1; f.comboCount=0; f.clashTimer=0;
  f.tapDir=0; f.tapTimer=0; f.dashTimer=0;
  f.guardTimer=0; f.crushTimer=0;
}

// --- プレイヤー(1人用モードの操作キャラ) ---
export const player = createFighter({ input: keys });

// --- 対戦格闘モードの状態 ---
// sheets/names はランディングで投入した2キャラ分の素材。
// f1(人間) / f2(CPU) は試合開始時に createFighter で作る。
export const vs = {
  sheets: [null, null],   // 抽出済みポーズ表(FR) × 2キャラ
  names:  ['キャラ1', 'キャラ2'],
  playerIdx: 0,           // 人間が操作する側(0 or 1)。もう一方がCPU
  cpuLevel: 'normal',     // easy / normal / hard
  f1: null,               // 人間側のファイター
  f2: null,               // CPU側のファイター
  winner: null,           // 決着後 'p1'(人間の勝ち) / 'p2'(CPUの勝ち)
  resultShown: false,     // 決着時の演出(BGM停止・勝敗音)を1回だけ鳴らすためのフラグ
  introStep: -1,          // 開始演出で今どのコマ(READY/3/2/1/FIGHT)を出しているか
};

// --- ワールド内オブジェクト（filter で再代入されるので配列はここで一元管理） ---
export const world = {
  enemies: [],
  items:   [],
  pops:    [],   // スコアポップ "+N"
};

// --- 実行時プリミティブ（モジュール間で共有・書き換えする値） ---
export const runtime = {
  spawnTimer: 0,
  itemTimer: 0,
  killCount: 0,        // 撃破した敵の総数(大型敵の確定スポーン判定に使う)
  giantsPending: 0,    // スポーン待ちの大型敵の数
  DEBUG: false,        // Dキーで当たり判定の可視化ON/OFF
  PRACTICE: false,     // Pキーで練習モード(敵が湧かない)
  MODE: 'action',      // 'action'(1人用アクション) / 'vs'(対戦格闘)
  PHASE: 'ready',      // 'ready'(START待ち) / 'intro'(開始演出) / 'playing'
  introT: 0,           // 開始演出の経過フレーム
  paused: false,       // 一時停止(終了/リトライメニュー表示中)
  helpOpen: false,     // 操作方法パネルを開いている間もゲームを止める
  // ループ
  running:false, acc:0, last:0, errShown:false,
};

// --- スプライト・画像アセット ---
// プレイヤーのポーズ表(FR)はキャラごとに異なるのでファイター側が持つ。
// ここは全モードで共有するアセットのみ。
export const gfx = {
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
  GAME.score=0; GAME.over=false; GAME.time=0;
  world.enemies=[]; runtime.spawnTimer=60;
  runtime.killCount=0; runtime.giantsPending=0; runtime.paused=false;
  world.items=[]; runtime.itemTimer=nextItemTimer();
  world.pops=[];
  resetFighter(player);
}
