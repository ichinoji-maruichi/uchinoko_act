// ===================== オーディオ基盤（共有） =====================
// AudioContext とマスター音量・ミュートを一元管理。sfx.js と bgm.js が共有する。
// ユーザー操作(キー入力)を起点に遅延生成し、自動再生ブロックを回避する。

let ac=null, _master=null, muted=false;

function ensure(){
  if(!ac){
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC) return null;
    ac=new AC();
    _master=ac.createGain();
    _master.gain.value = muted ? 0 : 1;
    _master.connect(ac.destination);
  }
  if(ac.state==='suspended') ac.resume();
  return ac;
}

// AudioContext(必要時に生成)。使えない環境では null。
export function actx(){ return ensure(); }

// マスターgain(ミュート制御用)。各バスはここに接続する。
export function masterBus(){ ensure(); return _master; }

export function isMuted(){ return muted; }

// BGM・SFX まとめてミュート切替(短いフェードでクリック音を防ぐ)
export function toggleMute(){
  muted=!muted;
  if(_master && ac){
    const t=ac.currentTime;
    _master.gain.cancelScheduledValues(t);
    _master.gain.setValueAtTime(_master.gain.value, t);
    _master.gain.linearRampToValueAtTime(muted?0:1, t+0.05);
  }
  return muted;
}
