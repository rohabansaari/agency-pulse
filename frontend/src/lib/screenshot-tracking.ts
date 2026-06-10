import {
  pingScreenshotExtension,
  startScreenshotTrackingForTimer as startExtensionTracking,
  stopScreenshotTrackingForTimer as stopExtensionTracking,
} from "./screenshot-bridge";
import {
  isBrowserScreenshotCaptureActive,
  startBrowserScreenshotCapture,
  stopBrowserScreenshotCapture,
} from "./screenshot-capture";

export type ScreenshotTrackingMode = "extension" | "browser" | "none";

export async function startScreenshotTrackingForTimer(options: {
  timeEntryId?: number | null;
  projectId?: number | null;
  preferBrowserFirst?: boolean;
}): Promise<{ ok: boolean; mode: ScreenshotTrackingMode; error?: string }> {
  const hasExtension = await pingScreenshotExtension();

  if (hasExtension && options.timeEntryId) {
    const ok = await startExtensionTracking({
      timeEntryId: options.timeEntryId,
      projectId: options.projectId,
    });

    return {
      ok,
      mode: ok ? "extension" : "none",
      error: ok ? undefined : "Chrome extension did not start screenshot tracking.",
    };
  }

  if (hasExtension) {
    return { ok: true, mode: "none" };
  }

  if (isBrowserScreenshotCaptureActive()) {
    return { ok: true, mode: "browser" };
  }

  const browser = await startBrowserScreenshotCapture({
    projectId: options.projectId,
  });

  return {
    ok: browser.ok,
    mode: browser.ok ? "browser" : "none",
    error: browser.error,
  };
}

export async function stopScreenshotTracking(): Promise<void> {
  await stopExtensionTracking();
  await stopBrowserScreenshotCapture();
}

export async function resumeExtensionTrackingForTimer(options: {
  timeEntryId: number;
  projectId?: number | null;
}): Promise<void> {
  const hasExtension = await pingScreenshotExtension();
  if (!hasExtension) {
    return;
  }

  await startExtensionTracking(options);
}
