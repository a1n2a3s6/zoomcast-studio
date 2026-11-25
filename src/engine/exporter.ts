import {
  ASPECT_DIMENSIONS,
  EXPORT_PRESETS,
  type ExportProgress,
  type RecordingClip,
  type StudioConfig,
  type ZoomKeyframe,
} from '../types/studio';
import { renderStudioFrame } from './compositor';
import { LocalGifEncoder } from './gifEncoder';
import { playTactileClick } from './sound';

function selectBestExportCodec(): { mimeType: string; extension: 'mp4' | 'webm' } {
  const candidates: Array<{ mimeType: string; extension: 'mp4' | 'webm' }> = [
    { mimeType: 'video/mp4;codecs=avc1.42E01E,mp4a.40.2', extension: 'mp4' },
    { mimeType: 'video/mp4', extension: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp9', extension: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', extension: 'webm' },
    { mimeType: 'video/webm', extension: 'webm' },
  ];

  for (const item of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(item.mimeType)) {
      return item;
    }
  }
  return { mimeType: 'video/webm', extension: 'webm' };
}

function loadVideoElement(url: string, muted: boolean): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.src = url;
    video.muted = muted;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';

    video.onloadeddata = () => resolve(video);
    video.onerror = () => reject(new Error('Failed to load clip for export.'));
    video.load();
  });
}

