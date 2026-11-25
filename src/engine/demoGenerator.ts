import type { RecordingClip, ZoomKeyframe } from '../types/studio';

export interface DemoClipResult {
  clip: RecordingClip;
  keyframes: ZoomKeyframe[];
}

const CODE_LINES: Array<{ indent: number; tokens: Array<{ text: string; color: string }> }> = [
  {
    indent: 0,
    tokens: [
      { text: 'export function ', color: '#F43F5E' },
      { text: 'evaluateCamera', color: '#38BDF8' },
      { text: '(t: ', color: '#94A3B8' },
      { text: 'number', color: '#F59E0B' },
      { text: ', keys: ', color: '#94A3B8' },
      { text: 'ZoomKeyframe[]', color: '#10B981' },
      { text: ') {', color: '#94A3B8' },
    ],
  },
  {
    indent: 1,
    tokens: [
      { text: 'const ', color: '#F43F5E' },
      { text: 'active ', color: '#E2E8F0' },
      { text: '= keys.find((k) => t >= k.startTime && t <= k.endTime);', color: '#94A3B8' },
    ],
  },
  {
    indent: 1,
    tokens: [
      { text: 'if ', color: '#F43F5E' },
      { text: '(!active) ', color: '#E2E8F0' },
      { text: 'return ', color: '#F43F5E' },
      { text: '{ scale: 1.0, focusX: 0.5, focusY: 0.5 };', color: '#10B981' },
    ],
  },
  {
    indent: 1,
    tokens: [
      { text: 'const ', color: '#F43F5E' },
      { text: 'ease ', color: '#E2E8F0' },
      { text: '= easeInOutCubic((t - active.startTime) / 0.42);', color: '#38BDF8' },
    ],
  },
  {
    indent: 1,
    tokens: [
      { text: 'return ', color: '#F43F5E' },
      { text: '{', color: '#94A3B8' },
    ],
  },
  {
    indent: 2,
    tokens: [
      { text: 'scale: ', color: '#E2E8F0' },
      { text: 'lerp(1.0, active.scale, ease),', color: '#F59E0B' },
    ],
  },
  {
    indent: 2,
    tokens: [
      { text: 'focusX: ', color: '#E2E8F0' },
      { text: 'clamp(active.targetX, 0, 1),', color: '#38BDF8' },
    ],
  },
  {
    indent: 2,
    tokens: [
      { text: 'focusY: ', color: '#E2E8F0' },
      { text: 'clamp(active.targetY, 0, 1),', color: '#38BDF8' },
    ],
  },
  {
    indent: 1,
    tokens: [{ text: '};', color: '#94A3B8' }],
  },
  {
    indent: 0,
    tokens: [{ text: '}', color: '#94A3B8' }],
  },
];

