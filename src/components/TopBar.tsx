import React, { useEffect, useRef, useState } from 'react';
import {
  Aperture,
  ChevronDown,
  Circle,
  Download,
  Film,
  FolderOpen,
  PanelRightClose,
  PanelRightOpen,
  Sparkles,
  Square,
  X,
} from 'lucide-react';
import {
  ASPECT_DIMENSIONS,
  EXPORT_PRESETS,
  type AspectRatio,
  type ExportPresetId,
  type ExportProgress,
  type RecordingClip,
} from '../types/studio';

interface TopBarProps {
  clip: RecordingClip | null;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ratio: AspectRatio) => void;
  exportPreset: ExportPresetId;
  exportBitrateMbps: number;
  onExportPresetChange: (preset: ExportPresetId) => void;
  onExportBitrateChange: (mbps: number) => void;
  isRecording: boolean;
  recordingSeconds: number;
  onStartRecordClick: () => void;
  onStopRecord: () => void;
  onImportFile: (file: File) => void;
  exportState: ExportProgress;
  onExport: () => void;
  onCancelExport: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}

const ASPECT_RATIOS: AspectRatio[] = ['16:9', '9:16', '1:1', '4:3'];
const PRESET_ORDER: ExportPresetId[] = ['4k-60', '1080p-60', 'reels-60', 'github-loop'];

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export const TopBar: React.FC<TopBarProps> = ({
  clip,
  aspectRatio,
  onAspectRatioChange,
  exportPreset,
  exportBitrateMbps,
  onExportPresetChange,
  onExportBitrateChange,
  isRecording,
  recordingSeconds,
  onStartRecordClick,
  onStopRecord,
  onImportFile,
  exportState,
  onExport,
  onCancelExport,
  inspectorOpen,
  onToggleInspector,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);

  useEffect(() => {
    if (!presetMenuOpen) return;
    const onOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setPresetMenuOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutsideClick);
    return () => window.removeEventListener('mousedown', onOutsideClick);
  }, [presetMenuOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    e.target.value = '';
  };

  const activePresetInfo = EXPORT_PRESETS[exportPreset];

  return (
    <header className="h-14 shrink-0 bg-[#13151B] border-b border-[#222631] px-4 flex items-center justify-between gap-3 select-none z-30">
      {/* Left: Brand & Active Clip Pill */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#0A0B0E] border border-[#222631] flex items-center justify-center shadow-inner">
            <Aperture className="w-4 h-4 text-[#38BDF8]" />
          </div>
          <div className="leading-tight">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold tracking-tight text-zinc-100">
                ZoomCast Studio
              </span>
              <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium tracking-wider uppercase rounded bg-[#0A0B0E] text-[#38BDF8] border border-[#222631]">
                60FPS LOCAL
              </span>
            </div>
          </div>
        </div>

        {clip && (
          <div className="hidden xl:flex items-center gap-2 pl-3 ml-1 border-l border-[#222631] min-w-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] shrink-0" />
            <span className="text-xs text-zinc-400 truncate max-w-[180px]" title={clip.name}>
              {clip.name}
            </span>
          </div>
        )}
      </div>

      {/* Center: Aspect Ratio Switcher */}
      <div className="flex items-center bg-[#0A0B0E] p-1 rounded-lg border border-[#222631]">
        {ASPECT_RATIOS.map((ratio) => {
          const active = aspectRatio === ratio;
          const label = ratio === '9:16' ? '9:16 Reels' : ASPECT_DIMENSIONS[ratio].shortLabel;
          return (
            <button
              key={ratio}
              type="button"
              onClick={() => onAspectRatioChange(ratio)}
              disabled={exportState.active}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                active
                  ? 'bg-[#1C202B] text-zinc-100 shadow-sm border border-[#2D3343]'
                  : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
              }`}
              title={`${ASPECT_DIMENSIONS[ratio].label} (${ASPECT_DIMENSIONS[ratio].width}×${ASPECT_DIMENSIONS[ratio].height})`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Right: Record / Import / Export Preset + Export CTA / Inspector */}
      <div className="flex items-center gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          onChange={handleFileChange}
          className="hidden"
        />

        {isRecording ? (
          <button
            type="button"
            onClick={onStopRecord}
            className="h-8 px-3 rounded-lg bg-[#F43F5E] hover:bg-[#E11D48] text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-[0_0_16px_rgba(244,63,94,0.35)]"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Stop</span>
            <span className="font-mono text-[11px] bg-black/25 px-1.5 py-0.5 rounded">
              {formatTimer(recordingSeconds)}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onStartRecordClick}
            disabled={exportState.active}
            className="h-8 px-3 rounded-lg bg-[#191C24] hover:bg-[#222631] border border-[#2A303E] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
          >
            <Circle className="w-2.5 h-2.5 fill-[#F43F5E] text-[#F43F5E]" />
            <span className="hidden lg:inline">Record New</span>
          </button>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={exportState.active || isRecording}
          className="h-8 px-3 rounded-lg bg-[#191C24] hover:bg-[#222631] border border-[#2A303E] text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-40"
          title="Import local MP4 or WebM recording"
        >
          <FolderOpen className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden lg:inline">Import</span>
        </button>

        {/* Export Split Button + Preset Popover */}
        {exportState.active ? (
          <div className="flex items-center gap-2 h-8 pl-3 pr-2 rounded-lg bg-[#0E241E] border border-[#10B981]/50 text-[#10B981] text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
            <span className="font-mono">{exportState.progress}%</span>
            <span className="hidden sm:inline font-mono text-[10px] text-emerald-300/80">
              {exportState.currentFps}fps
            </span>
            <button
              type="button"
              onClick={onCancelExport}
              className="ml-0.5 p-0.5 rounded hover:bg-[#10B981]/20 text-zinc-300 hover:text-white"
              title="Cancel export"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div ref={menuRef} className="relative flex items-center">
            <button
              type="button"
              onClick={onExport}
              disabled={!clip || isRecording}
              className="h-8 pl-3 pr-2.5 rounded-l-lg bg-[#10B981] hover:bg-[#059669] disabled:bg-[#191C24] disabled:text-zinc-500 disabled:border-[#222631] disabled:shadow-none text-[#06140F] text-xs font-semibold flex items-center gap-1.5 transition-all shadow-[0_0_20px_rgba(16,185,129,0.28)] border border-r-0 border-[#34D399]/40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {activePresetInfo.format === 'gif'
                  ? 'Export Loop GIF'
                  : `Export ${activePresetInfo.badge}`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPresetMenuOpen((v) => !v)}
              disabled={!clip || isRecording}
              className="h-8 px-1.5 rounded-r-lg bg-[#059669] hover:bg-[#047857] disabled:bg-[#191C24] disabled:text-zinc-500 disabled:border-[#222631] text-[#06140F] border border-[#34D399]/40 flex items-center justify-center transition-colors"
              title="Choose Export Preset & Bitrate"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>

            {presetMenuOpen && (
              <div className="absolute right-0 top-10 w-72 rounded-xl bg-[#13151B] border border-[#262B38] shadow-2xl p-3 z-50">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Film className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Export Preset</span>
                </div>

                <div className="space-y-1.5 mb-3">
                  {PRESET_ORDER.map((id) => {
                    const info = EXPORT_PRESETS[id];
                    const selected = exportPreset === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onExportPresetChange(id);
                          if (info.overrideAspect) {
                            onAspectRatioChange(info.overrideAspect);
                          }
                        }}
                        className={`w-full px-2.5 py-2 rounded-lg border text-left transition-colors ${
                          selected
                            ? 'bg-[#0F231E] border-[#10B981]/60 text-zinc-100'
                            : 'bg-[#0A0B0E] border-[#222631] text-zinc-300 hover:border-zinc-600'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold flex items-center gap-1.5">
                            {info.format === 'gif' && (
                              <Sparkles className="w-3 h-3 text-[#F59E0B]" />
                            )}
                            {info.label}
                          </span>
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#13151B] text-[#10B981]">
                            {info.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{info.description}</div>
                      </button>
                    );
                  })}
                </div>

                {activePresetInfo.format === 'video' && (
                  <div className="pt-2.5 border-t border-[#222631]">
                    <div className="flex justify-between text-[11px] mb-1.5">
                      <span className="text-zinc-400">Video Bitrate</span>
                      <span className="font-mono text-[#10B981] font-semibold">
                        {exportBitrateMbps} Mbps
                      </span>
                    </div>
                    <input
                      type="range"
                      min={8}
                      max={20}
                      step={1}
                      value={exportBitrateMbps}
                      onChange={(e) => onExportBitrateChange(Number(e.target.value))}
                      className="w-full studio-slider"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onToggleInspector}
          className="h-8 w-8 rounded-lg bg-[#191C24] hover:bg-[#222631] border border-[#2A303E] text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors"
          title={inspectorOpen ? 'Hide Style Inspector' : 'Show Style Inspector'}
        >
          {inspectorOpen ? (
            <PanelRightClose className="w-4 h-4" />
          ) : (
            <PanelRightOpen className="w-4 h-4" />
          )}
        </button>
      </div>
    </header>
  );
};
