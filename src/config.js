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

// --- ルール ---
export const ACTION_MAX_HP = 3;   // アクションモード(1人用)の初期体力=HUDのハートの数

// --- 対戦格闘モード ---
// 対戦モードの体力。0になった方が負け。1発あたりの重さを下げるために14にしてある
// (弱1 / 強コンボ計3 / アッパー2 / ガードの削り0.3 に対して、決着まで約12〜14秒)。
// ガードの削りがあるので整数ではなく小数で持つ。HUDはバー表示なので見た目は変わらない。
export const VS_MAX_HP    = 14;
// 対戦モードのキャラ身長(px)。2人が並ぶので1人用(TARGET_H=200)より小さくし、
// 間合いを取る余地を作る。論理画面は800×450。
export const VS_TARGET_H  = 175;
export const VS_START_GAP = 260;  // 試合開始時の2人の間隔(px)

// --- 対戦モードの戦闘 ---
// 攻撃判定の大きさはキャラによらず共通にする。2人とも VS_TARGET_H の身長で
// 描かれるのに、元画像の解像度(=f.SCALE)で判定の大きさが変わると有利不利が出るため。
// (アクションモードは従来どおり f.SCALE をそのまま使う)
export const VS_BOX_SCALE = VS_TARGET_H / TARGET_H;
// 体(くらい判定)は身長に対する比で持つ。半幅・立ち高さ・しゃがみ高さ。
export const VS_BODY_HW_R     = 0.16;
export const VS_BODY_TOP_R    = 0.92;
export const VS_BODY_CROUCH_R = 0.55;
// 連続ヒットの上限。この回数を受けると強制的に大きく吹っ飛んでダウンする。
// 強コンボ完走(atk1→atk2→atk3)がちょうど3ヒットなので、弱連打も3発で必ず切れ、
// ダウン中の無敵(DOWN_INVULN)でリセットがかかる=永久コンボにならない。
export const VS_COMBO_LIMIT = 3;
// 空中攻撃・ジャンプアッパーののけぞり(コンボ定義に stun を持たないもの)の既定値
export const VS_HITSTUN   = 16;
export const VS_HIT_KB    = 3.2;   // 通常ヒットのノックバック初速
export const VS_LAUNCH_VX = 6.5;   // 大吹っ飛び(3ヒット目/フィニッシュ)の横初速
export const VS_LAUNCH_VY = -12;   // 同・上方向の初速
export const VS_AIR_KB    = 5;     // 空中で受けた時の横初速
export const VS_AIR_LIFT  = -6;    // 空中で受けた時の浮き直し。小さいほど拾い直しにくい
// 画面端で相手を押し込めない分、殴った側が下がる量。
// 端に追い詰めた側が一方的に殴り続けられる(ハメ)のを防ぐ。
export const VS_CORNER_PUSH = 16;
// 「端に詰まっている」とみなす壁からの距離。ノックバック(約18px)で押し切れる範囲より
// 広めに取る。狭くすると、殴った瞬間はまだ壁に届いておらず判定をすり抜けてしまう。
export const VS_CORNER_ZONE = 60;
export const VS_CLASH_KB     = 4.5;  // 相殺で互いに離れる初速
export const VS_CLASH_FREEZE = 14;   // 相殺後の硬直フレーム(この間は入力不可)
export const VS_GETUP     = 14;    // ダウン→「しゃがみ」を挟んで待機に戻るまでのフレーム
export const VS_PUSH_DIST = 62;    // これより近づくと押し合う

// --- ダッシュ（対戦モード） ---
// 方向キーの2回押しで発動。専用ポーズは作らず歩きの絵を速く回して見せる。
// 入力は「keys.left/right が false→true になった回数」で見るので、
// キーボードとスマホの仮想スティック(中央に戻して再度倒す)で同じ判定が使える。
export const VS_DASH_TAP_WINDOW = 14;  // 2回目の押しを受け付けるフレーム数
export const VS_DASH_SPD  = 9.5;       // ダッシュ中の速度(歩き3.2の約3倍)
export const VS_DASH_TIME = 9;         // 加速している時間 → 約85px移動する
export const VS_DASH_END  = 7;         // 後隙(滑って止まる)。ここを攻撃されると危ない