function drawCursor(ctx: CanvasRenderingContext2D, x: number, y: number, clicking: boolean): void {
  ctx.save();
  ctx.translate(x, y);
  if (clicking) {
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, 22);
  ctx.lineTo(6, 17);
  ctx.lineTo(11, 25);
  ctx.lineTo(14.5, 23);
  ctx.lineTo(9.5, 15);
  ctx.lineTo(17, 15);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.strokeStyle = '#0A0B0E';
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCodeEditorFrame(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  // Base dark IDE canvas
  ctx.fillStyle = '#0D1017';
  ctx.fillRect(0, 0, w, h);

  // Left sidebar
  ctx.fillStyle = '#111520';
  ctx.fillRect(0, 0, 230, h);
  ctx.fillStyle = '#1E2433';
  ctx.fillRect(230, 0, 1, h);

  // Sidebar header
  ctx.fillStyle = '#64748B';
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillText('EXPLORER — ZOOMCAST', 20, 34);

  const files = [
    { name: 'src/engine/easing.ts', active: true },
    { name: 'src/engine/compositor.ts', active: false },
    { name: 'src/engine/exporter.ts', active: false },
    { name: 'src/components/Timeline.tsx', active: false },
  ];
  files.forEach((file, i) => {
    const y = 66 + i * 32;
    if (file.active) {
      ctx.fillStyle = '#1B2232';
      ctx.fillRect(10, y - 18, 210, 26);
      ctx.fillStyle = '#38BDF8';
      ctx.fillRect(10, y - 18, 3, 26);
    }
    ctx.fillStyle = file.active ? '#F8FAFC' : '#94A3B8';
    ctx.font = '500 13px "JetBrains Mono", monospace';
    ctx.fillText(file.name, 24, y);
  });

  // Top tab bar
  ctx.fillStyle = '#111520';
  ctx.fillRect(231, 0, w - 231, 46);
  ctx.fillStyle = '#1E2433';
  ctx.fillRect(231, 46, w - 231, 1);

  // Active tab
  ctx.fillStyle = '#0D1017';
  ctx.fillRect(231, 0, 195, 46);
  ctx.fillStyle = '#38BDF8';
  ctx.fillRect(231, 0, 195, 2);
  ctx.fillStyle = '#F1F5F9';
  ctx.font = '500 13px "JetBrains Mono", monospace';
  ctx.fillText('easing.ts', 256, 28);

  // "Run 60fps Suite" button in top right
  const btnX = w - 208;
  const btnY = 9;
  const btnW = 180;
  const btnH = 28;
  const testsRunning = t >= 4.2;
  const testsPassed = t >= 5.3;

  ctx.fillStyle = testsPassed ? '#10B981' : testsRunning ? '#F59E0B' : '#1E293B';
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnW, btnH, 6);
  ctx.fill();
  ctx.fillStyle = testsPassed || testsRunning ? '#0A0B0E' : '#F8FAFC';
  ctx.font = '600 12px Inter, sans-serif';
  ctx.fillText(
    testsPassed ? '✓ All 60fps Tests Passed' : testsRunning ? '● Running Benchmarks...' : '▶ Run 60fps Suite',
    btnX + 16,
    btnY + 18
  );

  // Code area with progressive typing animation in first 3.6 seconds
  const totalCharsToShow = Math.floor(Math.min(1, t / 3.4) * 420);
  let consumed = 0;

  ctx.font = '400 16px "JetBrains Mono", monospace';
  CODE_LINES.forEach((line, lineIdx) => {
    const y = 92 + lineIdx * 34;

    // Line number
    ctx.fillStyle = '#475569';
    ctx.fillText(String(lineIdx + 1).padStart(2, ' '), 252, y);

    let x = 294 + line.indent * 26;
    for (const token of line.tokens) {
      if (consumed >= totalCharsToShow) break;
      const remaining = totalCharsToShow - consumed;
      const slice = token.text.slice(0, remaining);
      ctx.fillStyle = token.color;
      ctx.fillText(slice, x, y);
      x += ctx.measureText(slice).width;
      consumed += token.text.length;
    }

    // Blinking typing caret on active line
    if (consumed >= totalCharsToShow && consumed - totalCharsToShow < 40 && t < 3.8) {
      if (Math.floor(t * 4) % 2 === 0) {
        ctx.fillStyle = '#38BDF8';
        ctx.fillRect(x + 2, y - 15, 2, 20);
      }
    }
  });

  // Bottom terminal panel
  const termTop = h - 220;
  ctx.fillStyle = '#090B10';
  ctx.fillRect(231, termTop, w - 231, 220);
  ctx.fillStyle = '#1E2433';
  ctx.fillRect(231, termTop, w - 231, 1);

  ctx.fillStyle = '#64748B';
  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillText('TERMINAL — LOCAL RENDER ENGINE', 252, termTop + 26);

  ctx.font = '400 14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText('$ npm run verify:compositor', 252, termTop + 58);

  if (t >= 4.4) {
    ctx.fillStyle = '#38BDF8';
    ctx.fillText('› Testing spring-damped zoom interpolation (0.0s → 8.0s)...', 252, termTop + 88);
  }
  if (t >= 5.1) {
    ctx.fillStyle = '#10B981';
    ctx.fillText('✓ 480/480 frames rendered @ 60.0 fps (0 dropped, 0 watermarks)', 252, termTop + 118);
  }
  if (t >= 5.7) {
    ctx.fillStyle = '#10B981';
    ctx.fillText('✓ Viewport bounds clamp verified — zero edge gaps at 2.4x zoom', 252, termTop + 148);
  }
  if (t >= 6.3) {
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('★ Ready for local 1080p MP4 / WebM export', 252, termTop + 178);
  }

  // Animated mouse cursor traveling from code line 4 → Run button → Terminal output
  let cx = 560;
  let cy = 220;
  let clicking = false;

  if (t < 1.2) {
    cx = 420 + (t / 1.2) * 140;
    cy = 180 + (t / 1.2) * 40;
  } else if (t < 3.8) {
    cx = 560 + Math.sin(t * 2) * 18;
    cy = 220;
  } else if (t < 4.35) {
    const p = (t - 3.8) / 0.55;
    const ease = 1 - Math.pow(1 - p, 3);
    cx = 560 + (btnX + 90 - 560) * ease;
    cy = 220 + (btnY + 14 - 220) * ease;
    clicking = t >= 4.18 && t <= 4.35;
  } else if (t < 5.5) {
    const p = Math.min(1, (t - 4.35) / 0.8);
    const ease = 1 - Math.pow(1 - p, 3);
    cx = btnX + 90 + (540 - (btnX + 90)) * ease;
    cy = btnY + 14 + (termTop + 118 - (btnY + 14)) * ease;
  } else {
    cx = 540;
    cy = termTop + 118;
  }

  drawCursor(ctx, cx, cy, clicking);
}

