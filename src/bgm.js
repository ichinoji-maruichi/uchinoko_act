// ===================== BGM（WebAudio合成チップチューン） =====================
// 素材ファイル不要。明るいレトロ調のループを生成する。
// I–V–vi–IV(C–G–Am–F) 進行の上に、リード(square)＋ベース(triangle)を鳴らす。
// ミュートは audio.js の共有マスターで制御(Mキー)。
import { BGM_VOLUME, BGM_TEMPO } from './config.js';
import { actx, masterBus, isMuted } from './audio.js';

// 音名→周波数(Hz)
const N = {
  A2:110.00, F2:87.31, G2:98.00,
  C3:130.81, D3:146.83, E3:164.81, F3:174.61, G3:196.00,
  C4:261.63, D4:293.66, E4:329.63, F4:349.23, G4:392.00, A4:440.00, B4:493.88,
  C5:523.25, D5:587.33, E5:659.25, F5:698.46, G5:783.99, A5:880.00,
};

// リード: 1小節=8分音符8個(16ステップ)。null=休符。
const leadBar = a => { const o=[]; for(const n of a){ o.push(n, null); } return o; };
const LEAD = [
  ...leadBar(['G4','C5','E5','C5','G4','C5','E5','G5']), // C
  ...leadBar(['G4','B4','D5','B4','G4','B4','D5','G5']), // G
  ...leadBar(['A4','C5','E5','C5','A4','C5','E5','A5']), // Am
  ...leadBar(['F4','A4','C5','A4','F4','A4','C5','E5']), // F
];
// ベース: 1小節=4分音符4個(16ステップ)。ルート↔5度で刻む。
const bassBar = a => { const o=[]; for(const n of a){ o.push(n, null, null, null); } return o; };
const BASS = [
  ...bassBar(['C3','G3','C3','G3']),
  ...bassBar(['G2','D3','G2','D3']),
  ...bassBar(['A2','E3','A2','E3']),
  ...bassBar(['F2','C3','F2','C3']),
];
const STEPS = LEAD.length;   // 64 (4小節×16)

// BGM用の音量バス
let _bus=null;
function bus(){
  if(!_bus){ const a=actx(); if(!a) return null; _bus=a.createGain(); _bus.gain.value=BGM_VOLUME; _bus.connect(masterBus()); }
  return _bus;
}
function note(freq, t, dur, type, vol){
  const a=actx(), b=bus(); if(!a||!b||!freq) return;
  const o=a.createOscillator(), g=a.createGain();
  o.type=type; o.frequency.setValueAtTime(freq,t);
  g.gain.setValueAtTime(0.0001,t);
  g.gain.exponentialRampToValueAtTime(vol, t+0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t+dur);
  o.connect(g); g.connect(b); o.start(t); o.stop(t+dur+0.02);
}

// --- スケジューラ(先読みでノートを予約。setInterval で駆動) ---
let playing=false, step=0, nextTime=0, timer=null;
const LOOKAHEAD=0.12, TICK=25;   // 120ms先まで、25ms間隔で予約
function stepDur(){ return 60/BGM_TEMPO/4; }   // 16分音符の長さ(秒)

function scheduler(){
  const a=actx(); if(!a) return;
  while(nextTime < a.currentTime + LOOKAHEAD){
    if(!isMuted()){
      const d=stepDur();
      note(N[LEAD[step]], nextTime, d*1.7, 'square',   0.55);   // リード
      note(N[BASS[step]], nextTime, d*3.4, 'triangle', 0.9);    // ベース
    }
    nextTime += stepDur();
    step = (step+1) % STEPS;
  }
}

export const bgm = {
  start(){
    const a=actx(); if(!a) return;
    if(playing){ step=0; return; }   // 再生中なら頭出しのみ
    playing=true; step=0; nextTime=a.currentTime+0.1;
    timer=setInterval(scheduler, TICK);
  },
  stop(){
    playing=false;
    if(timer){ clearInterval(timer); timer=null; }
  },
  isPlaying(){ return playing; },
};
