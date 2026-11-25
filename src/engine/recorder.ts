import type { CaptureOptions, RecordingClip } from '../types/studio';

export interface ActiveRecordingSession {
  screenStream: MediaStream;
  webcamStream: MediaStream | null;
  stop: () => Promise<RecordingClip>;
}

function pickBestRecordingMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9',
    'video/webm',
    'video/mp4',
  ];
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      return mime;
    }
  }
  return '';
}

function readVideoMetadata(url: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.src = url;

    const finalize = () => {
      const duration =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
      const width = video.videoWidth || 1920;
      const height = video.videoHeight || 1080;
      video.src = '';
      resolve({ duration, width, height });
    };

    video.onloadedmetadata = () => {
      // Chrome MediaRecorder WebM blobs sometimes report Infinity duration until seeked
      if (!Number.isFinite(video.duration) || video.duration === Infinity) {
        video.currentTime = 1e6;
        video.ontimeupdate = () => {
          video.ontimeupdate = null;
          video.currentTime = 0;
          finalize();
        };
      } else {
        finalize();
      }
    };

    video.onerror = () => {
      resolve({ duration: 0, width: 1920, height: 1080 });
    };
  });
}

/**
 * Starts a local browser screen recording session via `getDisplayMedia`,
 * optionally mixing microphone audio via Web Audio API and recording a
 * synchronized webcam PiP stream in parallel.
 */
export async function startScreenRecording(
  options: CaptureOptions,
  onExternalStop?: () => void
): Promise<ActiveRecordingSession> {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
    throw new Error('Screen capture is not supported in this browser.');
  }

  const displayStream = await navigator.mediaDevices.getDisplayMedia({
    video: {
      frameRate: { ideal: 60, max: 60 },
    },
    audio: true,
  });

  let micStream: MediaStream | null = null;
  let webcamStream: MediaStream | null = null;
  let audioCtx: AudioContext | null = null;

  if (options.includeMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch {
      // Continue gracefully without microphone if permission is denied
      micStream = null;
    }
  }

  if (options.includeWebcam) {
    try {
      webcamStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 30 },
          facingMode: 'user',
        },
        audio: false,
      });
    } catch {
      webcamStream = null;
    }
  }

  // Combine screen video + mixed system/mic audio tracks
  const combinedTracks: MediaStreamTrack[] = [...displayStream.getVideoTracks()];
  const displayAudioTracks = displayStream.getAudioTracks();
  const micAudioTracks = micStream ? micStream.getAudioTracks() : [];
  let hasAudio = false;

  if (displayAudioTracks.length > 0 && micAudioTracks.length > 0) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    const sysSource = audioCtx.createMediaStreamSource(new MediaStream(displayAudioTracks));
    const micSource = audioCtx.createMediaStreamSource(new MediaStream(micAudioTracks));
    sysSource.connect(dest);
    micSource.connect(dest);
    dest.stream.getAudioTracks().forEach((track) => combinedTracks.push(track));
    hasAudio = true;
  } else if (displayAudioTracks.length > 0) {
    displayAudioTracks.forEach((track) => combinedTracks.push(track));
    hasAudio = true;
  } else if (micAudioTracks.length > 0) {
    micAudioTracks.forEach((track) => combinedTracks.push(track));
    hasAudio = true;
  }

  const combinedStream = new MediaStream(combinedTracks);
  const mimeType = pickBestRecordingMimeType();

  const screenChunks: Blob[] = [];
  const screenRecorder = new MediaRecorder(
    combinedStream,
    mimeType
      ? { mimeType, videoBitsPerSecond: 10_000_000 }
      : { videoBitsPerSecond: 10_000_000 }
  );

  screenRecorder.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) {
      screenChunks.push(ev.data);
    }
  };

  let webcamRecorder: MediaRecorder | null = null;
  const webcamChunks: Blob[] = [];
  if (webcamStream) {
    const camMime = pickBestRecordingMimeType();
    webcamRecorder = new MediaRecorder(
      webcamStream,
      camMime ? { mimeType: camMime, videoBitsPerSecond: 2_500_000 } : undefined
    );
    webcamRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        webcamChunks.push(ev.data);
      }
    };
  }

  const startedAt = performance.now();
  let stopped = false;

  const stopPromiseResolver = (): Promise<RecordingClip> =>
    new Promise((resolve) => {
      if (stopped) return;
      stopped = true;

      const finishWebcam = (): Promise<string | null> =>
        new Promise((resolveCam) => {
          if (!webcamRecorder || webcamRecorder.state === 'inactive') {
            resolveCam(null);
            return;
          }
          webcamRecorder.onstop = () => {
            if (webcamChunks.length === 0) {
              resolveCam(null);
              return;
            }
            const camBlob = new Blob(webcamChunks, {
              type: webcamRecorder?.mimeType || 'video/webm',
            });
            resolveCam(URL.createObjectURL(camBlob));
          };
          webcamRecorder.stop();
        });

      screenRecorder.onstop = async () => {
        const elapsedSec = Math.max(0.5, (performance.now() - startedAt) / 1000);
        const screenBlob = new Blob(screenChunks, {
          type: screenRecorder.mimeType || 'video/webm',
        });
        const url = URL.createObjectURL(screenBlob);
        const webcamUrl = await finishWebcam();

        // Release all hardware tracks cleanly
        displayStream.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        webcamStream?.getTracks().forEach((t) => t.stop());
        if (audioCtx && audioCtx.state !== 'closed') {
          audioCtx.close().catch(() => undefined);
        }

        const meta = await readVideoMetadata(url);
        const duration = meta.duration > 0.2 ? meta.duration : elapsedSec;

        resolve({
          id: `rec-${Date.now()}`,
          name: `Screen Recording ${new Date().toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}`,
          url,
          duration,
          width: meta.width,
          height: meta.height,
          source: 'recorded',
          webcamUrl,
          hasAudio,
        });
      };

      if (screenRecorder.state !== 'inactive') {
        screenRecorder.stop();
      } else {
        displayStream.getTracks().forEach((t) => t.stop());
        micStream?.getTracks().forEach((t) => t.stop());
        webcamStream?.getTracks().forEach((t) => t.stop());
      }
    });

  // Notify UI if the user clicks the browser's built-in "Stop sharing" button
  const primaryVideoTrack = displayStream.getVideoTracks()[0];
  if (primaryVideoTrack) {
    primaryVideoTrack.onended = () => {
      if (!stopped && onExternalStop) {
        onExternalStop();
      }
    };
  }

  screenRecorder.start(250);
  webcamRecorder?.start(250);

  return {
    screenStream: displayStream,
    webcamStream,
    stop: stopPromiseResolver,
  };
}