/**
 * Synthesizes an 8-second animated code-editor demo clip purely in-browser
 * using an offscreen Canvas + MediaRecorder, returning both the playable Blob
 * clip and 2 pre-aligned ZoomKeyframes so users can immediately test the NLE.
 */
export async function generateSampleDemoClip(
  onProgress?: (percent: number) => void
): Promise<DemoClipResult> {
  const width = 1280;
  const height = 720;
  const durationSec = 8;
  const fps = 30;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D context unavailable for demo synthesis.');
  }

  const mimeCandidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType =
    mimeCandidates.find(
      (m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)
    ) ?? 'video/webm';

  const stream = canvas.captureStream(fps);
  const chunks: Blob[] = [];
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 6_000_000,
  });

  recorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      chunks.push(ev.data);
    }
  };

  return new Promise<DemoClipResult>((resolve, reject) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);

      const clip: RecordingClip = {
        id: `demo-${Date.now()}`,
        name: 'ZoomCast_CodeEditor_Demo.webm',
        url,
        duration: durationSec,
        width,
        height,
        source: 'demo',
        webcamUrl: null,
        hasAudio: false,
      };

      const keyframes: ZoomKeyframe[] = [
        {
          id: 'kf-demo-1',
          startTime: 1.1,
          duration: 2.3,
          scale: 2.0,
          targetX: 0.44,
          targetY: 0.3,
          ripple: true,
        },
        {
          id: 'kf-demo-2',
          startTime: 4.05,
          duration: 1.5,
          scale: 2.35,
          targetX: 0.89,
          targetY: 0.04,
          ripple: true,
        },
        {
          id: 'kf-demo-3',
          startTime: 5.55,
          duration: 1.9,
          scale: 1.85,
          targetX: 0.46,
          targetY: 0.84,
          ripple: true,
        },
      ];

      resolve({ clip, keyframes });
    };

    recorder.onerror = () => {
      reject(new Error('Failed to synthesize sample demo clip.'));
    };

    recorder.start(200);
    const startWall = performance.now();

    const step = () => {
      const elapsedSec = (performance.now() - startWall) / 1000;
      const clampedT = Math.min(durationSec, elapsedSec);

      drawCodeEditorFrame(ctx, width, height, clampedT);
      onProgress?.(Math.min(99, Math.round((clampedT / durationSec) * 100)));

      if (elapsedSec >= durationSec) {
        onProgress?.(100);
        recorder.stop();
        return;
      }
      requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  });
}