function loadImageElement(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function seekVideo(video: HTMLVideoElement, timeSec: number): Promise<void> {
  return new Promise((resolve) => {
    const target = Math.max(0, timeSec);
    if (Math.abs(video.currentTime - target) < 0.015) {
      resolve();
      return;
    }
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      resolve();
    };
    video.addEventListener('seeked', onSeeked);
    video.currentTime = target;
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ExportOptions {
  clip: RecordingClip;
  config: StudioConfig;
  keyframes: ZoomKeyframe[];
  onProgress: (status: ExportProgress) => void;
  signal?: AbortSignal;
}

/**
 * Hardware-accelerated local export engine supporting:
 * - 4K UHD 60fps, 1080p Pro 60fps, 9:16 Reels 60fps (configurable 8–20 Mbps bitrate)
 * - 1-Click GitHub README Loop GIF89a export
 * - Live FPS & Frame-Drop telemetry monitor
 * - Synced tactile Web Audio click sound synthesis on zoom keyframes
 */
export async function exportStudioVideo({
  clip,
  config,
  keyframes,
  onProgress,
  signal,
}: ExportOptions): Promise<void> {
  const preset = EXPORT_PRESETS[config.exportPreset];
  const effectiveAspect = preset.overrideAspect ?? config.aspectRatio;
  const baseDims = ASPECT_DIMENSIONS[effectiveAspect];
  const width = Math.round(baseDims.width * preset.scaleFactor);
  const height = Math.round(baseDims.height * preset.scaleFactor);
  const effectiveConfig: StudioConfig = { ...config, aspectRatio: effectiveAspect };

  const trimStart = Math.max(0, Math.min(config.trimStart, clip.duration - 0.1));
  const trimEnd = Math.max(trimStart + 0.1, Math.min(config.trimEnd, clip.duration));
  const totalTrimDuration = Math.max(0.1, trimEnd - trimStart);

  // Branch 1: 1-Click Animated GIF89a Export for GitHub READMEs
  if (preset.format === 'gif') {
    onProgress({
      active: true,
      progress: 0,
      phase: 'preparing',
      mimeType: 'image/gif',
      message: `Preparing ${width}×${height} GitHub Loop GIF...`,
      currentFps: preset.fps,
      droppedFrames: 0,
      renderedFrames: 0,
    });

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2D canvas unavailable for GIF export.');

    const videoEl = await loadVideoElement(clip.url, true);
    const webcamEl = clip.webcamUrl ? await loadVideoElement(clip.webcamUrl, true) : null;
    const customBackdropImg = config.customBackdropUrl
      ? await loadImageElement(config.customBackdropUrl)
      : null;

    const encoder = new LocalGifEncoder(width, height, preset.fps);
    const stepSec = config.playbackSpeed / preset.fps;
    const totalSteps = Math.max(1, Math.min(180, Math.ceil(totalTrimDuration / stepSec)));
    const startWall = performance.now();

    try {
      for (let i = 0; i < totalSteps; i++) {
        if (signal?.aborted) throw new Error('Export cancelled.');
        const t = Math.min(trimEnd, trimStart + i * stepSec);
        await seekVideo(videoEl, t);
        if (webcamEl) await seekVideo(webcamEl, t);

        renderStudioFrame(
          ctx,
          width,
          height,
          videoEl,
          webcamEl,
          t,
          effectiveConfig,
          keyframes,
          customBackdropImg
        );

        const frameData = ctx.getImageData(0, 0, width, height);
        encoder.addFrame(frameData);

        const elapsedSec = Math.max(0.05, (performance.now() - startWall) / 1000);
        const pct = Math.min(98, Math.round(((i + 1) / totalSteps) * 98));
        onProgress({
          active: true,
          progress: pct,
          phase: 'rendering',
          mimeType: 'image/gif',
          message: `Encoding GitHub Loop GIF (${i + 1}/${totalSteps} frames)`,
          currentFps: Math.round((i + 1) / elapsedSec),
          droppedFrames: 0,
          renderedFrames: i + 1,
        });
      }

      const gifBlob = encoder.finish();
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      triggerBrowserDownload(gifBlob, `zoomcast-loop-${width}x${height}-${stamp}.gif`);

      onProgress({
        active: false,
        progress: 100,
        phase: 'done',
        mimeType: 'image/gif',
        message: `Exported ${width}×${height} GitHub Loop GIF`,
        currentFps: preset.fps,
        droppedFrames: 0,
        renderedFrames: totalSteps,
      });
    } finally {
      videoEl.src = '';
      if (webcamEl) webcamEl.src = '';
    }
    return;
  }

  // Branch 2: Hardware-Accelerated 60fps MP4 / WebM Export with Bitrate & FPS Telemetry
  const { mimeType, extension } = selectBestExportCodec();
  const targetBitrateBps = Math.round(Math.max(8, Math.min(20, config.exportBitrateMbps)) * 1_000_000);

  onProgress({
    active: true,
    progress: 0,
    phase: 'preparing',
    mimeType,
    message: `Preparing ${preset.label} (${width}×${height} @ ${config.exportBitrateMbps} Mbps)...`,
    currentFps: 60,
    droppedFrames: 0,
    renderedFrames: 0,
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) {
    throw new Error('Could not initialize 2D export canvas.');
  }

  const videoEl = await loadVideoElement(clip.url, false);
  const webcamEl = clip.webcamUrl ? await loadVideoElement(clip.webcamUrl, true) : null;
  const customBackdropImg = config.customBackdropUrl
    ? await loadImageElement(config.customBackdropUrl)
    : null;

  await seekVideo(videoEl, trimStart);
  if (webcamEl) {
    await seekVideo(webcamEl, trimStart);
  }

  videoEl.playbackRate = config.playbackSpeed;
  if (webcamEl) {
    webcamEl.playbackRate = config.playbackSpeed;
  }

  const canvasStream = canvas.captureStream(preset.fps);
  const outputTracks: MediaStreamTrack[] = [...canvasStream.getVideoTracks()];

  let audioCtx: AudioContext | null = null;
  let audioDest: MediaStreamAudioDestinationNode | null = null;

  if (clip.hasAudio || config.clickSoundEnabled) {
    try {
      audioCtx = new AudioContext();
      audioDest = audioCtx.createMediaStreamDestination();
      if (clip.hasAudio) {
        const sourceNode = audioCtx.createMediaElementSource(videoEl);
        sourceNode.connect(audioDest);
      } else {
        videoEl.muted = true;
      }
      audioDest.stream.getAudioTracks().forEach((track) => outputTracks.push(track));
    } catch {
      videoEl.muted = true;
      audioCtx = null;
      audioDest = null;
    }
  } else {
    videoEl.muted = true;
  }

  const combinedStream = new MediaStream(outputTracks);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: targetBitrateBps,
  });

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  let rafId = 0;
  let cleanedUp = false;
  let renderedFrames = 0;
  let droppedFrames = 0;
  let lastFrameWall = 0;
  let startWall = 0;
  const triggeredClicks = new Set<string>();

  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (rafId) cancelAnimationFrame(rafId);
    videoEl.pause();
    videoEl.src = '';
    if (webcamEl) {
      webcamEl.pause();
      webcamEl.src = '';
    }
    combinedStream.getTracks().forEach((t) => t.stop());
    if (audioCtx && audioCtx.state !== 'closed') {
      audioCtx.close().catch(() => undefined);
    }
  };

  return new Promise<void>((resolve, reject) => {
    const finishRecording = () => {
      if (recorder.state === 'inactive') return;
      onProgress({
        active: true,
        progress: 98,
        phase: 'finalizing',
        mimeType,
        message: 'Finalizing zero-watermark master...',
        currentFps: preset.fps,
        droppedFrames,
        renderedFrames,
      });
      recorder.stop();
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new Error('Export cancelled.'));
      });
    }

    recorder.onstop = () => {
      try {
        if (signal?.aborted) return;
        const blob = new Blob(chunks, { type: mimeType });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const ratioSlug = effectiveAspect.replace(':', 'x');
        triggerBrowserDownload(
          blob,
          `zoomcast-${preset.id}-${ratioSlug}-${stamp}.${extension}`
        );

        onProgress({
          active: false,
          progress: 100,
          phase: 'done',
          mimeType,
          message: `Exported ${preset.label} (.${extension})`,
          currentFps: preset.fps,
          droppedFrames,
          renderedFrames,
        });
        cleanup();
        resolve();
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    recorder.onerror = () => {
      cleanup();
      reject(new Error('MediaRecorder encountered an error during export.'));
    };

    renderStudioFrame(
      ctx,
      width,
      height,
      videoEl,
      webcamEl,
      trimStart,
      effectiveConfig,
      keyframes,
      customBackdropImg
    );

    recorder.start(200);
    startWall = performance.now();
    lastFrameWall = startWall;

    const expectedFrameMs = 1000 / preset.fps;

    const renderLoop = (now: number) => {
      if (signal?.aborted) return;

      const deltaMs = now - lastFrameWall;
      if (renderedFrames > 2 && deltaMs > expectedFrameMs * 1.65) {
        droppedFrames += Math.max(1, Math.round(deltaMs / expectedFrameMs) - 1);
      }
      lastFrameWall = now;
      renderedFrames++;

      const t = videoEl.currentTime;
      const cam = renderStudioFrame(
        ctx,
        width,
        height,
        videoEl,
        webcamEl,
        t,
        effectiveConfig,
        keyframes,
        customBackdropImg
      );

      // Inject synced tactile click sound when entering a zoom keyframe
      if (
        config.clickSoundEnabled &&
        audioCtx &&
        audioDest &&
        cam.activeKeyframeId &&
        cam.rippleProgress >= 0 &&
        cam.rippleProgress < 0.25 &&
        !triggeredClicks.has(cam.activeKeyframeId)
      ) {
        triggeredClicks.add(cam.activeKeyframeId);
        playTactileClick(audioCtx, audioDest, 0.28);
      }

      const elapsedSec = Math.max(0.05, (now - startWall) / 1000);
      const currentFps = Math.min(preset.fps, Math.round(renderedFrames / elapsedSec));
      const pct = Math.min(97, Math.max(0, ((t - trimStart) / totalTrimDuration) * 97));

      onProgress({
        active: true,
        progress: Math.round(pct),
        phase: 'rendering',
        mimeType,
        message: `${preset.label} · ${width}×${height} @ ${config.exportBitrateMbps} Mbps`,
        currentFps,
        droppedFrames,
        renderedFrames,
      });

      if (t >= trimEnd - 0.03 || videoEl.ended) {
        videoEl.pause();
        webcamEl?.pause();
        finishRecording();
        return;
      }

      rafId = requestAnimationFrame(renderLoop);
    };

    videoEl.onended = () => {
      finishRecording();
    };

    Promise.all([
      videoEl.play(),
      webcamEl ? webcamEl.play().catch(() => undefined) : Promise.resolve(),
    ])
      .then(() => {
        rafId = requestAnimationFrame(renderLoop);
      })
      .catch((err) => {
        cleanup();
        reject(err);
      });
  });
}