// --- ガード（対戦モード） ---
// しゃがみ(↓)がそのままガード。攻撃を受けた瞬間にしゃがんでいれば成立する。
// 削りダメージがあるので、HPは小数で持つ(HUDはバー表示なので見た目は変わらない)。
export const VS_GUARD_CHIP = 0.3;   // ガード成功時の削りダメージ
export const VS_GUARD_STUN = 10;    // ガード硬直
export const VS_GUARD_KB   = 2.0;   // ガード時に押し戻される初速
// 強攻撃3段目(atk3)をガードするとガードクラッシュ。吹っ飛ばず、その場で長く硬直する
// ＝攻めた側の追撃が確定する。これがガードを固め続けることへの回答になる。
// クラッシュ自体のダメージは控えめにして、本当の報酬は「40フレームの硬直＝追撃確定」に置く。
// ここを大きくすると、強コンボをガードする方が素で食らうより損になり、ガードが死ぬ。
export const VS_CRUSH_DMG  = 1.5;
export const VS_CRUSH_STUN = 40;

// --- 試合開始の演出（対戦モード） ---
// READY → 3 → 2 → 1 → FIGHT! の順に出す。この間は入力を受け付けず、アイテムも降らない。
export const VS_INTRO_STEPS  = ['READY', '3', '2', '1', 'FIGHT!'];
export const VS_INTRO_FRAMES = 36;   // 1コマあたりの表示フレーム(全体で約3秒)

// --- アイテム（対戦モード） ---
// 基本の挙動はアクションモードと同じ(空から落ちてきて、攻撃で壊すと効果が出る)。
// ただし1試合が15秒前後なので、20〜30秒間隔のままでは一度も降ってこない。
export const VS_ITEM_INTERVAL_MIN = 7*60, VS_ITEM_INTERVAL_MAX = 12*60;
export const VS_ITEM_HEAL = 2;      // 本物を壊した側が回復する量
export const VS_ITEM_FAKE_DMG = 1;  // 偽物に触れた側が受けるダメージ
export function nextVsItemTimer(){
  return VS_ITEM_INTERVAL_MIN + Math.random()*(VS_ITEM_INTERVAL_MAX-VS_ITEM_INTERVAL_MIN);
}

