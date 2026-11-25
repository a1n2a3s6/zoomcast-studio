import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, CheckCircle2, Radio } from 'lucide-react';
import {
  DEFAULT_STUDIO_CONFIG,
  type AspectRatio,
  type CaptureOptions,
  type ExportPresetId,
  type ExportProgress,
  type PlaybackSpeed,
  type RecordingClip,
  type StudioConfig,
  type ZoomKeyframe,
} from './types/studio';
import { startScreenRecording, type ActiveRecordingSession } from './engine/recorder';
import { exportStudioVideo } from './engine/exporter';
import { generateSampleDemoClip } from './engine/demoGenerator';
import { extractAudioWaveform } from './engine/waveform';
import { clamp } from './engine/easing';
import { TopBar } from './components/TopBar';
import { CaptureBar } from './components/CaptureBar';
import { CanvasPreview } from './components/CanvasPreview';
import { TimelineEditor } from './components/TimelineEditor';
import { StyleInspector } from './components/StyleInspector';

const INITIAL_EXPORT_STATE: ExportProgress = {
  active: false,
  progress: 0,
  phase: 'done',
  mimeType: '',
  message: '',
  currentFps: 60,
  droppedFrames: 0,
  renderedFrames: 0,
};

const SHUTTLE_SPEEDS: PlaybackSpeed[] = [1, 1.25, 1.5, 2];

