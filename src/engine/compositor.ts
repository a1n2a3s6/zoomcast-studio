import {
  BACKDROP_PRESETS,
  type BackdropPreset,
  type CameraState,
  type StudioConfig,
  type ZoomKeyframe,
} from '../types/studio';
import { clamp, evaluateCameraState } from './easing';

export interface FrameGeometry {
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  chromeH: number;
  videoX: number;
  videoY: number;
  videoW: number;
  videoH: number;
  radius: number;
}

export interface SourceCropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: StudioConfig,
  customBackdropImg?: HTMLImageElement | null
): void {
  if (
    config.customBackdropUrl &&
    customBackdropImg &&
    customBackdropImg.complete &&
    customBackdropImg.naturalWidth > 0
  ) {
    const imgW = customBackdropImg.naturalWidth;
    const imgH = customBackdropImg.naturalHeight;
    const coverScale = Math.max(width / imgW, height / imgH);
    const drawW = imgW * coverScale;
    const drawH = imgH * coverScale;
    const drawX = (width - drawW) / 2;
    const drawY = (height - drawH) / 2;
    ctx.drawImage(customBackdropImg, drawX, drawY, drawW, drawH);
    return;
  }

  const preset: BackdropPreset =
    BACKDROP_PRESETS.find((b) => b.id === config.backdropId) ?? BACKDROP_PRESETS[0];

  ctx.fillStyle = preset.baseColor;
  ctx.fillRect(0, 0, width, height);

  if (preset.kind === 'linear' && preset.linearColors) {
    const angleRad = ((preset.angleDeg ?? 135) * Math.PI) / 180;
    const cx = width / 2;
    const cy = height / 2;
    const len = Math.hypot(width, height) / 2;
    const x0 = cx - Math.cos(angleRad) * len;
    const y0 = cy - Math.sin(angleRad) * len;
    const x1 = cx + Math.cos(angleRad) * len;
    const y1 = cy + Math.sin(angleRad) * len;

    const grad = ctx.createLinearGradient(x0, y0, x1, y1);
    grad.addColorStop(0, preset.linearColors[0]);
    if (preset.linearColors[2]) {
      grad.addColorStop(0.55, preset.linearColors[1]);
      grad.addColorStop(1, preset.linearColors[2]);
    } else {
      grad.addColorStop(1, preset.linearColors[1]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (preset.kind === 'mesh' && preset.stops) {
    const maxDim = Math.max(width, height);
    for (const stop of preset.stops) {
      const gx = stop.x * width;
      const gy = stop.y * height;
      const gr = stop.r * maxDim;
      const rad = ctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
      rad.addColorStop(0, stop.color);
      rad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, width, height);
    }
  }
}

export function computeFrameGeometry(
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
  config: StudioConfig
): FrameGeometry {
  const refScale = Math.min(canvasWidth, canvasHeight) / 1080;
  const pad = clamp(config.padding, 0, 120) * refScale;
  const chromeH = config.showWindowChrome ? Math.round(32 * refScale) : 0;
  const radius = clamp(config.borderRadius, 0, 32) * refScale;

  const availW = Math.max(64, canvasWidth - pad * 2);
  const availH = Math.max(64, canvasHeight - pad * 2 - chromeH);

  const safeVideoW = Math.max(1, videoWidth || 16);
  const safeVideoH = Math.max(1, videoHeight || 9);
  const videoAspect = safeVideoW / safeVideoH;

  let videoW = availW;
  let videoH = videoW / videoAspect;
  if (videoH > availH) {
    videoH = availH;
    videoW = videoH * videoAspect;
  }

  const frameW = videoW;
  const frameH = videoH + chromeH;
  const frameX = (canvasWidth - frameW) / 2;
  const frameY = (canvasHeight - frameH) / 2;

  return {
    frameX,
    frameY,
    frameW,
    frameH,
    chromeH,
    videoX: frameX,
    videoY: frameY + chromeH,
    videoW,
    videoH,
    radius,
  };
}

export function computeSourceCrop(
  videoWidth: number,
  videoHeight: number,
  camera: CameraState
): SourceCropRect {
  const scale = Math.max(1, camera.scale);
  const sw = videoWidth / scale;
  const sh = videoHeight / scale;

  const targetPxX = camera.focusX * videoWidth;
  const targetPxY = camera.focusY * videoHeight;

  const sx = clamp(targetPxX - sw / 2, 0, Math.max(0, videoWidth - sw));
  const sy = clamp(targetPxY - sh / 2, 0, Math.max(0, videoHeight - sh));

  return { sx, sy, sw, sh };
}

export function canvasPointToVideoNormalized(
  clientX: number,
  clientY: number,
  canvasRect: DOMRect,
  canvasWidth: number,
  canvasHeight: number,
  videoWidth: number,
  videoHeight: number,
  config: StudioConfig,
  camera: CameraState
): { x: number; y: number } | null {
  if (canvasRect.width <= 0 || canvasRect.height <= 0) return null;

  const px = ((clientX - canvasRect.left) / canvasRect.width) * canvasWidth;
  const py = ((clientY - canvasRect.top) / canvasRect.height) * canvasHeight;

  const geom = computeFrameGeometry(canvasWidth, canvasHeight, videoWidth, videoHeight, config);

  if (
    px < geom.videoX ||
    px > geom.videoX + geom.videoW ||
    py < geom.videoY ||
    py > geom.videoY + geom.videoH
  ) {
    return null;
  }

  const localU = (px - geom.videoX) / geom.videoW;
  const localV = (py - geom.videoY) / geom.videoH;

  const crop = computeSourceCrop(videoWidth, videoHeight, camera);
  const srcX = crop.sx + localU * crop.sw;
  const srcY = crop.sy + localV * crop.sh;

  return {
    x: clamp(srcX / Math.max(1, videoWidth), 0, 1),
    y: clamp(srcY / Math.max(1, videoHeight), 0, 1),
  };
}

function drawWindowChrome(
  ctx: CanvasRenderingContext2D,
  geom: FrameGeometry,
  refScale: number
): void {
  const { frameX, frameY, frameW, chromeH } = geom;

  ctx.fillStyle = '#151820';
  ctx.fillRect(frameX, frameY, frameW, chromeH);

  ctx.fillStyle = '#262B38';
  ctx.fillRect(frameX, frameY + chromeH - Math.max(1, refScale), frameW, Math.max(1, refScale));

  const dotRadius = Math.max(3.2, 5.2 * refScale);
  const dotSpacing = Math.max(11, 18 * refScale);
  const startX = frameX + Math.max(14, 20 * refScale);
  const centerY = frameY + chromeH / 2;

  const colors = ['#F43F5E', '#F59E0B', '#10B981'];
  colors.forEach((color, idx) => {
    ctx.beginPath();
    ctx.arc(startX + idx * dotSpacing, centerY, dotRadius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.88;
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function mapVideoPointToScreen(
  normX: number,
  normY: number,
  videoWidth: number,
  videoHeight: number,
  crop: SourceCropRect,
  geom: FrameGeometry
): { x: number; y: number } {
  const srcX = normX * videoWidth;
  const srcY = normY * videoHeight;
  const u = (srcX - crop.sx) / crop.sw;
  const v = (srcY - crop.sy) / crop.sh;
  return {
    x: geom.videoX + u * geom.videoW,
    y: geom.videoY + v * geom.videoH,
  };
}

function drawSpotlightDimmer(
  ctx: CanvasRenderingContext2D,
  geom: FrameGeometry,
  crop: SourceCropRect,
  videoWidth: number,
  videoHeight: number,
  camera: CameraState,
  dimmerStrength: number
): void {
  const zoomFactor = clamp((camera.scale - 1) / 0.65, 0, 1);
  const alpha = clamp(dimmerStrength, 0, 0.75) * zoomFactor;
  if (alpha <= 0.01) return;

  const center = mapVideoPointToScreen(
    camera.focusX,
    camera.focusY,
    videoWidth,
    videoHeight,
    crop,
    geom
  );
  const innerR = Math.min(geom.videoW, geom.videoH) * 0.24;
  const outerR = Math.hypot(geom.videoW, geom.videoH) * 0.68;

  const grad = ctx.createRadialGradient(center.x, center.y, innerR, center.x, center.y, outerR);
  grad.addColorStop(0, 'rgba(6, 8, 12, 0)');
  grad.addColorStop(0.58, `rgba(6, 8, 12, ${(alpha * 0.45).toFixed(3)})`);
  grad.addColorStop(1, `rgba(6, 8, 12, ${alpha.toFixed(3)})`);

  ctx.save();
  ctx.fillStyle = grad;
  ctx.fillRect(geom.videoX, geom.videoY, geom.videoW, geom.videoH);
  ctx.restore();
}

function drawCursorHalo(
  ctx: CanvasRenderingContext2D,
  geom: FrameGeometry,
  crop: SourceCropRect,
  videoWidth: number,
  videoHeight: number,
  camera: CameraState,
  refScale: number
): void {
  const zoomFactor = clamp((camera.scale - 1) / 0.45, 0, 1);
  if (zoomFactor <= 0.04) return;

  const pos = mapVideoPointToScreen(
    camera.focusX,
    camera.focusY,
    videoWidth,
    videoHeight,
    crop,
    geom
  );
  const haloR = 34 * refScale;

  ctx.save();
  const grad = ctx.createRadialGradient(pos.x, pos.y, 2 * refScale, pos.x, pos.y, haloR);
  grad.addColorStop(0, `rgba(56, 189, 248, ${(0.22 * zoomFactor).toFixed(3)})`);
  grad.addColorStop(0.55, `rgba(245, 158, 11, ${(0.1 * zoomFactor).toFixed(3)})`);
  grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, haloR, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 13 * refScale, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(245, 158, 11, ${(0.42 * zoomFactor).toFixed(3)})`;
  ctx.lineWidth = Math.max(1.2, 1.8 * refScale);
  ctx.stroke();
  ctx.restore();
}

function drawClickRipple(
  ctx: CanvasRenderingContext2D,
  geom: FrameGeometry,
  crop: SourceCropRect,
  videoWidth: number,
  videoHeight: number,
  camera: CameraState,
  refScale: number
): void {
  if (camera.rippleProgress < 0 || camera.rippleProgress > 1) return;

  const pos = mapVideoPointToScreen(
    camera.rippleX,
    camera.rippleY,
    videoWidth,
    videoHeight,
    crop,
    geom
  );

  const p = camera.rippleProgress;
  const easeOut = 1 - Math.pow(1 - p, 3);
  const alpha = Math.max(0, 1 - p);

  const outerRadius = (12 + easeOut * 54) * refScale;
  const innerRadius = (6 + easeOut * 28) * refScale;

  ctx.save();
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, outerRadius, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(56, 189, 248, ${(alpha * 0.92).toFixed(3)})`;
  ctx.lineWidth = Math.max(2, 3.5 * refScale * (1 - p * 0.45));
  ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
  ctx.shadowBlur = 16 * refScale;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, innerRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(245, 158, 11, ${(alpha * 0.34).toFixed(3)})`;
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
}

function drawWebcamBubble(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  webcamEl: HTMLVideoElement,
  config: StudioConfig,
  refScale: number
): void {
  if (webcamEl.readyState < 2 || webcamEl.videoWidth === 0 || webcamEl.videoHeight === 0) {
    return;
  }

  const diameter = clamp(config.webcamSize, 96, 280) * refScale;
  const radius = diameter / 2;
  const margin = Math.max(20, 34 * refScale);

  const cx =
    config.webcamCorner === 'bl' || config.webcamCorner === 'tl'
      ? margin + radius
      : width - margin - radius;
  const cy =
    config.webcamCorner === 'tl' || config.webcamCorner === 'tr'
      ? margin + radius
      : height - margin - radius;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 28 * refScale;
  ctx.shadowOffsetY = 10 * refScale;
  ctx.fillStyle = '#0A0B0E';
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const vw = webcamEl.videoWidth;
  const vh = webcamEl.videoHeight;
  const minSide = Math.min(vw, vh);
  const sx = (vw - minSide) / 2;
  const sy = (vh - minSide) / 2;

  ctx.translate(cx, cy);
  ctx.scale(-1, 1);
  ctx.drawImage(webcamEl, sx, sy, minSide, minSide, -radius, -radius, diameter, diameter);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = Math.max(1.5, 2.5 * refScale);
  ctx.stroke();
  ctx.restore();
}

/**
 * Pure 60fps HTML5 Canvas 2D rendering pipeline with velocity-based micro motion-blur,
 * radial spotlight dimmer on zoom, custom cursor halo, expanding click ripple, and Webcam PiP.
 */
export function renderStudioFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  videoEl: HTMLVideoElement | null,
  webcamEl: HTMLVideoElement | null,
  currentTime: number,
  config: StudioConfig,
  keyframes: ZoomKeyframe[],
  customBackdropImg?: HTMLImageElement | null
): CameraState {
  ctx.clearRect(0, 0, width, height);

  // 1. Studio Backdrop
  drawBackdrop(ctx, width, height, config, customBackdropImg);

  const camera = evaluateCameraState(
    currentTime,
    keyframes,
    config.springStiffness,
    config.springDamping
  );

  if (!videoEl || videoEl.readyState < 2 || videoEl.videoWidth === 0 || videoEl.videoHeight === 0) {
    return camera;
  }

  const refScale = Math.min(width, height) / 1080;
  const vw = videoEl.videoWidth;
  const vh = videoEl.videoHeight;
  const geom = computeFrameGeometry(width, height, vw, vh, config);
  const crop = computeSourceCrop(vw, vh, camera);

  // 2. Multi-layer drop shadow
  const shadowStrength = clamp(config.shadowIntensity, 0, 1);
  if (shadowStrength > 0.01) {
    ctx.save();
    drawRoundedRectPath(ctx, geom.frameX, geom.frameY, geom.frameW, geom.frameH, geom.radius);
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.45 * shadowStrength).toFixed(3)})`;
    ctx.shadowBlur = 72 * refScale * shadowStrength;
    ctx.shadowOffsetY = 26 * refScale * shadowStrength;
    ctx.fillStyle = '#0A0B0E';
    ctx.fill();
    ctx.restore();

    ctx.save();
    drawRoundedRectPath(ctx, geom.frameX, geom.frameY, geom.frameW, geom.frameH, geom.radius);
    ctx.shadowColor = `rgba(0, 0, 0, ${(0.55 * shadowStrength).toFixed(3)})`;
    ctx.shadowBlur = 22 * refScale * shadowStrength;
    ctx.shadowOffsetY = 8 * refScale * shadowStrength;
    ctx.fillStyle = '#0A0B0E';
    ctx.fill();
    ctx.restore();
  }

  // 3. Clipped Rounded Frame + Optional Chrome + Zoomed Video (with velocity micro-blur)
  ctx.save();
  drawRoundedRectPath(ctx, geom.frameX, geom.frameY, geom.frameW, geom.frameH, geom.radius);
  ctx.clip();

  if (config.showWindowChrome) {
    drawWindowChrome(ctx, geom, refScale);
  }

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Velocity-based micro motion-blur during rapid zoom/pan glides
  if (config.motionBlurEnabled && camera.velocity > 0.22) {
    const blurPx = clamp((camera.velocity - 0.22) * 1.15 * refScale, 0, 3.2 * refScale);
    if (blurPx > 0.18) {
      ctx.filter = `blur(${blurPx.toFixed(2)}px)`;
    }
  }

  ctx.drawImage(
    videoEl,
    crop.sx,
    crop.sy,
    crop.sw,
    crop.sh,
    geom.videoX,
    geom.videoY,
    geom.videoW,
    geom.videoH
  );
  ctx.filter = 'none';
  ctx.restore();

  // 4. Cinematic Spotlight Dimmer on Zoom
  if (config.spotlightDimmer > 0.01) {
    drawSpotlightDimmer(ctx, geom, crop, vw, vh, camera, config.spotlightDimmer);
  }

  // 5. Custom Subtle Cursor Halo
  if (config.cursorHaloEnabled) {
    drawCursorHalo(ctx, geom, crop, vw, vh, camera, refScale);
  }

  // 6. Expanding Click Ripple Ring
  drawClickRipple(ctx, geom, crop, vw, vh, camera, refScale);
  ctx.restore();

  // Subtle 1px specular border around frame
  ctx.save();
  drawRoundedRectPath(ctx, geom.frameX, geom.frameY, geom.frameW, geom.frameH, geom.radius);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.11)';
  ctx.lineWidth = Math.max(1, 1.2 * refScale);
  ctx.stroke();
  ctx.restore();

  // 7. Optional Circular Floating Webcam PiP Bubble
  if (webcamEl) {
    drawWebcamBubble(ctx, width, height, webcamEl, config, refScale);
  }

  return camera;
}
