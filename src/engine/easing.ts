import type { CameraState, ZoomKeyframe } from '../types/studio';

const RIPPLE_DURATION_SEC = 0.65;
const MAX_RAMP_IN_SEC = 0.48;
const MAX_RAMP_OUT_SEC = 0.52;
const BLEND_GAP_THRESHOLD_SEC = 0.65;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Smooth cubic ease-in-out curve for camera zoom and pan glides.
 */
export function easeInOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * Analytical spring-damped response curve parameterized by `stiffness` and `damping`.
 * Produces silky Screen Studio-like camera settles with configurable tightness.
 */
export function evaluateSpringProgress(
  t: number,
  stiffness = 210,
  damping = 24
): number {
  const x = clamp(t, 0, 1);
  if (x === 0 || x === 1) return x;

  const omega0 = Math.sqrt(Math.max(40, stiffness));
  const zeta = clamp(damping / (2 * omega0), 0.55, 1.45);
  // Map normalized progress [0..1] onto a 0.65s physical settle window
  const tau = x * 0.65;

  let raw: number;
  let endVal: number;
  const tauEnd = 0.65;

  if (zeta < 1) {
    const omegaD = omega0 * Math.sqrt(1 - zeta * zeta);
    const phi = (zeta * omega0) / omegaD;
    raw = 1 - Math.exp(-zeta * omega0 * tau) * (Math.cos(omegaD * tau) + phi * Math.sin(omegaD * tau));
    endVal =
      1 -
      Math.exp(-zeta * omega0 * tauEnd) *
        (Math.cos(omegaD * tauEnd) + phi * Math.sin(omegaD * tauEnd));
  } else {
    // Critically damped or overdamped
    raw = 1 - Math.exp(-omega0 * tau) * (1 + omega0 * tau);
    endVal = 1 - Math.exp(-omega0 * tauEnd) * (1 + omega0 * tauEnd);
  }

  return clamp(raw / Math.max(0.0001, endVal), 0, 1.03);
}

function keyframeEnvelope(
  t: number,
  kf: ZoomKeyframe,
  skipRampIn: boolean,
  skipRampOut: boolean,
  stiffness: number,
  damping: number
): number {
  const start = kf.startTime;
  const end = kf.startTime + Math.max(0.25, kf.duration);
  if (t <= start || t >= end) return 0;

  const rampIn = Math.min(MAX_RAMP_IN_SEC, kf.duration * 0.32);
  const rampOut = Math.min(MAX_RAMP_OUT_SEC, kf.duration * 0.32);

  if (!skipRampIn && t < start + rampIn) {
    return evaluateSpringProgress((t - start) / Math.max(0.001, rampIn), stiffness, damping);
  }

  if (!skipRampOut && t > end - rampOut) {
    const outProgress = (t - (end - rampOut)) / Math.max(0.001, rampOut);
    return 1 - easeInOutCubic(outProgress);
  }

  return 1;
}

interface RawCameraSample {
  scale: number;
  focusX: number;
  focusY: number;
  rippleProgress: number;
  rippleX: number;
  rippleY: number;
  activeKeyframeId: string | null;
}

