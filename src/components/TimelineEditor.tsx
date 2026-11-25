import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Plus, Scissors, Trash2, ZoomIn } from 'lucide-react';
import type { PlaybackSpeed, ZoomKeyframe } from '../types/studio';
import { clamp } from '../engine/easing';

interface TimelineEditorProps {
  duration: number;
  currentTime: number;
  trimStart: number;
  trimEnd: number;
  playbackSpeed: PlaybackSpeed;
  waveformBars: number[];
  keyframes: ZoomKeyframe[];
  selectedKeyframeId: string | null;
  onSeek: (time: number) => void;
  onTrimChange: (trimStart: number, trimEnd: number) => void;
  onPlaybackSpeedChange: (speed: PlaybackSpeed) => void;
  onSelectKeyframe: (id: string | null) => void;
  onAddZoomAtPlayhead: () => void;
  onUpdateKeyframe: (id: string, patch: Partial<ZoomKeyframe>) => void;
  onDeleteKeyframe: (id: string) => void;
}

type DragMode =
  | { kind: 'playhead' }
  | { kind: 'trim-start' }
  | { kind: 'trim-end' }
  | { kind: 'kf-move'; id: string; offsetSec: number }
  | { kind: 'kf-resize-right'; id: string };

const SPEEDS: PlaybackSpeed[] = [1, 1.25, 1.5, 2];

