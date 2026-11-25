export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:3';

export type PlaybackSpeed = 1 | 1.25 | 1.5 | 2;

export type WebcamCorner = 'br' | 'bl' | 'tr' | 'tl';

export type ExportPresetId = '4k-60' | '1080p-60' | 'reels-60' | 'github-loop';

export interface ZoomKeyframe {
  id: string;
  startTime: number;
  duration: number;
  /** Zoom magnification factor clamped between 1.4 and 3.0 */
  scale: number;
  /** Normalized horizontal focus target in video coordinates (0..1) */
  targetX: number;
  /** Normalized vertical focus target in video coordinates (0..1) */
  targetY: number;
  /** Show expanding click ripple ring when entering this keyframe */
  ripple: boolean;
}

export interface StudioConfig {
  aspectRatio: AspectRatio;
  backdropId: string;
  customBackdropUrl: string | null;
  /** Canvas outer padding in px (0–120) */
  padding: number;
  /** Video frame corner radius in px (0–32) */
  borderRadius: number;
  /** Multi-layer drop shadow intensity (0–1) */
  shadowIntensity: number;
  /** Render minimalist macOS-style dark window chrome bar */
  showWindowChrome: boolean;
  playbackSpeed: PlaybackSpeed;
  /** Trimmed clip in-point in seconds */
  trimStart: number;
  /** Trimmed clip out-point in seconds */
  trimEnd: number;
  webcamCorner: WebcamCorner;
  /** Diameter of circular webcam PiP bubble in reference 1080p pixels (100–260) */
  webcamSize: number;
  /** Cinematic radial vignette/spotlight dimmer around zoomed target (0–0.75) */
  spotlightDimmer: number;
  /** Velocity-based micro-blur during rapid zoom/pan transitions */
  motionBlurEnabled: boolean;
  /** Spring-damped camera stiffness (120–360) */
  springStiffness: number;
  /** Spring-damped camera damping (14–36) */
  springDamping: number;
  /** Custom subtle glowing cursor halo around active zoom target */
  cursorHaloEnabled: boolean;
  /** Synthesized tactile click sound synced to zoom keyframes */
  clickSoundEnabled: boolean;
  /** Active hardware-accelerated export preset */
  exportPreset: ExportPresetId;
  /** Target video bitrate in Mbps (8–20) */
  exportBitrateMbps: number;
}

export interface BackdropMeshStop {
  x: number;
  y: number;
  r: number;
  color: string;
}

export interface BackdropPreset {
  id: string;
  name: string;
  previewCss: string;
  kind: 'solid' | 'mesh' | 'linear';
  baseColor: string;
  stops?: BackdropMeshStop[];
  angleDeg?: number;
  linearColors?: [string, string, string?];
}

export interface RecordingClip {
  id: string;
  name: string;
  url: string;
  duration: number;
  width: number;
  height: number;
  source: 'recorded' | 'imported' | 'demo';
  webcamUrl: string | null;
  hasAudio: boolean;
}

export interface CameraState {
  scale: number;
  focusX: number;
  focusY: number;
  /** Instantaneous combined zoom + pan velocity for micro-blur */
  velocity: number;
  /** 0..1 while click ripple is active, -1 when inactive */
  rippleProgress: number;
  rippleX: number;
  rippleY: number;
  activeKeyframeId: string | null;
}

export interface ExportProgress {
  active: boolean;
  progress: number;
  phase: 'preparing' | 'rendering' | 'finalizing' | 'done' | 'error';
  mimeType: string;
  message: string;
  currentFps: number;
  droppedFrames: number;
  renderedFrames: number;
}

export interface CaptureOptions {
  includeMic: boolean;
  includeWebcam: boolean;
}

export interface ExportPresetInfo {
  id: ExportPresetId;
  label: string;
  badge: string;
  description: string;
  fps: number;
  format: 'video' | 'gif';
  scaleFactor: number;
  overrideAspect?: AspectRatio;
}