function sampleRawCamera(
  currentTime: number,
  sorted: ZoomKeyframe[],
  stiffness: number,
  damping: number
): RawCameraSample {
  if (sorted.length === 0) {
    return {
      scale: 1,
      focusX: 0.5,
      focusY: 0.5,
      rippleProgress: -1,
      rippleX: 0.5,
      rippleY: 0.5,
      activeKeyframeId: null,
    };
  }

  // Smooth bridge between closely spaced consecutive keyframes
  for (let i = 0; i < sorted.length - 1; i++) {
    const prev = sorted[i];
    const next = sorted[i + 1];
    const prevEnd = prev.startTime + Math.max(0.25, prev.duration);
    const gap = next.startTime - prevEnd;

    if (gap >= 0 && gap <= BLEND_GAP_THRESHOLD_SEC && currentTime >= prevEnd && currentTime <= next.startTime) {
      const bridgeT = gap < 0.001 ? 1 : easeInOutCubic((currentTime - prevEnd) / gap);
      return {
        scale: lerp(prev.scale, next.scale, bridgeT),
        focusX: lerp(prev.targetX, next.targetX, bridgeT),
        focusY: lerp(prev.targetY, next.targetY, bridgeT),
        rippleProgress: -1,
        rippleX: next.targetX,
        rippleY: next.targetY,
        activeKeyframeId: bridgeT < 0.5 ? prev.id : next.id,
      };
    }
  }

  let activeIndex = -1;
  for (let i = 0; i < sorted.length; i++) {
    const kf = sorted[i];
    const end = kf.startTime + Math.max(0.25, kf.duration);
    if (currentTime >= kf.startTime && currentTime <= end) {
      activeIndex = i;
    }
  }

  if (activeIndex === -1) {
    return {
      scale: 1,
      focusX: 0.5,
      focusY: 0.5,
      rippleProgress: -1,
      rippleX: 0.5,
      rippleY: 0.5,
      activeKeyframeId: null,
    };
  }

  const active = sorted[activeIndex];
  const prev = activeIndex > 0 ? sorted[activeIndex - 1] : null;
  const next = activeIndex < sorted.length - 1 ? sorted[activeIndex + 1] : null;

  const prevEnd = prev ? prev.startTime + Math.max(0.25, prev.duration) : -Infinity;
  const activeEnd = active.startTime + Math.max(0.25, active.duration);

  const bridgedFromPrev =
    prev !== null &&
    active.startTime - prevEnd >= -prev.duration &&
    active.startTime - prevEnd <= BLEND_GAP_THRESHOLD_SEC;

  const bridgedToNext =
    next !== null &&
    next.startTime - activeEnd >= -active.duration &&
    next.startTime - activeEnd <= BLEND_GAP_THRESHOLD_SEC;

  let scale: number;
  let focusX: number;
  let focusY: number;

  const rampIn = Math.min(MAX_RAMP_IN_SEC, active.duration * 0.32);
  const elapsed = currentTime - active.startTime;

  if (bridgedFromPrev && prev !== null && elapsed < rampIn) {
    const glideT = evaluateSpringProgress(elapsed / Math.max(0.001, rampIn), stiffness, damping);
    scale = lerp(prev.scale, active.scale, glideT);
    focusX = lerp(prev.targetX, active.targetX, glideT);
    focusY = lerp(prev.targetY, active.targetY, glideT);
  } else {
    const env = keyframeEnvelope(
      currentTime,
      active,
      bridgedFromPrev,
      bridgedToNext,
      stiffness,
      damping
    );
    scale = lerp(1, active.scale, env);
    focusX = lerp(0.5, active.targetX, env);
    focusY = lerp(0.5, active.targetY, env);
  }

  let rippleProgress = -1;
  if (active.ripple && elapsed >= 0 && elapsed <= RIPPLE_DURATION_SEC) {
    rippleProgress = clamp(elapsed / RIPPLE_DURATION_SEC, 0, 1);
  }

  return {
    scale: Math.max(1, scale),
    focusX: clamp(focusX, 0, 1),
    focusY: clamp(focusY, 0, 1),
    rippleProgress,
    rippleX: active.targetX,
    rippleY: active.targetY,
    activeKeyframeId: active.id,
  };
}

/**
 * Evaluates the spring-damped camera state (`scale`, `focusX`, `focusY`,
 * instantaneous `velocity` for motion blur, and click ripple progress) at `currentTime`.
 */
export function evaluateCameraState(
  currentTime: number,
  keyframes: ZoomKeyframe[],
  springStiffness = 210,
  springDamping = 24
): CameraState {
  if (keyframes.length === 0) {
    return {
      scale: 1,
      focusX: 0.5,
      focusY: 0.5,
      velocity: 0,
      rippleProgress: -1,
      rippleX: 0.5,
      rippleY: 0.5,
      activeKeyframeId: null,
    };
  }

  const sorted = [...keyframes].sort((a, b) => a.startTime - b.startTime);
  const center = sampleRawCamera(currentTime, sorted, springStiffness, springDamping);

  // Finite-difference instantaneous camera velocity for real-time micro motion-blur
  const dt = 0.016;
  const before = sampleRawCamera(Math.max(0, currentTime - dt), sorted, springStiffness, springDamping);
  const after = sampleRawCamera(currentTime + dt, sorted, springStiffness, springDamping);

  const dScale = Math.abs(after.scale - before.scale) / (2 * dt);
  const dPan = Math.hypot(after.focusX - before.focusX, after.focusY - before.focusY) / (2 * dt);
  const velocity = dScale * 0.85 + dPan * 2.4;

  return {
    ...center,
    velocity,
  };
}
