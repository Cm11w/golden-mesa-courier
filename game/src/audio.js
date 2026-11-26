// Golden Mesa Courier — synthesised sound, no audio files.
// One job: the engine hum, the ring chime, the warnings and the landing
// fanfare, all made with WebAudio oscillators. Silent until a gesture.

export function buildAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (err) {
      return false;
    }
    // Engine: two detuned saws through a low-pass, gain follows throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 78;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(filter);
    engineOsc2.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise, gain follows airspeed.
    const noiseLength = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, noiseLength, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i += 1) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 700;
    band.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(band);
    band.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    started = true;
    return true;
  }

  function tone(freq, at, dur, type = 'sine', vol = 0.16) {
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(vol, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  }

  return {
    /** Call from a user gesture (or the first frame) to unlock sound. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume();
      return started;
    },
    /** Continuous engine + wind, driven by throttle and speed each frame. */
    update(throttle, speed01) {
      if (!ctx || !started) return;
      const t = ctx.currentTime;
      engineOsc.frequency.setTargetAtTime(46 + throttle * 64, t, 0.1);
      engineOsc2.frequency.setTargetAtTime(69 + throttle * 96, t, 0.1);
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.075, t, 0.1);
      windGain.gain.setTargetAtTime(speed01 * 0.05, t, 0.2);
    },
    ring() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(880, t, 0.35);
      tone(1318, t + 0.09, 0.5);
    },
    leg() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(659, t, 0.25);
      tone(880, t + 0.1, 0.25);
      tone(1174, t + 0.2, 0.5);
    },
    warn() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(440, t, 0.14, 'square', 0.08);
      tone(440, t + 0.2, 0.14, 'square', 0.08);
    },
    land() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(523, t, 0.3);
      tone(659, t + 0.12, 0.3);
      tone(784, t + 0.24, 0.3);
      tone(1046, t + 0.36, 0.7);
    },
    thud() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(70, t, 0.4, 'triangle', 0.3);
    },
  };
}
