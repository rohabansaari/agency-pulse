import { getOrganizationId, getToken } from "./auth";

const APP_SOURCE = "agencypulse-app";
const EXT_SOURCE = "agencypulse-extension";
const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

type BridgeAction = "ping" | "start" | "stop";

type BridgeResponse = {
  source: typeof EXT_SOURCE;
  requestId: string;
  ok: boolean;
  trackingActive?: boolean;
  error?: string;
};

function sendBridgeMessage(
  action: BridgeAction,
  payload: Record<string, unknown> = {},
  timeoutMs = 2500,
): Promise<BridgeResponse> {
  if (typeof window === "undefined") {
    return Promise.resolve({
      source: EXT_SOURCE,
      requestId: "",
      ok: false,
      error: "Unavailable outside browser.",
    });
  }

  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now());

  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      window.removeEventListener("message", onMessage);
      resolve({
        source: EXT_SOURCE,
        requestId,
        ok: false,
        error: "Extension not responding.",
      });
    }, timeoutMs);

    function onMessage(event: MessageEvent) {
      if (event.source !== window) {
        return;
      }

      const data = event.data as BridgeResponse | undefined;
      if (!data || data.source !== EXT_SOURCE || data.requestId !== requestId) {
        return;
      }

      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(data);
    }

    window.addEventListener("message", onMessage);
    window.postMessage(
      {
        source: APP_SOURCE,
        action,
        requestId,
        payload,
      },
      "*",
    );
  });
}

export async function pingScreenshotExtension(): Promise<boolean> {
  const response = await sendBridgeMessage("ping");
  return response.ok;
}

export async function startScreenshotTrackingForTimer(options: {
  timeEntryId: number;
  projectId?: number | null;
}): Promise<boolean> {
  const token = getToken();
  const organizationId = getOrganizationId();

  if (!token || !organizationId) {
    return false;
  }

  const response = await sendBridgeMessage("start", {
    apiBaseUrl: API_BASE,
    authToken: token,
    organizationId,
    projectId: options.projectId ?? null,
    timeEntryId: options.timeEntryId,
  });

  return response.ok;
}

export async function stopScreenshotTrackingForTimer(): Promise<boolean> {
  const response = await sendBridgeMessage("stop");
  return response.ok;
}