function formatSec(sec: number): string {
  const safe = Math.max(0, sec);
  const mins = Math.floor(safe / 60);
  const rem = safe - mins * 60;
  return `${String(mins).padStart(2, '0')}:${rem.toFixed(1).padStart(4, '0')}`;
}

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  duration,
  currentTime,
  trimStart,
  trimEnd,
  playbackSpeed,
  waveformBars,
  keyframes,
  selectedKeyframeId,
  onSeek,
  onTrimChange,
  onPlaybackSpeedChange,
  onSelectKeyframe,
  onAddZoomAtPlayhead,
  onUpdateKeyframe,
  onDeleteKeyframe,
}) => {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [dragMode, setDragMode] = useState<DragMode | null>(null);

  const safeDuration = Math.max(0.5, duration);

  const clientXToTime = useCallback(
    (clientX: number): number => {
      const el = trackRef.current;
      if (!el) return 0;
      const rect = el.getBoundingClientRect();
      const ratio = clamp((clientX - rect.left) / Math.max(1, rect.width), 0, 1);
      return ratio * safeDuration;
    },
    [safeDuration]
  );

  useEffect(() => {
    if (!dragMode) return;

    const handleMove = (e: MouseEvent) => {
      const t = clientXToTime(e.clientX);

      if (dragMode.kind === 'playhead') {
        onSeek(t);
      } else if (dragMode.kind === 'trim-start') {
        const nextStart = clamp(t, 0, Math.max(0, trimEnd - 0.3));
        onTrimChange(nextStart, trimEnd);
        if (currentTime < nextStart) onSeek(nextStart);
      } else if (dragMode.kind === 'trim-end') {
        const nextEnd = clamp(t, Math.min(safeDuration, trimStart + 0.3), safeDuration);
        onTrimChange(trimStart, nextEnd);
        if (currentTime > nextEnd) onSeek(nextEnd);
      } else if (dragMode.kind === 'kf-move') {
        const kf = keyframes.find((k) => k.id === dragMode.id);
        if (!kf) return;
        const maxStart = Math.max(0, safeDuration - kf.duration);
        const nextStart = clamp(t - dragMode.offsetSec, 0, maxStart);
        onUpdateKeyframe(kf.id, { startTime: Number(nextStart.toFixed(2)) });
      } else if (dragMode.kind === 'kf-resize-right') {
        const kf = keyframes.find((k) => k.id === dragMode.id);
        if (!kf) return;
        const maxDur = Math.max(0.4, safeDuration - kf.startTime);
        const nextDur = clamp(t - kf.startTime, 0.4, maxDur);
        onUpdateKeyframe(kf.id, { duration: Number(nextDur.toFixed(2)) });
      }
    };

    const handleUp = () => {
      setDragMode(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [
    dragMode,
    clientXToTime,
    onSeek,
    onTrimChange,
    trimStart,
    trimEnd,
    currentTime,
    safeDuration,
    keyframes,
    onUpdateKeyframe,
  ]);

  const toPct = (time: number) => `${clamp((time / safeDuration) * 100, 0, 100)}%`;

  const tickCount = Math.min(12, Math.max(4, Math.round(safeDuration)));
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => (i / tickCount) * safeDuration);

  const selectedKf = keyframes.find((k) => k.id === selectedKeyframeId) ?? null;
  const trimStartRatio = trimStart / safeDuration;
  const trimEndRatio = trimEnd / safeDuration;

  return (
    <section className="h-52 shrink-0 bg-[#13151B] border-t border-[#222631] flex flex-col select-none">
      {/* Timeline Action Header */}
      <div className="h-10 px-4 border-b border-[#222631] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onAddZoomAtPlayhead}
            className="h-7 px-2.5 rounded-md bg-[#F59E0B]/15 hover:bg-[#F59E0B]/25 border border-[#F59E0B]/50 text-[#F59E0B] text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Zoom Here (Z)</span>
          </button>

          {selectedKf && (
            <div className="hidden sm:flex items-center gap-2 pl-2 ml-1 border-l border-[#222631]">
              <span className="text-[11px] font-mono text-[#F59E0B]">
                Selected: {selectedKf.scale.toFixed(1)}x · {selectedKf.duration.toFixed(1)}s
              </span>
              <button
                type="button"
                onClick={() => onDeleteKeyframe(selectedKf.id)}
                className="h-6 px-2 rounded bg-[#2A1218] hover:bg-[#3F1620] border border-[#F43F5E]/40 text-[#F43F5E] text-[11px] font-medium flex items-center gap-1 transition-colors"
                title="Delete selected zoom keyframe (Delete)"
              >
                <Trash2 className="w-3 h-3" />
                <span>Delete</span>
              </button>
            </div>
          )}
        </div>

        {/* Trim Range + Speed Selector */}
        <div className="flex items-center gap-3">
          {waveformBars.length > 0 && (
            <span className="hidden lg:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0A0B0E] border border-[#222631] text-[10px] font-mono text-[#38BDF8]">
              <AudioLines className="w-3 h-3" />
              <span>WAVEFORM LIVE</span>
            </span>
          )}

          <div className="hidden md:flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
            <Scissors className="w-3.5 h-3.5 text-zinc-500" />
            <span>
              {formatSec(trimStart)} → {formatSec(trimEnd)}
            </span>
            <span className="text-zinc-600">
              ({((trimEnd - trimStart) / playbackSpeed).toFixed(1)}s out)
            </span>
          </div>

          <div className="flex items-center bg-[#0A0B0E] p-0.5 rounded-md border border-[#222631]">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => onPlaybackSpeedChange(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-[#1D2230] text-[#38BDF8]'
                    : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tracks Workspace */}
      <div className="flex-1 px-4 py-2.5 flex gap-3 overflow-hidden">
        {/* Track Labels Column */}
        <div className="w-24 shrink-0 flex flex-col pt-6 gap-2.5 text-[11px] font-medium text-zinc-500">
          <div className="h-12 flex items-center gap-1.5">
            {waveformBars.length > 0 ? (
              <AudioLines className="w-3.5 h-3.5 text-[#38BDF8]" />
            ) : (
              <Scissors className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <span>{waveformBars.length > 0 ? 'Clip & Audio' : 'Clip / Trim'}</span>
          </div>
          <div className="h-9 flex items-center gap-1.5 text-[#F59E0B]/90">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom Track</span>
          </div>
        </div>

        {/* Interactive Timeline Tracks Area */}
        <div
          ref={trackRef}
          className="flex-1 relative flex flex-col"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              onSeek(clientXToTime(e.clientX));
              setDragMode({ kind: 'playhead' });
            }
          }}
        >
          {/* Time Ruler */}
          <div
            className="h-6 relative border-b border-[#222631] cursor-pointer"
            onMouseDown={(e) => {
              onSeek(clientXToTime(e.clientX));
              setDragMode({ kind: 'playhead' });
            }}
          >
            {ticks.map((tickTime, idx) => (
              <div
                key={idx}
                className="absolute top-0 bottom-0 flex flex-col justify-between pointer-events-none"
                style={{ left: toPct(tickTime) }}
              >
                <span className="text-[10px] font-mono text-zinc-500 -translate-x-1/2">
                  {tickTime.toFixed(1)}s
                </span>
                <span className="w-px h-1.5 bg-[#2B3140]" />
              </div>
            ))}
          </div>

          {/* Track 1: Main Video Clip + Live Web Audio Waveform + Draggable Trim In/Out */}
          <div
            className="h-12 mt-2 relative rounded-lg bg-[#0A0B0E] border border-[#222631] overflow-hidden cursor-pointer"
            onMouseDown={(e) => {
              onSeek(clientXToTime(e.clientX));
              setDragMode({ kind: 'playhead' });
            }}
          >
            {/* Real-Time Decoded Audio Waveform Bars */}
            {waveformBars.length > 0 ? (
              <div className="absolute inset-0 flex items-center gap-[1px] px-1 pointer-events-none">
                {waveformBars.map((amp, idx) => {
                  const posRatio = idx / waveformBars.length;
                  const inTrim = posRatio >= trimStartRatio && posRatio <= trimEndRatio;
                  const heightPct = Math.max(10, Math.round(amp * 84));
                  return (
                    <div
                      key={idx}
                      className="flex-1 rounded-full transition-colors"
                      style={{
                        height: `${heightPct}%`,
                        backgroundColor: inTrim
                          ? 'rgba(56, 189, 248, 0.72)'
                          : 'rgba(100, 116, 139, 0.25)',
                      }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="absolute inset-0 opacity-25 bg-[repeating-linear-gradient(90deg,#1F2433_0px,#1F2433_2px,transparent_2px,transparent_10px)]" />
            )}

            {/* Dimmed Pre-Trim Region */}
            <div
              className="absolute top-0 bottom-0 left-0 bg-black/55 pointer-events-none"
              style={{ width: toPct(trimStart) }}
            />

            {/* Dimmed Post-Trim Region */}
            <div
              className="absolute top-0 bottom-0 right-0 bg-black/55 pointer-events-none"
              style={{
                width: `${clamp(((safeDuration - trimEnd) / safeDuration) * 100, 0, 100)}%`,
              }}
            />

            {/* Active Trimmed Region Highlight */}
            <div
              className="absolute top-0 bottom-0 border-y-2 border-[#38BDF8]/55 bg-[#38BDF8]/5 pointer-events-none"
              style={{
                left: toPct(trimStart),
                width: `${clamp(((trimEnd - trimStart) / safeDuration) * 100, 0, 100)}%`,
              }}
            />

            {/* Trim In Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragMode({ kind: 'trim-start' });
              }}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-[#38BDF8] hover:bg-sky-300 cursor-ew-resize z-10 flex items-center justify-center rounded-l-sm shadow"
              style={{ left: toPct(trimStart) }}
              title="Drag to adjust Trim In (or press I)"
            >
              <div className="w-0.5 h-4 bg-[#0A0B0E] rounded-full" />
            </div>

            {/* Trim Out Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                setDragMode({ kind: 'trim-end' });
              }}
              className="absolute top-0 bottom-0 w-3 -ml-1.5 bg-[#38BDF8] hover:bg-sky-300 cursor-ew-resize z-10 flex items-center justify-center rounded-r-sm shadow"
              style={{ left: toPct(trimEnd) }}
              title="Drag to adjust Trim Out (or press O)"
            >
              <div className="w-0.5 h-4 bg-[#0A0B0E] rounded-full" />
            </div>
          </div>

          {/* Track 2: Amber Zoom Keyframe Blocks */}
          <div
            className="h-9 mt-2.5 relative rounded-lg bg-[#0A0B0E] border border-[#222631] overflow-hidden"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) {
                onSelectKeyframe(null);
                onSeek(clientXToTime(e.clientX));
                setDragMode({ kind: 'playhead' });
              }
            }}
          >
            {keyframes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-600 pointer-events-none">
                Click anywhere on the preview video or press Z to add a Zoom keyframe
              </div>
            )}

            {keyframes.map((kf) => {
              const selected = kf.id === selectedKeyframeId;
              const leftPct = clamp((kf.startTime / safeDuration) * 100, 0, 100);
              const widthPct = clamp((kf.duration / safeDuration) * 100, 2.5, 100 - leftPct);

              return (
                <div
                  key={kf.id}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    onSelectKeyframe(kf.id);
                    const pointerTime = clientXToTime(e.clientX);
                    setDragMode({
                      kind: 'kf-move',
                      id: kf.id,
                      offsetSec: pointerTime - kf.startTime,
                    });
                  }}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                  className={`absolute top-1 bottom-1 rounded-md px-2 flex items-center justify-between cursor-grab active:cursor-grabbing transition-shadow ${
                    selected
                      ? 'bg-[#F59E0B] text-[#0A0B0E] ring-2 ring-amber-200/80 shadow-[0_0_16px_rgba(245,158,11,0.45)] z-10'
                      : 'bg-[#F59E0B]/25 hover:bg-[#F59E0B]/35 border border-[#F59E0B]/60 text-amber-200'
                  }`}
                  title={`Zoom ${kf.scale.toFixed(1)}x (${kf.startTime.toFixed(1)}s · ${kf.duration.toFixed(1)}s)`}
                >
                  <span className="text-[11px] font-mono font-semibold truncate">
                    {kf.scale.toFixed(1)}x
                  </span>

                  {/* Right Resize Handle */}
                  <div
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      onSelectKeyframe(kf.id);
                      setDragMode({ kind: 'kf-resize-right', id: kf.id });
                    }}
                    className={`w-2 h-4 rounded-sm cursor-ew-resize shrink-0 ${
                      selected ? 'bg-[#0A0B0E]/40' : 'bg-[#F59E0B]/50 hover:bg-[#F59E0B]'
                    }`}
                    title="Drag to resize duration"
                  />
                </div>
              );
            })}
          </div>

          {/* Cyan Playhead Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-[#38BDF8] pointer-events-none z-20 shadow-[0_0_10px_rgba(56,189,248,0.85)]"
            style={{ left: toPct(currentTime) }}
          >
            <div className="w-3 h-3 -ml-[5px] -mt-0.5 bg-[#38BDF8] rotate-45 rounded-[2px] border border-[#0A0B0E]" />
          </div>
        </div>
      </div>
    </section>
  );
};