export default function App(): React.ReactElement {
  const [clip, setClip] = useState<RecordingClip | null>(null);
  const [waveformBars, setWaveformBars] = useState<number[]>([]);
  const [config, setConfig] = useState<StudioConfig>(DEFAULT_STUDIO_CONFIG);
  const [keyframes, setKeyframes] = useState<ZoomKeyframe[]>([]);
  const [selectedKeyframeId, setSelectedKeyframeId] = useState<string | null>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [clickToZoomMode, setClickToZoomMode] = useState(true);
  const [inspectorOpen, setInspectorOpen] = useState(true);

  const [captureOptions, setCaptureOptions] = useState<CaptureOptions>({
    includeMic: true,
    includeWebcam: false,
  });
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [demoProgress, setDemoProgress] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [exportState, setExportState] = useState<ExportProgress>(INITIAL_EXPORT_STATE);

  const videoRef = useRef<HTMLVideoElement>(null);
  const webcamRef = useRef<HTMLVideoElement>(null);
  const recordingSessionRef = useRef<ActiveRecordingSession | null>(null);
  const exportAbortRef = useRef<AbortController | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const loadNewClip = useCallback(
    (nextClip: RecordingClip, initialKeyframes: ZoomKeyframe[] = []) => {
      setClip((prev) => {
        if (prev?.url) URL.revokeObjectURL(prev.url);
        if (prev?.webcamUrl) URL.revokeObjectURL(prev.webcamUrl);
        return nextClip;
      });
      setWaveformBars([]);
      setConfig((prev) => ({
        ...prev,
        trimStart: 0,
        trimEnd: Number(nextClip.duration.toFixed(2)),
      }));
      setKeyframes(initialKeyframes);
      setSelectedKeyframeId(initialKeyframes[0]?.id ?? null);
      setCurrentTime(0);
      setIsPlaying(false);
      setShowCaptureModal(false);
      setErrorMessage(null);

      // Decode live audio waveform asynchronously via Web Audio API
      if (nextClip.hasAudio) {
        extractAudioWaveform(nextClip.url, 160).then((bars) => {
          setWaveformBars(bars);
        });
      }
    },
    []
  );

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return;
    }
    const id = window.setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [isRecording]);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.playbackRate = config.playbackSpeed;
      video.muted = isMuted;
    }
    const cam = webcamRef.current;
    if (cam) {
      cam.playbackRate = config.playbackSpeed;
      cam.muted = true;
    }
  }, [config.playbackSpeed, isMuted, clip]);

  useEffect(() => {
    if (!isPlaying || !clip) return;
    let rafId = 0;

    const tick = () => {
      const video = videoRef.current;
      if (video) {
        const t = video.currentTime;
        if (t >= config.trimEnd - 0.02 || video.ended) {
          video.currentTime = config.trimStart;
          if (webcamRef.current) webcamRef.current.currentTime = config.trimStart;
          setCurrentTime(config.trimStart);
        } else {
          setCurrentTime(t);
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isPlaying, clip, config.trimStart, config.trimEnd]);

  const handleSeek = useCallback((time: number) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = time;
    }
    if (webcamRef.current) {
      webcamRef.current.currentTime = time;
    }
    setCurrentTime(time);
  }, []);

  const handlePause = useCallback(() => {
    videoRef.current?.pause();
    webcamRef.current?.pause();
    setIsPlaying(false);
  }, []);

  const handlePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !clip) return;
    if (video.currentTime < config.trimStart || video.currentTime >= config.trimEnd - 0.05) {
      video.currentTime = config.trimStart;
      if (webcamRef.current) webcamRef.current.currentTime = config.trimStart;
    }
    video.play().catch(() => undefined);
    webcamRef.current?.play().catch(() => undefined);
    setIsPlaying(true);
  }, [clip, config.trimStart, config.trimEnd]);

  const handleTogglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || !clip) return;
    if (video.paused) {
      handlePlay();
    } else {
      handlePause();
    }
  }, [clip, handlePlay, handlePause]);

  const handleAddZoom = useCallback(
    (targetX: number, targetY: number) => {
      if (!clip) return;
      const startTime = Number(Math.max(0, Math.min(currentTime, clip.duration - 0.5)).toFixed(2));
      const duration = Number(Math.min(2.0, Math.max(0.6, clip.duration - startTime)).toFixed(2));
      const newKf: ZoomKeyframe = {
        id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        startTime,
        duration,
        scale: 2.0,
        targetX: Number(targetX.toFixed(3)),
        targetY: Number(targetY.toFixed(3)),
        ripple: true,
      };
      setKeyframes((prev) => [...prev, newKf].sort((a, b) => a.startTime - b.startTime));
      setSelectedKeyframeId(newKf.id);
    },
    [clip, currentTime]
  );

  const handleUpdateKeyframe = useCallback((id: string, patch: Partial<ZoomKeyframe>) => {
    setKeyframes((prev) =>
      prev
        .map((kf) => (kf.id === id ? { ...kf, ...patch } : kf))
        .sort((a, b) => a.startTime - b.startTime)
    );
  }, []);

  const handleDeleteKeyframe = useCallback((id: string) => {
    setKeyframes((prev) => prev.filter((kf) => kf.id !== id));
    setSelectedKeyframeId((prev) => (prev === id ? null : prev));
  }, []);

  // Pro NLE Keyboard Transport: J / K / L + Space + I / O + Z + Delete
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!clip || exportState.active) return;

      const key = e.key.toLowerCase();

      if (e.code === 'Space') {
        e.preventDefault();
        handleTogglePlay();
      } else if (key === 'k') {
        e.preventDefault();
        handlePause();
      } else if (key === 'j') {
        e.preventDefault();
        const step = isPlaying ? 1.0 : 0.5;
        handleSeek(clamp(currentTime - step, 0, clip.duration));
      } else if (key === 'l') {
        e.preventDefault();
        if (!isPlaying) {
          handlePlay();
        } else {
          const idx = SHUTTLE_SPEEDS.indexOf(config.playbackSpeed);
          const nextSpeed = SHUTTLE_SPEEDS[Math.min(SHUTTLE_SPEEDS.length - 1, idx + 1)];
          setConfig((prev) => ({ ...prev, playbackSpeed: nextSpeed }));
          showToast(`Shuttle forward ${nextSpeed}x`);
        }
      } else if (key === 'i') {
        e.preventDefault();
        const nextIn = Number(clamp(currentTime, 0, Math.max(0, config.trimEnd - 0.3)).toFixed(2));
        setConfig((prev) => ({ ...prev, trimStart: nextIn }));
        showToast(`Trim In set to ${nextIn.toFixed(1)}s`);
      } else if (key === 'o') {
        e.preventDefault();
        const nextOut = Number(
          clamp(currentTime, Math.min(clip.duration, config.trimStart + 0.3), clip.duration).toFixed(2)
        );
        setConfig((prev) => ({ ...prev, trimEnd: nextOut }));
        showToast(`Trim Out set to ${nextOut.toFixed(1)}s`);
      } else if (key === 'z') {
        e.preventDefault();
        handleAddZoom(0.5, 0.5);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedKeyframeId) {
        e.preventDefault();
        handleDeleteKeyframe(selectedKeyframeId);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    clip,
    exportState.active,
    isPlaying,
    currentTime,
    config.playbackSpeed,
    config.trimStart,
    config.trimEnd,
    handleTogglePlay,
    handlePlay,
    handlePause,
    handleSeek,
    handleAddZoom,
    selectedKeyframeId,
    handleDeleteKeyframe,
    showToast,
  ]);

  const handleStopRecording = useCallback(async () => {
    const session = recordingSessionRef.current;
    if (!session) return;
    recordingSessionRef.current = null;
    setIsRecording(false);
    try {
      const recordedClip = await session.stop();
      loadNewClip(recordedClip, []);
      showToast('Screen recording ready in timeline');
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to finalize recording.');
    }
  }, [loadNewClip, showToast]);

  const handleStartRecording = useCallback(async () => {
    setErrorMessage(null);
    try {
      const session = await startScreenRecording(captureOptions, () => {
        handleStopRecording();
      });
      recordingSessionRef.current = session;
      setIsRecording(true);
      setShowCaptureModal(false);
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Screen capture was cancelled or permission was denied.'
      );
    }
  }, [captureOptions, handleStopRecording]);

  const handleImportFile = useCallback(
    (file: File) => {
      setErrorMessage(null);
      const url = URL.createObjectURL(file);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.muted = true;
      probe.src = url;

      probe.onloadedmetadata = () => {
        const duration = Number.isFinite(probe.duration) && probe.duration > 0 ? probe.duration : 10;
        const width = probe.videoWidth || 1920;
        const height = probe.videoHeight || 1080;
        loadNewClip(
          {
            id: `imp-${Date.now()}`,
            name: file.name,
            url,
            duration,
            width,
            height,
            source: 'imported',
            webcamUrl: null,
            hasAudio: true,
          },
          []
        );
        showToast(`Imported ${file.name}`);
      };

      probe.onerror = () => {
        URL.revokeObjectURL(url);
        setErrorMessage('Unsupported video format. Please import an MP4 or WebM file.');
      };
    },
    [loadNewClip, showToast]
  );

  const handleLoadDemo = useCallback(async () => {
    setErrorMessage(null);
    setDemoProgress(0);
    try {
      const { clip: demoClip, keyframes: demoKeyframes } = await generateSampleDemoClip((pct) => {
        setDemoProgress(pct);
      });
      setDemoProgress(null);
      loadNewClip(demoClip, demoKeyframes);
      showToast('Sample 8s IDE demo loaded with 3 zoom keyframes');
    } catch (err) {
      setDemoProgress(null);
      setErrorMessage(err instanceof Error ? err.message : 'Could not synthesize demo clip.');
    }
  }, [loadNewClip, showToast]);

  const handleExport = useCallback(async () => {
    if (!clip || exportState.active) return;

    handlePause();

    const controller = new AbortController();
    exportAbortRef.current = controller;

    try {
      await exportStudioVideo({
        clip,
        config,
        keyframes,
        signal: controller.signal,
        onProgress: (status) => setExportState(status),
      });
      showToast('Zero-watermark export downloaded');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Export failed.';
      setExportState({
        ...INITIAL_EXPORT_STATE,
        phase: 'error',
        message: msg,
      });
      if (msg !== 'Export cancelled.') {
        setErrorMessage(msg);
      }
    } finally {
      exportAbortRef.current = null;
    }
  }, [clip, config, keyframes, exportState.active, handlePause, showToast]);

  const handleCancelExport = useCallback(() => {
    exportAbortRef.current?.abort();
    setExportState(INITIAL_EXPORT_STATE);
  }, []);

  const selectedKeyframe = keyframes.find((k) => k.id === selectedKeyframeId) ?? null;

  return (
    <div className="h-screen w-screen bg-[#0A0B0E] text-zinc-100 flex flex-col overflow-hidden">
      <TopBar
        clip={clip}
        aspectRatio={config.aspectRatio}
        onAspectRatioChange={(aspectRatio: AspectRatio) =>
          setConfig((prev) => ({ ...prev, aspectRatio }))
        }
        exportPreset={config.exportPreset}
        exportBitrateMbps={config.exportBitrateMbps}
        onExportPresetChange={(exportPreset: ExportPresetId) =>
          setConfig((prev) => ({ ...prev, exportPreset }))
        }
        onExportBitrateChange={(exportBitrateMbps: number) =>
          setConfig((prev) => ({ ...prev, exportBitrateMbps }))
        }
        isRecording={isRecording}
        recordingSeconds={recordingSeconds}
        onStartRecordClick={() => {
          if (clip) {
            setShowCaptureModal(true);
          } else {
            handleStartRecording();
          }
        }}
        onStopRecord={handleStopRecording}
        onImportFile={handleImportFile}
        exportState={exportState}
        onExport={handleExport}
        onCancelExport={handleCancelExport}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((v) => !v)}
      />

      {/* Hidden source <video> elements decoded by the 60fps Canvas 2D compositor */}
      {clip && (
        <>
          <video
            ref={videoRef}
            src={clip.url}
            playsInline
            preload="auto"
            className="hidden"
            onLoadedMetadata={(e) => {
              const vid = e.currentTarget;
              if (Number.isFinite(vid.duration) && vid.duration > 0) {
                setClip((prev) =>
                  prev && Math.abs(prev.duration - vid.duration) > 0.25
                    ? { ...prev, duration: vid.duration }
                    : prev
                );
                setConfig((prev) => ({
                  ...prev,
                  trimEnd: Math.min(prev.trimEnd, vid.duration) || vid.duration,
                }));
              }
            }}
          />
          {clip.webcamUrl && (
            <video
              ref={webcamRef}
              src={clip.webcamUrl}
              playsInline
              muted
              preload="auto"
              className="hidden"
            />
          )}
        </>
      )}

      {/* Main NLE Workspace */}
      {isRecording ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#0A0B0E] p-6">
          <div className="w-16 h-16 rounded-2xl bg-[#2A1218] border border-[#F43F5E]/50 flex items-center justify-center shadow-[0_0_40px_rgba(244,63,94,0.25)]">
            <Radio className="w-7 h-7 text-[#F43F5E] animate-pulse" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-zinc-100">Recording Screen at 60fps</h2>
            <p className="text-xs text-zinc-400 mt-1">
              Switch to the window you want to capture. Click Stop when finished.
            </p>
          </div>
          <button
            type="button"
            onClick={handleStopRecording}
            className="mt-2 h-10 px-6 rounded-xl bg-[#F43F5E] hover:bg-[#E11D48] text-white text-sm font-semibold transition-colors shadow-[0_0_24px_rgba(244,63,94,0.35)]"
          >
            Finish Recording &amp; Open Studio
          </button>
        </div>
      ) : !clip ? (
        <CaptureBar
          captureOptions={captureOptions}
          onCaptureOptionsChange={setCaptureOptions}
          onStartRecording={handleStartRecording}
          onImportFile={handleImportFile}
          onLoadDemo={handleLoadDemo}
          demoProgress={demoProgress}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      ) : (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
            <CanvasPreview
              clip={clip}
              videoRef={videoRef}
              webcamRef={webcamRef}
              config={config}
              keyframes={keyframes}
              currentTime={currentTime}
              isPlaying={isPlaying}
              isMuted={isMuted}
              clickToZoomMode={clickToZoomMode}
              onTogglePlay={handleTogglePlay}
              onSeek={handleSeek}
              onToggleMute={() => setIsMuted((m) => !m)}
              onToggleClickToZoom={() => setClickToZoomMode((v) => !v)}
              onCanvasAddZoom={handleAddZoom}
            />

            <TimelineEditor
              duration={clip.duration}
              currentTime={currentTime}
              trimStart={config.trimStart}
              trimEnd={config.trimEnd}
              playbackSpeed={config.playbackSpeed}
              waveformBars={waveformBars}
              keyframes={keyframes}
              selectedKeyframeId={selectedKeyframeId}
              onSeek={handleSeek}
              onTrimChange={(trimStart, trimEnd) =>
                setConfig((prev) => ({ ...prev, trimStart, trimEnd }))
              }
              onPlaybackSpeedChange={(playbackSpeed: PlaybackSpeed) =>
                setConfig((prev) => ({ ...prev, playbackSpeed }))
              }
              onSelectKeyframe={setSelectedKeyframeId}
              onAddZoomAtPlayhead={() => handleAddZoom(0.5, 0.5)}
              onUpdateKeyframe={handleUpdateKeyframe}
              onDeleteKeyframe={handleDeleteKeyframe}
            />
          </div>

          {inspectorOpen && (
            <StyleInspector
              config={config}
              onConfigChange={(patch) => setConfig((prev) => ({ ...prev, ...patch }))}
              selectedKeyframe={selectedKeyframe}
              onUpdateKeyframe={handleUpdateKeyframe}
              onDeleteKeyframe={handleDeleteKeyframe}
              hasWebcam={Boolean(clip.webcamUrl)}
            />
          )}
        </div>
      )}

      {/* Modal Capture Launcher */}
      {showCaptureModal && (
        <CaptureBar
          isModal
          onCloseModal={() => setShowCaptureModal(false)}
          captureOptions={captureOptions}
          onCaptureOptionsChange={setCaptureOptions}
          onStartRecording={handleStartRecording}
          onImportFile={handleImportFile}
          onLoadDemo={handleLoadDemo}
          demoProgress={demoProgress}
          errorMessage={errorMessage}
          onClearError={() => setErrorMessage(null)}
        />
      )}

      {/* Live Export Progress & FPS / Frame-Drop Telemetry HUD */}
      {exportState.active && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 w-[420px] rounded-xl bg-[#13151B] border border-[#10B981]/50 p-3.5 shadow-2xl">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-zinc-100 truncate pr-2">{exportState.message}</span>
            <span className="font-mono text-[#10B981] font-semibold shrink-0">
              {exportState.progress}%
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-[#0A0B0E] overflow-hidden mb-2.5">
            <div
              className="h-full bg-[#10B981] transition-all duration-150"
              style={{ width: `${exportState.progress}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
            <span className="inline-flex items-center gap-1.5 text-[#38BDF8]">
              <Activity className="w-3.5 h-3.5" />
              <span>{exportState.currentFps} FPS</span>
            </span>
            <span>{exportState.renderedFrames} frames</span>
            <span
              className={exportState.droppedFrames > 0 ? 'text-[#F59E0B]' : 'text-[#10B981]'}
            >
              {exportState.droppedFrames} dropped
            </span>
          </div>
        </div>
      )}

      {/* Subtle Toast Notification */}
      {toastMessage && !exportState.active && (
        <div className="fixed bottom-6 right-6 z-40 px-3.5 py-2 rounded-xl bg-[#13151B] border border-[#222631] shadow-xl flex items-center gap-2 text-xs text-zinc-200">
          <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