export const EXPORT_PRESETS: Record<ExportPresetId, ExportPresetInfo> = {
  '1080p-60': {
    id: '1080p-60',
    label: '1080p Pro 60fps',
    badge: 'FHD · 60fps',
    description: 'High-bitrate 1080p MP4/WebM with audio',
    fps: 60,
    format: 'video',
    scaleFactor: 1,
  },
  '4k-60': {
    id: '4k-60',
    label: '4K UHD 60fps',
    badge: '4K · 60fps',
    description: 'Ultra-crisp 2160p Retina master export',
    fps: 60,
    format: 'video',
    scaleFactor: 2,
  },
  'reels-60': {
    id: 'reels-60',
    label: '9:16 Reels 60fps',
    badge: '9:16 · 60fps',
    description: 'Vertical 1080×1920 for Reels, Shorts & TikTok',
    fps: 60,
    format: 'video',
    scaleFactor: 1,
    overrideAspect: '9:16',
  },
  'github-loop': {
    id: 'github-loop',
    label: 'GitHub README Loop GIF',
    badge: 'GIF · 15fps',
    description: 'Self-contained animated GIF89a loop for docs & READMEs',
    fps: 15,
    format: 'gif',
    scaleFactor: 0.45,
  },
};

export const ASPECT_DIMENSIONS: Record<
  AspectRatio,
  { width: number; height: number; label: string; shortLabel: string }
