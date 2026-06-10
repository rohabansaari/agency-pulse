import { uploadScreenshot } from "./api";

const CAPTURE_INTERVAL_MS = 5 * 60 * 1000;

let stream: MediaStream | null = null;
let intervalId: number | null = null;
let sessionId: string | null = null;
let projectId: number | null = null;

function createSessionId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return String(Date.now());
}

export function isBrowserScreenshotCaptureActive(): boolean {
  return stream !== null;
}

export async function startBrowserScreenshotCapture(options: {
  projectId?: number | null;
}): Promise<{ ok: boolean; error?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getDisplayMedia) {
    return {
      ok: false,
      error: "This browser does not support tab screenshot capture.",
    };
  }

  if (stream) {
    return { ok: true };
  }

  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        displaySurface: "browser",
      },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: "include",
      surfaceSwitching: "exclude",
      monitorTypeSurfaces: "exclude",
    } as DisplayMediaStreamOptions);

    sessionId = createSessionId();
    projectId = options.projectId ?? null;

    const track = stream.getVideoTracks()[0];
    track.addEventListener("ended", () => {
      void stopBrowserScreenshotCapture();
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
        error: "Tab sharing was declined. Choose “This tab” or “Share” to enable screenshots.",
      };
    }

    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unable to start tab capture.",
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
}

function stopStream(): void {
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
}

async function captureAndUploadFrame(): Promise<void> {
  if (!stream || !sessionId) {
    return;
  }

  const video = document.createElement("video");
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => {
      video
        .play()
        .then(() => resolve())
        .catch(reject);
    };
    video.onerror = () => reject(new Error("Unable to read shared tab video."));
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
    video.srcObject = null;
    return;
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  video.srcObject = null;

  const image = canvas.toDataURL("image/jpeg", 0.65);

  try {
    await uploadScreenshot({
      image,
      timestamp: new Date().toISOString(),
      session_id: sessionId,
      project_id: projectId,
    });
  } catch {
    // Timer keeps running even if one upload fails.
  }
}
