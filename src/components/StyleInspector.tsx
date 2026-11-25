import React, { useRef } from 'react';
import {
  Camera,
  ImagePlus,
  Layers,
  Sliders,
  Sparkles,
  Trash2,
  X,
  ZoomIn,
} from 'lucide-react';
import {
  BACKDROP_PRESETS,
  type StudioConfig,
  type WebcamCorner,
  type ZoomKeyframe,
} from '../types/studio';
import { clamp } from '../engine/easing';

interface StyleInspectorProps {
  config: StudioConfig;
  onConfigChange: (patch: Partial<StudioConfig>) => void;
  selectedKeyframe: ZoomKeyframe | null;
  onUpdateKeyframe: (id: string, patch: Partial<ZoomKeyframe>) => void;
  onDeleteKeyframe: (id: string) => void;
  hasWebcam: boolean;
}

const CORNERS: Array<{ id: WebcamCorner; label: string }> = [
  { id: 'tl', label: 'Top Left' },
  { id: 'tr', label: 'Top Right' },
  { id: 'bl', label: 'Bottom Left' },
  { id: 'br', label: 'Bottom Right' },
];

export const StyleInspector: React.FC<StyleInspectorProps> = ({
  config,
  onConfigChange,
  selectedKeyframe,
  onUpdateKeyframe,
  onDeleteKeyframe,
  hasWebcam,
}) => {
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const handleBackdropUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (config.customBackdropUrl) {
      URL.revokeObjectURL(config.customBackdropUrl);
    }
    const url = URL.createObjectURL(file);
    onConfigChange({ customBackdropUrl: url });
    e.target.value = '';
  };

  const handleClearCustomBackdrop = () => {
    if (config.customBackdropUrl) {
      URL.revokeObjectURL(config.customBackdropUrl);
    }
    onConfigChange({ customBackdropUrl: null });
  };

  const handleTargetPadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!selectedKeyframe) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    onUpdateKeyframe(selectedKeyframe.id, {
      targetX: Number(x.toFixed(3)),
      targetY: Number(y.toFixed(3)),
    });
  };

  return (
    <aside className="w-80 shrink-0 bg-[#13151B] border-l border-[#222631] overflow-y-auto p-4 space-y-5 select-none">
      {/* Section 1: Studio Backdrop */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Layers className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Studio Backdrop</span>
          </div>
          {config.customBackdropUrl && (
            <button
              type="button"
              onClick={handleClearCustomBackdrop}
              className="text-[11px] text-zinc-400 hover:text-zinc-100 flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              <span>Clear Image</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-2.5">
          {BACKDROP_PRESETS.map((preset) => {
            const active = !config.customBackdropUrl && config.backdropId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  onConfigChange({
                    backdropId: preset.id,
                    customBackdropUrl: null,
                  })
                }
                title={preset.name}
                className={`group relative h-11 rounded-lg overflow-hidden border transition-all ${
                  active
                    ? 'border-[#38BDF8] ring-2 ring-[#38BDF8]/30 scale-[1.02]'
                    : 'border-[#252A38] hover:border-zinc-500'
                }`}
                style={{ background: preset.previewCss }}
              >
                <span className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-[9px] font-medium text-white/90 bg-black/45 truncate text-left">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleBackdropUpload}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          className="w-full h-8 rounded-lg bg-[#0A0B0E] hover:bg-[#181B24] border border-dashed border-[#2D3344] text-zinc-300 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
        >
          <ImagePlus className="w-3.5 h-3.5 text-zinc-400" />
          <span>
            {config.customBackdropUrl ? 'Replace Custom Wallpaper' : 'Upload Custom Wallpaper'}
          </span>
        </button>
      </div>

      {/* Section 2: Frame & Presentation */}
      <div className="pt-4 border-t border-[#222631] space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Sliders className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Frame &amp; Chrome</span>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300">Canvas Padding</span>
            <span className="font-mono text-zinc-400">{config.padding}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={120}
            step={2}
            value={config.padding}
            onChange={(e) => onConfigChange({ padding: Number(e.target.value) })}
            className="w-full studio-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300">Corner Radius</span>
            <span className="font-mono text-zinc-400">{config.borderRadius}px</span>
          </div>
          <input
            type="range"
            min={0}
            max={32}
            step={1}
            value={config.borderRadius}
            onChange={(e) => onConfigChange({ borderRadius: Number(e.target.value) })}
            className="w-full studio-slider"
          />
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300">Drop Shadow</span>
            <span className="font-mono text-zinc-400">
              {Math.round(config.shadowIntensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={config.shadowIntensity}
            onChange={(e) => onConfigChange({ shadowIntensity: Number(e.target.value) })}
            className="w-full studio-slider"
          />
        </div>

        <label className="flex items-center justify-between pt-0.5 cursor-pointer">
          <span className="text-xs text-zinc-300">macOS Window Header</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.showWindowChrome}
            onClick={() => onConfigChange({ showWindowChrome: !config.showWindowChrome })}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
              config.showWindowChrome ? 'bg-[#38BDF8]' : 'bg-[#222631]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#0A0B0E] transition-transform ${
                config.showWindowChrome ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Section 3: Cinematic Camera Physics & Effects */}
      <div className="pt-4 border-t border-[#222631] space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          <Sparkles className="w-3.5 h-3.5 text-[#F59E0B]" />
          <span>Camera &amp; Motion</span>
        </div>

        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-zinc-300">Spotlight Dimmer</span>
            <span className="font-mono text-zinc-400">
              {Math.round(config.spotlightDimmer * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.75}
            step={0.05}
            value={config.spotlightDimmer}
            onChange={(e) => onConfigChange({ spotlightDimmer: Number(e.target.value) })}
            className="w-full studio-slider studio-slider-amber"
          />
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Stiffness</span>
              <span className="font-mono text-zinc-300">{config.springStiffness}</span>
            </div>
            <input
              type="range"
              min={120}
              max={360}
              step={10}
              value={config.springStiffness}
              onChange={(e) => onConfigChange({ springStiffness: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-zinc-400">Damping</span>
              <span className="font-mono text-zinc-300">{config.springDamping}</span>
            </div>
            <input
              type="range"
              min={14}
              max={36}
              step={1}
              value={config.springDamping}
              onChange={(e) => onConfigChange({ springDamping: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>
        </div>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-zinc-300">Velocity Motion-Blur</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.motionBlurEnabled}
            onClick={() => onConfigChange({ motionBlurEnabled: !config.motionBlurEnabled })}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
              config.motionBlurEnabled ? 'bg-[#38BDF8]' : 'bg-[#222631]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#0A0B0E] transition-transform ${
                config.motionBlurEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-zinc-300">Cursor Target Halo</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.cursorHaloEnabled}
            onClick={() => onConfigChange({ cursorHaloEnabled: !config.cursorHaloEnabled })}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
              config.cursorHaloEnabled ? 'bg-[#F59E0B]' : 'bg-[#222631]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#0A0B0E] transition-transform ${
                config.cursorHaloEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-xs text-zinc-300">Tactile Click Sound</span>
          <button
            type="button"
            role="switch"
            aria-checked={config.clickSoundEnabled}
            onClick={() => onConfigChange({ clickSoundEnabled: !config.clickSoundEnabled })}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
              config.clickSoundEnabled ? 'bg-[#10B981]' : 'bg-[#222631]'
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-[#0A0B0E] transition-transform ${
                config.clickSoundEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </label>
      </div>

      {/* Section 4: Selected Zoom Keyframe Inspector */}
      <div className="pt-4 border-t border-[#222631]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#F59E0B]">
            <ZoomIn className="w-3.5 h-3.5" />
            <span>Zoom Keyframe</span>
          </div>
          {selectedKeyframe && (
            <button
              type="button"
              onClick={() => onDeleteKeyframe(selectedKeyframe.id)}
              className="text-[11px] text-[#F43F5E] hover:text-rose-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              <span>Delete</span>
            </button>
          )}
        </div>

        {selectedKeyframe ? (
          <div className="space-y-3.5 p-3 rounded-xl bg-[#0A0B0E] border border-[#F59E0B]/30">
            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300">Zoom Depth</span>
                <span className="font-mono text-[#F59E0B] font-semibold">
                  {selectedKeyframe.scale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min={1.4}
                max={3.0}
                step={0.05}
                value={selectedKeyframe.scale}
                onChange={(e) =>
                  onUpdateKeyframe(selectedKeyframe.id, { scale: Number(e.target.value) })
                }
                className="w-full studio-slider studio-slider-amber"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300">Duration</span>
                <span className="font-mono text-zinc-300">
                  {selectedKeyframe.duration.toFixed(1)}s
                </span>
              </div>
              <input
                type="range"
                min={0.5}
                max={6.0}
                step={0.1}
                value={selectedKeyframe.duration}
                onChange={(e) =>
                  onUpdateKeyframe(selectedKeyframe.id, {
                    duration: Number(e.target.value),
                  })
                }
                className="w-full studio-slider studio-slider-amber"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1.5">
                <span className="text-zinc-300">Focus Target</span>
                <span className="font-mono text-[11px] text-zinc-400">
                  {Math.round(selectedKeyframe.targetX * 100)}%,{' '}
                  {Math.round(selectedKeyframe.targetY * 100)}%
                </span>
              </div>
              <div
                onClick={handleTargetPadClick}
                className="relative h-20 rounded-lg bg-[#13151B] border border-[#222631] cursor-crosshair overflow-hidden"
                title="Click to reposition zoom focus point"
              >
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#1E222E_1px,transparent_1px),linear-gradient(to_bottom,#1E222E_1px,transparent_1px)] bg-[size:20%_25%]" />
                <div
                  className="absolute w-3.5 h-3.5 -ml-[7px] -mt-[7px] rounded-full bg-[#F59E0B] border-2 border-[#0A0B0E] shadow-[0_0_10px_#F59E0B]"
                  style={{
                    left: `${selectedKeyframe.targetX * 100}%`,
                    top: `${selectedKeyframe.targetY * 100}%`,
                  }}
                />
              </div>
            </div>

            <label className="flex items-center justify-between pt-1 cursor-pointer">
              <span className="text-xs text-zinc-300">Click Ripple Ring</span>
              <button
                type="button"
                role="switch"
                aria-checked={selectedKeyframe.ripple}
                onClick={() =>
                  onUpdateKeyframe(selectedKeyframe.id, { ripple: !selectedKeyframe.ripple })
                }
                className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
                  selectedKeyframe.ripple ? 'bg-[#F59E0B]' : 'bg-[#222631]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-[#0A0B0E] transition-transform ${
                    selectedKeyframe.ripple ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </label>
          </div>
        ) : (
          <div className="p-3 rounded-xl bg-[#0A0B0E] border border-[#222631] text-xs text-zinc-500 leading-relaxed">
            Click any amber block on the Zoom Track—or click directly on the video canvas—to
            inspect and fine-tune zoom depth, duration, and target focus.
          </div>
        )}
      </div>

      {/* Section 5: Webcam PiP Controls */}
      {hasWebcam && (
        <div className="pt-4 border-t border-[#222631] space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            <Camera className="w-3.5 h-3.5 text-[#38BDF8]" />
            <span>Webcam Bubble</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {CORNERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onConfigChange({ webcamCorner: c.id })}
                className={`h-7 rounded-md text-[11px] font-medium border transition-colors ${
                  config.webcamCorner === c.id
                    ? 'bg-[#1D2432] border-[#38BDF8]/60 text-[#38BDF8]'
                    : 'bg-[#0A0B0E] border-[#222631] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-zinc-300">Bubble Size</span>
              <span className="font-mono text-zinc-400">{config.webcamSize}px</span>
            </div>
            <input
              type="range"
              min={100}
              max={260}
              step={4}
              value={config.webcamSize}
              onChange={(e) => onConfigChange({ webcamSize: Number(e.target.value) })}
              className="w-full studio-slider"
            />
          </div>
        </div>
      )}
    </aside>
  );
};
