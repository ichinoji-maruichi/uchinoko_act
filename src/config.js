// ===================== 定数・設定 =====================
// 物理・敵タイプ・コンボ・タイミングなど、調整対象の定数をここに集約。
// 実行時に変化する状態は state.js、ロジックは各モジュールへ。

// --- アセットのパス（assets/ 配下のPNGを差し替えれば見た目が変わる） ---
export const ASSETS = {
  playerDefault: 'assets/player_default.png',  // お試しマネキン
  enemies:       'assets/enemies.png',          // 敵表(5×3)
  background:    'assets/background.png',        // 森背景
  logo:          'assets/logo.png',             // タイトルロゴ(ready画面。無ければ非表示)
};

// --- スプライト抽出 ---
// プレイヤー表のポーズ配置（5列×3行=15セル）。null は抽出しない。
// 2段目5コマ目 jump_upper = ジャンプアッパー(上昇中)の専用ポーズ。
export const POSES = [
  'idle','walk_start','walk1','walk2','crouch',
  'atk_start','atk1','atk2','atk3','jump_upper',
  'jump_up','jump_down','damage','knockback','down'
];
// 敵表の配置（5×3）。各敵は移動2フレーム。
export const ESPR_MAP = [
  'rusher','rusher','walker','walker',null,
  'brute','brute','flyer','flyer',null,
  'heal','fake',null,null,null
];
export const COLS = 5, ROWS = 3;
// tol=キー色許容 / minsz=最小連結成分サイズ / inset=セル内側マージン(px)
export const EX = { tol:120, minsz:200, inset:3 };

// --- ステージ・物理 ---
export const GROUND_OFFSET = 40;   // 地面ライン = canvas.height - GROUND_OFFSET
export const CLAMP_MARGIN  = 30;   // プレイヤーが画面端で止まる余白(px)
export const GRAV = 0.9, JUMP_V = -16, MOVE_SPD = 3.2;
export const JUMP_UPPER_V = -20;   // ジャンプアッパーの初速(通常ジャンプより速く上昇)
export const TARGET_H  = 200;   // idle の身長をこの高さ(px)に正規化
export const FOOT_SINK = 6;     // 足元を地面ラインより少し沈めて接地感を出す(px)
// 横たわりポーズ(ダウン等)の接地アンカー補正。
// 髪・尻尾などの細い揺れ物が本体より下に描かれると、bbox下端を接地させると本体が浮く。
// これらのポーズだけ「一定以上の横幅がある最下行(=本体の下端)」を接地線に合わせ、
// その下の細い突起は地面に流れる形にする。揺れ物がないキャラは最下行付近が本体なので
// footY≒bh となり従来と変わらない(=埋まらない)。
export const LYING_POSES = ['down'];   // 対象ポーズ(必要なら 'knockback' 等を追加)
// 本体とみなす行の横幅しきい値(最大行幅に対する比)。実測(サンプル/長髪キャラ)で調整:
// 揺れ物が少ないキャラは frac を上げても沈み量が数pxで頭打ち(本体が下端まで詰まっているため)、
// 長髪など下に垂れるキャラは 0.5〜0.6 で本体下端に到達し以降は横ばい。両立点として 0.6 を採用。
export const LYING_ANCHOR_FRAC = 0.6;
// 吹っ飛びダウン→起き上がりまでの無敵フレーム。ダウン(約40f)+起き上がり直後の猶予を含める。
export const DOWN_INVULN = 70;

// --- 攻撃コンボ定義 ---
// wait=そのポーズを表示し続けるフレーム数(60fps基準) / adv=前進量(px) / dmg=ダメージ
export const LIGHT_COMBO = [
  { pose:'atk_start', wait:6,  adv:4 },
  { pose:'atk1',      wait:14, adv:10, dmg:1 },
];
export const HEAVY_COMBO = [
  { pose:'atk_start', wait:7,  adv:4 },
  { pose:'atk1',      wait:14, adv:10, dmg:1 },
  { pose:'atk2',      wait:14, adv:12, dmg:1 },
  { pose:'atk3',      wait:20, adv:16, dmg:2 },   // フィニッシュは2ダメージ
];

