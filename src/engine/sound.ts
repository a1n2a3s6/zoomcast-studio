let sharedPreviewAudioCtx: AudioContext | null = null;

function getPreviewAudioContext(): AudioContext | null {
  if (typeof window === 'undefined' || typeof AudioContext === 'undefined') {
    return null;
  }
  if (!sharedPreviewAudioCtx || sharedPreviewAudioCtx.state === 'closed') {
    sharedPreviewAudioCtx = new AudioContext();
  }
  if (sharedPreviewAudioCtx.state === 'suspended') {
    sharedPreviewAudioCtx.resume().catch(() => undefined);
  }
  return sharedPreviewAudioCtx;
}

/**
 * Synthesizes a subtle, crisp tactile UI click sound purely via Web Audio API
 * (short bandpass-filtered impulse + 1.8kHz → 440Hz micro-transient).
 * Can route to either the live speakers or an export `MediaStreamAudioDestinationNode`.
 */
export function playTactileClick(
  externalCtx?: AudioContext | null,
  destination?: AudioNode | null,
  volume = 0.22
): void {
  const ctx = externalCtx ?? getPreviewAudioContext();
  if (!ctx) return;

  const target = destination ?? ctx.destination;
  const now = ctx.currentTime;

  // 1. Crisp pitch-dropped sine body (tactile mechanical switch pop)
  const osc = ctx.createOscillator();
  const oscGain = ctx.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(1750, now);
  osc.frequency.exponentialRampToValueAtTime(380, now + 0.024);

  oscGain.gain.setValueAtTime(0.0001, now);
  oscGain.gain.linearRampToValueAtTime(volume, now + 0.002);
  oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.028);

  osc.connect(oscGain);
  oscGain.connect(target);
  osc.start(now);
  osc.stop(now + 0.032);

  // 2. Micro high-frequency transient tick
  const bufferSize = Math.max(64, Math.floor(ctx.sampleRate * 0.012));
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    const decay = 1 - i / bufferSize;
    data[i] = (Math.random() * 2 - 1) * decay * decay;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(3200, now);
  filter.Q.setValueAtTime(2.2, now);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(volume * 0.45, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);

  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(target);
  noise.start(now);
  noise.stop(now + 0.014);
}
