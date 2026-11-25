import React, { useEffect, useRef, useState } from 'react';
import {
  Crosshair,
  Pause,
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  ASPECT_DIMENSIONS,
  type CameraState,
  type RecordingClip,
  type StudioConfig,
  type ZoomKeyframe,
} from '../types/studio';
import { canvasPointToVideoNormalized, renderStudioFrame } from '../engine/compositor';
import { playTactileClick } from '../engine/sound';

interface CanvasPreviewProps {
  clip: RecordingClip;
  videoRef: React.RefObject<HTMLVideoElement>;
  webcamRef: React.RefObject<HTMLVideoElement>;
  config: StudioConfig;
  keyframes: ZoomKeyframe[];
  currentTime: number;
  isPlaying: boolean;
  isMuted: boolean;
  clickToZoomMode: boolean;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onToggleMute: () => void;
  onToggleClickToZoom: () => void;
  onCanvasAddZoom: (targetX: number, targetY: number) => void;
}

interface PinFlash {
  xPct: number;
  yPct: number;
  id: number;
}

function formatTimecode(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
  clip,
  videoRef,
  webcamRef,
  config,
  keyframes,
  currentTime,
  isPlaying,
  isMuted,
  clickToZoomMode,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onToggleClickToZoom,
  onCanvasAddZoom,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const backdropImgRef = useRef<HTMLImageElement | null>(null);
  const lastClickedKfRef = useRef<string | null>(null);
  const latestCameraRef = useRef<CameraState>({
    scale: 1,
    focusX: 0.5,
    focusY: 0.5,
    velocity: 0,
    rippleProgress: -1,
    rippleX: 0.5,
    rippleY: 0.5,
    activeKeyframeId: null,
  });

  const [liveScale, setLiveScale] = useState(1);
  const [pinFlash, setPinFlash] = useState<PinFlash | null>(null);

  useEffect(() => {
    if (!config.customBackdropUrl) {
      backdropImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      backdropImgRef.current = img;
    };
    img.src = config.customBackdropUrl;
  }, [config.customBackdropUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const dims = ASPECT_DIMENSIONS[config.aspectRatio];
    const previewScale = Math.min(1, 1280 / Math.max(dims.width, dims.height));
    const renderW = Math.round(dims.width * previewScale);
    const renderH = Math.round(dims.height * previewScale);

    if (canvas.width !== renderW || canvas.height !== renderH) {
      canvas.width = renderW;
      canvas.height = renderH;
    }

    let rafId = 0;
    let lastReportedScale = 1;

    const draw = () => {
      const videoEl = videoRef.current;
      const webcamEl = clip.webcamUrl ? webcamRef.current : null;
      const t = videoEl ? videoEl.currentTime : currentTime;

      const cam = renderStudioFrame(
        ctx,
        renderW,
        renderH,
        videoEl,
        webcamEl,
        t,
        config,
        keyframes,
        backdropImgRef.current
      );
      latestCameraRef.current = cam;

      // Trigger synthesized tactile click sound on live preview playback
      if (
        isPlaying &&
        !isMuted &&
        config.clickSoundEnabled &&
        cam.activeKeyframeId &&
        cam.rippleProgress >= 0 &&
        cam.rippleProgress < 0.22
      ) {
        if (lastClickedKfRef.current !== cam.activeKeyframeId) {
          lastClickedKfRef.current = cam.activeKeyframeId;
          playTactileClick();
        }
      } else if (!cam.activeKeyframeId) {
        lastClickedKfRef.current = null;
      }

      if (Math.abs(cam.scale - lastReportedScale) > 0.02) {
        lastReportedScale = cam.scale;
        setLiveScale(cam.scale);
      }

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, [clip.webcamUrl, config, keyframes, videoRef, webcamRef, currentTime, isPlaying, isMuted]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!clickToZoomMode) {
      onTogglePlay();
      return;
    }

    const canvas = canvasRef.current;
    const videoEl = videoRef.current;
    if (!canvas || !videoEl) return;

    const rect = canvas.getBoundingClientRect();
    const norm = canvasPointToVideoNormalized(
      e.clientX,
      e.clientY,
      rect,
      canvas.width,
      canvas.height,
      videoEl.videoWidth || clip.width,
      videoEl.videoHeight || clip.height,
      config,
      latestCameraRef.current
    );

    if (!norm) return;

    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const flashId = Date.now();
    setPinFlash({ xPct, yPct, id: flashId });
    window.setTimeout(() => {
      setPinFlash((prev) => (prev?.id === flashId ? null : prev));
    }, 800);

    if (config.clickSoundEnabled && !isMuted) {
      playTactileClick();
    }

    onCanvasAddZoom(norm.x, norm.y);
  };

  const dims = ASPECT_DIMENSIONS[config.aspectRatio];
  const aspectStyle = `${dims.width} / ${dims.height}`;

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#0A0B0E] relative overflow-hidden">
      {/* Subtle Top Viewport Status Strip */}
      <div className="h-9 px-4 flex items-center justify-between text-[11px] text-zinc-400 border-b border-[#181B24] shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-500">
            {dims.width}×{dims.height} · 60fps
          </span>
          <span
            className={`px-1.5 py-0.5 rounded font-mono text-[10px] border ${
              liveScale > 1.03
                ? 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40'
                : 'bg-[#13151B] text-zinc-400 border-[#222631]'
            }`}
          >
            {liveScale.toFixed(2)}x
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleClickToZoom}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-medium transition-colors ${
            clickToZoomMode
              ? 'bg-[#F59E0B]/15 border-[#F59E0B]/50 text-[#F59E0B]'
              : 'bg-[#13151B] border-[#222631] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span>
            {clickToZoomMode
              ? 'Click anywhere on video to add Zoom'
              : 'Click-to-Zoom Paused'}
          </span>
        </button>
      </div>

      {/* Centered 60fps Studio Canvas */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-5 overflow-hidden">
        <div
          className="relative max-w-full max-h-full flex items-center justify-center"
          style={{ aspectRatio: aspectStyle, height: '100%' }}
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`max-w-full max-h-full rounded-xl border border-[#222631] shadow-[0_20px_60px_rgba(0,0,0,0.65)] ${
              clickToZoomMode ? 'cursor-crosshair' : 'cursor-pointer'
            }`}
          />

          {/* Target Pin Flash Feedback */}
          {pinFlash && (
            <div
              key={pinFlash.id}
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${pinFlash.xPct}%`, top: `${pinFlash.yPct}%` }}
            >
              <div className="w-10 h-10 rounded-full border-2 border-[#F59E0B] bg-[#F59E0B]/20 animate-ping" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] shadow-[0_0_10px_#F59E0B]" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Transport Controls Bar */}
      <div className="h-12 shrink-0 px-4 bg-[#101218] border-t border-[#222631] flex items-center justify-between gap-4 select-none">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSeek(config.trimStart)}
            className="w-8 h-8 rounded-lg bg-[#191C24] hover:bg-[#222631] border border-[#262B38] text-zinc-300 flex items-center justify-center transition-colors"
            title="Jump to Trim In"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={onTogglePlay}
            className="h-8 px-3.5 rounded-lg bg-[#38BDF8] hover:bg-[#0EA5E9] text-[#05131C] text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-3.5 h-3.5 fill-current" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onToggleMute}
            className="w-8 h-8 rounded-lg bg-[#191C24] hover:bg-[#222631] border border-[#262B38] text-zinc-300 flex items-center justify-center transition-colors"
            title={isMuted ? 'Unmute preview audio' : 'Mute preview audio'}
          >
            {isMuted ? (
              <VolumeX className="w-3.5 h-3.5 text-zinc-500" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-zinc-200" />
            )}
          </button>
        </div>

        {/* Live Timecode */}
        <div className="font-mono text-xs flex items-center gap-1.5 bg-[#0A0B0E] px-3 py-1 rounded-lg border border-[#222631]">
          <span className="text-[#38BDF8] font-semibold">
            {formatTimecode(currentTime)}
          </span>
          <span className="text-zinc-600">/</span>
          <span className="text-zinc-400">{formatTimecode(clip.duration)}</span>
        </div>

        {/* Pro NLE Keyboard Shortcut Legend */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono">
          <kbd className="px-1.5 py-0.5 rounded bg-[#191C24] border border-[#2A303E] text-zinc-300">
            J/K/L
          </kbd>
          <span>Shuttle</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#191C24] border border-[#2A303E] text-zinc-300 ml-1">
            I/O
          </kbd>
          <span>Trim</span>
          <kbd className="px-1.5 py-0.5 rounded bg-[#191C24] border border-[#2A303E] text-zinc-300 ml-1">
            Z
          </kbd>
          <span>Zoom</span>
        </div>
      </div>
    </div>
  );
};