> = {
  '16:9': { width: 1920, height: 1080, label: '16:9 Landscape', shortLabel: '16:9' },
  '9:16': { width: 1080, height: 1920, label: '9:16 Reels', shortLabel: '9:16' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square', shortLabel: '1:1' },
  '4:3': { width: 1440, height: 1080, label: '4:3 Classic', shortLabel: '4:3' },
};

export const BACKDROP_PRESETS: BackdropPreset[] = [
  {
    id: 'nordic-fjord',
    name: 'Nordic Fjord',
    kind: 'mesh',
    baseColor: '#0A131C',
    previewCss:
      'radial-gradient(circle at 20% 20%, #0E7490 0%, transparent 55%), radial-gradient(circle at 82% 78%, #155E75 0%, transparent 55%), #0A131C',
    stops: [
      { x: 0.18, y: 0.22, r: 0.65, color: 'rgba(14, 116, 144, 0.72)' },
      { x: 0.84, y: 0.78, r: 0.68, color: 'rgba(21, 94, 117, 0.65)' },
      { x: 0.55, y: 0.12, r: 0.5, color: 'rgba(56, 189, 248, 0.22)' },
    ],
  },
  {
    id: 'graphite-mist',
    name: 'Graphite Mist',
    kind: 'mesh',
    baseColor: '#11141B',
    previewCss:
      'radial-gradient(circle at 25% 25%, #334155 0%, transparent 60%), radial-gradient(circle at 80% 80%, #1E293B 0%, transparent 60%), #11141B',
    stops: [
      { x: 0.22, y: 0.24, r: 0.65, color: 'rgba(71, 85, 105, 0.55)' },
      { x: 0.82, y: 0.78, r: 0.7, color: 'rgba(30, 41, 59, 0.72)' },
      { x: 0.5, y: 0.5, r: 0.45, color: 'rgba(148, 163, 184, 0.14)' },
    ],
  },
  {
    id: 'amber-dusk',
    name: 'Amber Dusk',
    kind: 'mesh',
    baseColor: '#160F0B',
    previewCss:
      'radial-gradient(circle at 18% 24%, #B45309 0%, transparent 58%), radial-gradient(circle at 82% 80%, #7C2D12 0%, transparent 58%), #160F0B',
    stops: [
      { x: 0.2, y: 0.22, r: 0.65, color: 'rgba(217, 119, 6, 0.58)' },
      { x: 0.8, y: 0.8, r: 0.68, color: 'rgba(154, 52, 18, 0.66)' },
      { x: 0.55, y: 0.35, r: 0.45, color: 'rgba(245, 158, 11, 0.22)' },
    ],
  },
  {
    id: 'emerald-pine',
    name: 'Emerald Pine',
    kind: 'mesh',
    baseColor: '#071410',
    previewCss:
      'radial-gradient(circle at 22% 20%, #047857 0%, transparent 58%), radial-gradient(circle at 82% 82%, #064E3B 0%, transparent 60%), #071410',
    stops: [
      { x: 0.22, y: 0.22, r: 0.65, color: 'rgba(16, 185, 129, 0.44)' },
      { x: 0.82, y: 0.82, r: 0.68, color: 'rgba(6, 95, 70, 0.68)' },
      { x: 0.5, y: 0.18, r: 0.45, color: 'rgba(52, 211, 153, 0.16)' },
    ],
  },
  {
    id: 'crimson-velvet',
    name: 'Crimson Velvet',
    kind: 'mesh',
    baseColor: '#160A0E',
    previewCss:
      'radial-gradient(circle at 20% 25%, #9F1239 0%, transparent 58%), radial-gradient(circle at 80% 78%, #4C0519 0%, transparent 60%), #160A0E',
    stops: [
      { x: 0.2, y: 0.24, r: 0.62, color: 'rgba(190, 18, 60, 0.54)' },
      { x: 0.8, y: 0.78, r: 0.68, color: 'rgba(136, 19, 55, 0.62)' },
      { x: 0.62, y: 0.2, r: 0.44, color: 'rgba(244, 63, 94, 0.2)' },
    ],
  },
  {
    id: 'cobalt-studio',
    name: 'Cobalt Studio',
    kind: 'mesh',
    baseColor: '#091122',
    previewCss:
      'radial-gradient(circle at 18% 20%, #1D4ED8 0%, transparent 58%), radial-gradient(circle at 84% 80%, #0369A1 0%, transparent 58%), #091122',
    stops: [
      { x: 0.18, y: 0.22, r: 0.65, color: 'rgba(37, 99, 235, 0.58)' },
      { x: 0.82, y: 0.8, r: 0.68, color: 'rgba(3, 105, 161, 0.6)' },
      { x: 0.5, y: 0.5, r: 0.5, color: 'rgba(56, 189, 248, 0.16)' },
    ],
  },
  {
    id: 'champagne-stone',
    name: 'Champagne Stone',
    kind: 'linear',
    baseColor: '#24201B',
    angleDeg: 135,
    linearColors: ['#2C2620', '#574E44', '#A89B8C'],
    previewCss: 'linear-gradient(135deg, #2C2620 0%, #574E44 52%, #A89B8C 100%)',
  },
  {
    id: 'terracotta-clay',
    name: 'Terracotta Clay',
    kind: 'linear',
    baseColor: '#1E110C',
    angleDeg: 140,
    linearColors: ['#1C100B', '#9A3412', '#EA580C'],
    previewCss: 'linear-gradient(140deg, #1C100B 0%, #9A3412 56%, #EA580C 100%)',
  },
  {
    id: 'obsidian-matte',
    name: 'Solid Obsidian',
    kind: 'solid',
    baseColor: '#0A0B0E',
    previewCss: '#0A0B0E',
  },
];

export const DEFAULT_STUDIO_CONFIG: StudioConfig = {
  aspectRatio: '16:9',
  backdropId: 'nordic-fjord',
  customBackdropUrl: null,
  padding: 56,
  borderRadius: 16,
  shadowIntensity: 0.72,
  showWindowChrome: true,
  playbackSpeed: 1,
  trimStart: 0,
  trimEnd: 8,
  webcamCorner: 'br',
  webcamSize: 164,
  spotlightDimmer: 0.35,
  motionBlurEnabled: true,
  springStiffness: 210,
  springDamping: 24,
  cursorHaloEnabled: true,
  clickSoundEnabled: true,
  exportPreset: '1080p-60',
  exportBitrateMbps: 14,
};
