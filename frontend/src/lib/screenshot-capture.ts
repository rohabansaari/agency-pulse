import { uploadScreenshot } from "./api";

const CAPTURE_INTERVAL_MS = 5 * 60 * 1000;

let stream: MediaStream | null = null;
let intervalId: number | null = null;
let sessionId: string | null = null;
let projectId: number | null = null;
let videoEl: HTMLVideoElement | null = null;
let sharingRevokedHandler: (() => void) | null = null;
let captureInProgress = false;

function createSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return String(Date.now());
}

export function isBrowserScreenshotCaptureActive(): boolean {
  return stream !== null;
}

export function setSharingRevokedHandler(handler: (() => void) | null): void {
  sharingRevokedHandler = handler;
}

export async function startBrowserScreenshotCapture(options: {
  projectId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return {
      ok: false,
      error: "This browser does not support screen capture.",
    };
  }

  if (stream) {
    return { ok: true };
  }

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        width: { ideal: 1920, max: 1920 },
        height: { ideal: 1080, max: 1080 },
      },
      audio: false,
      preferCurrentTab: false,
      selfBrowserSurface: "exclude",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "include",
      systemAudio: "exclude",
    } as DisplayMediaStreamOptions);

    sessionId = createSessionId();
    projectId = options.projectId ?? null;

    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      void handleSharingRevoked();
    });

    await captureAndUploadFrame();

    intervalId = window.setInterval(() => {
      void captureAndUploadFrame();
    }, CAPTURE_INTERVAL_MS);

    return { ok: true };
  } catch (error) {
    stopStream();
    sessionId = null;
    projectId = null;

    if (error instanceof DOMException && error.name === "NotAllowedError") {
      return {
        ok: false,
        error:
          'Screen sharing is required. Choose "Entire screen" in the Chrome dialog and click Share.',
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to start screen capture.",
    };
  }
}

export async function stopBrowserScreenshotCapture(): Promise<void> {
  if (intervalId !== null) {
    window.clearInterval(intervalId);
    intervalId = null;
  }

  stopStream();
  sessionId = null;
  projectId = null;
  captureInProgress = false;
}

async function handleSharingRevoked(): Promise<void> {
  await stopBrowserScreenshotCapture();
  sharingRevokedHandler?.();
}

function stopStream(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;

  if (videoEl) {
    videoEl.srcObject = null;
  }
}

function getVideoElement(): HTMLVideoElement {
  if (!videoEl) {
    videoEl = document.createElement("video");
    videoEl.muted = true;
    videoEl.playsInline = true;
  }

  return videoEl;
}

async function captureAndUploadFrame(): Promise<void> {
  if (!stream || !sessionId || captureInProgress) {
    return;
  }

  captureInProgress = true;

  try {
    const video = getVideoElement();
    video.srcObject = stream;

    await new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        reject(new Error("Screen capture timed out."));
      }, 15000);

      video.onloadedmetadata = () => {
        window.clearTimeout(timeout);
        video
          .play()
          .then(() => resolve())
          .catch(reject);
      };
      video.onerror = () => {
        window.clearTimeout(timeout);
        reject(new Error("Unable to read shared screen."));
      };
    });

    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    const canvas = document.createElement("canvas");
    const maxWidth = 1600;
    const scale = Math.min(1, maxWidth / Math.max(video.videoWidth, 1));
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const image = canvas.toDataURL("image/jpeg", 0.6);

    await uploadScreenshotWithRetry({
      image,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      project_id: projectId,
    });
  } catch {
    // Keep the timer running; the next interval will retry capture.
  } finally {
    captureInProgress = false;
  }
}

async function uploadScreenshotWithRetry(
  payload: Parameters<typeof uploadScreenshot>[0],
  attempt = 1,
): Promise<void> {
  try {
    await uploadScreenshot(payload);
  } catch {
    if (attempt >= 3) {
      return;
    }

    await new Promise((resolve) => window.setTimeout(resolve, 1500 * attempt));
    await uploadScreenshotWithRetry(payload, attempt + 1);
  }
}
