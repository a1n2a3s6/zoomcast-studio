import React, { useRef, useState } from 'react';
import {
  Camera,
  CameraOff,
  Circle,
  Clapperboard,
  FolderOpen,
  Lock,
  Mic,
  MicOff,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import type { CaptureOptions } from '../types/studio';

interface CaptureBarProps {
  captureOptions: CaptureOptions;
  onCaptureOptionsChange: (next: CaptureOptions) => void;
  onStartRecording: () => void;
  onImportFile: (file: File) => void;
  onLoadDemo: () => void;
  demoProgress: number | null;
  errorMessage: string | null;
  onClearError: () => void;
  /** When true, renders as a dismissible overlay modal over an existing project */
  isModal?: boolean;
  onCloseModal?: () => void;
}

export const CaptureBar: React.FC<CaptureBarProps> = ({
  captureOptions,
  onCaptureOptionsChange,
  onStartRecording,
  onImportFile,
  onLoadDemo,
  demoProgress,
  errorMessage,
  onClearError,
  isModal = false,
  onCloseModal,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('video/')) {
      onImportFile(file);
    }
  };

  const card = (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`relative w-full max-w-xl rounded-2xl bg-[#13151B] border transition-colors p-7 shadow-2xl ${
        isDragging ? 'border-[#38BDF8] bg-[#151B26]' : 'border-[#222631]'
      }`}
    >
      {isModal && onCloseModal && (
        <button
          type="button"
          onClick={onCloseModal}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-[#0A0B0E] border border-[#222631] text-zinc-400 hover:text-zinc-100 flex items-center justify-center"
          title="Close launcher"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileInput}
        className="hidden"
      />

      {/* Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#0A0B0E] border border-[#222631] text-[11px] font-mono text-[#38BDF8] mb-3">
          <Sparkles className="w-3 h-3" />
          <span>OPEN-SOURCE SCREEN STUDIO</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">
          Record, Zoom &amp; Export in 60fps
        </h1>
        <p className="text-sm text-zinc-400 mt-1.5 leading-relaxed">
          Capture your screen with smooth spring-damped zooms, click ripples, and studio backdrops —
          100% locally in your browser with zero uploads and zero watermarks.
        </p>
      </div>

      {/* Capture Source Toggles */}
      <div className="grid grid-cols-2 gap-2.5 mb-5">
        <button
          type="button"
          onClick={() =>
            onCaptureOptionsChange({
              ...captureOptions,
              includeMic: !captureOptions.includeMic,
            })
          }
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
            captureOptions.includeMic
              ? 'bg-[#191D27] border-[#38BDF8]/50 text-zinc-100'
              : 'bg-[#0A0B0E] border-[#222631] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {captureOptions.includeMic ? (
              <Mic className="w-4 h-4 text-[#38BDF8]" />
            ) : (
              <MicOff className="w-4 h-4 text-zinc-500" />
            )}
            <div>
              <div className="text-xs font-medium">Microphone</div>
              <div className="text-[11px] text-zinc-500">
                {captureOptions.includeMic ? 'Mixed with audio' : 'Muted'}
              </div>
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              captureOptions.includeMic ? 'bg-[#38BDF8]' : 'bg-zinc-700'
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() =>
            onCaptureOptionsChange({
              ...captureOptions,
              includeWebcam: !captureOptions.includeWebcam,
            })
          }
          className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
            captureOptions.includeWebcam
              ? 'bg-[#191D27] border-[#38BDF8]/50 text-zinc-100'
              : 'bg-[#0A0B0E] border-[#222631] text-zinc-400 hover:text-zinc-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {captureOptions.includeWebcam ? (
              <Camera className="w-4 h-4 text-[#38BDF8]" />
            ) : (
              <CameraOff className="w-4 h-4 text-zinc-500" />
            )}
            <div>
              <div className="text-xs font-medium">Webcam PiP</div>
              <div className="text-[11px] text-zinc-500">
                {captureOptions.includeWebcam ? 'Circular overlay' : 'Off'}
              </div>
            </div>
          </div>
          <span
            className={`w-2 h-2 rounded-full ${
              captureOptions.includeWebcam ? 'bg-[#38BDF8]' : 'bg-zinc-700'
            }`}
          />
        </button>
      </div>

      {/* Primary Action Buttons */}
      <div className="space-y-2.5">
        <button
          type="button"
          onClick={onStartRecording}
          disabled={demoProgress !== null}
          className="w-full h-11 rounded-xl bg-[#F43F5E] hover:bg-[#E11D48] disabled:opacity-50 text-white text-sm font-semibold flex items-center justify-center gap-2.5 transition-all shadow-[0_0_24px_rgba(244,63,94,0.28)]"
        >
          <Circle className="w-3.5 h-3.5 fill-white" />
          <span>Record Screen</span>
        </button>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={demoProgress !== null}
            className="h-10 px-4 rounded-xl bg-[#191C24] hover:bg-[#222631] border border-[#2B303E] text-zinc-200 text-xs font-medium flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
          >
            <FolderOpen className="w-4 h-4 text-zinc-400" />
            <span>Import Recording (MP4/WebM)</span>
          </button>

          <button
            type="button"
            onClick={onLoadDemo}
            disabled={demoProgress !== null}
            className="h-10 px-4 rounded-xl bg-[#0E1E29] hover:bg-[#132A3A] border border-[#38BDF8]/40 text-[#38BDF8] text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-70"
          >
            <Clapperboard className="w-4 h-4" />
            <span>
              {demoProgress !== null
                ? `Synthesizing Demo (${demoProgress}%)...`
                : 'Load Sample Demo Clip'}
            </span>
          </button>
        </div>
      </div>

      {demoProgress !== null && (
        <div className="mt-3">
          <div className="h-1.5 w-full rounded-full bg-[#0A0B0E] overflow-hidden border border-[#222631]">
            <div
              className="h-full bg-[#38BDF8] transition-all duration-150"
              style={{ width: `${demoProgress}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-400 mt-1.5 font-mono">
            Rendering 8-second animated IDE clip locally via Canvas 2D...
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="mt-4 px-3.5 py-2.5 rounded-xl bg-[#2A1218] border border-[#F43F5E]/40 text-xs text-rose-200 flex items-center justify-between gap-2">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-300 hover:text-white shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Privacy & Architecture Footer */}
      <div className="mt-6 pt-4 border-t border-[#222631] flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-[#10B981]" />
          <span>100% Local-First (Zero Server Uploads)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Zero Watermarks · Drag &amp; Drop Video Supported</span>
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
        {card}
      </div>
    );
  }

  return (
    <div className="flex-1 flex items-center justify-center p-6 bg-[#0A0B0E] overflow-auto">
      {card}
    </div>
  );
};
