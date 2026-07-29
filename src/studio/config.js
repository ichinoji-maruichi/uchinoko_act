// ===================== スプライトスタジオ固有の定数 =====================
// POSES / COLS / ROWS はゲームの config.js を共有する(../config.js)。

// ポーズの日本語ラベル
export const LABEL_JP = {
  idle:"待機", walk_start:"歩き始め", walk1:"歩き1", walk2:"歩き2", crouch:"しゃがみ/着地",
  atk_start:"攻撃開始", atk1:"攻撃1(左パンチ)", atk2:"攻撃2(右パンチ)", atk3:"攻撃3(左キック)",
  jump_upper:"ジャンプアッパー",
  jump_up:"ジャンプ上り", jump_down:"ジャンプ下り", damage:"ダメージ",
  knockback:"吹っ飛び", down:"ダウン"
};

// アンカー種別: ジャンプ系は重心基準、それ以外は足元基準
export const CENTROID_ANCHOR = new Set(["jump_up","jump_down"]);

// アニメクリップ定義(ポーズ名の並び・ループ可否)
export const CLIPS = {
  "待機":      {seq:["idle"], loop:true, hold:1},
  "歩く":      {seq:["walk_start","walk1","walk2","walk1"], loop:true},
  "弱攻撃":    {seq:["atk_start","atk1","idle"], loop:false},
  "強攻撃":    {seq:["atk_start","atk1","atk2","atk3","idle"], loop:false},
  "ジャンプ":  {seq:["crouch","jump_up","jump_down","crouch","idle"], loop:false},
  "ジャンプアッパー": {seq:["crouch","jump_upper","jump_down","crouch","idle"], loop:false},
  "しゃがみ":  {seq:["crouch"], loop:true, hold:1},
  "ダメージ":  {seq:["damage","idle"], loop:false},
  "やられ":    {seq:["damage","knockback","down"], loop:false, tail:true},
};

// お試しマネキン(ゲームの既定キャラ)
export const TEMPLATE_SRC = 'assets/player_default.png';
// ダウンロードできるテンプレート2種
//  A: 通常版 / B: 揺れ物・装飾が多いキャラ向けの拡張版(コマ内の余白が広い)
export const TEMPLATE_A_SRC = 'assets/sprite-template-a.png';
export const TEMPLATE_B_SRC = 'assets/sprite-template-b.png';

// 生成プロンプト(GeminiやChatGPT等に貼り付けて使う)
export const GEN_PROMPT = `添付の1枚目はキャラクターイラスト、2枚目はスプライト表のテンプレートです。
2枚目のマネキンとまったく同じ配置・同じポーズ・同じ頭の向き・同じ緑背景(RGB 0,255,34)・同じ頭身で、1枚目のキャラクターをデフォルメしたピクセルアートのスプライト表を作ってください。

厳守事項:
-5列×3行のグリッド。各コマの位置・大きさはテンプレートと完全に一致させる
-各コマのキャラの位置、ポーズはテンプレートのマネキンに正確に従う
-各コマのポーズは以下（左から）
 -1段目:待機/横向き/歩き1（画面手前の足を画面右に出す。頭の角度は「横向き」と合わせる）/歩き2左足前（歩き1の次の1歩。歩き1とは逆の足。画面手前の足を画面左に出す。頭の角度は「横向き」と合わせる）/しゃがみ
 -2段目:攻撃構え/攻撃1左腕パンチ（画面奥の腕を画面右に出す。胸を見せる）/攻撃2右腕パンチ（攻撃1とは逆の腕。画面の手前を画面右に出す。背中を見せる）/攻撃3左ハイキック（画面奥の足でキック。胸を見せる）/右ジャンプアッパー（少し宙に浮きつつ画面手前の右腕を画面右斜め上へ突き上げるアッパー。頭は横向き）
 -3段目:ジャンプ上り/ジャンプ下り/ダメージ/吹っ飛び/ダウン（倒れ。処理の都合上、コマの上寄りに描く）
-背景は隙間なく純緑(0,255,34)で塗りつぶす。中間色を作らない。影やグラデ背景は入れない
-キャラの髪・服・色は1枚目に忠実に。全コマで同一人物を保つ。手に小物を持っている場合は無くして良い
-メガネや帽子、ヒゲ等の頭部の小物もデザインに含める。ダメージ、吹っ飛び、ダウンでもメガネや帽子、ヒゲは外さない
-揺れ物（長い髪、マフラー、尻尾などの長い物）はポーズに見合った動きをつける。ただし、コマの枠内に納めること
-キャラはコマの枠内に完全に収める。隣のコマにはみ出さない
-キャラの体・髪・装飾がコマの境界線に接触・重ならないよう、上下左右に少し余白を空けて配置すること
-背景とキャラの境界はハードエッジでキャラの輪郭線には背景色とのアンチエイリアスをかけない
ピクセルアート、ドット絵、hard edges, no anti-aliasing, indexed color look`;