// --- 敵タイプ ---
// 図形で表現できる範囲(速度・耐久・サイズ・高さ・色)で差別化。
export const ENEMY_TYPES = {
  walker:{ speedMin:1.2, speedMax:1.8, hp:1, r:26, hue:35,  fly:false, score:1, atkImmune:false, drawScale:1.5 },
  rusher:{ speedMin:3.2, speedMax:3.8, hp:1, r:18, hue:0,   fly:false, score:2, atkImmune:true,  drawScale:0.9 }, // 攻撃無敵・踏むか避ける
  brute: { speedMin:0.7, speedMax:1.0, hp:4, r:46, hue:210, fly:false, score:3, atkImmune:false, drawScale:1.3 }, // HP4
  flyer: { speedMin:1.8, speedMax:2.4, hp:1, r:28, hue:280, fly:true,  score:3, atkImmune:false, drawScale:0.8 }, // スコア3
  // 大型のレア敵。既存スプライトを流用(spr)し、色(tint)で差別化。動きが遅く、体力が高い。
  // tint は 'color' 合成で色相のみ差し替え(黒い輪郭・陰影の明暗は保たれる)。
  // stompBounceScale: 踏んだ時のバウンド倍率(大きいほど高く跳ね返され再踏みが難しい)
  // stompRefund:false = 踏んでも2段ジャンプを戻さない(無限バウンドでの一方的撃破を防ぐ)
  // stompImmune:true = 踏めるがダメージ0(でかいので踏み程度では倒せない→攻撃で倒す)
  giant_mushroom:{ speedMin:0.5, speedMax:0.8, hp:3, r:52, hue:280, fly:false, score:3, atkImmune:false, drawScale:1.5, spr:'walker', tint:'#a24be0', stompBounceScale:1.5, stompRefund:false, stompImmune:true }, // でかきのこ(紫, walkerの絵)
  giant_tanuki:  { speedMin:0.4, speedMax:0.7, hp:8, r:76, hue:120, fly:false, score:5, atkImmune:false, drawScale:1.3, spr:'brute',  tint:'#3fbf5a', stompBounceScale:1.6, stompRefund:false, stompImmune:true }, // でかたぬき(緑, bruteの絵。ボス格で最大)
};
// この体数を倒すごとに大型敵(でかきのこ/でかたぬき)を1体確定スポーンする。
export const GIANT_SPAWN_EVERY = 30;
export const ENEMY_DRAW_SCALE = 1.2;   // 敵の見た目の共通倍率(当たり判定は変えない)
export const STOMP_BOUNCE = -11;       // 踏んだ後の跳ね返り速度
export const DEATH_DUR = 22;           // 敵の消滅アニメの長さ(フレーム)
export const STOMP_REVIVE_DOUBLEJUMP = true;  // 踏みつけで2段ジャンプ復活

// --- アイテム ---
export const ITEM_INTERVAL_MIN = 20*60, ITEM_INTERVAL_MAX = 30*60;  // 20〜30秒
export const ITEM_FALL_SPEED = 1.3;   // ゆっくり落下
export const ITEM_FAKE_RATE = 0.35;   // 出現時に偽物になる確率
// アイテムの被攻撃判定を上方向のみ拡張する倍率。落下アイテムを高い位置でも壊せるように。
// ※飛行敵の判定は enemies.js 側で別管理なので、この値を上げても飛行敵には当たらない。
export const ITEM_ATK_UP_SCALE = 1.5;
export function nextItemTimer(){
  return ITEM_INTERVAL_MIN + Math.random()*(ITEM_INTERVAL_MAX-ITEM_INTERVAL_MIN);
}

// --- 演出 ---
export const POP_DUR = 48;   // スコアポップの表示フレーム数

// --- サウンド ---
export const SFX_VOLUME = 0.35;   // 効果音の音量(0〜1)
export const BGM_VOLUME = 0.08;   // BGMの音量(0〜1)。SFXが埋もれないよう控えめ
export const BGM_TEMPO  = 140;    // BGMのテンポ(BPM)

// --- 入力 ---
export const KEYMAP = {
  ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
  KeyZ:'light', KeyX:'heavy', Space:'up'
};

// --- ループ ---
export const STEP_MS = 1000/60;   // 固定タイムステップ(60fps基準)