// --- CPU（対戦相手の自動操作） ---
// CPUは人間と同じ入力(左右/ジャンプ/弱/強)しか使わない。強さの差は
// 「反応の速さ・攻めの頻度・相殺を狙う確率・空中復帰の成功率」だけで付ける。
export const VS_AI_RANGE = 105;   // この距離以内なら攻撃が届くとみなす
// react=行動を決め直す間隔(フレーム。小さいほど手数が増える) / aggro=間合い内で攻める率
// heavy=強攻撃を選ぶ率(強コンボはダメージが大きいので強さへの影響も大きい)
// clash=相手の攻撃開始に合わせて振り返す率 / guard=相手の攻撃開始にガードする率
// retreat=下がる率 / jump=遠距離で跳ぶ率 / dash=遠距離で歩かずダッシュで詰める率
// recover=吹っ飛ばされた時に受け身を取る率
// 調整は「人間らしく動く相手」と戦わせて行う。ここを間違えると痛い目を見る:
// 以前は「射程に入った瞬間フレーム単位で必ず攻撃する機械」を基準にしていたが、
// それは人間には不可能な動きなので、その相手に勝てるようCPUを強くした結果、
// 実際に人が操作すると「ふつう」でも手も足も出ない設定になってしまった。
// いまは反応が遅く取りこぼしもある2種類のモデル(慣れてない人 / 中級者)で測っている。
//
//   よわい : 慣れてない人が83%勝ち / 中級者は93%勝ち
//   ふつう : 慣れてない人が45%勝ち / 中級者は88%勝ち  ← UIの初期選択なので五分に置く
//   つよい : 慣れてない人が23%勝ち / 中級者は75%勝ち
//
// 調整で分かったこと:
//  ・react(判断間隔)が支配的。人間の反応速度に相当するので、ここで強さがほぼ決まる
//  ・clash は上げすぎると逆に弱くなる。相殺はダメージが0なので、相殺ばかりでは勝てない
//  ・guard と dash はCPUにとって不利な選択肢。ガードは相殺の下位互換(削りを食らう)で、
//    ダッシュは後隙を狩られる。強さだけなら両方0が最善だが、それではCPUが新しい動きを
//    見せないので、あえて割り当てている
//  ・heavy(強攻撃)は後隙20fを持つので、上げすぎると空振りを狩られて弱くなる
export const VS_AI = {
  easy:   { react:20, aggro:0.50, heavy:0.35, clash:0.10, guard:0.25, retreat:0.26, jump:0.04, dash:0.25, recover:0.35 },
  normal: { react:15, aggro:0.58, heavy:0.45, clash:0.20, guard:0.20, retreat:0.22, jump:0.05, dash:0.20, recover:0.55 },
  hard:   { react:11, aggro:0.65, heavy:0.45, clash:0.28, guard:0.15, retreat:0.22, jump:0.05, dash:0.20, recover:0.80 },
};

// --- 攻撃コンボ定義（アクションモード用） ---
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

// --- 攻撃コンボ定義（対戦モード用） ---
// 対戦は人対人の読み合いになるので、敵を倒すだけのアクションモードとは別に持つ。
// 違いは2点だけ:
//
// (1) stun = 相手をのけぞらせるフレーム数。
//     弱は「出始め6f → 判定 → 全体20f」で当たるのは6f目。stun=14 にすると
//     相手は 6+14=20f 目に復帰し、こちらの復帰(20f)とちょうど同じになる。
//     つまり弱を連打しても相手には必ず反撃の機会があり、同時に振れば相殺になる。
//     (stun を長くすると弱連打が繋がり続けて一方的なハメになる)
//     強は 6f/20f/34f と14f間隔で当たるので、stun=20 なら次の一撃まで繋がる。
//
// (2) 強の発生を弱と同じ6fに揃える。
//     7fのままだと、同時に振った時に発生の速い弱が必ず先に当たり、
//     強は一方的に潰されて使い道がなくなる。揃えると相殺になり、
//     「強は当たれば4ダメージ、外せば全体54fの大きな隙」という取引が成立する。
export const VS_LIGHT_COMBO = [
  { pose:'atk_start', wait:6,  adv:4 },
  { pose:'atk1',      wait:14, adv:10, dmg:1, stun:14 },
];
export const VS_HEAVY_COMBO = [
  { pose:'atk_start', wait:6,  adv:4 },
  { pose:'atk1',      wait:14, adv:10, dmg:1, stun:20 },
  { pose:'atk2',      wait:14, adv:12, dmg:1, stun:20 },
  // フィニッシュ。ダメージは他と同じ1で、報酬は「大きく吹っ飛ばしてダウンを取る」こと。
  // recover=20 は判定が消えたあとの後隙。空振りするとここを狩られる＝強攻撃のリスク。
  // (wait を伸ばすだけだと判定持続が延びて逆に強くなるので、判定16f＋後隙20f に分けている)
  { pose:'atk3',      wait:36, adv:16, dmg:1, recover:20 },
];
// 対戦モードのジャンプアッパーの威力。外すと空中で無防備なので、当てた時の見返りを大きく。
export const VS_UPPER_DMG = 2;

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
