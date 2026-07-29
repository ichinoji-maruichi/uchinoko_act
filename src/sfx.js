// ===================== 効果音（WebAudio合成） =====================
// 素材ファイル不要。コードでレトロ風の効果音を生成する。
// AudioContext・ミュートは audio.js で共有(BGMと共通のマスターにぶら下げる)。
import { SFX_VOLUME } from './config.js';
import { actx, masterBus, isMuted } from './audio.js';

// SFX用の音量バス(マスターに接続)。個々の音の vol はこのバスで一括スケールされる。
let _bus=null;
function bus(){
  if(!_bus){ const a=actx(); if(!a) return null; _bus=a.createGain(); _bus.gain.value=SFX_VOLUME; _bus.connect(masterBus()); }
  return _bus;
}

// 単音(オシレータ)。周波数を from→to にスライドさせ、短いエンベロープで鳴らす。
function tone(from, to, dur, type='square', vol=1, delay=0){
  const a=actx(); const b=bus(); if(!a||!b) return; const t=a.currentTime+delay;
  const o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(from,t);
  if(to && to!==from) o.frequency.exponentialRampToValueAtTime(Math.max(1,to), t+dur);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol, t+0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(b); o.start(t); o.stop(t+dur+0.02);
}

// ノイズ(打撃・被弾の質感用)。ローパスで角を丸める。
function noise(dur, vol=0.5, delay=0, cutoff=1400){
  const a=actx(); const b=bus(); if(!a||!b) return; const t=a.currentTime+delay;
  const len=Math.floor(a.sampleRate*dur);
  const buf=a.createBuffer(1,len,a.sampleRate); const d=buf.getChannelData(0);
  for(let i=0;i<len;i++) d[i]=Math.random()*2-1;
  const n=a.createBufferSource(); n.buffer=buf;
  const f=a.createBiquadFilter(); f.type='lowpass'; f.frequency.value=cutoff;
  const g=a.createGain(); g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  n.connect(f); f.connect(g); g.connect(b); n.start(t); n.stop(t+dur+0.02);
}

// ===================== 効果音イベント =====================
// ミュート判定は共有の isMuted() を使う。
export const sfx = {
  // ゲーム開始/リトライ（AudioContextのアンロックも兼ねる）
  start(){ if(isMuted())return; tone(392,784,0.10,'square',0.4); tone(784,1046,0.10,'square',0.35,0.09); },
  // ジャンプ / 2段ジャンプ
  jump(){  if(isMuted())return; tone(320,640,0.12,'square',0.4); },
  jump2(){ if(isMuted())return; tone(440,900,0.12,'square',0.4); },
  // 攻撃の空振り（風切り音）。空振りでも鳴る。弱/強、さらにフィニッシュ(strong)で音色を変える。
  swing(heavy=false, strong=false){ if(isMuted())return;
    if(strong){ // 強3撃目(フィニッシュ): 重く低い大振り
      tone(300,90,0.20,'sawtooth',0.34); tone(150,60,0.22,'square',0.22); noise(0.16,0.30,0,1500);
    } else if(heavy){ tone(560,200,0.12,'triangle',0.22); noise(0.11,0.16,0,2400); }
    else            { tone(820,340,0.08,'triangle',0.18); noise(0.07,0.12,0,3400); }
  },
  // 攻撃ヒット（dmg で重さを変える。強一撃は低音を足して厚く）
  hit(dmg=1){ if(isMuted())return;
    if(dmg>=2){ tone(500,120,0.12,'square',0.5); tone(180,70,0.16,'square',0.3); noise(0.11,0.45,0,900); }
    else      { tone(680,180,0.08,'square',0.4); noise(0.05,0.28,0,1600); }
  },
  // 踏みつけ（倒さず跳ねた時 = brute）。ポンっと押し出しの効くバウンド音。
  stomp(){ if(isMuted())return; tone(150,540,0.14,'square',0.5); noise(0.06,0.32,0,800); },
  // 敵撃破。cause で音を変える: 'stomp'=踏み潰し(ぐしゃっ) / それ以外=斬り(キラン)。
  kill(cause){ if(isMuted())return;
    if(cause==='stomp'){ tone(320,70,0.15,'square',0.5); noise(0.13,0.42,0,700); }
    else { tone(760,300,0.09,'triangle',0.4); tone(1040,520,0.10,'triangle',0.32,0.07); }
  },
  // 回復アイテム取得（上昇アルペジオ C-E-G）
  heal(){ if(isMuted())return; tone(523,523,0.09,'triangle',0.4); tone(659,659,0.09,'triangle',0.4,0.08); tone(784,784,0.12,'triangle',0.4,0.16); },
  // スコア加算（偽物撃破 / 満タン時のハート = コイン風）
  coin(){ if(isMuted())return; tone(988,988,0.06,'square',0.35); tone(1319,1319,0.12,'square',0.35,0.06); },
  // 被弾
  hurt(){ if(isMuted())return; tone(220,70,0.20,'square',0.4); noise(0.18,0.4,0,1000); },
  // ゲームオーバー（下降 A-F-C）
  gameover(){ if(isMuted())return; tone(440,415,0.18,'triangle',0.4); tone(349,330,0.20,'triangle',0.4,0.18); tone(262,247,0.40,'triangle',0.4,0.40); },
};
