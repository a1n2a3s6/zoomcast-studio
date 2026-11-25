/**
 * Decodes an audio/video Blob URL via the Web Audio API (`decodeAudioData`)
 * and downsamples it into normalized RMS/peak amplitude bars (0.06..1.0)
 * for crisp real-time rendering on the NLE timeline track.
 */
export async function extractAudioWaveform(
  mediaUrl: string,
  barCount = 160
): Promise<number[]> {
  let audioCtx: AudioContext | null = null;
  try {
    const response = await fetch(mediaUrl);
    if (!response.ok) return [];
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength === 0) return [];

    audioCtx = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    if (channelData.length === 0) return [];

    const samplesPerBar = Math.max(1, Math.floor(channelData.length / barCount));
    const rawPeaks: number[] = new Array(barCount).fill(0);
    let maxPeak = 0.0001;

    for (let i = 0; i < barCount; i++) {
      const start = i * samplesPerBar;
      const end = Math.min(channelData.length, start + samplesPerBar);
      let sumSquares = 0;
      let localMax = 0;

      // Stride for fast decoding on long recordings
      const stride = Math.max(1, Math.floor((end - start) / 128));
      let count = 0;
      for (let j = start; j < end; j += stride) {
        const sample = Math.abs(channelData[j]);
        sumSquares += sample * sample;
        if (sample > localMax) localMax = sample;
        count++;
      }

      const rms = count > 0 ? Math.sqrt(sumSquares / count) : 0;
      // Blend RMS and peak for a natural speech + transient waveform shape
      const val = rms * 0.65 + localMax * 0.35;
      rawPeaks[i] = val;
      if (val > maxPeak) maxPeak = val;
    }

    return rawPeaks.map((v) => Math.max(0.06, Math.min(1, v / maxPeak)));
  } catch {
    // Clips without an audio stream gracefully return an empty waveform
    return [];
  } finally {
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => undefined);
    }
  }
}
